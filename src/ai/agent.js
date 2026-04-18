// AI 智能体主循环：定时截屏 → 调 API → 广播给渲染 + 驱动桌宠移动
const { captureScreen } = require('../main/capture');
const { send } = require('./adapter');
const { buildSystemPrompt, parseAIResponse } = require('./prompt');
const { getConfig } = require('../config/store');
const movement = require('../main/movement');

let firstTickTimeout = null;
let intervalHandle = null;
let running = false;
let consecutiveErrors = 0;

function getPetWin() {
  const { getPetWindow } = require('../main/window');
  return getPetWindow();
}

function broadcast(channel, payload) {
  const win = getPetWin();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

async function runOnce({ userText = null, skipImage = false } = {}) {
  const cfg = getConfig();
  if (!cfg.ai?.apiKey) {
    broadcast('ai:tick-event', {
      emotion: 'think',
      action: 'idle',
      speech: '先去设置里填 API key 吧～',
      duration: 5,
    });
    return null;
  }

  let imageBase64 = null;
  if (!skipImage && cfg.capture?.autoCapture !== false) {
    try {
      const shot = await captureScreen({
        excludeSelf: cfg.capture?.excludeSelf !== false,
      });
      imageBase64 = shot.base64;
    } catch (err) {
      console.warn('[agent] capture failed:', err.message);
    }
  }

  try {
    const { text } = await send({
      systemPrompt: buildSystemPrompt(cfg.ai.systemPrompt),
      userText,
      imageBase64,
      config: cfg.ai,
    });
    consecutiveErrors = 0;
    const parsed = parseAIResponse(text);
    broadcast('ai:tick-event', parsed);
    // 执行移动指令（AI 决定桌宠去哪）
    if (parsed.move && parsed.move !== 'stay') {
      movement.moveTo(parsed.move);
    }
    return parsed;
  } catch (err) {
    consecutiveErrors += 1;
    console.error('[agent] API error:', err.message);
    if (consecutiveErrors >= 3 && running) {
      stopAgent();
      broadcast('ai:tick-event', {
        emotion: 'angry',
        action: 'idle',
        speech: `连不上网了，我先歇会儿。${(err.message || '').slice(0, 15)}`,
        duration: 6,
      });
    } else {
      broadcast('ai:tick-event', {
        emotion: 'think',
        action: 'idle',
        speech: '我走神了...',
        duration: 3,
      });
    }
    return null;
  }
}

function startAgent() {
  if (running) return;
  const cfg = getConfig();
  const intervalMs = Math.max(10, Number(cfg.capture?.intervalSec) || 60) * 1000;
  running = true;
  consecutiveErrors = 0;

  // 首次延迟 5 秒，让用户先看见桌宠/不会启动就唠叨
  firstTickTimeout = setTimeout(() => {
    firstTickTimeout = null;
    if (!running) return;
    runOnce();
    intervalHandle = setInterval(() => {
      if (!running) return;
      runOnce();
    }, intervalMs);
  }, 5000);
}

function stopAgent() {
  running = false;
  if (firstTickTimeout) {
    clearTimeout(firstTickTimeout);
    firstTickTimeout = null;
  }
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

function isAgentRunning() {
  return running;
}

async function triggerManualChat(payload = {}) {
  return runOnce({
    userText: payload.userText || '用户戳了你一下，说点有趣的吧',
    skipImage: payload.skipImage || false,
  });
}

module.exports = {
  startAgent,
  stopAgent,
  isAgentRunning,
  triggerManualChat,
  runOnce,
};

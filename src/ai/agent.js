// 优化版 agent.js：提高错误容错阈值 + 智能降级 + AI 流程并行化
const { captureScreen } = require('../main/capture');
const { send } = require('./adapter');
const { buildSystemPrompt, parseAIResponse } = require('./prompt');
const { getConfig } = require('../config/store');
const movement = require('../main/movement');

let firstTickTimeout = null;
let intervalHandle = null;
let running = false;
let consecutiveErrors = 0;
let totalTicks = 0;
let successfulTicks = 0;

// 优化：AI 流程并行化 - 缓存上一帧截图
let lastScreenshot = null; // { base64: string, ts: number, cached: boolean }
let screenshotInProgress = false;

// 优化：提高错误容错阈值，从 3 次提升到 5 次
const ERROR_THRESHOLD = 5;
// 优化：添加成功率监控，低于 30% 时才停止
const MIN_SUCCESS_RATE = 0.3;

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

// 优化：后台预截图（不阻塞 AI 调用）
async function backgroundCapture() {
  if (screenshotInProgress) return;
  screenshotInProgress = true;
  try {
    const cfg = getConfig();
    await movement.ensureOnPrimary();
    const shot = await captureScreen({
      excludeSelf: cfg.capture?.excludeSelf !== false,
    });
    lastScreenshot = {
      base64: shot.base64,
      ts: shot.ts,
      cached: shot.cached || false,
      format: shot.format || 'png',
    };
  } catch (err) {
    console.warn('[agent] background capture failed:', err.message);
  } finally {
    screenshotInProgress = false;
  }
}

async function runOnce({ userText = null, skipImage = false, useLastScreenshot = true } = {}) {
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

  totalTicks += 1;

  // 优化：AI 流程并行化
  // 1. 如果有上一帧截图且未过期（< 90 秒），直接使用
  // 2. 同时启动后台截图为下次准备
  let imageBase64 = null;
  if (!skipImage && cfg.capture?.autoCapture !== false) {
    const screenshotMaxAge = cfg.capture?.screenshotMaxAgeSec || 90;
    const now = Date.now();

    if (useLastScreenshot && lastScreenshot && (now - lastScreenshot.ts) < screenshotMaxAge * 1000) {
      // 使用缓存的截图（可能是上一帧）
      imageBase64 = lastScreenshot.base64;
      // 后台启动下一帧截图（不阻塞当前 AI 调用）
      backgroundCapture().catch(() => {});
    } else {
      // 首次或截图过期，同步截图
      try {
        await movement.ensureOnPrimary();
        const shot = await captureScreen({
          excludeSelf: cfg.capture?.excludeSelf !== false,
        });
        imageBase64 = shot.base64;
        lastScreenshot = {
          base64: shot.base64,
          ts: shot.ts,
          cached: shot.cached || false,
          format: shot.format || 'png',
        };
      } catch (err) {
        console.warn('[agent] capture failed:', err.message);
      }
    }
  }

  try {
    const { text } = await send({
      systemPrompt: buildSystemPrompt(cfg.ai.systemPrompt),
      userText,
      imageBase64,
      config: cfg.ai,
    });

    // 成功：重置错误计数，增加成功计数
    consecutiveErrors = 0;
    successfulTicks += 1;

    const parsed = parseAIResponse(text);
    broadcast('ai:tick-event', parsed);

    if (parsed.move && parsed.move !== 'stay') {
      movement.moveTo(parsed.move);
    }
    return parsed;
  } catch (err) {
    consecutiveErrors += 1;
    console.error('[agent] API error:', err.message);

    // 优化：智能降级策略
    const successRate = totalTicks > 0 ? successfulTicks / totalTicks : 1;
    const shouldStop = consecutiveErrors >= ERROR_THRESHOLD && successRate < MIN_SUCCESS_RATE;

    if (shouldStop && running) {
      stopAgent();
      broadcast('ai:tick-event', {
        emotion: 'angry',
        action: 'idle',
        speech: `网络太差了，我先休息。成功率 ${(successRate * 100).toFixed(0)}%`,
        duration: 6,
      });
    } else {
      // 优化：根据错误次数调整反馈
      const speeches = [
        '我走神了...',
        '网络有点卡...',
        '再试试...',
        '连接不太稳定...',
        '快撑不住了...',
      ];
      const speech = speeches[Math.min(consecutiveErrors - 1, speeches.length - 1)];

      broadcast('ai:tick-event', {
        emotion: consecutiveErrors >= 3 ? 'sleepy' : 'think',
        action: 'idle',
        speech,
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
  totalTicks = 0;
  successfulTicks = 0;

  // 优化：首次延迟可配置，默认 5 秒
  const firstTickDelay = Math.max(0, Number(cfg.ai?.firstTickDelaySec) || 5) * 1000;

  firstTickTimeout = setTimeout(() => {
    firstTickTimeout = null;
    if (!running) return;
    runOnce();
    intervalHandle = setInterval(() => {
      if (!running) return;
      runOnce();
    }, intervalMs);
  }, firstTickDelay);
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

// 优化：添加统计信息获取
function getAgentStats() {
  return {
    running,
    totalTicks,
    successfulTicks,
    consecutiveErrors,
    successRate: totalTicks > 0 ? successfulTicks / totalTicks : 0,
  };
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
  getAgentStats,
};

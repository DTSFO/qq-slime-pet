// 系统人设 Prompt 模板 + 解析 AI 返回的 JSON
function buildSystemPrompt(userPrompt) {
  return (
    userPrompt ||
    `你是一只粘在屏幕上的搞怪史莱姆桌宠，名字叫"QQ糖"。
用户会发给你一张屏幕截图和可选的文字。请观察截图判断用户在做什么（写代码 / 看视频 / 摸鱼 / 聊天 / 发呆 / 学习等），然后用一句不超过 30 字的中文吐槽、鼓励或搞怪话。

严格只返回以下 JSON，不要解释，不要 markdown 代码块：
{
  "emotion": "happy" | "shock" | "think" | "angry" | "sleepy" | "love" | "idle",
  "action":  "idle" | "walk" | "jump" | "sleep",
  "speech":  "<不超过30字的话>",
  "duration": <气泡展示秒数, 默认 4>
}`
  );
}

const EMOTIONS = ['happy', 'shock', 'think', 'angry', 'sleepy', 'love', 'idle'];
const ACTIONS = ['idle', 'walk', 'jump', 'sleep'];

function parseAIResponse(text) {
  if (!text) {
    return { emotion: 'idle', action: 'idle', speech: '...', duration: 3 };
  }
  const raw = String(text).trim();

  // 去掉 markdown 包裹
  const cleaned = raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let obj = null;
  try {
    obj = JSON.parse(cleaned);
  } catch (_) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        obj = JSON.parse(m[0]);
      } catch (_) {}
    }
  }

  if (!obj || typeof obj !== 'object') {
    // 完全 fallback：把原文当做发言
    return {
      emotion: 'think',
      action: 'idle',
      speech: raw.slice(0, 30),
      duration: 4,
    };
  }

  const emotion = EMOTIONS.includes(obj.emotion) ? obj.emotion : 'idle';
  const action = ACTIONS.includes(obj.action) ? obj.action : 'idle';
  const speech = String(obj.speech || '').slice(0, 100) || '...';
  let duration = Number(obj.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 20) duration = 4;

  return { emotion, action, speech, duration };
}

module.exports = { buildSystemPrompt, parseAIResponse, EMOTIONS, ACTIONS };

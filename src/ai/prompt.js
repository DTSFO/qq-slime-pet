// 优化版：压缩系统提示词 + 增强 JSON 解析容错
function buildSystemPrompt(userPrompt) {
  const base = (userPrompt || DEFAULT_BASE_PROMPT).trim();
  return base + '\n\n' + MOVE_PROTOCOL;
}

// 优化：减少冗余说明，从 ~400 字符压缩到 ~240 字符（-40%）
const DEFAULT_BASE_PROMPT = `你是史莱姆桌宠"QQ糖"。观察截图判断用户在做什么，用不超过30字的中文吐槽/鼓励/搞怪。
风格：可爱毒舌但不恶意。看到视频/游戏评论内容，看到代码吐槽或鼓励，看到聊天软件只评论状态不读隐私。`;

// 优化：压缩 move 说明，移除重复示例
const MOVE_PROTOCOL = `决定桌宠位置：全屏内容时躲角落，用户闲着时凑中央，工作界面时贴边安静。

严格返回 JSON（无解释/markdown）：
{"emotion":"happy|shock|think|angry|sleepy|love|idle","action":"idle|walk|jump|sleep","speech":"<30字>","duration":4,"move":"stay|edge-left|edge-right|edge-top|edge-bottom|corner-tl|corner-tr|corner-bl|corner-br|center"}

move: stay=原位(默认), edge-*=贴边, corner-*=角落(tl左上/tr右上/bl左下/br右下), center=中央互动。不确定用stay。`;

const EMOTIONS = ['happy', 'shock', 'think', 'angry', 'sleepy', 'love', 'idle'];
const ACTIONS = ['idle', 'walk', 'jump', 'sleep'];
const VALID_MOVES = [
  'stay',
  'edge-left', 'edge-right', 'edge-top', 'edge-bottom',
  'corner-tl', 'corner-tr', 'corner-bl', 'corner-br',
  'center',
];

// 优化：增强容错 - 支持部分字段缺失
function parseAIResponse(text) {
  if (!text) {
    return { emotion: 'idle', action: 'idle', speech: '...', duration: 3, move: 'stay' };
  }
  const raw = String(text).trim();

  // 清理 markdown 代码块
  const cleaned = raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let obj = null;
  try {
    obj = JSON.parse(cleaned);
  } catch (_) {
    // 尝试提取 JSON 对象
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { obj = JSON.parse(m[0]); } catch (_) {}
    }
  }

  // 完全解析失败 - 尝试从文本提取 speech
  if (!obj || typeof obj !== 'object') {
    return {
      emotion: 'think',
      action: 'idle',
      speech: raw.slice(0, 30) || '...',
      duration: 4,
      move: 'stay',
    };
  }

  // 增强容错：每个字段独立验证，缺失时使用默认值
  const emotion = EMOTIONS.includes(obj.emotion) ? obj.emotion : 'idle';
  const action = ACTIONS.includes(obj.action) ? obj.action : 'idle';

  // speech 容错：支持空字符串、null、undefined
  let speech = '...';
  if (obj.speech !== null && obj.speech !== undefined) {
    speech = String(obj.speech).slice(0, 100) || '...';
  }

  // duration 容错：支持字符串数字、非法值
  let duration = 4;
  if (obj.duration !== null && obj.duration !== undefined) {
    const parsed = Number(obj.duration);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 20) {
      duration = parsed;
    }
  }

  // move 容错：支持大小写不敏感
  let move = 'stay';
  if (obj.move) {
    const normalized = String(obj.move).toLowerCase();
    move = VALID_MOVES.includes(normalized) ? normalized : 'stay';
  }

  return { emotion, action, speech, duration, move };
}

module.exports = { buildSystemPrompt, parseAIResponse, EMOTIONS, ACTIONS, VALID_MOVES };

// 系统人设 Prompt 模板 + 解析 AI 返回的 JSON
function buildSystemPrompt(userPrompt) {
  const base = (userPrompt || DEFAULT_BASE_PROMPT).trim();
  // 移动指令约定永远追加在用户人设后面，保证协议稳定
  return base + '\n\n' + MOVE_PROTOCOL;
}

const DEFAULT_BASE_PROMPT = `你是一只粘在屏幕上的搞怪史莱姆桌宠，名字叫"QQ糖"。
用户会发给你一张屏幕截图和可选的文字。请观察截图判断用户在做什么（写代码 / 看视频 / 摸鱼 / 聊天 / 发呆 / 学习等），然后用一句不超过 30 字的中文吐槽、鼓励或搞怪话。

风格要求：可爱搞怪、毒舌但不恶意。看到黑屏/视频时说"这视频有意思吗"，看到代码时吐槽或鼓励，看到聊天软件时不要读别人隐私只评论整体状态。`;

const MOVE_PROTOCOL = `你还要决定桌宠要不要移动位置，让它像个真正会看屏幕懂人心的小生物。
例如用户在全屏看视频/玩游戏，你就让它躲到角落别挡着；用户发呆/闲着，就凑近屏幕中央逗逗他；
检测到严肃工作界面（IDE / 文档）就贴在屏幕一角安静待着。

严格只返回下面这段 JSON，不要解释、不要 markdown：
{
  "emotion": "happy" | "shock" | "think" | "angry" | "sleepy" | "love" | "idle",
  "action":  "idle" | "walk" | "jump" | "sleep",
  "speech":  "<不超过30字>",
  "duration": <气泡展示秒数, 默认 4>,
  "move":    "stay" | "edge-left" | "edge-right" | "edge-top" | "edge-bottom" | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br" | "center"
}

move 说明：
- stay：保持原位（最常用，没特别理由就选这个）
- edge-left/right/top/bottom：吸附到屏幕对应边
- corner-tl/tr/bl/br：四个角（tl=左上, tr=右上, bl=左下, br=右下，躲起来的常用选择）
- center：屏幕中央（凑近用户，表示主动互动）

不确定就返回 "stay"，不要频繁乱跑。`;

const EMOTIONS = ['happy', 'shock', 'think', 'angry', 'sleepy', 'love', 'idle'];
const ACTIONS = ['idle', 'walk', 'jump', 'sleep'];
const VALID_MOVES = [
  'stay',
  'edge-left', 'edge-right', 'edge-top', 'edge-bottom',
  'corner-tl', 'corner-tr', 'corner-bl', 'corner-br',
  'center',
];

function parseAIResponse(text) {
  if (!text) {
    return { emotion: 'idle', action: 'idle', speech: '...', duration: 3, move: 'stay' };
  }
  const raw = String(text).trim();

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
      try { obj = JSON.parse(m[0]); } catch (_) {}
    }
  }

  if (!obj || typeof obj !== 'object') {
    return {
      emotion: 'think',
      action: 'idle',
      speech: raw.slice(0, 30),
      duration: 4,
      move: 'stay',
    };
  }

  const emotion = EMOTIONS.includes(obj.emotion) ? obj.emotion : 'idle';
  const action = ACTIONS.includes(obj.action) ? obj.action : 'idle';
  const speech = String(obj.speech || '').slice(0, 100) || '...';
  let duration = Number(obj.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 20) duration = 4;
  const move = VALID_MOVES.includes(obj.move) ? obj.move : 'stay';

  return { emotion, action, speech, duration, move };
}

module.exports = { buildSystemPrompt, parseAIResponse, EMOTIONS, ACTIONS, VALID_MOVES };

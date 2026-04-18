// 配置持久化封装：electron-store，区分公开字段和敏感字段
let Store;
try {
  Store = require('electron-store');
} catch (e) {
  // 回退为内存存储，防止依赖未装时整体崩溃
  Store = class InMemoryStore {
    constructor(opts) {
      this._data = JSON.parse(JSON.stringify(opts?.defaults || {}));
    }
    get store() {
      return this._data;
    }
    set(pathOrObj, value) {
      if (typeof pathOrObj === 'string') {
        const keys = pathOrObj.split('.');
        let o = this._data;
        for (let i = 0; i < keys.length - 1; i++) {
          if (o[keys[i]] == null) o[keys[i]] = {};
          o = o[keys[i]];
        }
        o[keys[keys.length - 1]] = value;
      } else {
        Object.assign(this._data, pathOrObj);
      }
    }
    get(p) {
      const keys = p.split('.');
      let o = this._data;
      for (const k of keys) {
        if (o == null) return undefined;
        o = o[k];
      }
      return o;
    }
  };
}

const DEFAULTS = {
  ai: {
    enabled: true,
    protocol: 'messages', // 'messages' | 'chat' | 'responses'
    endpoint: 'https://api.anthropic.com',
    apiKey: '',
    model: 'claude-sonnet-4-6',
    temperature: 0.8,
    maxTokens: 512,
    systemPrompt: `你是一只粘在屏幕上的搞怪史莱姆桌宠，名字叫"QQ糖"。
用户会发给你一张屏幕截图和可选的文字。请观察截图判断用户在做什么（写代码 / 看视频 / 摸鱼 / 聊天 / 发呆 / 学习等），然后用一句不超过 30 字的中文吐槽、鼓励或搞怪话。

严格只返回以下 JSON，不要解释，不要 markdown 代码块：
{
  "emotion": "happy" | "shock" | "think" | "angry" | "sleepy" | "love" | "idle",
  "action":  "idle" | "walk" | "jump" | "sleep",
  "speech":  "<不超过30字的话>",
  "duration": <气泡展示秒数, 默认 4>
}

风格要求：
- 可爱搞怪、毒舌但不恶意
- 偶尔卖萌、偶尔鼓励
- 看到黑屏/视频时可以说"这视频有意思吗"
- 看到代码时可以吐槽或鼓励
- 看到聊天软件时不要读别人隐私，只评论整体状态`,
  },
  capture: {
    intervalSec: 60,
    autoCapture: true,
    excludeSelf: true,
    maxWidth: 1280,
  },
  pet: {
    size: 220,
    alwaysOnTop: true,
    startAtLogin: false,
    position: { x: null, y: null },
    bubbleDuration: 4,
    petName: 'QQ糖',
  },
  debug: { logApiCalls: false },
};

const store = new Store({
  name: 'config',
  defaults: DEFAULTS,
});

function getConfig() {
  return store.store;
}

function deepMerge(target, src) {
  for (const k of Object.keys(src || {})) {
    if (
      src[k] &&
      typeof src[k] === 'object' &&
      !Array.isArray(src[k]) &&
      target[k] &&
      typeof target[k] === 'object'
    ) {
      deepMerge(target[k], src[k]);
    } else {
      target[k] = src[k];
    }
  }
  return target;
}

function setConfig(partial) {
  const current = store.store;
  const merged = deepMerge(JSON.parse(JSON.stringify(current)), partial);
  for (const topKey of Object.keys(merged)) {
    store.set(topKey, merged[topKey]);
  }
  return store.store;
}

// 给渲染进程的脱敏版本：apiKey 只报"是否配置"
function getPublicConfig() {
  const cfg = JSON.parse(JSON.stringify(store.store));
  if (cfg.ai) {
    cfg.ai.hasApiKey = !!cfg.ai.apiKey;
    delete cfg.ai.apiKey;
  }
  return cfg;
}

module.exports = { getConfig, setConfig, getPublicConfig, DEFAULTS };

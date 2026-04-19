// 优化版 adapter.js：添加指数退避重试机制
const { net } = require('electron');
const messagesProtocol = require('./protocol-messages');
const chatProtocol = require('./protocol-chat');
const responsesProtocol = require('./protocol-responses');

// 指数退避重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * 指数退避重试包装器
 * @param {Function} fn 要重试的异步函数
 * @param {Object} options 重试配置
 * @returns {Promise<any>}
 */
async function withRetry(fn, options = {}) {
  const config = { ...RETRY_CONFIG, ...options };
  let lastError = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 最后一次尝试失败，直接抛出
      if (attempt === config.maxRetries) {
        break;
      }

      // 判断是否应该重试
      const shouldRetry =
        error.status && config.retryableStatusCodes.includes(error.status) ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('timeout') ||
        error.message?.includes('network');

      if (!shouldRetry) {
        throw error;
      }

      // 计算退避延迟
      const delay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs
      );

      console.warn(`[adapter] 重试 ${attempt + 1}/${config.maxRetries}，${delay}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * @param {Object} params
 * @param {string} params.systemPrompt
 * @param {string} [params.userText]
 * @param {string} [params.imageBase64]
 * @param {Object} params.config
 * @returns {Promise<{ text: string, raw: any }>}
 */
async function send(params) {
  const { config } = params;
  if (!config || !config.apiKey) {
    throw new Error('未配置 API key，请先在设置里填写');
  }

  // 使用重试机制包装 API 调用
  return withRetry(async () => {
    switch ((config.protocol || 'messages').toLowerCase()) {
      case 'messages':
        return messagesProtocol.send(params);
      case 'chat':
        return chatProtocol.send(params);
      case 'responses':
        return responsesProtocol.send(params);
      default:
        throw new Error(`未知的 API 协议：${config.protocol}`);
    }
  });
}

/* ============================================================
   模型列表拉取
   ============================================================ */

function defaultEndpointFor(protocol) {
  if (protocol === 'messages') return 'https://api.anthropic.com';
  return 'https://api.openai.com';
}

function headersFor(cfg) {
  const protocol = (cfg.protocol || 'messages').toLowerCase();
  if (protocol === 'messages') {
    return {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }
  return {
    Authorization: `Bearer ${cfg.apiKey}`,
    'content-type': 'application/json',
  };
}

function getJson({ url, headers, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'GET', url });
    for (const [k, v] of Object.entries(headers || {})) req.setHeader(k, v);
    const chunks = [];
    const timer = setTimeout(() => {
      try { req.abort(); } catch (_) {}
      reject(Object.assign(new Error('请求超时'), { code: 'ETIMEDOUT' }));
    }, timeoutMs);
    req.on('response', (res) => {
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        clearTimeout(timer);
        const text = Buffer.concat(chunks).toString('utf8');
        let json;
        try { json = JSON.parse(text); } catch (_) { json = { _raw: text }; }
        if (res.statusCode >= 400) {
          const msg = json?.error?.message || json?.message || `HTTP ${res.statusCode}`;
          reject(Object.assign(new Error(msg), { status: res.statusCode, body: json }));
        } else {
          resolve(json);
        }
      });
      res.on('error', (e) => { clearTimeout(timer); reject(e); });
    });
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.end();
  });
}

function extractModelIds(raw) {
  if (Array.isArray(raw?.data)) {
    return raw.data.map((m) => m?.id || m?.name).filter(Boolean);
  }
  if (Array.isArray(raw?.models)) {
    return raw.models.map((m) => m?.id || m?.name).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.map((m) => (typeof m === 'string' ? m : m?.id || m?.name)).filter(Boolean);
  }
  return [];
}

async function listModels(cfg) {
  if (!cfg || !cfg.apiKey) {
    throw new Error('需要 API key 才能拉取模型列表');
  }

  // 使用重试机制包装模型列表请求
  return withRetry(async () => {
    const endpoint = (cfg.endpoint || defaultEndpointFor(cfg.protocol)).replace(/\/+$/, '');
    const url = `${endpoint}/v1/models`;
    const headers = headersFor(cfg);
    const raw = await getJson({ url, headers });
    const ids = extractModelIds(raw);

    const unique = Array.from(new Set(ids));
    const priority = (id) => {
      const s = String(id).toLowerCase();
      if (s.includes('vision') || s.includes('4o') || s.includes('sonnet')
          || s.includes('opus') || s.includes('gpt-4') || s.includes('claude'))
        return 0;
      return 1;
    };
    unique.sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
    return unique;
  }, { maxRetries: 2 }); // 模型列表请求重试次数较少
}

module.exports = { send, listModels, withRetry };

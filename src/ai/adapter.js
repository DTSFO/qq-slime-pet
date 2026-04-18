// 三协议统一入口：根据 config.protocol 分派
const { net } = require('electron');
const messagesProtocol = require('./protocol-messages');
const chatProtocol = require('./protocol-chat');
const responsesProtocol = require('./protocol-responses');

/**
 * @param {Object} params
 * @param {string} params.systemPrompt
 * @param {string} [params.userText]
 * @param {string} [params.imageBase64]    // PNG base64, 不含 data: 前缀
 * @param {Object} params.config           // { protocol, endpoint, apiKey, model, temperature, maxTokens }
 * @returns {Promise<{ text: string, raw: any }>}
 */
async function send(params) {
  const { config } = params;
  if (!config || !config.apiKey) {
    throw new Error('未配置 API key，请先在设置里填写');
  }
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
}

/* ============================================================
   模型列表拉取 —— GET {endpoint}/v1/models
   - Anthropic: headers x-api-key + anthropic-version
   - OpenAI (chat/responses): headers Authorization Bearer
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
      reject(new Error('请求超时'));
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

/** 从各种形状的响应中提取模型 id 列表 */
function extractModelIds(raw) {
  // OpenAI / Anthropic / 大部分代理：{ data: [{id, ...}] }
  if (Array.isArray(raw?.data)) {
    return raw.data.map((m) => m?.id || m?.name).filter(Boolean);
  }
  // 某些代理：{ models: [...] }
  if (Array.isArray(raw?.models)) {
    return raw.models.map((m) => m?.id || m?.name).filter(Boolean);
  }
  // Ollama：{ models: [{name,...}] }（已被上面覆盖）/ 直接数组
  if (Array.isArray(raw)) {
    return raw.map((m) => (typeof m === 'string' ? m : m?.id || m?.name)).filter(Boolean);
  }
  return [];
}

/**
 * 拉模型列表
 * @param {Object} cfg { protocol, endpoint, apiKey }
 * @returns {Promise<string[]>} 模型 id 数组
 */
async function listModels(cfg) {
  if (!cfg || !cfg.apiKey) {
    throw new Error('需要 API key 才能拉取模型列表');
  }
  const endpoint = (cfg.endpoint || defaultEndpointFor(cfg.protocol)).replace(/\/+$/, '');
  const url = `${endpoint}/v1/models`;
  const headers = headersFor(cfg);
  const raw = await getJson({ url, headers });
  const ids = extractModelIds(raw);
  // 去重 + 排序（字母序，同时把带 vision / 4o / sonnet / opus / gpt-4 关键字的放前面）
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
}

module.exports = { send, listModels };


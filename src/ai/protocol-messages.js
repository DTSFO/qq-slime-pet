// Anthropic Messages API 适配：POST {endpoint}/v1/messages
const { net } = require('electron');

function postJson({ url, headers, body, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'POST', url });
    for (const [k, v] of Object.entries(headers || {})) req.setHeader(k, v);

    const chunks = [];
    const timer = setTimeout(() => {
      try {
        req.abort();
      } catch (_) {}
      reject(new Error('请求超时'));
    }, timeoutMs);

    req.on('response', (res) => {
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        clearTimeout(timer);
        const text = Buffer.concat(chunks).toString('utf8');
        let json;
        try {
          json = JSON.parse(text);
        } catch (_) {
          json = { _raw: text };
        }
        if (res.statusCode >= 400) {
          const msg =
            json?.error?.message ||
            json?.message ||
            `HTTP ${res.statusCode}`;
          reject(Object.assign(new Error(msg), { status: res.statusCode, body: json }));
        } else {
          resolve(json);
        }
      });
      res.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    req.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function send({ systemPrompt, userText, imageBase64, config }) {
  const endpoint = (config.endpoint || 'https://api.anthropic.com').replace(/\/+$/, '');
  const url = `${endpoint}/v1/messages`;
  const content = [];
  if (imageBase64) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: imageBase64,
      },
    });
  }
  content.push({
    type: 'text',
    text: userText || '请观察屏幕并给出反应。',
  });

  const body = {
    model: config.model,
    max_tokens: Math.max(64, Math.min(4096, config.maxTokens || 512)),
    temperature: config.temperature ?? 0.8,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  };

  const headers = {
    'content-type': 'application/json',
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };

  const raw = await postJson({ url, headers, body, timeoutMs: 30000 });
  const text = Array.isArray(raw.content)
    ? raw.content
        .filter((c) => c && c.type === 'text')
        .map((c) => c.text)
        .join('')
    : '';
  return { text, raw };
}

module.exports = { send };

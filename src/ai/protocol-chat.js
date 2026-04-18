// OpenAI Chat Completions 兼容协议：POST {endpoint}/v1/chat/completions
const { net } = require('electron');

function postJson({ url, headers, body, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'POST', url });
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
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function send({ systemPrompt, userText, imageBase64, config }) {
  const endpoint = (config.endpoint || 'https://api.openai.com').replace(/\/+$/, '');
  const url = `${endpoint}/v1/chat/completions`;

  const userContent = [];
  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${imageBase64}` },
    });
  }
  userContent.push({
    type: 'text',
    text: userText || '请观察屏幕并给出反应。',
  });

  const body = {
    model: config.model,
    temperature: config.temperature ?? 0.8,
    max_tokens: Math.max(64, Math.min(4096, config.maxTokens || 512)),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  };

  const headers = {
    'content-type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  const raw = await postJson({ url, headers, body, timeoutMs: 30000 });
  const msg = raw?.choices?.[0]?.message?.content;
  let text = '';
  if (typeof msg === 'string') {
    text = msg;
  } else if (Array.isArray(msg)) {
    text = msg.filter((p) => p && p.type === 'text').map((p) => p.text).join('');
  }
  return { text, raw };
}

module.exports = { send };

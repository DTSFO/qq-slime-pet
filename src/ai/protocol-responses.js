// OpenAI Responses API 协议：POST {endpoint}/v1/responses
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

function extractOutputText(raw) {
  if (!raw) return '';
  if (typeof raw.output_text === 'string' && raw.output_text) return raw.output_text;

  // 扫 raw.output[*].content[*]
  if (Array.isArray(raw.output)) {
    const texts = [];
    for (const item of raw.output) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c === 'string') texts.push(c);
          else if (c && typeof c.text === 'string') texts.push(c.text);
          else if (c?.type === 'output_text' && c.text) texts.push(c.text);
        }
      }
    }
    if (texts.length) return texts.join('');
  }
  // 兼容某些代理返回 choices 结构
  if (raw?.choices?.[0]?.message?.content) {
    const c = raw.choices[0].message.content;
    if (typeof c === 'string') return c;
  }
  return '';
}

async function send({ systemPrompt, userText, imageBase64, config }) {
  const endpoint = (config.endpoint || 'https://api.openai.com').replace(/\/+$/, '');
  const url = `${endpoint}/v1/responses`;

  const userContent = [];
  if (imageBase64) {
    userContent.push({
      type: 'input_image',
      image_url: `data:image/png;base64,${imageBase64}`,
    });
  }
  userContent.push({
    type: 'input_text',
    text: userText || '请观察屏幕并给出反应。',
  });

  const body = {
    model: config.model,
    instructions: systemPrompt,
    input: [{ role: 'user', content: userContent }],
    temperature: config.temperature ?? 0.8,
    max_output_tokens: Math.max(64, Math.min(4096, config.maxTokens || 512)),
  };

  const headers = {
    'content-type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  const raw = await postJson({ url, headers, body, timeoutMs: 30000 });
  const text = extractOutputText(raw);
  return { text, raw };
}

module.exports = { send };

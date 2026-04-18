// 三协议统一入口：根据 config.protocol 分派
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

module.exports = { send };

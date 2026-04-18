// 设置窗口渲染逻辑：加载配置 → 填表单 → 保存
(function () {
  const $ = (id) => document.getElementById(id);
  const status = $('status');

  function setStatus(msg, type = 'info') {
    status.className = 'status ' + type;
    status.textContent = msg;
  }
  function clearStatus() { status.className = 'status'; status.textContent = ''; }

  async function load() {
    const cfg = await window.pet.getConfig();
    // AI
    $('ai-enabled').checked = !!cfg.ai?.enabled;
    $('ai-protocol').value = cfg.ai?.protocol || 'messages';
    $('ai-endpoint').value = cfg.ai?.endpoint || '';
    // apiKey 在脱敏版中已被删除；只有 hasApiKey 布尔
    $('ai-key').value = '';
    $('ai-key').placeholder = cfg.ai?.hasApiKey ? '（已配置，留空则不修改）' : 'sk-...';
    $('ai-model').value = cfg.ai?.model || '';
    $('ai-temp').value = cfg.ai?.temperature ?? 0.8;
    $('ai-maxtok').value = cfg.ai?.maxTokens ?? 512;
    $('ai-prompt').value = cfg.ai?.systemPrompt || '';
    // capture
    $('cap-auto').checked = cfg.capture?.autoCapture !== false;
    $('cap-interval').value = cfg.capture?.intervalSec ?? 60;
    $('cap-maxw').value = cfg.capture?.maxWidth ?? 1280;
    $('cap-excludeself').checked = cfg.capture?.excludeSelf !== false;
    // pet
    $('pet-name').value = cfg.pet?.petName || 'QQ糖';
    $('pet-size').value = cfg.pet?.size ?? 220;
    $('pet-bubble').value = cfg.pet?.bubbleDuration ?? 4;
    $('pet-ontop').checked = cfg.pet?.alwaysOnTop !== false;
  }

  function collect(includeEmptyKey = false) {
    const payload = {
      ai: {
        enabled: $('ai-enabled').checked,
        protocol: $('ai-protocol').value,
        endpoint: $('ai-endpoint').value.trim(),
        model: $('ai-model').value.trim(),
        temperature: Number($('ai-temp').value),
        maxTokens: Number($('ai-maxtok').value),
        systemPrompt: $('ai-prompt').value,
      },
      capture: {
        autoCapture: $('cap-auto').checked,
        intervalSec: Number($('cap-interval').value),
        maxWidth: Number($('cap-maxw').value),
        excludeSelf: $('cap-excludeself').checked,
      },
      pet: {
        petName: $('pet-name').value.trim() || 'QQ糖',
        size: Number($('pet-size').value),
        bubbleDuration: Number($('pet-bubble').value),
        alwaysOnTop: $('pet-ontop').checked,
      },
    };
    const keyInput = $('ai-key').value;
    if (includeEmptyKey || keyInput) {
      payload.ai.apiKey = keyInput;
    }
    return payload;
  }

  $('btn-save').addEventListener('click', async () => {
    clearStatus();
    try {
      const payload = collect();
      const r = await window.pet.saveSettings(payload);
      if (r?.ok) {
        setStatus(`已保存 ✓ ${r.agentRunning ? '智能体已启动' : '智能体未启动（检查 API key）'}`, 'ok');
        await load();
      } else {
        setStatus('保存失败', 'err');
      }
    } catch (err) {
      setStatus('保存失败: ' + err.message, 'err');
    }
  });

  $('btn-test').addEventListener('click', async () => {
    clearStatus();
    setStatus('正在连接...', 'info');
    try {
      // 测试用当前表单里的配置（但如果 key 为空，用已保存的）
      const payload = collect(false);
      const override = { ...payload.ai };
      // 如果 key 输入框为空，让主进程用已存的
      if (!override.apiKey) delete override.apiKey;
      const r = await window.pet.testConnection(override);
      if (r.ok) {
        setStatus(`连接成功 ✓ 回复: ${r.text || '(空)'}`, 'ok');
      } else {
        setStatus(`连接失败: ${r.error}`, 'err');
      }
    } catch (err) {
      setStatus('测试失败: ' + err.message, 'err');
    }
  });

  $('btn-cancel').addEventListener('click', () => {
    window.pet.closeSettings();
  });

  // 协议切换时自动补默认 endpoint（如果当前 endpoint 是另一种默认值）
  $('ai-protocol').addEventListener('change', (e) => {
    const anth = 'https://api.anthropic.com';
    const oai = 'https://api.openai.com';
    const cur = $('ai-endpoint').value.trim();
    if (e.target.value === 'messages' && (cur === oai || cur === '')) {
      $('ai-endpoint').value = anth;
    } else if ((e.target.value === 'chat' || e.target.value === 'responses') &&
               (cur === anth || cur === '')) {
      $('ai-endpoint').value = oai;
    }
  });

  load().catch((err) => setStatus('加载配置失败: ' + err.message, 'err'));
})();

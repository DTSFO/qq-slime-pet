// 设置窗口渲染逻辑：加载配置 → 填表单 → 保存 + 模型列表拉取
(function () {
  const $ = (id) => document.getElementById(id);
  const status = $('status');

  const ANTHROPIC_DEFAULT = 'https://api.anthropic.com';
  const OPENAI_DEFAULT = 'https://api.openai.com';

  function setStatus(msg, type = 'info') {
    status.className = 'status ' + type;
    status.textContent = msg;
  }
  function clearStatus() { status.className = 'status'; status.textContent = ''; }

  function setHint(el, msg, type) {
    el.textContent = msg;
    el.className = 'hint' + (type ? ' hint-' + type : '');
  }

  async function load() {
    const cfg = await window.pet.getConfig();
    // AI
    $('ai-enabled').checked = !!cfg.ai?.enabled;
    $('ai-protocol').value = cfg.ai?.protocol || 'messages';
    $('ai-endpoint').value = cfg.ai?.endpoint || '';
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
      const payload = collect(false);
      const override = { ...payload.ai };
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

  /* ---------- 模型列表拉取 ---------- */
  $('btn-fetch-models').addEventListener('click', async () => {
    const btn = $('btn-fetch-models');
    const hint = $('models-hint');
    if (btn.classList.contains('loading')) return;
    btn.classList.add('loading');
    setHint(hint, '正在拉取模型列表...', '');
    try {
      const payload = collect(false);
      const override = { ...payload.ai };
      if (!override.apiKey) delete override.apiKey;
      const r = await window.pet.listModels(override);
      if (r.ok) {
        const datalist = $('models-list');
        datalist.innerHTML = '';
        for (const id of r.models) {
          const opt = document.createElement('option');
          opt.value = id;
          datalist.appendChild(opt);
        }
        if (r.models.length === 0) {
          setHint(hint, '接口返回空列表，建议手动输入', 'err');
        } else {
          setHint(hint, `已获取 ${r.models.length} 个模型 · 点击输入框展开下拉`, 'ok');
          // 如果当前模型不在列表中，不自动覆盖；若为空则填第一个
          const cur = $('ai-model').value.trim();
          if (!cur) $('ai-model').value = r.models[0];
        }
      } else {
        setHint(hint, `失败: ${r.error}（可手动输入模型名）`, 'err');
      }
    } catch (err) {
      setHint(hint, '失败: ' + err.message, 'err');
    } finally {
      btn.classList.remove('loading');
    }
  });

  // 协议切换：自动替换默认 endpoint
  $('ai-protocol').addEventListener('change', (e) => {
    const cur = $('ai-endpoint').value.trim();
    if (e.target.value === 'messages' && (cur === OPENAI_DEFAULT || cur === '')) {
      $('ai-endpoint').value = ANTHROPIC_DEFAULT;
    } else if ((e.target.value === 'chat' || e.target.value === 'responses') &&
               (cur === ANTHROPIC_DEFAULT || cur === '')) {
      $('ai-endpoint').value = OPENAI_DEFAULT;
    }
    // 清空 datalist（因为换协议了，老列表无意义）
    $('models-list').innerHTML = '';
    setHint($('models-hint'), '协议已切换，请重新点 ↻ 拉取模型列表', '');
  });

  load().catch((err) => setStatus('加载配置失败: ' + err.message, 'err'));
})();

// 设置窗口渲染逻辑：加载配置 → 填表单 → 保存 + 模型列表拉取（自制下拉）
(function () {
  const $ = (id) => document.getElementById(id);
  const status = $('status');

  const ANTHROPIC_DEFAULT = 'https://api.anthropic.com';
  const OPENAI_DEFAULT = 'https://api.openai.com';

  let modelList = []; // 最近一次拉到的模型 id 数组

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
    $('ai-enabled').checked = !!cfg.ai?.enabled;
    $('ai-protocol').value = cfg.ai?.protocol || 'messages';
    $('ai-endpoint').value = cfg.ai?.endpoint || '';
    $('ai-key').value = '';
    $('ai-key').placeholder = cfg.ai?.hasApiKey ? '（已配置，留空则不修改）' : 'sk-...';
    $('ai-model').value = cfg.ai?.model || '';
    $('ai-temp').value = cfg.ai?.temperature ?? 0.8;
    $('ai-maxtok').value = cfg.ai?.maxTokens ?? 512;
    $('ai-prompt').value = cfg.ai?.systemPrompt || '';
    $('cap-auto').checked = cfg.capture?.autoCapture !== false;
    $('cap-interval').value = cfg.capture?.intervalSec ?? 60;
    $('cap-maxw').value = cfg.capture?.maxWidth ?? 1280;
    $('cap-excludeself').checked = cfg.capture?.excludeSelf !== false;
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
    if (includeEmptyKey || keyInput) payload.ai.apiKey = keyInput;
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
      if (r.ok) setStatus(`连接成功 ✓ 回复: ${r.text || '(空)'}`, 'ok');
      else setStatus(`连接失败: ${r.error}`, 'err');
    } catch (err) {
      setStatus('测试失败: ' + err.message, 'err');
    }
  });

  $('btn-cancel').addEventListener('click', () => window.pet.closeSettings());

  /* ======================================================
     自制下拉框：点输入框显示全部，输入过滤，点击选中
     ====================================================== */
  const modelInput = $('ai-model');
  const dropdown = $('model-dropdown');

  function renderDropdown(filter) {
    const f = (filter || '').toLowerCase().trim();
    const items = f
      ? modelList.filter((m) => m.toLowerCase().includes(f))
      : modelList.slice();

    if (modelList.length === 0) {
      dropdown.innerHTML = '<div class="model-dropdown-empty">未获取模型列表，请先点 ↻ 刷新</div>';
      return;
    }
    if (items.length === 0) {
      dropdown.innerHTML = '<div class="model-dropdown-empty">无匹配项，可直接输入自定义模型名</div>';
      return;
    }
    // 限制渲染条目数，避免 DOM 过多（展示前 80 条，模糊匹配时大多少于 80）
    const show = items.slice(0, 80);
    dropdown.innerHTML = show.map((id) => {
      const safe = id.replace(/</g, '&lt;');
      if (!f) return `<div class="model-option" data-value="${safe}">${safe}</div>`;
      const idx = id.toLowerCase().indexOf(f);
      if (idx < 0) return `<div class="model-option" data-value="${safe}">${safe}</div>`;
      const before = safe.slice(0, idx);
      const hit = safe.slice(idx, idx + f.length);
      const after = safe.slice(idx + f.length);
      return `<div class="model-option" data-value="${safe}">${before}<span class="match">${hit}</span>${after}</div>`;
    }).join('');
  }

  function openDropdown() {
    renderDropdown(modelInput.value);
    dropdown.classList.remove('hidden');
  }
  function closeDropdown() {
    dropdown.classList.add('hidden');
  }

  modelInput.addEventListener('focus', openDropdown);
  modelInput.addEventListener('input', () => renderDropdown(modelInput.value));
  modelInput.addEventListener('blur', () => {
    // 延迟关闭，让 mousedown 先生效
    setTimeout(closeDropdown, 150);
  });
  modelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDropdown(); modelInput.blur(); }
  });
  dropdown.addEventListener('mousedown', (e) => {
    const opt = e.target.closest('.model-option');
    if (!opt) return;
    e.preventDefault(); // 阻止 input blur
    modelInput.value = opt.getAttribute('data-value');
    closeDropdown();
    modelInput.dispatchEvent(new Event('change'));
  });
  // 点击外部关闭
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.model-picker')) closeDropdown();
  });

  /* ---------- 拉取模型列表 ---------- */
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
        modelList = r.models || [];
        if (modelList.length === 0) {
          setHint(hint, '接口返回空列表，建议手动输入模型名', 'err');
        } else {
          setHint(hint, `已获取 ${modelList.length} 个模型 · 点击输入框展开列表，输入可过滤`, 'ok');
          // 立即展开让用户看到列表
          renderDropdown('');
          dropdown.classList.remove('hidden');
          modelInput.focus();
          // 若当前值空，填入第一个
          if (!modelInput.value.trim()) modelInput.value = modelList[0];
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

  // 协议切换：自动替换默认 endpoint + 清空模型列表
  $('ai-protocol').addEventListener('change', (e) => {
    const cur = $('ai-endpoint').value.trim();
    if (e.target.value === 'messages' && (cur === OPENAI_DEFAULT || cur === '')) {
      $('ai-endpoint').value = ANTHROPIC_DEFAULT;
    } else if ((e.target.value === 'chat' || e.target.value === 'responses') &&
               (cur === ANTHROPIC_DEFAULT || cur === '')) {
      $('ai-endpoint').value = OPENAI_DEFAULT;
    }
    modelList = [];
    setHint($('models-hint'), '协议已切换，请重新点 ↻ 拉取模型列表', '');
  });

  load().catch((err) => setStatus('加载配置失败: ' + err.message, 'err'));
})();

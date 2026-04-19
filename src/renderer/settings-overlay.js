// 设置 overlay 控制器：封装表单加载/保存/模型下拉/tab 切换
// 运行在桌宠主窗口进程里（不是独立窗口），因此点击 保存/取消/× 后调 closeSettings 让主进程恢复窗口
(function () {
  const $ = (id) => document.getElementById(id);

  const ANTHROPIC_DEFAULT = 'https://api.anthropic.com';
  const OPENAI_DEFAULT = 'https://api.openai.com';

  class SettingsOverlay {
    constructor() {
      this.el = document.getElementById('settings-overlay');
      if (!this.el) return;
      this.statusEl = $('settings-status');
      this.modelList = [];
      this._initialized = false;
      this._bindToggle();
    }

    _bindToggle() {
      window.pet?.onSettingsToggle?.((on) => {
        if (on) this.show();
        else this.hide();
      });
    }

    _lazyInit() {
      if (this._initialized) return;
      this._initialized = true;
      this._bindTabs();
      this._bindActions();
      this._bindModelDropdown();
      this._bindProtocolSwitch();
      this._bindKeys();
    }

    async show() {
      this._lazyInit();
      this.el.classList.remove('hidden');
      this.el.setAttribute('aria-hidden', 'false');
      document.body.classList.add('settings-open');
      // 默认回到 AI tab
      this._switchTab('ai');
      try { await this.load(); } catch (err) {
        this._setStatus('加载配置失败: ' + err.message, 'err');
      }
    }

    hide() {
      this.el.classList.add('hidden');
      this.el.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('settings-open');
      this._closeDropdown();
      this._clearStatus();
    }

    /* ---------- Tab ---------- */
    _bindTabs() {
      this.el.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
      });
    }
    _switchTab(name) {
      this.el.querySelectorAll('.tab-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === name);
      });
      this.el.querySelectorAll('.tab-panel').forEach((p) => {
        p.classList.toggle('active', p.dataset.panel === name);
      });
    }

    /* ---------- 状态条 ---------- */
    _setStatus(msg, type = 'info') {
      this.statusEl.className = 'status ' + type;
      this.statusEl.textContent = msg;
    }
    _clearStatus() {
      this.statusEl.className = 'status hidden';
      this.statusEl.textContent = '';
    }
    _setHint(el, msg, type) {
      el.textContent = msg;
      el.className = 'hint' + (type ? ' hint-' + type : '');
    }

    /* ---------- 加载 / 收集 ---------- */
    async load() {
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

    collect(includeEmptyKey = false) {
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

    /* ---------- 按钮 / 动作 ---------- */
    _bindActions() {
      $('btn-save').addEventListener('click', () => this._onSave());
      $('btn-test').addEventListener('click', () => this._onTest());
      $('btn-cancel').addEventListener('click', () => window.pet?.closeSettings?.());
      $('settings-close-btn').addEventListener('click', () => window.pet?.closeSettings?.());
    }

    async _onSave() {
      this._clearStatus();
      try {
        const payload = this.collect();
        const r = await window.pet.saveSettings(payload);
        if (r?.ok) {
          // 保存成功直接关闭 overlay（沿用旧行为）
          window.pet?.closeSettings?.();
        } else {
          this._setStatus('保存失败', 'err');
        }
      } catch (err) {
        this._setStatus('保存失败: ' + err.message, 'err');
      }
    }

    async _onTest() {
      this._clearStatus();
      this._setStatus('正在连接...', 'info');
      try {
        const payload = this.collect(false);
        const override = { ...payload.ai };
        if (!override.apiKey) delete override.apiKey;
        const r = await window.pet.testConnection(override);
        if (r.ok) this._setStatus(`连接成功 ✓ 回复: ${r.text || '(空)'}`, 'ok');
        else this._setStatus(`连接失败: ${r.error}`, 'err');
      } catch (err) {
        this._setStatus('测试失败: ' + err.message, 'err');
      }
    }

    /* ---------- 模型下拉 ---------- */
    _bindModelDropdown() {
      const modelInput = $('ai-model');
      const dropdown = $('model-dropdown');
      const hint = $('models-hint');
      this._modelInput = modelInput;
      this._dropdown = dropdown;

      const render = (filter) => {
        const f = (filter || '').toLowerCase().trim();
        if (this.modelList.length === 0) {
          dropdown.innerHTML = '<div class="model-dropdown-empty">未获取模型列表，请先点 ↻ 刷新</div>';
          return;
        }
        const items = f
          ? this.modelList.filter((m) => m.toLowerCase().includes(f))
          : this.modelList.slice();
        if (items.length === 0) {
          dropdown.innerHTML = '<div class="model-dropdown-empty">无匹配项，可直接输入自定义模型名</div>';
          return;
        }
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
      };
      this._renderDropdown = render;

      const openDropdown = () => {
        render(modelInput.value);
        dropdown.classList.remove('hidden');
      };
      const closeDropdown = () => dropdown.classList.add('hidden');
      this._closeDropdown = closeDropdown;

      modelInput.addEventListener('focus', openDropdown);
      modelInput.addEventListener('input', () => render(modelInput.value));
      modelInput.addEventListener('blur', () => setTimeout(closeDropdown, 150));
      modelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeDropdown(); modelInput.blur(); }
      });
      dropdown.addEventListener('mousedown', (e) => {
        const opt = e.target.closest('.model-option');
        if (!opt) return;
        e.preventDefault();
        modelInput.value = opt.getAttribute('data-value');
        closeDropdown();
        modelInput.dispatchEvent(new Event('change'));
      });
      // 点击外部关闭
      document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.model-picker')) closeDropdown();
      });

      // 拉取按钮
      $('btn-fetch-models').addEventListener('click', async () => {
        const btn = $('btn-fetch-models');
        if (btn.classList.contains('loading')) return;
        btn.classList.add('loading');
        this._setHint(hint, '正在拉取模型列表...', '');
        try {
          const payload = this.collect(false);
          const override = { ...payload.ai };
          if (!override.apiKey) delete override.apiKey;
          const r = await window.pet.listModels(override);
          if (r.ok) {
            this.modelList = r.models || [];
            if (this.modelList.length === 0) {
              this._setHint(hint, '接口返回空列表，建议手动输入模型名', 'err');
            } else {
              this._setHint(hint, `已获取 ${this.modelList.length} 个模型 · 点击输入框展开列表，输入可过滤`, 'ok');
              render('');
              dropdown.classList.remove('hidden');
              modelInput.focus();
              if (!modelInput.value.trim()) modelInput.value = this.modelList[0];
            }
          } else {
            this._setHint(hint, `失败: ${r.error}（可手动输入模型名）`, 'err');
          }
        } catch (err) {
          this._setHint(hint, '失败: ' + err.message, 'err');
        } finally {
          btn.classList.remove('loading');
        }
      });
    }

    /* ---------- 协议切换：自动填默认 endpoint ---------- */
    _bindProtocolSwitch() {
      $('ai-protocol').addEventListener('change', (e) => {
        const cur = $('ai-endpoint').value.trim();
        if (e.target.value === 'messages' && (cur === OPENAI_DEFAULT || cur === '')) {
          $('ai-endpoint').value = ANTHROPIC_DEFAULT;
        } else if ((e.target.value === 'chat' || e.target.value === 'responses') &&
                   (cur === ANTHROPIC_DEFAULT || cur === '')) {
          $('ai-endpoint').value = OPENAI_DEFAULT;
        }
        this.modelList = [];
        this._setHint($('models-hint'), '协议已切换，请重新点 ↻ 拉取模型列表', '');
      });
    }

    /* ---------- 快捷键：ESC 关闭 ---------- */
    _bindKeys() {
      document.addEventListener('keydown', (e) => {
        if (!document.body.classList.contains('settings-open')) return;
        if (e.key === 'Escape' && !this._dropdown?.classList.contains('hidden') === false) {
          // 已在下拉里单独处理，这里 overlay 整体关闭
        }
        if (e.key === 'Escape') {
          if (!this._dropdown?.classList.contains('hidden')) {
            this._closeDropdown?.();
            return;
          }
          window.pet?.closeSettings?.();
        }
      });
    }
  }

  window.__settingsOverlay = new SettingsOverlay();
})();

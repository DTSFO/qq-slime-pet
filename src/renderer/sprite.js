// sprite.js —— 史莱姆外观控制器
// 负责切换 CSS 状态类、在 overlay 里添加飘字（?、Z、❤）
(function () {
  const STATES = [
    'idle', 'walk', 'sleep', 'sleepy',
    'shock', 'happy', 'think', 'angry', 'love', 'drag',
  ];

  class Sprite {
    constructor(petEl) {
      this.el = petEl;
      this.overlay = petEl.querySelector('.pet-overlay');
      this.current = 'idle';
      this._overlayTimer = null;
    }

    setState(state) {
      if (!STATES.includes(state)) state = 'idle';
      if (this.current === state) return;
      // 移除所有 state-* 再加新的
      STATES.forEach((s) => this.el.classList.remove('state-' + s));
      this.el.classList.add('state-' + state);
      this.current = state;

      this._clearOverlay();
      if (state === 'think') this._spawnOverlayLoop('?', '#fff');
      else if (state === 'sleep' || state === 'sleepy') this._spawnOverlayLoop('z', '#e3f2ff');
      else if (state === 'love') this._spawnOverlayLoop('❤', '#ff4e78');
      else if (state === 'happy') this._spawnOverlayLoop('♪', '#fff176');
      else if (state === 'angry') this._spawnOverlayLoop('💢', '#ff3015');
    }

    getState() {
      return this.current;
    }

    _clearOverlay() {
      if (this._overlayTimer) {
        clearInterval(this._overlayTimer);
        this._overlayTimer = null;
      }
      this.overlay.innerHTML = '';
    }

    _spawnOverlayLoop(char, color) {
      const spawn = () => {
        const span = document.createElement('span');
        span.className = 'overlay-icon';
        span.textContent = char;
        span.style.color = color;
        span.style.left = 40 + Math.random() * 20 + '%';
        this.overlay.appendChild(span);
        setTimeout(() => span.remove(), 1900);
      };
      spawn();
      this._overlayTimer = setInterval(spawn, 1100);
    }

    // 水平移动桌宠（用 body 本身移动，避免动窗口）
    setOffsetX(px) {
      const body = this.el.querySelector('.pet-body');
      if (!body) return;
      body.style.marginLeft = px + 'px';
    }

    // 短暂闪光：应对点击反馈
    pulse() {
      this.el.style.filter = 'brightness(1.3) saturate(1.2)';
      setTimeout(() => { this.el.style.filter = ''; }, 180);
    }
  }

  window.Sprite = Sprite;
})();

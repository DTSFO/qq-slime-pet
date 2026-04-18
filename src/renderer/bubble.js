// bubble.js —— 对话气泡 + 打字机
(function () {
  class Bubble {
    constructor(el) {
      this.el = el;
      this.text = el.querySelector('.bubble-text');
      this._hideTimer = null;
      this._typingTimer = null;
    }

    /**
     * 显示气泡，带打字机效果
     * @param {string} content
     * @param {number} durationSec  气泡在显示完后保留多少秒
     */
    show(content, durationSec = 4) {
      this._clearTimers();
      this.text.innerHTML = '';
      this.el.classList.remove('hidden');

      const chars = Array.from(content || '');
      let i = 0;
      const cursor = '<span class="typing-cursor">&nbsp;</span>';
      const typeSpeed = Math.max(25, Math.min(80, 800 / Math.max(1, chars.length)));

      const tick = () => {
        if (i < chars.length) {
          i++;
          this.text.innerHTML =
            chars.slice(0, i).join('').replace(/\n/g, '<br>') + cursor;
          this._typingTimer = setTimeout(tick, typeSpeed);
        } else {
          // 打完了，去掉光标
          this.text.innerHTML = chars.join('').replace(/\n/g, '<br>');
          this._hideTimer = setTimeout(() => this.hide(), durationSec * 1000);
        }
      };
      tick();
    }

    hide() {
      this._clearTimers();
      this.el.classList.add('hidden');
    }

    _clearTimers() {
      if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
      if (this._typingTimer) { clearTimeout(this._typingTimer); this._typingTimer = null; }
    }
  }

  window.Bubble = Bubble;
})();

// drag.js —— 拖拽桌宠 + 点击检测 + 鼠标穿透切换
// 思路：窗口默认穿透，鼠标移动时检测是否落在 .pet-body 的碰撞框内
// 若在 → 请求主进程关闭穿透；若不在 → 打开穿透
(function () {
  class DragController {
    constructor(petEl, { onClick, onRightClick, onDragStart, onDragEnd } = {}) {
      this.el = petEl;
      this.onClick = onClick;
      this.onRightClick = onRightClick;
      this.onDragStart = onDragStart;
      this.onDragEnd = onDragEnd;

      this._dragging = false;
      this._pressedAt = 0;
      this._pressPos = null;
      this._clickThrough = true;
      this._dragMoveThrottled = false;

      // P2 优化：rect 缓存 + mousemove 节流
      this._cachedRect = null;
      this._rectCacheTime = 0;
      this._lastHitTest = false;
      this._throttleTimer = null;

      window.addEventListener('mousemove', (e) => this._onMouseMove(e));
      petEl.addEventListener('mousedown', (e) => this._onMouseDown(e));
      window.addEventListener('mouseup', (e) => this._onMouseUp(e));
      petEl.addEventListener('contextmenu', (e) => this._onContextMenu(e));

      this._applyClickThrough(true);
    }

    _hitTest(clientX, clientY) {
      const body = this.el.querySelector('.pet-body');
      if (!body) return false;

      const now = performance.now();
      if (!this._cachedRect || now - this._rectCacheTime > 100) {
        this._cachedRect = body.getBoundingClientRect();
        this._rectCacheTime = now;
      }

      const rect = this._cachedRect;
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    }

    async _applyClickThrough(enabled) {
      if (enabled === this._clickThrough) return;
      this._clickThrough = enabled;
      if (window.pet?.setClickThrough) {
        await window.pet.setClickThrough(enabled);
      }
    }

    _onMouseMove(e) {
      if (document.body.classList.contains('settings-open')) return;
      if (this._dragging) {
        if (this._dragMoveThrottled) return;
        this._dragMoveThrottled = true;
        requestAnimationFrame(() => {
          window.pet?.dragMove?.();
          this._dragMoveThrottled = false;
        });
        return;
      }

      if (this._throttleTimer) return;
      this._throttleTimer = setTimeout(() => {
        this._throttleTimer = null;
      }, 50);

      const hit = this._hitTest(e.clientX, e.clientY);
      if (hit !== this._lastHitTest) {
        this._lastHitTest = hit;
        this._applyClickThrough(!hit);
      }
    }

    async _onMouseDown(e) {
      if (e.button === 2) return; // 右键单独处理
      // 确保穿透已关闭（否则 mousedown 根本不会到我们这里）
      this._pressedAt = Date.now();
      this._pressPos = { x: e.clientX, y: e.clientY };
      this._dragging = false;

      // 准备拖拽：超过 3px 才算拖动
      const startThreshold = 3;
      const moveHandler = (ev) => {
        const dx = ev.clientX - this._pressPos.x;
        const dy = ev.clientY - this._pressPos.y;
        if (!this._dragging && Math.hypot(dx, dy) > startThreshold) {
          this._dragging = true;
          window.pet?.dragStart?.();
          this.onDragStart?.();
        }
      };
      window.addEventListener('mousemove', moveHandler);
      this._cleanupMove = () => window.removeEventListener('mousemove', moveHandler);
    }

    _onMouseUp() {
      if (this._cleanupMove) {
        this._cleanupMove();
        this._cleanupMove = null;
      }
      const heldMs = Date.now() - this._pressedAt;
      if (this._dragging) {
        this._dragging = false;
        window.pet?.dragEnd?.();
        this.onDragEnd?.();
      } else if (heldMs > 0 && heldMs < 400 && this._pressPos) {
        // 短按 → 视为点击
        this.onClick?.();
      }
      this._pressedAt = 0;
      this._pressPos = null;
    }

    _onContextMenu(e) {
      e.preventDefault();
      this.onRightClick?.();
      window.pet?.contextMenu?.(e.screenX, e.screenY);
    }
  }

  window.DragController = DragController;
})();

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
      this._clickThrough = true; // 当前是否穿透

      // 主进程通过 forward 仍会把 mousemove 送来，用于检测指针落点
      window.addEventListener('mousemove', (e) => this._onMouseMove(e));
      petEl.addEventListener('mousedown', (e) => this._onMouseDown(e));
      window.addEventListener('mouseup', (e) => this._onMouseUp(e));
      petEl.addEventListener('contextmenu', (e) => this._onContextMenu(e));

      // 启动时先把穿透打开（兜底）
      this._applyClickThrough(true);
    }

    _hitTest(clientX, clientY) {
      const body = this.el.querySelector('.pet-body');
      if (!body) return false;
      const rect = body.getBoundingClientRect();
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
      // overlay 打开时：click-through 由主进程整体关闭，不走 hit-test 切换
      if (document.body.classList.contains('settings-open')) return;
      if (this._dragging) {
        window.pet?.dragMove?.();
        return;
      }
      const hit = this._hitTest(e.clientX, e.clientY);
      // 指针在身上 → 关闭穿透；指针离开 → 打开穿透
      this._applyClickThrough(!hit);
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

// pet.js —— 渲染进程总控：状态机 + 动画调度 + 接收 AI 事件
(function () {
  const petEl = document.getElementById('pet');
  const bubbleEl = document.getElementById('bubble');

  const sprite = new window.Sprite(petEl);
  const bubble = new window.Bubble(bubbleEl);

  // 状态机
  const REACTION_STATES = ['happy', 'shock', 'think', 'angry', 'love', 'sleepy'];
  const BASE_STATES = ['idle', 'walk', 'sleep', 'drag'];

  class PetFSM {
    constructor() {
      this.state = 'idle';
      this.lastInteraction = Date.now();
      this.reactionResetTimer = null;
      this.walkTimer = null;
      this.walkOffset = 0;
    }

    markInteraction() {
      this.lastInteraction = Date.now();
      // 睡眠中被戳 → 惊讶
      if (this.state === 'sleep' || this.state === 'sleepy') {
        this.setState('shock');
      }
    }

    setState(state, { stickMs } = {}) {
      clearTimeout(this.reactionResetTimer);
      this.state = state;
      sprite.setState(state);

      if (REACTION_STATES.includes(state)) {
        const ms = stickMs || 2400;
        this.reactionResetTimer = setTimeout(() => {
          if (this.state === state) this.setState('idle');
        }, ms);
      }

      if (state === 'walk') this._startWalk();
      else this._stopWalk();
    }

    _startWalk() {
      this._stopWalk();
      const duration = 3000 + Math.random() * 3000;
      const direction = Math.random() > 0.5 ? 1 : -1;
      const distance = 20 + Math.random() * 30;
      const startTime = performance.now();
      const startOffset = this.walkOffset;

      const tick = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        // 缓入缓出
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.walkOffset = startOffset + direction * distance * eased;
        // 反弹：走到头会影响窗口边界，这里只是视觉上左右晃
        if (Math.abs(this.walkOffset) > 40) this.walkOffset = 40 * Math.sign(this.walkOffset);
        sprite.setOffsetX(this.walkOffset);
        if (t < 1 && this.state === 'walk') {
          this.walkTimer = requestAnimationFrame(tick);
        } else if (this.state === 'walk') {
          this.setState('idle');
        }
      };
      this.walkTimer = requestAnimationFrame(tick);
    }

    _stopWalk() {
      if (this.walkTimer) {
        cancelAnimationFrame(this.walkTimer);
        this.walkTimer = null;
      }
    }
  }

  const pet = new PetFSM();
  pet.setState('idle');

  // 让 walkOffset 随时间慢慢归零
  setInterval(() => {
    if (pet.state !== 'walk' && pet.state !== 'drag') {
      pet.walkOffset *= 0.9;
      if (Math.abs(pet.walkOffset) < 0.2) pet.walkOffset = 0;
      sprite.setOffsetX(pet.walkOffset);
    }
  }, 200);

  // ---------- 空闲自动状态转换 ----------
  function idleTicker() {
    const now = Date.now();
    const idleMs = now - pet.lastInteraction;

    // 当前处于反应动画 / 拖拽 / 走路时不做自动转换
    if (['drag', 'walk'].includes(pet.state)) return;
    if (REACTION_STATES.includes(pet.state)) return;

    if (idleMs > 5 * 60 * 1000) {
      // 5 分钟 → 睡觉
      if (pet.state !== 'sleep') pet.setState('sleep');
      return;
    }
    if (idleMs > 3 * 60 * 1000) {
      if (pet.state !== 'sleepy') pet.setState('sleepy', { stickMs: 60 * 1000 });
      return;
    }
    if (pet.state === 'idle' && idleMs > 8000 + Math.random() * 7000) {
      pet.setState('walk');
    }
  }
  setInterval(idleTicker, 1500);

  // ---------- 拖拽 + 点击 ----------
  const drag = new window.DragController(petEl, {
    onClick: async () => {
      pet.markInteraction();
      sprite.pulse();
      // 点击触发一次 AI 手动聊天（不带图）
      bubble.show('嗯？', 1.5);
      try {
        await window.pet?.chat?.({ userText: '用户戳了你一下', skipImage: true });
      } catch (_) {}
    },
    onRightClick: () => pet.markInteraction(),
    onDragStart: () => {
      pet.markInteraction();
      pet.setState('drag');
      bubble.hide();
    },
    onDragEnd: () => {
      // 扔完后 shock 一下再 idle
      pet.setState('shock', { stickMs: 700 });
      setTimeout(() => {
        if (pet.state === 'shock') pet.setState('idle');
      }, 700);
    },
  });

  // ---------- 接收 AI 事件 ----------
  window.pet?.onAIEvent?.((data) => {
    if (!data) return;
    const { emotion, action, speech, duration } = data;
    pet.markInteraction();

    // 先切表情，再根据 action 决定是否触发长动作
    if (emotion && REACTION_STATES.includes(emotion)) {
      pet.setState(emotion, { stickMs: Math.max(2000, (duration || 4) * 1000) });
    } else if (emotion === 'idle') {
      pet.setState('idle');
    }

    if (action === 'walk') pet.setState('walk');
    else if (action === 'sleep') pet.setState('sleep');
    else if (action === 'jump') pet.setState('happy');

    if (speech) {
      bubble.show(speech, duration || 4);
    }
  });

  // ---------- 调试接口 ----------
  window.__petDebug = {
    setState: (s) => pet.setState(s),
    say: (t, d) => bubble.show(t, d || 4),
    getState: () => pet.state,
  };

  console.log('[pet] ready. try window.__petDebug.setState("happy")');
})();

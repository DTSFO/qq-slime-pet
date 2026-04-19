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

  // ---------- 随机入场动画 ----------
  const INTRO_ANIMATIONS = ['intro-pop', 'intro-drop', 'intro-spin', 'intro-ink'];
  (function playRandomIntro() {
    const name = INTRO_ANIMATIONS[Math.floor(Math.random() * INTRO_ANIMATIONS.length)];
    petEl.classList.add(name);
    const cleanup = () => {
      petEl.classList.remove(name);
      petEl.removeEventListener('animationend', onEnd);
    };
    const onEnd = (e) => {
      // .pet 身上有多种 animation（breathing 等），只在入场动画结束时清掉
      if (e.target === petEl && e.animationName && e.animationName.startsWith('intro-')) {
        cleanup();
      }
    };
    petEl.addEventListener('animationend', onEnd);
    // 兜底：即便 animationend 没到（被打断），900ms 后强制清掉
    setTimeout(cleanup, 1000);
  })();

  // P1 优化：合并定时器到单一 ticker
  let tickCount = 0;
  setInterval(() => {
    tickCount++;

    if (pet.state !== 'walk' && pet.state !== 'drag') {
      pet.walkOffset *= 0.9;
      if (Math.abs(pet.walkOffset) < 0.2) pet.walkOffset = 0;
      sprite.setOffsetX(pet.walkOffset);
    }

    if (tickCount % 7 === 0) {
      const now = Date.now();
      const idleMs = now - pet.lastInteraction;

      if (['drag', 'walk'].includes(pet.state)) return;
      if (REACTION_STATES.includes(pet.state)) return;

      if (idleMs > 5 * 60 * 1000) {
        if (pet.state !== 'sleep') pet.setState('sleep');
      } else if (idleMs > 3 * 60 * 1000) {
        if (pet.state !== 'sleepy') pet.setState('sleepy', { stickMs: 60 * 1000 });
      } else if (pet.state === 'idle' && idleMs > 8000 + Math.random() * 7000) {
        pet.setState('walk');
      }
    }
  }, 200);


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
  let cleanupAIEvent = null;
  if (window.pet?.onAIEvent) {
    cleanupAIEvent = window.pet.onAIEvent((data) => {
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
  }

  // ---------- 边缘 / 探头 / 移动事件 ----------
  const EDGE_CLASSES = ['edge-left', 'edge-right', 'edge-top', 'edge-bottom'];
  const PEEK_CLASSES = ['peek-left', 'peek-right', 'peek-top', 'peek-bottom'];
  let currentEdge = 'none';
  let isMovingByAI = false;

  let cleanupEdge = null;
  if (window.pet?.onEdgeChanged) {
    cleanupEdge = window.pet.onEdgeChanged((edge) => {
      EDGE_CLASSES.forEach((c) => petEl.classList.remove(c));
      if (edge && edge !== 'none') petEl.classList.add('edge-' + edge);
      currentEdge = edge || 'none';
      pet.markInteraction();
    });
  }

  let cleanupPeek = null;
  if (window.pet?.onPeekChanged) {
    cleanupPeek = window.pet.onPeekChanged((side) => {
      PEEK_CLASSES.forEach((c) => petEl.classList.remove(c));
      if (side) {
        petEl.classList.add('peek-' + side);
        pet.setState('think', { stickMs: 5000 });
        bubble.show('偷偷看一下~', 3);
      }
      pet.markInteraction();
    });
  }

  let cleanupMoving = null;
  if (window.pet?.onMoving) {
    cleanupMoving = window.pet.onMoving((data) => {
      if (!data) return;
      if (data.moving) {
        isMovingByAI = true;
        pet.setState('walk');
      } else if (isMovingByAI) {
        isMovingByAI = false;
        if (currentEdge && currentEdge !== 'none') {
          pet.setState('idle');
        } else {
          pet.setState('happy', { stickMs: 1200 });
        }
      }
    });
  }

  let cleanupCrawling = null;
  if (window.pet?.onCrawling) {
    cleanupCrawling = window.pet.onCrawling((data) => {
      if (!data) {
        petEl.classList.remove('crawling');
        try { sprite.setCrawling(null); } catch (_) {}
        return;
      }

      petEl.classList.add('crawling');

      if (typeof data === 'object' && data.direction) {
        try { sprite.setCrawling(data.direction, data.velocity || 1); } catch (_) {}
      } else if (typeof data === 'boolean') {
        try { sprite.setCrawling(data); } catch (_) {}
      }
    });
  }

  // ---------- 退场动画：主进程广播 pet:farewell ----------
  const OUTRO_ANIMATIONS = ['outro-shrink', 'outro-fall', 'outro-poof', 'outro-ink'];
  let cleanupFarewell = null;
  if (window.pet?.onFarewell) {
    cleanupFarewell = window.pet.onFarewell(() => {
      const keepClasses = ['pet'];
      Array.from(petEl.classList).forEach((c) => {
        if (!keepClasses.includes(c)) petEl.classList.remove(c);
      });
      bubble.hide();
      const name = OUTRO_ANIMATIONS[Math.floor(Math.random() * OUTRO_ANIMATIONS.length)];
      petEl.classList.add(name);
    });
  }

  // ---------- 设置 overlay：暂停走路 / 结束时恢复 idle ----------
  let cleanupSettings = null;
  if (window.pet?.onSettingsToggle) {
    cleanupSettings = window.pet.onSettingsToggle((on) => {
      if (on) {
        pet._stopWalk();
        bubble.hide();
        try { sprite.pauseAnimation(); } catch (_) {}
      } else {
        pet.setState('idle');
        try { sprite.resumeAnimation(); } catch (_) {}
      }
    });
  }

  // ---------- 清理函数：窗口关闭时调用 ----------
  window.addEventListener('beforeunload', () => {
    // 清理所有 IPC 监听器
    if (cleanupAIEvent) cleanupAIEvent();
    if (cleanupEdge) cleanupEdge();
    if (cleanupPeek) cleanupPeek();
    if (cleanupMoving) cleanupMoving();
    if (cleanupCrawling) cleanupCrawling();
    if (cleanupFarewell) cleanupFarewell();
    if (cleanupSettings) cleanupSettings();

    // 清理 sprite rAF
    if (sprite && sprite.cleanup) sprite.cleanup();
  });

  // ---------- 调试接口 ----------
  window.__petDebug = {
    setState: (s) => pet.setState(s),
    say: (t, d) => bubble.show(t, d || 4),
    getState: () => pet.state,
  };

  console.log('[pet] ready. try window.__petDebug.setState("happy")');
})();

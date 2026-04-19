// sprite.js —— 水墨风 16×16 NES 像素史莱姆
// 每帧 rAF 重绘 canvas；按状态驱动的 WIGGLE_PROFILES 让每行像素独立偏移，
// 形成"像素级蠕动"：身体像果冻一样挤压、推进、心跳，而不是整体 CSS transform。
// Overlay 飘字 ?/Z/♥ 仍由 DOM 处理
(function () {
  /* ----- 水墨 · 白底墨染调色板 ----- */
  const INK = {
    '.': null,
    '#': '#1a1a22',  // 焦墨描边
    'W': '#f8f8ff',  // 幽灵白（主体，占 85%）
    'M': '#9a98a2',  // 淡墨（晕染，加深）
    'L': '#3e3d48',  // 中墨（眼睛/嘴/墨痕，加深）
    'K': '#0a0a0a',  // 纯黑（极少用）
    'R': '#9c2e24',  // 朱砂（点缀）
    'B': '#f8f8ff',  // 兼容别名 —— 等价于 W
  };

  /* ----- 基础身体（16×16 · 白主体 + 底部三层渐深墨渗） ----- */
  const BODY = [
    "................",
    "................",
    ".....######.....",
    "....#WWWWWW#....",
    "...#WWWWWWWW#...",
    "..#WWWWWWWWWW#..",
    "..#WWWWWWWWWW#..",
    ".#WWWWWWWWWWWW#.",
    ".#WWWWWWWWWWWW#.",
    ".#WWWWWWWWWWWW#.",
    ".#WWWWWWWWWWWW#.",
    "#WMMWWWWWWWWMMW#",
    "#MLLWWWWWWWWLLM#",
    "#LLLLWWWWWWLLLL#",
    "################",
    "................",
  ];

  /** 脸部 patch —— 眼睛/嘴巴用中墨 L，符合水墨风 */
  const FACES = {
    idle: {
      eyes: [
        { x: 3,  y: 8, grid: ["LL","LL"] },
        { x: 11, y: 8, grid: ["LL","LL"] },
      ],
      mouth: null,
    },
    sleepy: {
      eyes: [
        { x: 3,  y: 8, grid: ["MM","LL"] },
        { x: 11, y: 8, grid: ["MM","LL"] },
      ],
      mouth: null,
    },
    sleep: {
      eyes: [
        { x: 3,  y: 8, grid: ["LLL"] },
        { x: 10, y: 8, grid: ["LLL"] },
      ],
      mouth: null,
    },
    shock: {
      eyes: [
        { x: 3,  y: 7, grid: ["LLL","LWL","LLL"] },
        { x: 10, y: 7, grid: ["LLL","LWL","LLL"] },
      ],
      mouth: { x: 7, y: 10, grid: ["LL","LL"] },
    },
    happy: {
      eyes: [
        { x: 3,  y: 8, grid: [".L.","LLL"] },
        { x: 10, y: 8, grid: [".L.","LLL"] },
      ],
      mouth: { x: 5, y: 11, grid: ["L....L","LLLLLL"] },
    },
    think: {
      eyes: [
        { x: 3,  y: 7, grid: ["LL","WW"] },
        { x: 11, y: 7, grid: ["LL","WW"] },
      ],
      mouth: null,
    },
    angry: {
      eyes: [
        { x: 3,  y: 7, grid: ["L..","WL.","WWL"] },
        { x: 10, y: 7, grid: ["..L",".LW","LWW"] },
      ],
      mouth: { x: 6, y: 11, grid: ["LLLL"] },
    },
    love: {
      eyes: [
        { x: 3,  y: 8, grid: ["RR","RR"] },
        { x: 11, y: 8, grid: ["RR","RR"] },
      ],
      mouth: { x: 7, y: 11, grid: [".L.","LLL"] },
    },
    drag: {
      eyes: [
        { x: 3,  y: 7, grid: ["LLL","LWL","LLL"] },
        { x: 10, y: 7, grid: ["LLL","LWL","LLL"] },
      ],
      mouth: { x: 6, y: 11, grid: ["LLLL"] },
    },
    walk: null, // 与 idle 一致
  };

  const STATES = Object.keys(FACES).concat(['walk']);

  /* ====================================================
     WIGGLE_PROFILES —— 像素级变形规则
     输入：相位 t（秒），返回 { shiftX(row), offsetY(row) }
     返回值建议为整数（Math.round），保持像素锐利
     row 是身体在 16 行中的索引（0 顶, 15 底）
     ==================================================== */
  const TAU = Math.PI * 2;

  function rowDepth(row) {
    // 身体主要从第 2 行开始，第 14 行结束
    if (row < 2) return 0;
    if (row > 14) return 0;
    return (row - 2) / 12;
  }

  const WIGGLE_PROFILES = {
    idle: (t, velocity = 1) => ({
      shiftX: (row) => Math.round(Math.sin(t * 1.6 + row * 0.15) * 0.3 * rowDepth(row)),
      offsetY: (row) => Math.round(Math.sin(t * 2.2) * 0.5 * rowDepth(row)),
    }),
    walk: (t, velocity = 1) => ({
      // 强烈前后推进波：phase 沿 row 传播，感觉像"推着走"
      shiftX: (row) => Math.round(Math.sin(t * 8 - row * 0.55) * 1.2 * (0.4 + rowDepth(row) * 0.7)),
      offsetY: (row) => {
        const d = rowDepth(row);
        // 底部挤压，中部抬起，构成"跨步"感
        return Math.round(Math.sin(t * 16) * 0.6 * d - Math.abs(Math.sin(t * 8)) * 0.4 * d);
      },
    }),
    crawl: (t, velocity = 1) => ({
      // 贴边爬行：波从一端传到另一端，单向推进（向右/向下）
      shiftX: (row) => Math.round(Math.sin(t * 5 * velocity - row * 0.7) * 1.4 * (0.3 + rowDepth(row) * 0.8)),
      offsetY: (row) => Math.round(Math.cos(t * 5 * velocity - row * 0.7) * 0.5 * rowDepth(row)),
    }),
    sleep: (t, velocity = 1) => ({
      shiftX: () => 0,
      offsetY: (row) => Math.round(Math.sin(t * 0.8) * 0.4 * rowDepth(row)),
    }),
    sleepy: (t, velocity = 1) => ({
      shiftX: (row) => Math.round(Math.sin(t * 1.2) * 0.3 * rowDepth(row)),
      offsetY: (row) => Math.round(Math.sin(t * 1.4) * 0.5 * rowDepth(row)),
    }),
    shock: (t, velocity = 1) => ({
      // 剧烈颤抖（降频：48Hz→24Hz 减少抖动感）
      shiftX: () => Math.round(Math.sin(t * 24) * 1.2),
      offsetY: () => Math.round(Math.cos(t * 26) * 0.8),
    }),
    happy: (t, velocity = 1) => ({
      // 欢快左右摇摆 + 头部上下弹
      shiftX: (row) => Math.round(Math.sin(t * 7) * 1.1 * (1 - rowDepth(row))),
      offsetY: (row) => {
        const d = rowDepth(row);
        return Math.round(-Math.abs(Math.sin(t * 6)) * 1.0 * (1 - d * 0.6));
      },
    }),
    think: (t, velocity = 1) => ({
      // 头微微歪：顶部向一侧偏
      shiftX: (row) => {
        const topBias = row < 8 ? (8 - row) / 8 : 0;
        return Math.round(Math.sin(t * 0.9) * 1.2 * topBias);
      },
      offsetY: (row) => Math.round(Math.sin(t * 1.8) * 0.3 * rowDepth(row)),
    }),
    angry: (t, velocity = 1) => ({
      // 急促颤抖（降频：30Hz→16Hz 更自然）
      shiftX: () => Math.round(Math.sin(t * 16) * 1.0),
      offsetY: (row) => Math.round(Math.sin(t * 14) * 0.4 * rowDepth(row)),
    }),
    love: (t, velocity = 1) => ({
      // 心跳：每 0.7s 一次脉冲式膨胀
      shiftX: (row) => {
        const pulse = Math.abs(Math.sin(t * 4.5));
        const centerBias = Math.abs(row - 8) / 8; // 离中部越远越少偏
        return Math.round(pulse * 0.9 * (1 - centerBias));
      },
      offsetY: (row) => {
        const pulse = Math.abs(Math.sin(t * 4.5));
        return Math.round(-pulse * 0.8 * rowDepth(row));
      },
    }),
    drag: (t, velocity = 1) => ({
      // 被拎起：左右大幅甩动
      shiftX: (row) => Math.round(Math.sin(t * 4) * 1.8 * rowDepth(row)),
      offsetY: (row) => Math.round(Math.cos(t * 4) * 0.9 * rowDepth(row)),
    }),
    // 定向爬行 profiles（墙壁巡逻）
    'crawl-up': (t, velocity = 1) => ({
      // 向上爬：波从下往上传播（row 递减方向）
      shiftX: (row) => Math.round(Math.sin(t * 5 * velocity + row * 0.7) * 1.4 * (0.3 + rowDepth(row) * 0.8)),
      offsetY: (row) => Math.round(Math.cos(t * 5 * velocity + row * 0.7) * 0.5 * rowDepth(row)),
    }),
    'crawl-down': (t, velocity = 1) => ({
      // 向下爬：波从上往下传播（row 递增方向）
      shiftX: (row) => Math.round(Math.sin(t * 5 * velocity - row * 0.7) * 1.4 * (0.3 + rowDepth(row) * 0.8)),
      offsetY: (row) => Math.round(Math.cos(t * 5 * velocity - row * 0.7) * 0.5 * rowDepth(row)),
    }),
    'crawl-left': (t, velocity = 1) => ({
      // 向左爬：负 shiftX 主导
      shiftX: (row) => Math.round(-Math.sin(t * 5 * velocity - row * 0.7) * 1.4 * (0.3 + rowDepth(row) * 0.8)),
      offsetY: (row) => Math.round(Math.cos(t * 5 * velocity - row * 0.7) * 0.5 * rowDepth(row)),
    }),
    'crawl-right': (t, velocity = 1) => ({
      // 向右爬：正 shiftX 主导
      shiftX: (row) => Math.round(Math.sin(t * 5 * velocity - row * 0.7) * 1.4 * (0.3 + rowDepth(row) * 0.8)),
      offsetY: (row) => Math.round(Math.cos(t * 5 * velocity - row * 0.7) * 0.5 * rowDepth(row)),
    }),
  };

  function getProfile(state, t, velocity = 1) {
    const fn = WIGGLE_PROFILES[state] || WIGGLE_PROFILES.idle;
    return fn(t, velocity);
  }

  /** 画带变形的 grid：每行独立按 shiftX/offsetY 偏移 */
  function paintDeformedGrid(ctx, grid, ox, oy, deform) {
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      const absY = oy + y;
      const dx = deform.shiftX(absY) | 0;
      const dy = deform.offsetY(absY) | 0;
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const color = INK[ch];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(ox + x + dx, absY + dy, 1, 1);
        }
      }
    }
  }

  class Sprite {
    constructor(petEl) {
      this.el = petEl;
      this.body = petEl.querySelector('.pet-body');
      this.overlay = petEl.querySelector('.pet-overlay');

      let canvas = this.body.querySelector('.pet-canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        canvas.className = 'pet-canvas';
        this.body.insertBefore(canvas, this.overlay);
      }
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      this.current = 'idle';
      this._faceKey = 'idle';
      this._profileKey = 'idle';
      this._phase = 0;
      this._lastT = 0;
      this._paused = false;
      this._crawling = false;
      this._overlayTimer = null;

      // P0 优化：帧缓存 + 脏区检测
      this._frameCache = new Map();
      this._lastDrawnState = null;
      this._lastDrawnPhase = -1;
      this._isDirty = true;
      this._staticStates = new Set(['sleep']);

      this._rafHandle = null;
      this._startRAF();
    }

    setState(state) {
      if (state === this.current) return;
      const faceKey = FACES[state] ? state : (state === 'walk' ? 'idle' : 'idle');
      if (!STATES.includes(state)) state = 'idle';
      this.current = state;
      this._faceKey = faceKey;
      this._profileKey = state;
      this._isDirty = true;

      STATES.forEach((s) => this.el.classList.remove('state-' + s));
      this.el.classList.add('state-' + state);

      this._updateOverlay(state);
    }

    setCrawling(direction, velocity = 1) {
      // direction: 'up' | 'down' | 'left' | 'right' | null
      // 向后兼容：如果传入布尔值，转换为 'right' 或 null
      if (typeof direction === 'boolean') {
        direction = direction ? 'right' : null;
      }
      const changed = this._crawlDirection !== direction || this._crawlVelocity !== velocity;
      this._crawlDirection = direction;
      this._crawlVelocity = Math.max(0.5, Math.min(2.0, velocity));
      if (changed) this._isDirty = true;
    }

    /** 外部暂停 rAF（如设置 overlay 打开时桌宠 display:none，停绘省电） */
    pauseAnimation() {
      this._paused = true;
      if (this._rafHandle) {
        cancelAnimationFrame(this._rafHandle);
        this._rafHandle = null;
      }
    }

    resumeAnimation() {
      if (!this._paused) return;
      this._paused = false;
      this._isDirty = true;
      this._startRAF();
    }

    _startRAF() {
      if (this._rafHandle) return;
      this._lastT = performance.now();
      const tick = (now) => {
        if (this._paused) { this._rafHandle = null; return; }
        // phase 以秒累加；控制在 [0, 1000) 防止精度漂移
        const dt = (now - this._lastT) / 1000;
        this._lastT = now;
        this._phase = (this._phase + dt) % 1000;
        this._draw();
        this._rafHandle = requestAnimationFrame(tick);
      };
      this._rafHandle = requestAnimationFrame(tick);
    }

    _draw() {
      let profileKey = this._profileKey;
      if (this._crawlDirection) {
        profileKey = 'crawl-' + this._crawlDirection;
      }
      const cacheKey = `${profileKey}_${this._faceKey}`;

      const isStatic = this._staticStates.has(profileKey);
      const phaseKey = isStatic ? Math.floor(this._phase * 2) : Math.floor(this._phase * 10);

      if (!this._isDirty &&
          this._lastDrawnState === cacheKey &&
          this._lastDrawnPhase === phaseKey) {
        return;
      }

      const fullCacheKey = `${cacheKey}_${phaseKey}`;
      let cachedFrame = this._frameCache.get(fullCacheKey);

      if (cachedFrame) {
        this.ctx.putImageData(cachedFrame, 0, 0);
      } else {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, 16, 16);
        const deform = getProfile(profileKey, this._phase, this._crawlVelocity);

        paintDeformedGrid(ctx, BODY, 0, 0, deform);

        const face = FACES[this._faceKey];
        if (face) {
          for (const eye of face.eyes || []) {
            const dx = deform.shiftX(eye.y) | 0;
            const dy = deform.offsetY(eye.y) | 0;
            paintGrid(ctx, eye.grid, eye.x + dx, eye.y + dy);
          }
          if (face.mouth) {
            const dx = deform.shiftX(face.mouth.y) | 0;
            const dy = deform.offsetY(face.mouth.y) | 0;
            paintGrid(ctx, face.mouth.grid, face.mouth.x + dx, face.mouth.y + dy);
          }
        }

        if (this._frameCache.size > 100) {
          const firstKey = this._frameCache.keys().next().value;
          this._frameCache.delete(firstKey);
        }
        this._frameCache.set(fullCacheKey, ctx.getImageData(0, 0, 16, 16));
      }

      this._lastDrawnState = cacheKey;
      this._lastDrawnPhase = phaseKey;
      this._isDirty = false;
    }

    getState() { return this.current; }

    _clearOverlay() {
      if (this._overlayTimer) { clearInterval(this._overlayTimer); this._overlayTimer = null; }
      this.overlay.innerHTML = '';
    }

    _updateOverlay(state) {
      this._clearOverlay();
      const spawnOf = (char, color) => {
        const spawn = () => {
          const span = document.createElement('span');
          span.className = 'overlay-icon';
          span.textContent = char;
          span.style.color = color;
          span.style.left = 38 + Math.random() * 24 + '%';
          this.overlay.appendChild(span);
          setTimeout(() => span.remove(), 1900);
        };
        spawn();
        this._overlayTimer = setInterval(spawn, 1100);
      };
      if (state === 'think')  spawnOf('?',  '#6a6864');
      else if (state === 'sleep' || state === 'sleepy') spawnOf('Z', '#6a6864');
      else if (state === 'love')  spawnOf('♥',  '#9c2e24');
      else if (state === 'happy') spawnOf('♪',  '#6a6864');
      else if (state === 'angry') spawnOf('怒', '#9c2e24');
    }

    // 水平晃动桌宠（走路时由 pet.js 调用，叠在像素 wiggle 之外）
    setOffsetX(px) {
      if (!this.body) return;
      this.body.style.marginLeft = px + 'px';
    }

    pulse() {
      this.el.style.filter = 'brightness(1.3) contrast(1.1)';
      setTimeout(() => { this.el.style.filter = ''; }, 180);
    }

    /** 清理资源：停止 rAF，清空缓存 */
    cleanup() {
      this._paused = true;
      if (this._rafHandle) {
        cancelAnimationFrame(this._rafHandle);
        this._rafHandle = null;
      }
      if (this._overlayTimer) {
        clearInterval(this._overlayTimer);
        this._overlayTimer = null;
      }
      // 清空帧缓存释放内存
      this._frameCache.clear();
    }
  }

  /** 非变形版（眼睛/嘴在 deformed body 之上，位置已按所在行偏移好了） */
  function paintGrid(ctx, grid, ox = 0, oy = 0) {
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const color = INK[ch];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
    }
  }

  window.Sprite = Sprite;
})();

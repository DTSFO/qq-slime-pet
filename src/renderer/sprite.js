// sprite.js —— 水墨风 16×16 NES 像素史莱姆 Canvas 渲染器
// 身体 + 脸通过 Canvas 绘制；overlay 飘字 ?/Z/❤ 仍由 DOM 处理
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

  /**
   * 脸部 patch —— 眼睛/嘴巴用中墨 L，符合水墨风
   */
  const FACES = {
    idle: {
      eyes: [
        { x: 3,  y: 8, grid: ["LL","LL"] },
        { x: 11, y: 8, grid: ["LL","LL"] },
      ],
      mouth: null,
    },
    sleepy: {
      // 半闭：上半眼是 M 淡墨，下半还是 L
      eyes: [
        { x: 3,  y: 8, grid: ["MM","LL"] },
        { x: 11, y: 8, grid: ["MM","LL"] },
      ],
      mouth: null,
    },
    sleep: {
      // 闭眼横线，用中墨 L
      eyes: [
        { x: 3,  y: 8, grid: ["LLL"] },
        { x: 10, y: 8, grid: ["LLL"] },
      ],
      mouth: null,
    },
    shock: {
      // 大瞪眼 3×3（外 L + 内 W 反白）
      eyes: [
        { x: 3,  y: 7, grid: ["LLL","LWL","LLL"] },
        { x: 10, y: 7, grid: ["LLL","LWL","LLL"] },
      ],
      mouth: { x: 7, y: 10, grid: ["LL","LL"] },
    },
    happy: {
      // 弯眯眼 + 微笑嘴
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
      // 斜眉（左 \ 右 /）+ 扁嘴
      eyes: [
        { x: 3,  y: 7, grid: ["L..","WL.","WWL"] },
        { x: 10, y: 7, grid: ["..L",".LW","LWW"] },
      ],
      mouth: { x: 6, y: 11, grid: ["LLLL"] },
    },
    love: {
      // 朱砂方块眼 + 小嘴
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

  /** 把字符 grid 绘制到 canvas（origin 是左上 cell） */
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

  class Sprite {
    constructor(petEl) {
      this.el = petEl;
      this.body = petEl.querySelector('.pet-body');
      this.overlay = petEl.querySelector('.pet-overlay');

      // 注入 canvas（若尚未存在）
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
      this._overlayTimer = null;
      this.render('idle');
    }

    setState(state) {
      if (state === this.current) return;
      const faceKey = FACES[state] ? state : (state === 'walk' ? 'idle' : 'idle');
      if (!STATES.includes(state)) state = 'idle';
      this.current = state;

      // 同步到外层 class（用于整体动画：walk-bounce / drag-wobble / angry-shake）
      STATES.forEach((s) => this.el.classList.remove('state-' + s));
      this.el.classList.add('state-' + state);

      this.render(faceKey);
      this._updateOverlay(state);
    }

    render(faceKey) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, 16, 16);
      paintGrid(ctx, BODY);
      const face = FACES[faceKey];
      if (face) {
        for (const eye of face.eyes || []) paintGrid(ctx, eye.grid, eye.x, eye.y);
        if (face.mouth) paintGrid(ctx, face.mouth.grid, face.mouth.x, face.mouth.y);
      }
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

    // 水平晃动桌宠（走路时由 pet.js 调用）
    setOffsetX(px) {
      if (!this.body) return;
      this.body.style.marginLeft = px + 'px';
    }

    pulse() {
      this.el.style.filter = 'brightness(1.3) contrast(1.1)';
      setTimeout(() => { this.el.style.filter = ''; }, 180);
    }
  }

  window.Sprite = Sprite;
})();

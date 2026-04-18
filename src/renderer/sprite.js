// sprite.js —— 水墨风 16×16 NES 像素史莱姆 Canvas 渲染器
// 身体 + 脸通过 Canvas 绘制；overlay 飘字 ?/Z/❤ 仍由 DOM 处理
(function () {
  /* ----- 水墨五色 + 点缀 ----- */
  const INK = {
    '.': null,
    '#': '#17171c',  // 焦墨（硬边描边）
    'B': '#2d2d36',  // 浓墨（主体）
    'L': '#52525c',  // 重墨（次暗）
    'M': '#8c8c96',  // 淡墨（中亮）
    'W': '#e8e0cc',  // 宣纸白（最亮反光）
    'K': '#050507',  // 眼珠纯黑
    'R': '#9c2e24',  // 朱砂（点缀）
  };

  /* ----- 基础身体（16×16） ----- */
  // 每行恰好 16 字符。眼睛和嘴巴位置用 B 占位，由 FACE patch 覆盖
  const BODY = [
    "................",
    "................",
    ".....######.....",
    "....#LMMMML#....",
    "...#LBBBBBBL#...",
    "..#BBBBBBBBBB#..",
    "..#BBBBBBBBBB#..",
    ".#BBBBBBBBBBBB#.",
    ".#BBBBBBBBBBBB#.",
    ".#BBBBBBBBBBBB#.",
    ".#BBBBBBBBBBBB#.",
    "#BBBBBBBBBBBBBB#",
    "#BBBBBBBBBBBBBB#",
    "#BBBBBBBBBBBBBB#",
    "################",
    "................",
  ];

  /**
   * 脸部 patch 定义
   * 每个状态 { eyes: [{x,y,grid[]}, ...], mouth: {x,y,grid[]} | null, shake?: boolean }
   * 空格/. 表示不覆盖该位置，其他字符覆盖原像素
   */
  const FACES = {
    idle: {
      eyes: [
        { x: 3,  y: 8, grid: ["KK","KK"] },
        { x: 11, y: 8, grid: ["KK","KK"] },
      ],
      mouth: null,
    },
    sleepy: {
      // 眼神无光：K 换淡墨 L，整体感觉困
      eyes: [
        { x: 3,  y: 8, grid: ["LL","LL"] },
        { x: 11, y: 8, grid: ["LL","LL"] },
      ],
      mouth: null,
    },
    sleep: {
      // 闭眼 —— 只剩一条横线
      eyes: [
        { x: 3,  y: 8, grid: ["KKK"] },
        { x: 10, y: 8, grid: ["KKK"] },
      ],
      mouth: null,
    },
    shock: {
      // 大瞪眼 3×3 + O 形嘴
      eyes: [
        { x: 3,  y: 7, grid: ["KKK","KKK","KKK"] },
        { x: 10, y: 7, grid: ["KKK","KKK","KKK"] },
      ],
      mouth: { x: 7, y: 10, grid: ["KK","KK"] },
    },
    happy: {
      // 弯眯眼 (^_^) + 微笑
      // 上排是单点，下排是 3 点弧 => 视觉上像眯起笑的眼睛
      eyes: [
        { x: 3,  y: 8, grid: [".K.","KKK"] },
        { x: 10, y: 8, grid: [".K.","KKK"] },
      ],
      mouth: { x: 5, y: 11, grid: ["K....K","KKKKKK"] },
    },
    think: {
      // 眼睛偏上（像在看头顶的问号）
      eyes: [
        { x: 3,  y: 7, grid: ["KK","BB"] },
        { x: 11, y: 7, grid: ["KK","BB"] },
      ],
      mouth: null,
    },
    angry: {
      // 斜眉 + 扁嘴
      // 眉在 row 7 斜向（左眉: \, 右眉: /）
      eyes: [
        { x: 3,  y: 7, grid: ["K..","BK.","BBK"] },   // 左斜眉 + 眼
        { x: 10, y: 7, grid: ["..K",".KB","KBB"] },   // 右斜眉 + 眼
      ],
      mouth: { x: 6, y: 11, grid: ["KKKK"] },
    },
    love: {
      // 朱砂心形眼
      eyes: [
        { x: 3,  y: 8, grid: ["RR","RR"] },
        { x: 11, y: 8, grid: ["RR","RR"] },
      ],
      mouth: { x: 7, y: 11, grid: [".K.","KKK"] },
    },
    drag: {
      // 惊慌 —— 接近 shock 但嘴巴扁
      eyes: [
        { x: 3,  y: 7, grid: ["KKK","KWK","KKK"] },
        { x: 10, y: 7, grid: ["KKK","KWK","KKK"] },
      ],
      mouth: { x: 6, y: 11, grid: ["KKKK"] },
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
      if (state === 'think')  spawnOf('?',  '#e8e0cc');
      else if (state === 'sleep' || state === 'sleepy') spawnOf('Z', '#8c8c96');
      else if (state === 'love')  spawnOf('♥',  '#9c2e24');
      else if (state === 'happy') spawnOf('♪',  '#e8e0cc');
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

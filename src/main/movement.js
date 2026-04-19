// 桌宠移动引擎：缓动位移 + 边缘检测 + 部分出屏探头吸附 + 贴边爬行巡逻
const { screen } = require('electron');

function getPetWin() {
  const { getPetWindow } = require('./window');
  return getPetWindow();
}

let moveTimer = null;
let moveResolve = null; // 当前 moveTo 的 promise resolve（可在被打断时提前 fire）
let currentEdge = 'none';
let currentPeek = null;

// 巡逻（贴边爬行）状态
let patrolTimer = null;        // 下一步定时器
let patrolInFlight = false;    // 是否正在爬一步
let patrolDir = 1;             // ±1：边缘方向（撞墙时反转）
let aiMoving = false;          // AI moveTo 期间不巡逻
let userDragging = false;      // 用户拖拽期间不巡逻

function getPrimaryBounds() {
  return screen.getPrimaryDisplay().workArea;
}

function getWinRect() {
  const win = getPetWin();
  if (!win || win.isDestroyed()) return null;
  const [x, y] = win.getPosition();
  const [w, h] = win.getSize();
  return { x, y, w, h };
}

/** 桌宠所在屏的 workArea —— 用于边缘/peek 检测（多屏感知） */
function getPetDisplayBounds() {
  const rect = getWinRect();
  if (!rect) return getPrimaryBounds();
  try {
    const d = screen.getDisplayNearestPoint({
      x: rect.x + Math.round(rect.w / 2),
      y: rect.y + Math.round(rect.h / 2),
    });
    return d?.workArea || getPrimaryBounds();
  } catch (_) {
    return getPrimaryBounds();
  }
}

/** 目标位置计算：target 语义化 → (x, y) 像素坐标（始终基于主屏） */
function computeTargetPos(target, rect, bounds) {
  const pad = 0; // 允许紧贴边缘（edge-* 的视觉就是要贴墙）
  const cx = bounds.x + Math.round((bounds.width - rect.w) / 2);
  const cy = bounds.y + Math.round((bounds.height - rect.h) / 2);
  switch (target) {
    case 'stay': return [rect.x, rect.y];
    case 'edge-left':   return [bounds.x + pad,                               rect.y];
    case 'edge-right':  return [bounds.x + bounds.width - rect.w - pad,       rect.y];
    case 'edge-top':    return [rect.x,                                       bounds.y + pad];
    case 'edge-bottom': return [rect.x,                                       bounds.y + bounds.height - rect.h - pad];
    case 'corner-tl':   return [bounds.x + pad,                               bounds.y + pad];
    case 'corner-tr':   return [bounds.x + bounds.width - rect.w - pad,       bounds.y + pad];
    case 'corner-bl':   return [bounds.x + pad,                               bounds.y + bounds.height - rect.h - pad];
    case 'corner-br':   return [bounds.x + bounds.width - rect.w - pad,       bounds.y + bounds.height - rect.h - pad];
    case 'center':      return [cx, cy];
    default: return [rect.x, rect.y];
  }
}

/** 把当前 moveTo 动画干净地停下，提前 resolve */
function clearMoveTimer() {
  if (moveTimer) {
    clearInterval(moveTimer);
    moveTimer = null;
  }
  if (moveResolve) {
    const r = moveResolve;
    moveResolve = null;
    r();
  }
}

/** 通用窗口缓动：把窗口从当前位置缓动到 (toX, toY)，返回 Promise */
function animateWindowTo(toX, toY, duration = 1200) {
  return new Promise((resolve) => {
    const win = getPetWin();
    if (!win || win.isDestroyed()) { resolve(); return; }
    const rect = getWinRect();
    if (!rect) { resolve(); return; }
    if (Math.abs(toX - rect.x) < 2 && Math.abs(toY - rect.y) < 2) {
      refreshEdgeState();
      resolve();
      return;
    }

    clearMoveTimer();
    moveResolve = resolve;

    const startT = Date.now();
    const fromX = rect.x, fromY = rect.y;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    moveTimer = setInterval(() => {
      const w = getPetWin();
      if (!w || w.isDestroyed()) { clearMoveTimer(); return; }
      const elapsed = Date.now() - startT;
      const t = Math.min(1, elapsed / duration);
      const e = ease(t);
      const nx = Math.round(fromX + (toX - fromX) * e);
      const ny = Math.round(fromY + (toY - fromY) * e);
      w.setPosition(nx, ny, false);
      refreshEdgeState();
      if (t >= 1) {
        clearMoveTimer();
      }
    }, 16);
  });
}

/** AI 走位：缓动移动到语义目标（基于主屏） */
async function moveTo(target, { duration = 1600 } = {}) {
  if (!target || target === 'stay') return;
  const win = getPetWin();
  if (!win || win.isDestroyed()) return;
  const rect = getWinRect();
  if (!rect) return;
  const bounds = getPrimaryBounds();
  const pos = computeTargetPos(target, rect, bounds);
  if (!pos) return;
  const [toX, toY] = pos.map(Math.round);

  aiMoving = true;
  stopPatrol();
  broadcastMoving(true, target);
  try {
    await animateWindowTo(toX, toY, duration);
  } finally {
    aiMoving = false;
    broadcastMoving(false, target);
    // 走位结束后若已贴边，自动恢复巡逻
    if (currentEdge !== 'none' && !userDragging) startPatrol(currentEdge);
  }
}

/** tick 前保险：桌宠不在主屏就爬回主屏右下 */
async function ensureOnPrimary() {
  const rect = getWinRect();
  if (!rect) return;
  const primary = getPrimaryBounds();
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const onPrimary =
    cx >= primary.x && cx < primary.x + primary.width &&
    cy >= primary.y && cy < primary.y + primary.height;
  if (onPrimary) return;
  await moveTo('corner-br', { duration: 2400 });
}

function broadcastMoving(isMoving, target) {
  const win = getPetWin();
  if (win && !win.isDestroyed()) {
    win.webContents.send('pet:moving', { moving: !!isMoving, target });
  }
}

function broadcastCrawling(on) {
  const win = getPetWin();
  if (win && !win.isDestroyed()) {
    win.webContents.send('pet:crawling', !!on);
  }
}

/** 检测当前贴在哪个边（或 'none'） */
function detectEdge() {
  const rect = getWinRect();
  if (!rect) return 'none';
  const bounds = getPetDisplayBounds();
  const threshold = 8;
  const distLeft = rect.x - bounds.x;
  const distRight = (bounds.x + bounds.width) - (rect.x + rect.w);
  const distTop = rect.y - bounds.y;
  const distBottom = (bounds.y + bounds.height) - (rect.y + rect.h);

  // 出屏（负距离）也算贴边
  if (distLeft <= threshold) return 'left';
  if (distRight <= threshold) return 'right';
  if (distTop <= threshold) return 'top';
  if (distBottom <= threshold) return 'bottom';
  return 'none';
}

/** 检测是否部分出屏 */
function detectPeek() {
  const rect = getWinRect();
  if (!rect) return { side: null };
  const bounds = getPetDisplayBounds();
  const outLeft   = bounds.x - rect.x;
  const outRight  = (rect.x + rect.w) - (bounds.x + bounds.width);
  const outTop    = bounds.y - rect.y;
  const outBottom = (rect.y + rect.h) - (bounds.y + bounds.height);
  const T = 20;
  if (outLeft   > T) return { side: 'left',   out: outLeft };
  if (outRight  > T) return { side: 'right',  out: outRight };
  if (outTop    > T) return { side: 'top',    out: outTop };
  if (outBottom > T) return { side: 'bottom', out: outBottom };
  return { side: null };
}

function refreshEdgeState() {
  const edge = detectEdge();
  const peek = detectPeek();
  const win = getPetWin();
  if (!win || win.isDestroyed()) return;

  if (edge !== currentEdge) {
    const prev = currentEdge;
    currentEdge = edge;
    win.webContents.send('pet:edge-changed', edge);
    // 巡逻启停：从 none → 某边 → 启动；→ none → 停止；换边 → 重启巡逻
    if (edge === 'none') {
      stopPatrol();
    } else if (!aiMoving && !userDragging) {
      startPatrol(edge);
    }
  }
  const peekSide = peek.side || null;
  if (peekSide !== currentPeek) {
    currentPeek = peekSide;
    win.webContents.send('pet:peek-changed', peekSide);
  }
}

/**
 * 用户拖拽释放后：如果窗口超出屏幕"太多"，拉回到只露出约一半身体的位置
 */
function maybeApplyPeekClamp() {
  const rect = getWinRect();
  if (!rect) return;
  const bounds = getPetDisplayBounds();
  const peekKeep = Math.round(rect.w * 0.45); // 屏幕内保留 45%

  const outLeft   = bounds.x - rect.x;
  const outRight  = (rect.x + rect.w) - (bounds.x + bounds.width);
  const outTop    = bounds.y - rect.y;
  const outBottom = (rect.y + rect.h) - (bounds.y + bounds.height);

  let tx = rect.x, ty = rect.y, applied = false;
  if (outLeft > 0) {
    tx = bounds.x - (rect.w - peekKeep);
    applied = true;
  } else if (outRight > 0) {
    tx = bounds.x + bounds.width - peekKeep;
    applied = true;
  }
  if (outTop > 0) {
    ty = bounds.y - (rect.h - peekKeep);
    applied = true;
  } else if (outBottom > 0) {
    ty = bounds.y + bounds.height - peekKeep;
    applied = true;
  }

  if (applied) {
    const win = getPetWin();
    if (win && !win.isDestroyed()) {
      win.setPosition(Math.round(tx), Math.round(ty), false);
    }
  }
  refreshEdgeState();
}

/** 拖拽状态开关（ipc.js 调用），拖拽期间不巡逻 */
function setDragging(on) {
  userDragging = !!on;
  if (userDragging) {
    stopPatrol();
  } else if (currentEdge !== 'none' && !aiMoving) {
    startPatrol(currentEdge);
  }
}

/* -------------------- 贴边爬行巡逻 -------------------- */

function startPatrol(edge) {
  stopPatrol();
  if (!edge || edge === 'none') return;
  patrolDir = Math.random() > 0.5 ? 1 : -1;
  scheduleNextStep(edge);
}

function scheduleNextStep(edge) {
  const delay = 3000 + Math.random() * 2000; // 3-5 秒
  patrolTimer = setTimeout(() => doPatrolStep(edge), delay);
}

async function doPatrolStep(edge) {
  patrolTimer = null;
  // 多重守护：边缘已丢 / AI 正在移动 / 用户正在拖拽 → 不动
  if (currentEdge !== edge || aiMoving || userDragging) return;
  const rect = getWinRect();
  if (!rect) return;
  const bounds = getPetDisplayBounds();

  const dist = (60 + Math.random() * 60) * patrolDir; // 60-120px 带方向
  let toX = rect.x, toY = rect.y;
  if (edge === 'left' || edge === 'right') {
    toY = Math.round(rect.y + dist);
    if (toY < bounds.y) { toY = bounds.y; patrolDir = 1; }
    if (toY + rect.h > bounds.y + bounds.height) {
      toY = bounds.y + bounds.height - rect.h;
      patrolDir = -1;
    }
  } else {
    // top / bottom 边 → 左右爬
    toX = Math.round(rect.x + dist);
    if (toX < bounds.x) { toX = bounds.x; patrolDir = 1; }
    if (toX + rect.w > bounds.x + bounds.width) {
      toX = bounds.x + bounds.width - rect.w;
      patrolDir = -1;
    }
  }

  patrolInFlight = true;
  broadcastCrawling(true);
  try {
    await animateWindowTo(toX, toY, 1200);
  } finally {
    patrolInFlight = false;
    broadcastCrawling(false);
  }

  // 偶尔反向，自然点
  if (Math.random() < 0.25) patrolDir *= -1;

  if (currentEdge === edge && !aiMoving && !userDragging) {
    scheduleNextStep(edge);
  }
}

function stopPatrol() {
  if (patrolTimer) { clearTimeout(patrolTimer); patrolTimer = null; }
  if (patrolInFlight) {
    broadcastCrawling(false);
    patrolInFlight = false;
  }
}

module.exports = {
  moveTo,
  detectEdge,
  detectPeek,
  refreshEdgeState,
  maybeApplyPeekClamp,
  ensureOnPrimary,
  setDragging,
};

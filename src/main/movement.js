// 桌宠移动引擎：缓动位移 + 边缘检测 + 部分出屏探头吸附
const { screen } = require('electron');

function getPetWin() {
  const { getPetWindow } = require('./window');
  return getPetWindow();
}

let moveTimer = null;
let currentEdge = 'none';
let currentPeek = null;

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

/** 目标位置计算：target 语义化 → (x, y) 像素坐标 */
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

/** 缓动移动到目标位置 */
function moveTo(target, { duration = 1600 } = {}) {
  if (!target || target === 'stay') return;
  const win = getPetWin();
  if (!win || win.isDestroyed()) return;
  const rect = getWinRect();
  if (!rect) return;
  const bounds = getPrimaryBounds();
  const pos = computeTargetPos(target, rect, bounds);
  if (!pos) return;
  const [toX, toY] = pos.map(Math.round);
  if (Math.abs(toX - rect.x) < 2 && Math.abs(toY - rect.y) < 2) {
    refreshEdgeState();
    return;
  }

  if (moveTimer) {
    clearInterval(moveTimer);
    moveTimer = null;
  }
  const startT = Date.now();
  const fromX = rect.x, fromY = rect.y;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // 在每一步告诉渲染进程"我正在移动"，渲染可以用它做 walk 动画
  broadcastMoving(true, target);

  moveTimer = setInterval(() => {
    const w = getPetWin();
    if (!w || w.isDestroyed()) {
      clearInterval(moveTimer); moveTimer = null; return;
    }
    const elapsed = Date.now() - startT;
    const t = Math.min(1, elapsed / duration);
    const e = ease(t);
    const nx = Math.round(fromX + (toX - fromX) * e);
    const ny = Math.round(fromY + (toY - fromY) * e);
    w.setPosition(nx, ny, false);
    refreshEdgeState();
    if (t >= 1) {
      clearInterval(moveTimer);
      moveTimer = null;
      broadcastMoving(false, target);
    }
  }, 16);
}

function broadcastMoving(isMoving, target) {
  const win = getPetWin();
  if (win && !win.isDestroyed()) {
    win.webContents.send('pet:moving', { moving: !!isMoving, target });
  }
}

/** 检测当前贴在哪个边（或 'none'） */
function detectEdge() {
  const rect = getWinRect();
  if (!rect) return 'none';
  const bounds = getPrimaryBounds();
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
  const bounds = getPrimaryBounds();
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
    currentEdge = edge;
    win.webContents.send('pet:edge-changed', edge);
  }
  const peekSide = peek.side || null;
  if (peekSide !== currentPeek) {
    currentPeek = peekSide;
    win.webContents.send('pet:peek-changed', peekSide);
  }
}

/**
 * 用户拖拽释放后：如果窗口超出屏幕"太多"，拉回到只露出约一半身体的位置，
 * 让桌宠看起来像在屏幕边缘探头
 */
function maybeApplyPeekClamp() {
  const rect = getWinRect();
  if (!rect) return;
  const bounds = getPrimaryBounds();
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

module.exports = {
  moveTo,
  detectEdge,
  detectPeek,
  refreshEdgeState,
  maybeApplyPeekClamp,
};

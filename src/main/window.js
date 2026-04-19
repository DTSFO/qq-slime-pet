// 主进程窗口管理：桌宠唯一窗口（设置以 overlay 形式叠在同一窗口内）
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { getConfig, setConfig } = require('../config/store');

let petWindow = null;

function clampToDisplay(x, y, w, h) {
  const displays = screen.getAllDisplays();
  const inSomeDisplay = displays.some((d) => {
    const b = d.bounds;
    return x >= b.x && y >= b.y && x + w <= b.x + b.width && y + h <= b.y + b.height;
  });
  if (inSomeDisplay) return { x, y };
  const primary = screen.getPrimaryDisplay().workArea;
  return {
    x: primary.x + Math.floor((primary.width - w) / 2),
    y: primary.y + Math.floor((primary.height - h) / 2),
  };
}

function createPetWindow() {
  if (petWindow && !petWindow.isDestroyed()) return petWindow;

  const cfg = getConfig();
  const size = cfg.pet?.size || 220;
  // 窗口高度给气泡留空间（桌宠本体贴底，上方 60% 高度放气泡）
  const winW = size;
  const winH = Math.round(size * 1.65);

  const saved = cfg.pet?.position || {};
  const primary = screen.getPrimaryDisplay().workArea;
  const defaultX = primary.x + primary.width - winW - 40;
  const defaultY = primary.y + primary.height - winH - 80;

  const pos = clampToDisplay(
    saved.x == null ? defaultX : saved.x,
    saved.y == null ? defaultY : saved.y,
    winW,
    winH
  );

  petWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: pos.x,
    y: pos.y,
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: cfg.pet?.alwaysOnTop !== false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  if (cfg.pet?.alwaysOnTop !== false) {
    petWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  // 关键：setContentProtection(true) —— 让桌宠在屏幕上可见，但对所有截图工具
  // (desktopCapturer / PrintScreen / Snipaste / OBS …) 不可见。
  // 这样 AI 定时截屏不会拍到桌宠本体，也不需要 hide/show 导致闪烁消失
  if (cfg.capture?.excludeSelf !== false) {
    petWindow.setContentProtection(true);
  }

  petWindow.setIgnoreMouseEvents(true, { forward: true });

  petWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  petWindow.on('moved', () => {
    if (!petWindow) return;
    // overlay 打开时会 setBounds 到居中大尺寸，不应写入 config
    if (settingsOpen) return;
    const [x, y] = petWindow.getPosition();
    setConfig({ pet: { position: { x, y } } });
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });

  return petWindow;
}

function getPetWindow() {
  return petWindow && !petWindow.isDestroyed() ? petWindow : null;
}

/* ==========================================================
   设置 Overlay —— 主窗口内嵌的设置面板，切一个 class 即可显示，
   消除了独立 BrowserWindow 的冷启动和双窗口 DWM 合成开销
   ========================================================== */

let settingsOpen = false;
let savedBounds = null;              // overlay 前的窗口 bounds
let savedAlwaysOnTop = true;         // overlay 前的 always-on-top 级别
let savedContentProtection = true;   // overlay 前的 content protection
let savedAgentRunning = false;       // overlay 前 AI 是否在跑

function openSettingsOverlay() {
  const win = getPetWindow();
  if (!win || win.isDestroyed() || settingsOpen) return;
  settingsOpen = true;

  // 记录 overlay 前状态
  const [x, y] = win.getPosition();
  const [w, h] = win.getSize();
  savedBounds = { x, y, width: w, height: h };
  const cfg = getConfig();
  savedAlwaysOnTop = cfg.pet?.alwaysOnTop !== false;
  savedContentProtection = cfg.capture?.excludeSelf !== false;

  // 暂停 AI agent —— 避免 overlay 打开时截到自己 + 省 GPU
  try {
    const { isAgentRunning, stopAgent } = require('../ai/agent');
    savedAgentRunning = isAgentRunning();
    if (savedAgentRunning) stopAgent();
  } catch (_) { savedAgentRunning = false; }

  // 关掉 content protection，让用户和录屏看到设置面板
  try { win.setContentProtection(false); } catch (_) {}

  // 关掉 click-through，overlay 要接收点击
  try { win.setIgnoreMouseEvents(false); } catch (_) {}

  // 居中到桌宠当前所在屏
  try {
    const d = screen.getDisplayNearestPoint({ x: x + w / 2, y: y + h / 2 });
    const area = d.workArea;
    const newW = 640, newH = 720;
    const newX = Math.round(area.x + (area.width - newW) / 2);
    const newY = Math.round(area.y + (area.height - newH) / 2);
    win.setBounds({ x: newX, y: newY, width: newW, height: newH }, false);
  } catch (_) {}

  // 降到 floating 级（screen-saver 会挡系统弹窗）
  try { win.setAlwaysOnTop(true, 'floating'); } catch (_) {}

  // 广播给渲染进程：overlay 显示
  try { win.webContents.send('settings:show'); } catch (_) {}

  // 把焦点给主窗口，让输入框可聚焦
  try { win.focus(); } catch (_) {}
}

function closeSettingsOverlay() {
  const win = getPetWindow();
  if (!win || win.isDestroyed() || !settingsOpen) return;
  settingsOpen = false;

  // 先通知渲染进程，这样 overlay 能在窗口 resize 前淡出
  try { win.webContents.send('settings:hide'); } catch (_) {}

  // 恢复窗口几何
  if (savedBounds) {
    try { win.setBounds(savedBounds, false); } catch (_) {}
    savedBounds = null;
  }

  // 恢复窗口属性
  try { win.setContentProtection(savedContentProtection); } catch (_) {}
  try { win.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
  try {
    if (savedAlwaysOnTop) win.setAlwaysOnTop(true, 'screen-saver');
    else win.setAlwaysOnTop(false);
  } catch (_) {}

  // 恢复 AI agent（若 settings:save 已经 start 过，这里不会重复，因 startAgent 内部有 running 守护）
  if (savedAgentRunning) {
    try {
      const { isAgentRunning, startAgent } = require('../ai/agent');
      if (!isAgentRunning()) startAgent();
    } catch (_) {}
  }
  savedAgentRunning = false;
}

function isSettingsOpen() { return settingsOpen; }

/** 优雅退出：先广播 pet:farewell 让渲染进程播退场动画，900ms 后 app.exit */
let quitting = false;
function performGracefulQuit({ delayMs = 900 } = {}) {
  if (quitting) return;
  quitting = true;
  try {
    const { stopAgent } = require('../ai/agent');
    stopAgent();
  } catch (_) {}
  const win = getPetWindow();
  if (win && !win.isDestroyed()) {
    try { win.webContents.send('pet:farewell'); } catch (_) {}
  }
  setTimeout(() => {
    try {
      const { app } = require('electron');
      app.exit(0);
    } catch (_) {}
  }, delayMs);
}

module.exports = {
  createPetWindow,
  getPetWindow,
  openSettingsOverlay,
  closeSettingsOverlay,
  isSettingsOpen,
  performGracefulQuit,
};

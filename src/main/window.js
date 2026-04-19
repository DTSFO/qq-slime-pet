// 主进程窗口管理：创建桌宠透明置顶窗口 + 独立设置窗口
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { getConfig, setConfig } = require('../config/store');

let petWindow = null;
let settingsWindow = null;

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

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 720,
    title: 'QQ糖桌宠 - 设置',
    resizable: true,
    minimizable: true,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e1f26',
    // 先隐藏，等内容准备好再显示，避免白屏闪烁 / 帧率掉
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false, // 设置窗口不后台节流
      // 开启 disk 缓存，避免每次重加载
      v8CacheOptions: 'code',
    },
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'settings.html'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    settingsWindow.focus();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

function getSettingsWindow() {
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null;
}

function closeSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
}

/** 优雅退出：先广播 pet:farewell 让渲染进程播退场动画，900ms 后 app.exit */
let quitting = false;
function performGracefulQuit({ delayMs = 900 } = {}) {
  if (quitting) return;
  quitting = true;
  const { app } = require('electron');
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
      const { app: a } = require('electron');
      a.exit(0);
    } catch (_) {}
  }, delayMs);
}

module.exports = {
  createPetWindow,
  getPetWindow,
  createSettingsWindow,
  getSettingsWindow,
  closeSettingsWindow,
  performGracefulQuit,
};

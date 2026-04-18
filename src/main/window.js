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
  const saved = cfg.pet?.position || {};
  const primary = screen.getPrimaryDisplay().workArea;
  const defaultX = primary.x + primary.width - size - 40;
  const defaultY = primary.y + primary.height - size - 80;

  const pos = clampToDisplay(
    saved.x == null ? defaultX : saved.x,
    saved.y == null ? defaultY : saved.y,
    size,
    size
  );

  petWindow = new BrowserWindow({
    width: size,
    height: size,
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
      sandbox: false, // 允许 preload 使用 require
    },
  });

  if (cfg.pet?.alwaysOnTop !== false) {
    petWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  // 默认穿透，渲染进程检测到指针落在史莱姆身上时再关闭
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
    height: 680,
    title: 'QQ糖桌宠 - 设置',
    resizable: true,
    minimizable: true,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e1f26',
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'settings.html'));

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

module.exports = {
  createPetWindow,
  getPetWindow,
  createSettingsWindow,
  getSettingsWindow,
  closeSettingsWindow,
};

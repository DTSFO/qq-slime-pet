// 系统托盘：右键菜单 + 快速开关 AI + 打开设置 + 退出
const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { createSettingsWindow } = require('./window');
const { getConfig, setConfig } = require('../config/store');
const { startAgent, stopAgent, isAgentRunning } = require('../ai/agent');

let tray = null;

// 内嵌 16×16 PNG（史莱姆剪影），防止没有外部 icon.png 时崩溃
// 一个最简单的绿色圆点 base64
const FALLBACK_ICON_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAXElEQVR42mNkwA/+M5IgyMTAwMDw' +
    'HxvAJoiuAJsCdAXYFKArwKYAXQGxBuAyCKcVxLgAmytw+Z1oA9ANwGUALm/gBNgMwOVdnAbgMgCX' +
    'iwkagMsr6HGACwAAhsEN9dK0YHAAAAAASUVORK5CYII=',
  'base64'
);

function loadTrayIcon() {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img;
  }
  return nativeImage.createFromBuffer(FALLBACK_ICON_PNG);
}

function createTray() {
  if (tray) return tray;
  tray = new Tray(loadTrayIcon());
  tray.setToolTip('QQ糖桌宠');
  refreshMenu();
  tray.on('double-click', () => createSettingsWindow());
  return tray;
}

function refreshMenu() {
  if (!tray) return;
  const cfg = getConfig();
  const menu = Menu.buildFromTemplate([
    {
      label: `桌宠：${cfg.pet?.petName || 'QQ糖'}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isAgentRunning() ? '暂停 AI 观察' : '启动 AI 观察',
      click: () => {
        if (isAgentRunning()) {
          stopAgent();
        } else {
          startAgent();
        }
        refreshMenu();
      },
    },
    {
      label: '打开设置',
      click: () => createSettingsWindow(),
    },
    {
      label: '置顶',
      type: 'checkbox',
      checked: !!cfg.pet?.alwaysOnTop,
      click: (item) => {
        setConfig({ pet: { alwaysOnTop: item.checked } });
        const { getPetWindow } = require('./window');
        const w = getPetWindow();
        if (w) w.setAlwaysOnTop(item.checked, 'screen-saver');
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        stopAgent();
        app.exit(0);
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { createTray, refreshMenu, destroyTray };

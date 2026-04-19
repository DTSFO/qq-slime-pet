// Electron 主进程入口：创建窗口、注册 IPC、启动 AI 智能体循环
const { app, BrowserWindow } = require('electron');
const path = require('path');

const { createPetWindow, getPetWindow } = require('./src/main/window');
const { registerIpcHandlers } = require('./src/main/ipc');
const { createTray } = require('./src/main/tray');
const { startAgent, stopAgent } = require('./src/ai/agent');
const { getConfig } = require('./src/config/store');

// ---- 性能/渲染开关（必须在 app.ready 前调用） ----
// 启用 GPU 光栅化，改善合成帧率（Electron 33 默认开启，这里兜底）
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
// 对于透明/置顶窗口，减少 DWM 抖动
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// 单实例锁：防止开多只桌宠
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  const win = getPetWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

// 透明窗口在 Windows 下有时需要禁用 GPU 硬件加速才稳；这里用软件合成避免黑闪
// app.disableHardwareAcceleration();  // 如遇到黑闪再打开

app.whenReady().then(async () => {
  createPetWindow();
  registerIpcHandlers();
  createTray();

  const cfg = getConfig();
  if (cfg.ai?.enabled && cfg.ai?.apiKey) {
    startAgent();
  }
});

app.on('window-all-closed', (e) => {
  // 关闭所有窗口不退出 App（桌宠可能最小化到托盘）
  e.preventDefault();
});

app.on('before-quit', () => {
  stopAgent();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createPetWindow();
  }
});

// 主进程 IPC 集中注册
const { ipcMain, Menu, screen, app } = require('electron');
const {
  getPetWindow,
  createSettingsWindow,
  closeSettingsWindow,
} = require('./window');
const { getConfig, setConfig, getPublicConfig } = require('../config/store');
const { send: aiSend, listModels } = require('../ai/adapter');
const {
  startAgent,
  stopAgent,
  isAgentRunning,
  triggerManualChat,
} = require('../ai/agent');
const { refreshMenu } = require('./tray');

function registerIpcHandlers() {
  // ---- 窗口拖拽 ----
  let dragging = false;
  let dragStart = null; // { mouseX, mouseY, winX, winY }

  ipcMain.handle('pet:drag-start', () => {
    const win = getPetWindow();
    if (!win) return;
    dragging = true;
    const pos = screen.getCursorScreenPoint();
    const [wx, wy] = win.getPosition();
    dragStart = { mouseX: pos.x, mouseY: pos.y, winX: wx, winY: wy };
  });

  ipcMain.handle('pet:drag-move', () => {
    if (!dragging || !dragStart) return;
    const win = getPetWindow();
    if (!win) return;
    const pos = screen.getCursorScreenPoint();
    const nx = dragStart.winX + (pos.x - dragStart.mouseX);
    const ny = dragStart.winY + (pos.y - dragStart.mouseY);
    win.setPosition(nx, ny, false);
  });

  ipcMain.handle('pet:drag-end', () => {
    dragging = false;
    dragStart = null;
    const win = getPetWindow();
    if (win) {
      const [x, y] = win.getPosition();
      setConfig({ pet: { position: { x, y } } });
    }
  });

  // ---- 鼠标穿透 ----
  ipcMain.handle('pet:set-clickthrough', (_e, enabled) => {
    const win = getPetWindow();
    if (!win) return;
    if (enabled) {
      win.setIgnoreMouseEvents(true, { forward: true });
    } else {
      win.setIgnoreMouseEvents(false);
    }
  });

  // ---- 右键菜单 ----
  ipcMain.handle('pet:context-menu', () => {
    const win = getPetWindow();
    if (!win) return;
    const menu = Menu.buildFromTemplate([
      {
        label: isAgentRunning() ? '暂停 AI 观察' : '启动 AI 观察',
        click: () => {
          if (isAgentRunning()) stopAgent();
          else startAgent();
          refreshMenu();
        },
      },
      {
        label: '和桌宠说话',
        click: () => triggerManualChat(),
      },
      { type: 'separator' },
      {
        label: '打开设置',
        click: () => createSettingsWindow(),
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
    menu.popup({ window: win });
  });

  // ---- AI 手动对话（渲染触发） ----
  ipcMain.handle('ai:chat', async (_e, payload) => {
    try {
      return await triggerManualChat(payload);
    } catch (err) {
      return { error: String(err && err.message || err) };
    }
  });

  // ---- AI 连接测试 ----
  ipcMain.handle('ai:test-connection', async (_e, cfgOverride) => {
    try {
      const cfg = { ...getConfig().ai, ...(cfgOverride || {}) };
      const r = await aiSend({
        systemPrompt: '你是一个测试 bot，只回复"OK"两个字。',
        userText: 'ping',
        imageBase64: null,
        config: cfg,
      });
      return { ok: true, text: r.text?.slice(0, 100) };
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) };
    }
  });

  // ---- AI 模型列表 ----
  ipcMain.handle('ai:list-models', async (_e, cfgOverride) => {
    try {
      const cfg = { ...getConfig().ai, ...(cfgOverride || {}) };
      const models = await listModels(cfg);
      return { ok: true, models };
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) };
    }
  });

  // ---- 配置 ----
  ipcMain.handle('config:get-public', () => getPublicConfig());
  ipcMain.handle('config:set', (_e, partial) => {
    setConfig(partial || {});
    return getPublicConfig();
  });

  // ---- 设置窗口 ----
  ipcMain.handle('settings:open', () => {
    createSettingsWindow();
  });
  ipcMain.handle('settings:close', () => closeSettingsWindow());
  ipcMain.handle('settings:save', (_e, cfg) => {
    setConfig(cfg || {});
    // 配置变更后重启 agent
    const wasRunning = isAgentRunning();
    stopAgent();
    const newCfg = getConfig();
    if (newCfg.ai?.enabled && newCfg.ai?.apiKey) {
      startAgent();
    }
    refreshMenu();
    return { ok: true, agentRunning: isAgentRunning(), wasRunning };
  });

  // ---- 位置保存 ----
  ipcMain.handle('pet:save-position', (_e, { x, y }) => {
    setConfig({ pet: { position: { x, y } } });
  });

  // ---- 智能体开关 ----
  ipcMain.handle('agent:toggle', (_e, on) => {
    if (on) startAgent();
    else stopAgent();
    refreshMenu();
    return { running: isAgentRunning() };
  });
}

module.exports = { registerIpcHandlers };

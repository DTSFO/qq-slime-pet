// Preload：通过 contextBridge 暴露白名单 IPC 给渲染进程，隔离敏感能力
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  // 拖拽相关
  dragStart: () => ipcRenderer.invoke('pet:drag-start'),
  dragMove: (dx, dy) => ipcRenderer.invoke('pet:drag-move', { dx, dy }),
  dragEnd: () => ipcRenderer.invoke('pet:drag-end'),

  // 鼠标穿透切换
  setClickThrough: (enabled) =>
    ipcRenderer.invoke('pet:set-clickthrough', !!enabled),

  // 右键菜单
  contextMenu: (x, y) => ipcRenderer.invoke('pet:context-menu', { x, y }),

  // AI 聊天（渲染主动触发一次）
  chat: (payload) => ipcRenderer.invoke('ai:chat', payload),

  // 监听主进程定时推送的 AI 反应
  onAIEvent: (handler) => {
    const listener = (_ev, data) => handler(data);
    ipcRenderer.on('ai:tick-event', listener);
    return () => ipcRenderer.removeListener('ai:tick-event', listener);
  },

  // 监听边缘/探头/移动状态变化
  onEdgeChanged: (handler) => {
    const listener = (_ev, edge) => handler(edge);
    ipcRenderer.on('pet:edge-changed', listener);
    return () => ipcRenderer.removeListener('pet:edge-changed', listener);
  },
  onPeekChanged: (handler) => {
    const listener = (_ev, side) => handler(side);
    ipcRenderer.on('pet:peek-changed', listener);
    return () => ipcRenderer.removeListener('pet:peek-changed', listener);
  },
  onMoving: (handler) => {
    const listener = (_ev, data) => handler(data);
    ipcRenderer.on('pet:moving', listener);
    return () => ipcRenderer.removeListener('pet:moving', listener);
  },
  onCrawling: (handler) => {
    const listener = (_ev, on) => handler(on);
    ipcRenderer.on('pet:crawling', listener);
    return () => ipcRenderer.removeListener('pet:crawling', listener);
  },
  onFarewell: (handler) => {
    const listener = (_ev, name) => handler(name);
    ipcRenderer.on('pet:farewell', listener);
    return () => ipcRenderer.removeListener('pet:farewell', listener);
  },
  onSettingsToggle: (handler) => {
    const showL = () => handler(true);
    const hideL = () => handler(false);
    ipcRenderer.on('settings:show', showL);
    ipcRenderer.on('settings:hide', hideL);
    return () => {
      ipcRenderer.removeListener('settings:show', showL);
      ipcRenderer.removeListener('settings:hide', hideL);
    };
  },

  // 配置读写（脱敏）
  getConfig: () => ipcRenderer.invoke('config:get-public'),
  setConfig: (partial) => ipcRenderer.invoke('config:set', partial),

  // 设置窗口控制
  openSettings: () => ipcRenderer.invoke('settings:open'),
  closeSettings: () => ipcRenderer.invoke('settings:close'),
  saveSettings: (cfg) => ipcRenderer.invoke('settings:save', cfg),
  testConnection: (cfg) => ipcRenderer.invoke('ai:test-connection', cfg),
  listModels: (cfg) => ipcRenderer.invoke('ai:list-models', cfg),

  // 位置同步
  savePosition: (x, y) => ipcRenderer.invoke('pet:save-position', { x, y }),

  // 托盘 / 智能体控制
  toggleAgent: (on) => ipcRenderer.invoke('agent:toggle', !!on),
});

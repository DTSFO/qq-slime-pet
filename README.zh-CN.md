# 🍮 QQ糖桌宠 — 水墨像素风桌面 AI 智能体

> [English](./README.md) · **简体中文**

一只水墨像素风的小史莱姆，蹲在你桌面一角，通过多模态 AI 看你的屏幕，然后冒出吐槽、卖萌动画和根据情境走位的反应。基于 Electron，零美术素材 —— 身子完全用 CSS / Canvas 像素画出来的。

[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-lightgrey.svg)](https://unlicense.org/)
[![Electron](https://img.shields.io/badge/electron-33.x-47848f.svg)](https://www.electronjs.org/)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)]()

---

## 🚨 隐私与安全须知（使用前必读）

本应用会**定期截取你主屏幕的画面**，并发送到**你自己配置的第三方 AI 服务**（Anthropic / OpenAI / 任何你配置的兼容代理或本地模型）。使用本应用即表示你已知悉：

> ### ⚠️ **截图内容会离开你的设备。**
>
> - 每张截图都会上传到你在设置面板中**自行配置**的 API 端点。截图**不会**发给本项目作者或任何其他服务器。
> - 截图以 base64 编码嵌入多模态请求体。其隐私政策和留存规则由你选择的 AI 服务商决定，与本项目无关。
> - 应用运行时屏幕上出现的**一切内容**由你本人负责。如果你在处理**密码、支付信息、私密对话、保密代码、病历、涉密材料或受 NDA / 法规约束的内容**，请从托盘菜单暂停 AI，或干脆不要启用截图。
> - 默认配置保守：未填 API Key 和启用前不截图，截图间隔默认 60 秒,托盘图标可随时暂停。
> - 本项目是业余 / 学习性质的作品。作者以 Unlicense（公共领域）"按现状"提供，**不承担任何质保、支持义务或责任**，包括但不限于数据泄露、隐私事故、意外的 API 账单或其他由使用本软件引发的后果。见 [LICENSE](./LICENSE)。
> - 运行前请自行审阅源码 —— 全部在 `src/` 下，所有网络请求都走 `src/ai/protocol-*.js`，完全透明。

**如果以上任何一条你不能接受，请不要安装或运行本应用。**

---

## ✨ 特性

- 🖼️ **纯 CSS / Canvas 像素史莱姆** —— 水墨风（幽灵白主体 + 墨晕阴影），无外部美术素材。16×16 像素 sprite 放大 8 倍。
- 🎭 **10 种动画状态** —— idle / walk / sleep / sleepy / shock / happy / think / angry / love / drag，全部由 AI 或交互驱动。
- 👻 **真正的后台运行** —— `setContentProtection(true)` 让桌宠对 `desktopCapturer`、PrintScreen、Snipaste、OBS 等截屏工具完全不可见。AI 可以截屏**且不会截到自己**，没有闪烁，没有藏显循环。
- 🧠 **三协议 AI 后端** —— 你可以自由选择：
  - `messages` —— Anthropic `/v1/messages`
  - `chat` —— OpenAI 兼容 `/v1/chat/completions`
  - `responses` —— OpenAI `/v1/responses`
- 🔄 **模型自动发现** —— 填好 endpoint + API Key,点 ↻ 自动拉取可用模型列表。自制下拉(支持输入过滤 + 点击选择)。
- 🗺️ **AI 智能走位** —— 模型根据屏幕内容决定桌宠去哪儿：
  - 全屏视频 / 游戏 → 滑到 `corner-br` 不挡路
  - IDE / 文档 → 停在 `edge-right` 低调待命
  - 空闲桌面 → 移到 `center` 玩耍
- 🧲 **边缘吸附 + 爬墙动画** —— 贴边时自动旋转 90/180°,"贴墙"姿态。
- 👀 **出屏探头** —— 拖出屏幕松手后,自动回拉到露出约 45% 身子的位置,配探头摇摆动画。
- 💬 **宣纸吐字气泡** + 打字机效果 —— 长度够放长台词,位置动态调整。
- 🖱️ **透明穿透窗口** —— 仅桌宠的像素区域响应点击,其他区域透传到桌面。
- 🗄️ **配置持久化** —— API Key、提示词、截图间隔、桌宠大小 / 名字、位置全部通过 `electron-store` 保存。
- 🔒 **默认安全** —— API Key 只存在主进程,不会暴露给渲染进程。contextIsolation + sandbox + 严格 CSP。
- 🟢 **托盘菜单** —— 切换 AI、打开设置、置顶开关、退出。

---

## 🖼️ 视觉效果

```
 幽灵白像素主体 + 三层墨晕 drop-shadow
 墨色像素眼（#3e3d48）,LOVE 状态加赭红点缀

                    ___________
                   / ( ·· )_ / )
                  /  ¯¯¯¯¯¯   ¯¯\        ← 宣纸气泡
                  \____________/
                        v
                     ██████
                   ████████████
                  ██ ▄▄  ▄▄ ██       ← 像素史莱姆
                  ██ ██  ██ ██       ← 自动放大到 128×128,像素化渲染
                  ████████████
                  ██████████████
                  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← 底部墨沉
               ~~~~~~~~~~~~~~~~~~
               ↑ 模糊墨晕
```

想一次看全 10 种状态，用任意浏览器打开 `preview.html` 即可。

---

## 🚀 快速开始

### 1. 克隆与安装

```bash
git clone https://github.com/DTSFO/qq-slime-pet.git
cd qq-slime-pet
npm install
```

> **SSL 证书报错 / Electron 下载超慢？** 仓库里已经带了 `.npmrc`，把 Electron 二进制源指向 `npmmirror.com`（国内 / 严苛防火墙环境更友好）。如果还是装不上：
> ```bash
> rm -rf node_modules && npm install
> # 或在 Node 22+ 上强制使用系统 CA：
> NODE_OPTIONS=--use-system-ca npm install
> ```

### 2. 运行

```bash
npm start
```

一只水墨像素小史莱姆会从主屏幕右下角淡入，开始呼吸动画。

### 3. 配置 AI（可选但强烈推荐）

右键桌宠 → **打开设置**，或双击托盘图标。

| 字段 | 示例 |
|---|---|
| API 协议 | `messages` |
| Endpoint | `https://api.anthropic.com` |
| API Key | `sk-ant-...`（仅本地保存） |
| 模型 | 点 ↻ 拉列表，然后选或输入 |
| 系统提示词 | 可编辑，但请保留末尾的 JSON 契约 |
| 截图间隔 | 默认 60 秒 |

点 **保存** —— 约 5 秒后 Agent 自动启动，开始按间隔观察屏幕。

#### 后端选项

<details>
<summary><b>Anthropic Claude</b>（视觉能力推荐）</summary>

```
Protocol: messages
Endpoint: https://api.anthropic.com
Model:    claude-sonnet-4-6 | claude-opus-4-7 | claude-haiku-4-5-20251001
```
</details>

<details>
<summary><b>OpenAI</b></summary>

```
Protocol: chat          （或新版 API 用 responses）
Endpoint: https://api.openai.com
Model:    gpt-4.1-mini | gpt-4o | 任何支持视觉的模型
```
</details>

<details>
<summary><b>本地模型（Ollama 等）</b></summary>

```
Protocol: chat
Endpoint: http://localhost:11434
Model:    llama3.2-vision | qwen2-vl | 任意多模态模型
API Key:  随便填非空值（Ollama 不校验）
```
</details>

<details>
<summary><b>OpenAI 兼容代理</b></summary>

用 `chat` 或 `responses` 协议，把 Endpoint 指向代理的 base URL，API Key 按代理文档配置。任何镜像 OpenAI schema 的服务都能用。
</details>

---

## 🎮 交互

| 操作 | 效果 |
|---|---|
| **左键点桌宠** | 戳一下 —— 触发一次 AI 回应（不截图，便宜） |
| **拖拽** | 拎起来扔到任何位置 |
| **拖出屏幕** | 自动吸回边缘，露出约 45% 身子 + 探头摇摆 |
| **右键点桌宠** | 上下文菜单：暂停 AI、手动对话、设置、退出 |
| **托盘图标** | 同样的菜单，加置顶切换 |
| **静坐 > 3 分钟** | 犯困 |
| **静坐 > 5 分钟** | 睡着（Zzz 覆盖） |
| **睡着状态下任意交互** | 吓一跳，醒来 |

---

## 🧩 AI 响应契约

系统提示词会强制模型**只回严格 JSON**：

```json
{
  "emotion": "happy" | "shock" | "think" | "angry" | "sleepy" | "love" | "idle",
  "action":  "idle" | "walk" | "jump" | "sleep",
  "speech":  "<不超过 30 个中文字符>",
  "duration": 4,
  "move":    "stay" | "edge-left" | "edge-right" | "edge-top" | "edge-bottom"
           | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br" | "center"
}
```

解析降级链：`JSON.parse` → 正则抽取 `\{[\s\S]*\}` → 把原文当作 `speech`，`emotion` 默认 `"think"`。未知枚举值会回落到安全默认值。

---

## 🔌 协议请求结构

<details>
<summary><code>messages</code>（Anthropic）</summary>

```http
POST {endpoint}/v1/messages
x-api-key: <key>
anthropic-version: 2023-06-01

{
  "model": "claude-sonnet-4-6",
  "max_tokens": 512,
  "system": "<systemPrompt>",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "..."}},
      {"type": "text",  "text": "<userText>"}
    ]
  }]
}
```

响应提取：`response.content[*].text`
</details>

<details>
<summary><code>chat</code>（OpenAI Chat Completions）</summary>

```http
POST {endpoint}/v1/chat/completions
Authorization: Bearer <key>

{
  "model": "gpt-4.1-mini",
  "messages": [
    {"role": "system", "content": "<systemPrompt>"},
    {"role": "user",   "content": [
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}},
      {"type": "text",      "text": "<userText>"}
    ]}
  ]
}
```

响应提取：`response.choices[0].message.content`
</details>

<details>
<summary><code>responses</code>（OpenAI Responses）</summary>

```http
POST {endpoint}/v1/responses
Authorization: Bearer <key>

{
  "model": "gpt-4.1-mini",
  "instructions": "<systemPrompt>",
  "input": [{
    "role": "user",
    "content": [
      {"type": "input_image", "image_url": "data:image/png;base64,..."},
      {"type": "input_text",  "text": "<userText>"}
    ]
  }]
}
```

响应提取：`response.output_text` → 降级到 `response.output[*].content[*].text`
</details>

三个适配器共享统一接口：`adapter.send({systemPrompt, userText, imageBase64, config}) → {text, raw}`。

模型发现通过 `GET {endpoint}/v1/models`（带对应认证头）完成，支持 `{data: []}` / `{models: []}` / 原始数组三种响应形态。

---

## 🏗️ 架构

```
 主进程                                   渲染进程（桌宠窗口）
 ─────────────────                        ────────────────────
 main.js
  ├─ window.js        （桌宠 + 设置）      index.html
  │    setContentProtection(true)          ├─ pet.js       状态机
  ├─ capture.js       desktopCapturer      ├─ sprite.js    canvas 画像素
  ├─ movement.js      平滑走位 + 边缘       ├─ bubble.js    打字机气泡
  ├─ tray.js          系统托盘              ├─ drag.js      穿透切换
  ├─ ipc.js           handler 注册表        └─ style.css    动画 + 墨晕
  └─ ai/
       adapter.js     按协议派发
       protocol-messages / chat / responses
       agent.js       60s 循环 → 截图 → API → 广播 → 走位
       prompt.js      系统提示词 + 解析器

 IPC 通道（preload.js 白名单暴露）：
   ai:chat, ai:tick-event, ai:list-models, ai:test-connection
   pet:drag-{start,move,end}, pet:set-clickthrough, pet:context-menu
   pet:edge-changed, pet:peek-changed, pet:moving
   settings:{open,close,save}, config:{get-public,set}
```

---

## 📁 目录结构

```
qq-slime-pet/
├── main.js                         # Electron 主入口
├── preload.js                      # 通过 contextBridge 暴露白名单 IPC
├── package.json                    # Electron + electron-store + electron-builder
├── .npmrc                          # Electron 二进制镜像（内网友好）
├── LICENSE                         # Unlicense（公共领域）
├── preview.html                    # 浏览器打开即可看全 10 种状态
├── src/
│   ├── index.html                  # 桌宠窗口
│   ├── settings.html               # 设置面板
│   ├── renderer/
│   │   ├── pet.js                  # 状态机 + 事件订阅
│   │   ├── sprite.js               # 16×16 身体 + 脸补丁，canvas 渲染
│   │   ├── bubble.js               # 气泡 + 打字机
│   │   ├── drag.js                 # 命中检测 + 穿透切换
│   │   └── style.css               # 全部 CSS、动画、边缘/探头状态
│   ├── ai/
│   │   ├── agent.js                # 截图 → API → 广播 → 走位
│   │   ├── adapter.js              # 协议派发 + listModels
│   │   ├── protocol-messages.js    # Anthropic 适配器
│   │   ├── protocol-chat.js        # OpenAI Chat Completions 适配器
│   │   ├── protocol-responses.js   # OpenAI Responses 适配器
│   │   └── prompt.js               # 系统提示词 + JSON 解析器
│   ├── main/
│   │   ├── window.js               # BrowserWindow 创建 / 位置夹持
│   │   ├── capture.js              # desktopCapturer + 压缩
│   │   ├── movement.js             # 平滑缓动、边缘检测、探头夹持
│   │   ├── tray.js                 # 系统托盘菜单
│   │   └── ipc.js                  # 所有 IPC handler
│   ├── config/
│   │   └── store.js                # electron-store 封装 + 默认值
│   └── settings/
│       └── settings.js             # 设置面板逻辑 + 自制下拉
└── assets/
    └── icon.png                    # 托盘 / 打包图标（可选）
```

---

## 🧪 开发

```bash
npm run dev     # 开日志
npm start       # 正常运行
npm run pack    # electron-builder 解压目录
npm run dist    # 完整安装包（NSIS / DMG / AppImage）
```

配置文件位置：

| 系统 | 路径 |
|---|---|
| Windows | `%APPDATA%\qq-slime-pet\config.json` |
| macOS   | `~/Library/Application Support/qq-slime-pet/config.json` |
| Linux   | `~/.config/qq-slime-pet/config.json` |

### 桌宠窗口里的调试控制台

桌宠窗口是真正的 Electron 渲染进程，可以开 DevTools（托盘菜单没有暴露入口 —— 聚焦桌宠后按 `Ctrl+Shift+I`，或在 `window.js` 里临时加 `petWindow.webContents.openDevTools({mode:'detach'})`）。有用的全局对象：

```js
window.__petDebug.setState('happy')   // 强制切换情绪
window.__petDebug.say('hi', 5)        // 显示气泡 5 秒
window.__petDebug.getState()          // 当前状态
```

---

## 🧠 AI 走位原理

每次 tick，LLM 看截图 → 决定桌宠该去哪 → 返回（例如）`"move": "corner-br"`。主进程 `movement.js`：

1. 按主屏幕计算目标像素坐标。
2. 起一个 60 fps `setInterval`，用 ease-in-out 在 1.6 秒内平滑插值窗口位置。
3. 每帧检查是否越过"离边缘 8px 内"阈值，越过就广播 `pet:edge-changed`。
4. 渲染进程订阅并应用 `.edge-left/right/top/bottom` CSS —— 旋转 `.pet-body` 并重新定位到对应墙边。
5. 拖出屏幕松手时，`maybeApplyPeekClamp` 把窗口回拉到露出 45% 身子的位置，并触发 `pet:peek-changed` 播放探头摇摆动画。

`setContentProtection(true)` 是让桌宠对用户可见、对截屏（含 `desktopCapturer`）不可见的魔法 —— 早期桌宠 agent 不得不"截屏前先隐藏再显示"的闪烁问题，由此消失。

---

## 🐛 已知限制

- 目前只使用主屏幕做截图和边缘计算。拖到副屏可用，但 AI 的 `move` 目标始终回到主屏。
- Windows 上 DRM 保护的视频帧（Netflix、付费流媒体）在截图中为黑屏，AI 会把它当成空屏幕。
- 边缘"爬行"目前是静态贴墙姿态，真正的上下 / 左右沿墙巡逻还没实现。
- 桌宠贴边时气泡隐藏（位置不好摆），后续版本补。
- macOS 首次运行会触发 **屏幕录制** 权限弹窗，在"系统设置 → 隐私与安全"里授权；不授权截图会是空白。
- `setContentProtection` 需要 Windows 10 build 16299+ / macOS 窗口共享 API / Linux 合成器配合。

---

## 🛣️ Roadmap

- [x] 水墨像素视觉
- [x] 三协议 AI 后端
- [x] 模型自动发现
- [x] AI 智能走位
- [x] 边缘吸附 + 出屏探头
- [x] 后台不可见截屏
- [ ] 真正的爬墙（纵向边缘上下移动）
- [ ] 多屏感知
- [ ] 本地 TTS 配音
- [ ] Sprite-sheet 替换接口（自带美术）
- [ ] 界面 i18n
- [ ] 打包 + 自动更新 + 安装包签名

---

## 🤝 贡献

非常欢迎 PR —— 尤其是：

- 像素 sprite-sheet 替代方案（`sprite.js` 里已经留好钩子）
- 更多协议（Gemini 原生、AWS Bedrock、Azure OpenAI）
- 本地 TTS
- 界面翻译

改动 AI 响应契约之前请先开 issue 讨论。

---

## 📜 License

[Unlicense](./LICENSE) —— 公共领域，随便用。无质保、无责任。

---

<sub>一个个人小实验 —— 给 16×16 的像素 sprite 接上多模态 LLM，能玩多远。❤️</sub>

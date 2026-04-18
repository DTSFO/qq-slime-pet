# QQ糖 · 像素史莱姆桌宠 AI 智能体

> 一只粘在屏幕上的搞怪果冻史莱姆，会看着你的屏幕帮你打工/摸鱼/发呆，时不时冒出一句让你哭笑不得的吐槽。

基于 **Electron** 构建，零素材依赖（纯 CSS 画的像素史莱姆），支持 **三种主流大模型 API 协议**（Anthropic Messages / OpenAI Chat Completions / OpenAI Responses），内置定时屏幕观察、AI 生成表情 & 动画 & 气泡 & 搞怪台词。

## ✨ 特性

- 🍮 **纯 CSS 果冻史莱姆**：零资源依赖，自带 10 种状态动画（idle/walk/sleep/shock/happy/think/angry/love/sleepy/drag）
- 🖱️ **透明置顶 + 智能穿透**：不遮挡你操作桌面，指针碰到史莱姆才接管点击
- 🤏 **拎起来扔**：可以任意拖到屏幕角落，位置自动记忆
- 🧠 **AI 智能体观察**：定时截屏 → 多模态模型分析你在干啥 → 给出反应
- 🔌 **三协议兼容**：支持 `messages` / `chat` / `responses` 任选一种，Anthropic / OpenAI / 兼容代理 / 本地模型都能接
- 💬 **打字机对话气泡**：搞怪吐槽、夸夸模式、鼓励摸鱼一条龙
- 🔒 **API Key 隔离**：只在主进程使用，渲染进程拿不到，不怕被 XSS
- ⚙️ **完整设置面板**：协议 / endpoint / 模型 / 温度 / 截屏间隔 / 人设 全部可调
- 🟢 **系统托盘 + 右键菜单**：暂停 AI、打开设置、一键退出
- 📦 **单实例运行**：不会开出一窝史莱姆

## 🖼️ 预览

```
  ┌──────────────────┐
  │  "在写代码吗？"   │
  │      加油哦       │
  └──┐               │
     ▼    ○  ○        <- 果冻高光
       ◎──◎           <- 大眼睛
        ♥             <- 害羞腮红
    ╭──────╮
    │  QQ  │          <- 半透明果冻身体
    ╰──────╯
       · ·            <- 底部阴影
```

（真实运行时是像素风 CSS 绘制的彩色史莱姆 + 呼吸动画）

## 🚀 快速开始

### 1. 安装

```bash
git clone https://github.com/DTSFO/qq-slime-pet.git
cd qq-slime-pet
npm install
```

### 2. 运行

```bash
npm start
```

史莱姆会出现在屏幕右下角，开始慢慢呼吸。

### 3. 配置 AI（可选但推荐）

右键桌宠 → **打开设置** ，或双击系统托盘图标。

选择一种 API 协议并填写 Key：

#### 方案 A：Anthropic Claude（推荐）

```
协议:     messages
Endpoint: https://api.anthropic.com
Model:    claude-sonnet-4-6
API Key:  sk-ant-...
```

#### 方案 B：OpenAI 或兼容服务

```
协议:     chat
Endpoint: https://api.openai.com
Model:    gpt-4.1-mini  / gpt-4o  / 等带视觉能力的模型
API Key:  sk-...
```

#### 方案 C：OpenAI Responses API（新版接口）

```
协议:     responses
Endpoint: https://api.openai.com
Model:    gpt-4.1 / gpt-4.1-mini
API Key:  sk-...
```

#### 方案 D：本地/代理（OpenAI 兼容）

```
协议:     chat
Endpoint: http://localhost:11434      (Ollama)
          或 https://your-proxy.com
Model:    llama3.2-vision / qwen2-vl / ...
API Key:  任意非空字符串（本地通常不校验）
```

保存后点 **测试连接** 验证，然后等约 5 秒 —— 桌宠就会开始自己看屏幕说话了。

## 🎮 操作

| 操作 | 行为 |
|---|---|
| **左键单击桌宠** | 戳一下，触发 AI 即兴对话（不截图，省 token） |
| **左键拖动** | 拎起史莱姆扔到任意位置 |
| **右键桌宠** | 弹出菜单：暂停 AI / 主动聊天 / 打开设置 / 退出 |
| **系统托盘** | 右键看完整菜单，双击打开设置 |

## ⚙️ 三种协议请求格式

统一接口 `send({ systemPrompt, userText, imageBase64, config })`，内部按 `config.protocol` 分派：

### `messages` (Anthropic)

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
→ 从 `response.content[*].text` 提取

### `chat` (OpenAI Chat Completions)

```http
POST {endpoint}/v1/chat/completions
Authorization: Bearer <key>

{
  "model": "gpt-4.1-mini",
  "max_tokens": 512,
  "messages": [
    {"role": "system", "content": "<systemPrompt>"},
    {"role": "user", "content": [
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}},
      {"type": "text",      "text": "<userText>"}
    ]}
  ]
}
```
→ 从 `response.choices[0].message.content` 提取

### `responses` (OpenAI Responses)

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
→ 优先 `response.output_text`，兼容 `response.output[*].content[*].text`

## 🎭 AI 响应契约

系统 prompt 强制要求模型返回 JSON：

```json
{
  "emotion": "happy" | "shock" | "think" | "angry" | "sleepy" | "love" | "idle",
  "action":  "idle" | "walk" | "jump" | "sleep",
  "speech":  "<不超过30字的中文>",
  "duration": 4
}
```

如果模型没按格式来（返回了自然语言），我们有三级降级解析：
1. `JSON.parse(cleaned)`
2. 正则抽取 `\{[\s\S]*\}` 再 parse
3. 原文当 `speech`，`emotion: 'think'`

## 🏗️ 架构

```
┌──────────────── 主进程 (Node) ─────────────────┐
│                                                │
│   main.js ──────→ window.js  (桌宠 + 设置窗口)  │
│                                                │
│   ipc.js ─┬─→ ai/agent.js → ai/adapter.js ─┬─→ messages
│           │                                ├─→ chat
│           │                                └─→ responses
│           │                                    ↓
│           ├─→ main/capture.js (截屏+隐藏自身)   │
│           └─→ config/store.js (持久化+脱敏)     │
│                                                │
└────────────────┬───────────────────────────────┘
                 │  IPC (preload 白名单)
┌────────────────┴───────────────────────────────┐
│            渲染进程 (桌宠窗口)                  │
│                                                │
│   index.html ── pet.js (状态机)                 │
│              ── sprite.js (CSS 类切换)          │
│              ── bubble.js (气泡 + 打字机)       │
│              ── drag.js (拖拽 + 穿透切换)       │
│                                                │
└────────────────────────────────────────────────┘
```

## 📁 目录结构

```
.
├── main.js                        # Electron 主进程入口
├── preload.js                     # contextBridge 安全桥
├── package.json
├── LICENSE                        # Unlicense (公共领域)
├── src/
│   ├── index.html                 # 桌宠主窗口
│   ├── settings.html              # 设置面板
│   ├── renderer/                  # 渲染进程脚本
│   │   ├── pet.js                 # 状态机
│   │   ├── sprite.js              # 史莱姆 DOM/动画控制
│   │   ├── bubble.js              # 对话气泡
│   │   ├── drag.js                # 拖拽 + 穿透
│   │   └── style.css              # 史莱姆 CSS 造型
│   ├── ai/
│   │   ├── agent.js               # 智能体主循环
│   │   ├── adapter.js             # 协议分派
│   │   ├── protocol-messages.js   # Anthropic 格式
│   │   ├── protocol-chat.js       # OpenAI Chat 格式
│   │   ├── protocol-responses.js  # OpenAI Responses 格式
│   │   └── prompt.js              # 系统人设 + 响应解析
│   ├── main/
│   │   ├── window.js              # BrowserWindow 管理
│   │   ├── capture.js             # desktopCapturer 截屏
│   │   ├── tray.js                # 系统托盘
│   │   └── ipc.js                 # IPC handlers 注册
│   ├── config/store.js            # electron-store 持久化
│   └── settings/settings.js       # 设置面板逻辑
└── assets/
    └── icon.png                   # 托盘/打包图标 (可选)
```

## 🧪 开发

```bash
# 开发模式（开启日志）
npm run dev

# 打包（需要 electron-builder）
npm run dist        # 完整打包
npm run pack        # 仅目录打包，调试用
```

配置文件位置：

| 平台 | 路径 |
|---|---|
| Windows | `%APPDATA%\qq-slime-pet\config.json` |
| macOS | `~/Library/Application Support/qq-slime-pet/config.json` |
| Linux | `~/.config/qq-slime-pet/config.json` |

## 🔒 隐私 & 成本提示

- **截图不会上传到任何第三方**，只发送给你在设置里填写的 API endpoint
- 截图前桌宠会自动隐藏，避免"自拍循环"
- macOS 首次使用会请求 **屏幕录制权限**（系统设置 → 隐私与安全性 → 屏幕录制）
- **token 成本估算**（仅供参考，以模型定价为准）：
  - 1280×720 截图 ≈ 1000–2000 input tokens
  - 60 秒间隔、每小时 60 次 ≈ 60k–120k input tokens
  - Claude Sonnet 4.6 约 $0.2–0.4/小时，gpt-4.1-mini 约 $0.02–0.05/小时
  - **不在用时请从托盘暂停 AI**

## 🐛 已知限制

- Windows 下捕获 DRM 视频（Netflix/付费视频）可能是黑屏，AI 会解读为"不知道在看啥"
- 透明窗口在某些低端集显上全屏游戏时可能闪烁，可在 `main.js` 开启 `app.disableHardwareAcceleration()`
- 多显示器系统只截主屏（可后续扩展选屏）
- 没有做本地语音 TTS（后续版本可以加，已在设计中预留）

## 🛠️ 里程碑

- [x] M1 — Electron 透明置顶窗口空壳
- [x] M2 — CSS 果冻史莱姆 + 呼吸待机
- [x] M3 — 拖拽 + 鼠标穿透切换
- [x] M4 — 状态机 + 走路 + 10 种表情
- [x] M5 — 对话气泡 + 打字机效果
- [x] M6 — 托盘 + 右键菜单 + 设置窗口 + 配置持久化
- [x] M7 — 三协议 AI 适配层（messages / chat / responses）
- [x] M8 — 定时截屏 + 完整智能体主循环
- [ ] M9 — electron-builder 打包 + 开机自启
- [ ] Extra — Sprite sheet 素材升级 / TTS 语音 / 历史对话记忆 / 多显示器

## 🤝 贡献

欢迎 PR！尤其是：
- 像素素材（sprite sheet 替换方案已预留）
- 更多协议适配（Gemini 原生 / Bedrock / Azure OpenAI）
- TTS 语音
- i18n

## 📜 License

**[Unlicense](LICENSE)** — 进入公共领域。随便用、随便改、随便卖，不用署名。Do whatever you want.

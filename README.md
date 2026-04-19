# 🍮 QQ Slime — Ink-Pixel Desktop Pet AI Agent

> **English** · [简体中文](./README.zh-CN.md)

A tiny Chinese-ink-style pixel slime that sits on your desktop, watches your screen through multimodal AI, and reacts with snarky comments, cute animations, and context-aware movement. Built with Electron, zero art assets required — the slime is drawn entirely in CSS/Canvas pixels.

[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-lightgrey.svg)](https://unlicense.org/)
[![Electron](https://img.shields.io/badge/electron-33.x-47848f.svg)](https://www.electronjs.org/)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)]()

---

## 🚨 Privacy & Safety Notice (READ BEFORE USE)

This app **takes periodic screenshots of your primary display** and sends them to a **third-party AI provider of your choice** (Anthropic / OpenAI / any compatible proxy or local model you configure). By using this app, you acknowledge:

> ### ⚠️ **Screenshot content leaves your machine.**
>
> - Every screenshot is uploaded to the API endpoint **you configure yourself** in the settings panel. It is **not** sent to the author of this app or any other server.
> - Screenshots are base64-encoded and included in the multimodal request body. They are subject to the privacy policy and data-retention rules of the provider you choose — not ours.
> - You are **solely responsible** for what your screen contains when this app is running. If you handle **passwords, payment info, private conversations, confidential code, medical records, classified material, or anything covered by an NDA or regulation**, PAUSE the AI from the tray menu, or don't enable screenshot capture at all.
> - Defaults are conservative: screenshots are off until you enter an API key and enable the agent. Capture interval defaults to 60 seconds. You can pause anytime via the tray icon.
> - This is a hobby / educational project. The author provides it "as is" under the Unlicense (public domain). **There is no warranty, no support obligation, and no liability** for any damages, data leakage, privacy breach, unexpected API bills, or consequences arising from its use. See [LICENSE](./LICENSE).
> - Review the source code before running — it's all under `src/`, and all network traffic goes through `src/ai/protocol-*.js` so you can see exactly what gets sent.

**If any of the above is unacceptable, do not install or run this app.**

---

## ✨ Features

- 🖼️ **Pure-CSS/Canvas pixel slime** — Chinese-ink style (ghost-white body + ink wash shading), no external art assets. 16×16 pixel sprite at 8× upscale.
- 🎭 **10 animation states** — idle / walk / sleep / sleepy / shock / happy / think / angry / love / drag — all driven by AI or interaction.
- 👻 **True background operation** — `setContentProtection(true)` makes the pet invisible to `desktopCapturer`, PrintScreen, Snipaste, OBS, etc. The AI can screenshot your screen *without* capturing itself. No flicker, no hide/show loops.
- 🧠 **Three protocol AI backend** — you can use any of:
  - `messages` — Anthropic `/v1/messages`
  - `chat` — OpenAI-compatible `/v1/chat/completions`
  - `responses` — OpenAI `/v1/responses`
- 🔄 **Auto model discovery** — enter endpoint + API key, click ↻, get the full list of available models. Custom dropdown (filter by typing, pick by clicking).
- 🗺️ **AI-driven smart movement** — the model decides where the pet should go based on what's on screen:
  - Full-screen video/game → slides to a `corner-br` to get out of your way
  - IDE/document → settles on `edge-right` so it's out of sight
  - Idle desktop → moves to `center` to hang out
- 🧲 **Edge snap with crawl animation** — when pet is against a screen edge it rotates 90/180° and "clings to the wall".
- 👀 **Off-screen peek** — if you drag the pet off-screen and release, it auto-clamps to keep ~45% of its body visible and plays a peeking wobble animation.
- 💬 **Rice-paper speech bubbles** with typewriter effect — wide enough for long lines, positioned dynamically.
- 🖱️ **Transparent click-through window** — only the pet's pixel area catches clicks; anywhere else passes through to the desktop.
- 🗄️ **Config persistence** — API key, prompt, screenshot interval, pet size/name, position all saved via `electron-store`.
- 🔒 **Secure by design** — API key lives only in the main process, never exposed to the renderer. contextIsolation + sandbox + strict CSP.
- 🟢 **Tray menu** — toggle AI, open settings, pin-on-top, quit.

---

## 🖼️ Look & Feel

```
 Ghost-white pixel body + 3-layer ink-wash drop-shadow
 Pixel eyes in muted ink (#3e3d48), red-ochre accents on LOVE state

                    ___________
                   / ( ·· )_ / )
                  /  ¯¯¯¯¯¯   ¯¯\        ← Rice-paper speech bubble
                  \____________/
                        v
                     ██████
                   ████████████
                  ██ ▄▄  ▄▄ ██       ← Pixel slime
                  ██ ██  ██ ██       ← Auto-scales to 128×128 with pixelated rendering
                  ████████████
                  ██████████████
                  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← Ink sediment at base
               ~~~~~~~~~~~~~~~~~~
               ↑ Blurred ink wash
```

For a visual of all 10 states at once, open `preview.html` in any browser.

---

## 🚀 Quick Start

### 1. Clone & install

```bash
git clone https://github.com/DTSFO/qq-slime-pet.git
cd qq-slime-pet
npm install
```

> **SSL cert error / slow Electron download?** A `.npmrc` shipping with the repo points Electron binary downloads to `npmmirror.com` (friendlier for users behind strict firewalls). If you still hit issues:
> ```bash
> rm -rf node_modules && npm install
> # or force system CA on Node 22+:
> NODE_OPTIONS=--use-system-ca npm install
> ```

### 2. Run

```bash
npm start
```

A small ink-pixel slime fades in at the bottom-right of your primary screen and starts breathing.

### 3. Configure AI (optional but recommended)

Right-click the pet → **Open Settings**, or double-click the tray icon.

| Field | Example |
|---|---|
| API Protocol | `messages` |
| Endpoint | `https://api.anthropic.com` |
| API Key | `sk-ant-...` (stored locally only) |
| Model | Click ↻ to fetch list, then pick or type |
| System Prompt | Editable, but keep the JSON contract at the end |
| Screenshot interval | 60s default |

Click **Save** — the agent auto-starts in ~5 seconds and begins watching your screen every interval.

#### Backend options

<details>
<summary><b>Anthropic Claude</b> (recommended for vision quality)</summary>

```
Protocol: messages
Endpoint: https://api.anthropic.com
Model:    claude-sonnet-4-6 | claude-opus-4-7 | claude-haiku-4-5-20251001
```
</details>

<details>
<summary><b>OpenAI</b></summary>

```
Protocol: chat          (or responses for the newer API)
Endpoint: https://api.openai.com
Model:    gpt-4.1-mini | gpt-4o | any vision-capable model
```
</details>

<details>
<summary><b>Local model (Ollama, etc.)</b></summary>

```
Protocol: chat
Endpoint: http://localhost:11434
Model:    llama3.2-vision | qwen2-vl | any multimodal pull
API Key:  anything non-empty (Ollama ignores it)
```
</details>

<details>
<summary><b>OpenAI-compatible proxy</b></summary>

Use `chat` or `responses` protocol, point Endpoint at your proxy's base URL, set API Key per proxy docs. Works with any service that mirrors the OpenAI schema.
</details>

---

## 🎮 Interactions

| Action | Result |
|---|---|
| **Left-click the pet** | Poke — triggers a one-off AI ping (no screenshot, cheap) |
| **Drag** | Pick it up and toss it anywhere |
| **Drag off-screen** | Auto-clamps to edge showing ~45% body + peek wiggle |
| **Right-click the pet** | Context menu: pause AI, manual chat, settings, quit |
| **Tray icon** | Same menu, plus pin-on-top toggle |
| **Let it sit still > 3 min** | Gets sleepy |
| **Let it sit still > 5 min** | Falls asleep (Zzz overlay) |
| **Any interaction while asleep** | Jumps awake with shock face |

---

## 🧩 AI Response Contract

The system prompt forces the model to reply with **strict JSON only**:

```json
{
  "emotion": "happy" | "shock" | "think" | "angry" | "sleepy" | "love" | "idle",
  "action":  "idle" | "walk" | "jump" | "sleep",
  "speech":  "<up to 30 Chinese chars>",
  "duration": 4,
  "move":    "stay" | "edge-left" | "edge-right" | "edge-top" | "edge-bottom"
           | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br" | "center"
}
```

Parser fallback chain: `JSON.parse` → regex-extract `\{[\s\S]*\}` → treat raw text as `speech` with `emotion: "think"`. Unknown enum values fall back to safe defaults.

---

## 🔌 Protocol Request Shapes

<details>
<summary><code>messages</code> (Anthropic)</summary>

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

Extract: `response.content[*].text`
</details>

<details>
<summary><code>chat</code> (OpenAI Chat Completions)</summary>

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

Extract: `response.choices[0].message.content`
</details>

<details>
<summary><code>responses</code> (OpenAI Responses)</summary>

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

Extract: `response.output_text` → fallback to `response.output[*].content[*].text`
</details>

The three adapters share a common interface: `adapter.send({systemPrompt, userText, imageBase64, config}) → {text, raw}`.

Model discovery uses `GET {endpoint}/v1/models` with the appropriate auth header, parses `{data: []}` / `{models: []}` / raw array shapes.

---

## 🏗️ Architecture

```
 Main Process                             Renderer (pet window)
 ─────────────────                        ────────────────────
 main.js
  ├─ window.js        (pet + settings)    index.html
  │    setContentProtection(true)          ├─ pet.js       state machine
  ├─ capture.js       desktopCapturer      ├─ sprite.js    canvas draws pixels
  ├─ movement.js      smooth move / edge   ├─ bubble.js    typewriter
  ├─ tray.js          system tray          ├─ drag.js      click-through toggle
  ├─ ipc.js           handler registry     └─ style.css    animations + ink wash
  └─ ai/
       adapter.js     dispatch by protocol
       protocol-messages / chat / responses
       agent.js       60s loop → capture → API → broadcast → moveTo
       prompt.js      system prompt + parser

 IPC channels (preload.js exposes whitelist):
   ai:chat, ai:tick-event, ai:list-models, ai:test-connection
   pet:drag-{start,move,end}, pet:set-clickthrough, pet:context-menu
   pet:edge-changed, pet:peek-changed, pet:moving
   settings:{open,close,save}, config:{get-public,set}
```

---

## 📁 Directory Structure

```
qq-slime-pet/
├── main.js                         # Electron main entrypoint
├── preload.js                      # IPC whitelist via contextBridge
├── package.json                    # Electron + electron-store + electron-builder
├── .npmrc                          # Electron binary mirror for restrictive networks
├── LICENSE                         # Unlicense (public domain)
├── preview.html                    # Open in any browser — all 10 states at a glance
├── src/
│   ├── index.html                  # Pet window
│   ├── settings.html               # Settings panel
│   ├── renderer/
│   │   ├── pet.js                  # FSM + event subscriptions
│   │   ├── sprite.js               # 16×16 body + face patches, canvas render
│   │   ├── bubble.js               # speech bubble + typewriter
│   │   ├── drag.js                 # hit-test + clickthrough toggle
│   │   └── style.css               # all CSS, animations, edge/peek states
│   ├── ai/
│   │   ├── agent.js                # screenshot → API → broadcast → moveTo
│   │   ├── adapter.js              # protocol dispatcher + listModels
│   │   ├── protocol-messages.js    # Anthropic adapter
│   │   ├── protocol-chat.js        # OpenAI Chat Completions adapter
│   │   ├── protocol-responses.js   # OpenAI Responses adapter
│   │   └── prompt.js               # system prompt + JSON parser
│   ├── main/
│   │   ├── window.js               # BrowserWindow creation / position clamping
│   │   ├── capture.js              # desktopCapturer + compression
│   │   ├── movement.js             # smooth ease, edge detect, peek clamp
│   │   ├── tray.js                 # system tray menu
│   │   └── ipc.js                  # all IPC handlers
│   ├── config/
│   │   └── store.js                # electron-store wrapper + defaults
│   └── settings/
│       └── settings.js             # settings panel logic + custom dropdown
└── assets/
    └── icon.png                    # Tray/build icon (optional)
```

---

## 🧪 Development

```bash
npm run dev     # logs enabled
npm start       # normal
npm run pack    # electron-builder unpacked dir
npm run dist    # full installer (NSIS/DMG/AppImage)
```

Config file location:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\qq-slime-pet\config.json` |
| macOS   | `~/Library/Application Support/qq-slime-pet/config.json` |
| Linux   | `~/.config/qq-slime-pet/config.json` |

### Debug console in the pet window

Since the pet window is a real Electron renderer, you can open devtools (the tray menu doesn't expose this — use `Ctrl+Shift+I` after focusing the pet, or temporarily set `petWindow.webContents.openDevTools({mode:'detach'})` in `window.js`). Helpful globals:

```js
window.__petDebug.setState('happy')   // force an emotion
window.__petDebug.say('hi', 5)        // show a bubble for 5s
window.__petDebug.getState()          // current state
```

---

## 🧠 How AI movement works

Every tick, the LLM sees the screenshot, decides where the pet should go, and returns (for example) `"move": "corner-br"`. Main process's `movement.js`:

1. Computes the target pixel coordinates on the primary display.
2. Starts a 60 fps `setInterval` that ease-in-out interpolates window position over 1.6s.
3. On each frame broadcasts `pet:edge-changed` if the pet crossed a "within 8px of edge" threshold.
4. Renderer listens and applies `.edge-left/right/top/bottom` CSS — which rotates `.pet-body` and repositions it against the corresponding wall.
5. When the pet is dragged off-screen and released, `maybeApplyPeekClamp` pulls the window back so 45% of the body stays visible, and `pet:peek-changed` triggers the wiggle animation.

`setContentProtection(true)` is the magic that lets the pet stay visible to the user but invisible in any screenshot including `desktopCapturer`'s — eliminating the hide/show flicker that earlier pet agents required.

---

## 🐛 Known Limitations

- Only the primary display is used for screenshots and edge calculations. Dragging to a secondary monitor works, but AI `move` targets always snap back to the primary.
- Windows DRM-protected video frames (Netflix, paid streaming) show up as black in screenshots — the AI will interpret them as a black screen.
- Edge "crawl" is currently a static wall-cling pose. An actual up-down / left-right patrol along the wall is not yet implemented.
- Speech bubble is hidden while the pet is edge-snapped (positioning would be awkward). Coming in a future version.
- On macOS, first run triggers a **Screen Recording** permission dialog — grant it in System Settings → Privacy & Security. Without it, screenshots are blank.
- `setContentProtection` requires Windows 10 build 16299+ / macOS with window-sharing API / Linux with a compositor that honors it.

---

## 🛣️ Roadmap

- [x] Pixel ink-wash visuals
- [x] Three-protocol AI backend
- [x] Auto model discovery
- [x] AI-driven smart movement
- [x] Edge snap + off-screen peek
- [x] Background-invisible screenshots
- [ ] True wall crawling (up/down on vertical edges)
- [ ] Multi-display awareness
- [ ] Local TTS for speech
- [ ] Sprite-sheet swap interface (bring your own art)
- [ ] i18n for UI
- [ ] Packaging + auto-update + installer signing

---

## 🤝 Contributing

PRs very welcome — especially for:

- Pixel sprite-sheet alternatives (hook already reserved in `sprite.js`)
- Additional protocols (Gemini native, AWS Bedrock, Azure OpenAI)
- Local TTS
- UI translations

Please open an issue first for anything that changes the AI response contract.

---

## 📜 License

[Unlicense](./LICENSE) — public domain. Do whatever you want. No warranty, no liability.

---

<sub>Built with ❤️ as a personal experiment in how far a 16×16 sprite can go with a multimodal LLM attached.</sub>

# 资源目录

## `icon.png`
托盘图标，建议 256×256 PNG。如果此文件不存在，代码会回退到内嵌的 fallback 图标。

## `slime/`
未来的 sprite sheet 存放处。`src/renderer/sprite.js` 已预留 `spritesheet` 模式接口：

```js
// src/renderer/sprite.js 未来扩展示例
const sprite = createSprite({
  mode: 'spritesheet',
  sheetUrl: 'assets/slime/sheet.png',
  frames: { idle: [0, 8], walk: [8, 16], sleep: [16, 20] },
  frameSize: 64,
  fps: 8,
});
```

目前使用纯 CSS 绘制史莱姆，零资源依赖。

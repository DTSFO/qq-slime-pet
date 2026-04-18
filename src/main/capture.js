// 屏幕截图：主进程负责，截屏前隐藏桌宠避免"自拍循环"
const { desktopCapturer, screen, nativeImage } = require('electron');
const { getConfig } = require('../config/store');
const { getPetWindow } = require('./window');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function captureScreen({ excludeSelf = true } = {}) {
  const cfg = getConfig();
  const maxWidth = cfg.capture?.maxWidth || 1280;
  const primary = screen.getPrimaryDisplay();
  const scale = primary.scaleFactor || 1;
  const target = {
    width: Math.min(maxWidth, primary.size.width),
    height: Math.round(
      Math.min(maxWidth, primary.size.width) * (primary.size.height / primary.size.width)
    ),
  };

  const petWin = getPetWindow();
  const hidden = excludeSelf && petWin && petWin.isVisible();
  if (hidden) {
    petWin.hide();
    // 给桌面合成器留一点时间把桌宠从画面里抹掉
    await sleep(120);
  }

  let result;
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: target.width * scale, height: target.height * scale },
    });
    if (!sources || !sources.length) {
      throw new Error('没有可用屏幕源');
    }
    // 取主屏：display_id 与 primary.id 匹配
    const main = sources.find(
      (s) => String(s.display_id) === String(primary.id)
    ) || sources[0];

    let img = main.thumbnail;
    if (img.getSize().width > maxWidth) {
      img = img.resize({ width: maxWidth, quality: 'good' });
    }
    const png = img.toPNG();
    result = {
      base64: png.toString('base64'),
      width: img.getSize().width,
      height: img.getSize().height,
      bytes: png.length,
      ts: Date.now(),
    };
  } finally {
    if (hidden && petWin && !petWin.isDestroyed()) {
      petWin.show();
    }
  }

  return result;
}

module.exports = { captureScreen };

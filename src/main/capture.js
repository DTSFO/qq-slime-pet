// 屏幕截图：依靠 setContentProtection(true) 让截图拍不到桌宠，不再 hide/show
const { desktopCapturer, screen } = require('electron');
const { getConfig } = require('../config/store');
const { getPetWindow } = require('./window');

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

  // 动态调整捕获可见性：用户永远看到桌宠，但截图中根据 excludeSelf 决定
  const petWin = getPetWindow();
  if (petWin && !petWin.isDestroyed()) {
    try { petWin.setContentProtection(!!excludeSelf); } catch (_) {}
  }

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: target.width * scale, height: target.height * scale },
  });
  if (!sources || !sources.length) {
    throw new Error('没有可用屏幕源');
  }
  const main = sources.find(
    (s) => String(s.display_id) === String(primary.id)
  ) || sources[0];

  let img = main.thumbnail;
  if (img.getSize().width > maxWidth) {
    img = img.resize({ width: maxWidth, quality: 'good' });
  }
  const png = img.toPNG();
  return {
    base64: png.toString('base64'),
    width: img.getSize().width,
    height: img.getSize().height,
    bytes: png.length,
    ts: Date.now(),
  };
}

module.exports = { captureScreen };

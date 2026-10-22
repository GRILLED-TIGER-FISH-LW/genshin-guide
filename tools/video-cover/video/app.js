/* =========================================================================
 * 视频封面 · app.js
 * =========================================================================
 * v2 变更：
 *  1. 【功能修复】「文字亮度」滑块真正生效
 *     —— 原来 capTextBrightness 从未参与渲染，拖动完全没反应。
 *        现在：图片填充时给 pattern 里的 image 套 feComponentTransfer；
 *              纯色填充时按倍率算灰度。
 *  2. 【性能】背景模糊改为半分辨率渲染 + JPEG 编码
 *     —— 原来每次都在 3840×2160 上做 100px 高斯模糊并转成 PNG base64，
 *        体积大、耗时长；现在像素量降到 1/4，体积小一个数量级。
 *  3. 【性能】拖动模糊/亮度滑块时对预览做 80ms 防抖，不再每个 input 都全量重绘
 *  4. 【健壮】init() 补齐错误兜底，任何一步失败都不再白屏
 *  5. 【健壮】importConfig 加了字段归一化，残缺/旧版本 JSON 不会打乱 state
 *  6. 【体积】exportConfig 剥离 fontData（字体数据可达数 MB），导入时按文件名重挂
 *  7. 【健壮】exportPNG 增加防连点，并补上成功提示
 *  8. 【清理】删除 init 末尾重复的 injectIcons()；SVG 样式里去掉 font-synthesis:none
 * ========================================================================= */
'use strict';

const SVG_W = 3840;
const SVG_H = 2160;
const BLUR_MAX_PX = 100;
const BLUR_RENDER_SCALE = 0.5;   /* 模糊层按半分辨率渲染：像素量降到 1/4 */

const BOSS_BASE_URL = '../../../shared/assets/video-cover/boss-base.png';
const LOGO_BASE_URL = '../../../shared/assets/video-cover/';
const DEFAULT_LOGO_FILE = 'gi-logo.png';

const LOGO_SIZE_FIXED = 200;
const LOGO_ROUNDED_FIXED = 50;

const MODE_MAIN_TEXTS = {
  character: '角色培养\n攻略图鉴',
  boss: '世界Boss\n&地方传奇'
};
const MODE_CAP_TEXT = {
  character: '攻略',
  boss: '攻略'
};
const MODE_SUB_LABELS = {
  character: { sub1: '第一行（自动编号）', sub2: '第二行（角色名）' },
  boss:      { sub1: '第一行（BOSS 名）',  sub2: '第二行' },
  custom:    { sub1: '第一行',             sub2: '第二行' }
};
const MIME_MAP = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2'
};

const ART_PATH_PREFIX_OLD = '../../shared/';
const ART_PATH_PREFIX_NEW = '../../../shared/';

const $ = id => document.getElementById(id);

const state = {
  showGuides: true,
  safeBoundX: 480,
  bg: '',
  midBrightness: -50,
  midBlur: 50,
  capX: 550, capY: 150, capH: 250,
  capFontSize: 180, capText: '', capTextBrightness: 100,
  capLogo: '',
  capEdgeInset: 2 / 3, capLogoGap: 40,
  mainX: 550, mainY: 760, mainSize: 340, mainLineGap: 350,
  mainText: '', mainColor: '#ffffff',
  subX: 550, subY: 1500, sub1Size: 200, sub2Size: 250,
  sub1: '', sub2: '', subColor: '#ffffff', subLineGap: 250,
  sigX: 550, sigY: 1980, sigSize: 100, sigStarBoost: 15, sigColor: '#ffffff',
  fontData: '', fontName: '', fontFileName: '',
  guideType: 'character',
  bossAvatar: null,
  characterArt: null,
  characterX: 2650,
  floatImg: []
};

let cachedBgImage = null;
let cachedBlurredBg = '';
let cachedBlurredBgKey = '';
let cachedBgSrc = null;

let CHAR_NAME_TO_ORDER = {};
let ART_DICT = {};
let NAMECARD_DICT = {};
let LOGO_LIST = [];
let FONT_LIST = [];
let loadedFontFace = null;

/* =========================================================================
 * 数据文件
 * ========================================================================= */
async function loadDataFiles() {
  try {
    const res = await fetch('../../../shared/data/characters.txt?t=' + Date.now());
    if (res.ok) {
      const txt = await res.text();
      txt.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const parts = line.split(/[\s,，\t]+/);
        if (parts.length < 2) return;
        const order = parseInt(parts[0], 10);
        const name = parts.slice(1).join(' ').trim();
        if (!order || !name) return;
        CHAR_NAME_TO_ORDER[name] = order;
      });
    }
  } catch (e) { console.warn('characters.txt 加载失败', e); }

  try {
    const res = await fetch('../../../shared/data/character-art.txt?t=' + Date.now());
    if (res.ok) {
      const txt = await res.text();
      txt.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const m = line.match(/^(\d+)\s+(\S+)\s*(.*)$/);
        if (!m) return;
        let url = (m[3] || '').trim();
        if (url.startsWith(ART_PATH_PREFIX_OLD)) {
          url = ART_PATH_PREFIX_NEW + url.slice(ART_PATH_PREFIX_OLD.length);
        }
        ART_DICT[m[2]] = url;
      });
    }
  } catch (e) { console.warn('character-art.txt 加载失败', e); }

  try {
    const res = await fetch('../../../shared/data/namecards.txt?t=' + Date.now());
    if (res.ok) {
      const txt = await res.text();
      txt.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const m = line.match(/^(\d+)\s+(\S+)\s+(https?:\/\/\S+)$/);
        if (!m) return;
        NAMECARD_DICT[m[2]] = m[3];
      });
    }
  } catch (e) { console.warn('namecards.txt 加载失败', e); }

  try {
    const res = await fetch('../../../shared/data/logos.txt?t=' + Date.now());
    if (res.ok) {
      const txt = await res.text();
      txt.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const parts = line.split(/\s+/);
        if (parts.length >= 2) LOGO_LIST.push({ name: parts[0], file: parts[1] });
      });
    }
  } catch (e) {}
  if (!LOGO_LIST.length) {
    LOGO_LIST.push({ name: '原神', file: DEFAULT_LOGO_FILE });
  }
}

/* =========================================================================
 * 工具函数
 * ========================================================================= */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* 以 #1a1a1a 为基准，按倍率算灰度（k=1 → #1a1a1a） */
function greyHex(base, k) {
  const v = Math.max(0, Math.min(255, Math.round(base * k)));
  const h = v.toString(16).padStart(2, '0');
  return '#' + h + h + h;
}

function getFormattedDateStr() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function stripElementSuffix(name) {
  return String(name || '').replace(/[（(][^）)]*[）)]\s*$/, '').trim();
}

function padOrder(n) { return String(n).padStart(3, '0'); }

async function urlToDataURL(url) {
  if (!url) return '';
  if (/^data:/i.test(url)) return url;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('FileReader 失败'));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return url;
  }
}

function showToast(message, type = 'info') {
  const container = $('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

function showConfirm(title, message) {
  return new Promise(resolve => {
    const backdrop = $('modalBackdrop');
    const titleEl = $('modalTitle');
    const msgEl = $('modalMessage');
    const cancelBtn = $('modalCancel');
    const confirmBtn = $('modalConfirm');
    if (!backdrop || !cancelBtn || !confirmBtn) { resolve(false); return; }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    const cleanup = (result) => {
      backdrop.classList.remove('is-visible');
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
      backdrop.onclick = null;
      resolve(result);
    };
    cancelBtn.onclick = () => cleanup(false);
    confirmBtn.onclick = () => cleanup(true);
    backdrop.onclick = (e) => { if (e.target === backdrop) cleanup(false); };
    backdrop.classList.add('is-visible');
  });
}

function injectIcons() {
  const ui = window.ICONS?.ui ?? {};
  const iconMap = {
    export: ui.export ?? '',
    import: ui.import ?? '',
    trash: ui.trash ?? '',
    plus: ui.plus ?? '',
    up: ui.arrowUp ?? '',
    down: ui.arrowDown ?? '',
    font: ui.textFont ?? '',
    guides: ui.guides ?? '',
    chevronDown: ui.chevronDown ?? '',
    chevronUp: ui.chevronUp ?? ''
  };
  document.querySelectorAll('[data-icon]').forEach(el => {
    const icon = iconMap[el.dataset.icon];
    if (icon) el.innerHTML = icon;
  });
}

/* =========================================================================
 * 背景图与模糊层
 * ========================================================================= */
async function loadBgImage() {
  if (state.bg === cachedBgSrc) return;
  cachedBgSrc = state.bg;
  cachedBgImage = null;
  cachedBlurredBg = '';
  cachedBlurredBgKey = '';
  if (!state.bg) return;
  try { cachedBgImage = await loadImage(state.bg); } catch (e) { cachedBgImage = null; }
}

function generateBlurredBgSync() {
  if (!cachedBgImage) return '';
  const key = cachedBgImage.src + '|' + state.midBlur + '|' + state.midBrightness;
  if (cachedBlurredBgKey === key && cachedBlurredBg) return cachedBlurredBg;

  const SS = BLUR_RENDER_SCALE;
  const W = Math.round(SVG_W * SS);
  const H = Math.round(SVG_H * SS);
  const img = cachedBgImage;
  const blurNorm = Math.min(100, Math.max(0, Number(state.midBlur) || 0)) / 100;
  const blurPx = blurNorm * BLUR_MAX_PX * SS;      /* 半径随分辨率等比缩放，视觉等价 */
  const slope = 1 + Number(state.midBrightness || 0) / 100;

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  if (blurPx > 0) {
    const coverScale = Math.max(W / img.width, H / img.height);
    const coverW = img.width * coverScale;
    const coverH = img.height * coverScale;
    const coverX = (W - coverW) / 2;
    const coverY = (H - coverH) / 2;

    const tmp1 = document.createElement('canvas');
    tmp1.width = W; tmp1.height = H;
    tmp1.getContext('2d').drawImage(img, coverX, coverY, coverW, coverH);

    const pad = Math.ceil(blurPx * 3) + 10;
    const BW = W + pad * 2, BH = H + pad * 2;
    const tmp2 = document.createElement('canvas');
    tmp2.width = BW; tmp2.height = BH;
    const t2 = tmp2.getContext('2d');
    t2.drawImage(tmp1, pad, pad);
    t2.drawImage(tmp1, 0, 0, W, 1, pad, 0, W, pad);
    t2.drawImage(tmp1, 0, H - 1, W, 1, pad, pad + H, W, pad);
    t2.drawImage(tmp1, 0, 0, 1, H, 0, pad, pad, H);
    t2.drawImage(tmp1, W - 1, 0, 1, H, pad + W, pad, pad, H);
    t2.drawImage(tmp1, 0, 0, 1, 1, 0, 0, pad, pad);
    t2.drawImage(tmp1, W - 1, 0, 1, 1, pad + W, 0, pad, pad);
    t2.drawImage(tmp1, 0, H - 1, 1, 1, 0, pad + H, pad, pad);
    t2.drawImage(tmp1, W - 1, H - 1, 1, 1, pad + W, pad + H, pad, pad);

    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(tmp2, -pad, -pad);
    ctx.filter = 'none';
  } else {
    const coverScale = Math.max(W / img.width, H / img.height);
    const coverW = img.width * coverScale;
    const coverH = img.height * coverScale;
    ctx.drawImage(img, (W - coverW) / 2, (H - coverH) / 2, coverW, coverH);
  }

  if (slope < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - slope})`;
    ctx.fillRect(0, 0, W, H);
  } else if (slope > 1) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, slope - 1)})`;
    ctx.fillRect(0, 0, W, H);
  }

  /* 模糊后的背景不需要透明通道，JPEG 比 PNG 小一个数量级 */
  const dataURL = c.toDataURL('image/jpeg', 0.92);
  cachedBlurredBg = dataURL;
  cachedBlurredBgKey = key;
  return dataURL;
}

/* =========================================================================
 * 文本测量与胶囊几何
 * ========================================================================= */
const measureCtx = document.createElement('canvas').getContext('2d');
function getFontFamily() { return state.fontName ? `'${state.fontName}'` : 'system-ui, sans-serif'; }
function measureTextWidth(text, size, font) {
  measureCtx.font = `${size}px ${font || getFontFamily()}`;
  return measureCtx.measureText(String(text)).width;
}
function capsulePath(x, y, w, h) {
  const r = h / 2;
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}
function getCapsuleGeometry() {
  const s = state;
  const R = s.capH / 2;
  const inset = (s.capEdgeInset == null ? 2 / 3 : s.capEdgeInset) * R;
  const logoW = s.capLogo ? LOGO_SIZE_FIXED : 0;
  const textW = measureTextWidth(s.capText, s.capFontSize, getFontFamily());
  const logoGap = logoW ? (s.capLogoGap == null ? 40 : s.capLogoGap) : 0;
  const contentW = logoW + logoGap + textW;
  const capW = contentW + 2 * inset;
  return {
    R, inset, logoW, logoGap, textW, capW,
    logoX: s.capX + inset,
    logoY: s.capY + (s.capH - LOGO_SIZE_FIXED) / 2,
    textRightX: s.capX + capW - inset,
    textBaseline: s.capY + s.capH / 2 + s.capFontSize * 0.35,
    capPath: capsulePath(s.capX, s.capY, capW, s.capH)
  };
}
function getFloatGeom(o) {
  const imgH = SVG_H * o.scale;
  const imgW = imgH * (o.w / Math.max(1, o.h));
  return { x: o.x - imgW / 2, y: (SVG_H - imgH) / 2, imgW, imgH };
}

/* =========================================================================
 * SVG 构建
 * ========================================================================= */
function buildSVG(showGuides, forExport = false) {
  const s = state;
  const font = getFontFamily();
  const fontFace = (forExport && s.fontData)
    ? `@font-face{font-family:'${s.fontName}';src:url("${s.fontData}");font-display:block}`
    : '';

  const cap = getCapsuleGeometry();
  const logoX = cap.logoX, logoY = cap.logoY;
  const textRightX = cap.textRightX, textBaseline = cap.textBaseline, capPath = cap.capPath;

  const mainLines = String(s.mainText || '').split('\n').filter((l, i) => l.trim() !== '' || i === 0).slice(0, 2);
  const subLines = [];
  if (s.sub1) subLines.push({ key: 'sub1', t: s.sub1, size: s.sub1Size || 200 });
  if (s.sub2) subLines.push({ key: 'sub2', t: s.sub2, size: s.sub2Size || 250 });

  const sigLeft = 'GENSHIN IMPACT', sigStar = '✧', sigRight = 'GRILLED TIGER FISH LW';
  const starSize = s.sigSize + s.sigStarBoost;
  const gapW = measureTextWidth(' ', s.sigSize, font);
  const wL = measureTextWidth(sigLeft, s.sigSize, font);
  const wS = measureTextWidth(sigStar, starSize, font);
  const sigStarCX = s.sigX + wL + gapW + wS / 2;
  const sigBaseline = s.sigY;

  const allFloats = collectFloats();
  const lowerFloats = allFloats.filter(o => o.underMiddle);
  const upperFloats = allFloats.filter(o => !o.underMiddle);

  const floatClipDefs = allFloats.map(o => {
    const { x, y, imgW, imgH } = getFloatGeom(o);
    const r = Math.min(100, Math.max(0, Number(o.rounded) || 0));
    const radius = Math.min(imgW, imgH) / 2 * (r / 100);
    return `<clipPath id="fclip-${o.id}"><rect x="${x}" y="${y}" width="${imgW}" height="${imgH}" rx="${radius}" ry="${radius}"/></clipPath>`;
  }).join('');

  function floatImages(arr) {
    return arr.map(o => {
      const { x, y, imgW, imgH } = getFloatGeom(o);
      return `<image data-float-id="${o.id}" href="${o.url}" x="${x}" y="${y}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid meet" clip-path="url(#fclip-${o.id})"/>`;
    }).join('');
  }

  const cropW = SVG_H * 4 / 3;
  const guideContent = showGuides ? (
    [s.safeBoundX, s.safeBoundX + cropW / 2, s.safeBoundX + cropW * 3 / 4, s.safeBoundX + cropW]
      .map(x => `<line x1="${x}" y1="0" x2="${x}" y2="${SVG_H}" stroke="#888888" stroke-width="2" stroke-dasharray="12 12" opacity="0.5" vector-effect="non-scaling-stroke"/>`).join('')
  ) : '';

  const capShadowFilter = `
    <filter id="capShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="${cap.R * 0.18}" dy="${cap.R * 0.18}" stdDeviation="0" flood-color="#000000" flood-opacity="0.5"/>
    </filter>`;

  /* —— 胶囊文字亮度（0–200%，100% 为原始亮度） —— */
  const brightRaw = Number(s.capTextBrightness);
  const brightK = Number.isFinite(brightRaw) ? Math.max(0, Math.min(2, brightRaw / 100)) : 1;

  const usePattern = !!(s.bg && s.capText);
  const capTextFill = usePattern ? 'url(#capTextPattern)' : greyHex(0x1a, brightK);

  const capBrightFilter = (usePattern && brightK !== 1) ? `
    <filter id="capBrightFilter" x="0" y="0" width="100%" height="100%">
      <feComponentTransfer>
        <feFuncR type="linear" slope="${brightK.toFixed(3)}"/>
        <feFuncG type="linear" slope="${brightK.toFixed(3)}"/>
        <feFuncB type="linear" slope="${brightK.toFixed(3)}"/>
      </feComponentTransfer>
    </filter>` : '';

  const capPattern = usePattern ? `
    <pattern id="capTextPattern" patternUnits="userSpaceOnUse" x="0" y="0" width="${SVG_W}" height="${SVG_H}">
      <image href="${s.bg}" x="0" y="0" width="${SVG_W}" height="${SVG_H}" preserveAspectRatio="xMidYMid slice"${brightK !== 1 ? ' filter="url(#capBrightFilter)"' : ''}/>
    </pattern>` : '';

  const blurredBgUrl = cachedBgImage ? generateBlurredBgSync() : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
<defs>
  <style>${fontFace} text { font-family: ${font}; paint-order: fill; text-rendering: geometricPrecision; }</style>
  <linearGradient id="midMask" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#fff"/><stop offset="40%" stop-color="#fff"/>
    <stop offset="60%" stop-color="#000"/><stop offset="100%" stop-color="#000"/>
  </linearGradient>
  <mask id="midMaskUse"><rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" fill="url(#midMask)"/></mask>
  ${s.capLogo ? `<clipPath id="logoClip"><rect x="${logoX}" y="${logoY}" width="${LOGO_SIZE_FIXED}" height="${LOGO_SIZE_FIXED}" rx="${LOGO_ROUNDED_FIXED}" ry="${LOGO_ROUNDED_FIXED}"/></clipPath>` : ''}
  ${capShadowFilter}
  ${capBrightFilter}
  ${capPattern}
  ${floatClipDefs}
</defs>

${s.bg ? `<image href="${s.bg}" x="0" y="0" width="${SVG_W}" height="${SVG_H}" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="${SVG_W}" height="${SVG_H}" fill="#1c1c22"/>`}
${floatImages(lowerFloats)}
${blurredBgUrl ? `<g mask="url(#midMaskUse)"><image id="midBlurImage" href="${blurredBgUrl}" x="0" y="0" width="${SVG_W}" height="${SVG_H}" preserveAspectRatio="xMidYMid slice"/></g>` : ''}
${floatImages(upperFloats)}
<g filter="url(#capShadow)">
  <path id="capCapsulePath" d="${capPath}" fill="#ffffff"/>
  ${s.capLogo ? `<image href="${s.capLogo}" x="${logoX}" y="${logoY}" width="${LOGO_SIZE_FIXED}" height="${LOGO_SIZE_FIXED}" preserveAspectRatio="xMidYMid slice" clip-path="url(#logoClip)"/>` : ''}
  <text data-field="capText" x="${textRightX}" y="${textBaseline}" font-size="${s.capFontSize}" fill="${capTextFill}" text-anchor="end">${esc(s.capText)}</text>
</g>

<g>
  ${mainLines.map((line, i) => {
    const y = s.mainY + i * s.mainLineGap;
    return `<text data-field="mainText.${i}" x="${s.mainX + 12}" y="${y + 12}" font-size="${s.mainSize}" fill="#000" opacity="0.5">${esc(line)}</text>` +
           `<text data-field="mainText.${i}" x="${s.mainX}" y="${y}" font-size="${s.mainSize}" fill="${s.mainColor}">${esc(line)}</text>`;
  }).join('')}
</g>

<g>
  ${subLines.map((line, i) => {
    const subGap = s.subLineGap == null ? 250 : s.subLineGap;
    const y = (subLines.length === 1 ? s.subY + subGap / 2 : s.subY) + i * subGap;
    return `<text data-field="${line.key}" x="${s.subX + 12}" y="${y + 12}" font-size="${line.size}" fill="#000" opacity="0.5">${esc(line.t)}</text>` +
           `<text data-field="${line.key}" x="${s.subX}" y="${y}" font-size="${line.size}" fill="${s.subColor}">${esc(line.t)}</text>`;
  }).join('')}
</g>

<g>
  <text x="${s.sigX + 12}" y="${sigBaseline + 12}" font-size="${s.sigSize}" fill="#000" opacity="0.5">${esc(sigLeft)}</text>
  <text x="${s.sigX}" y="${sigBaseline}" font-size="${s.sigSize}" fill="${s.sigColor}">${esc(sigLeft)}</text>
  <text x="${sigStarCX + 12}" y="${sigBaseline + 12}" font-size="${starSize}" fill="#000" opacity="0.5" text-anchor="middle">${sigStar}</text>
  <text x="${sigStarCX}" y="${sigBaseline}" font-size="${starSize}" fill="${s.sigColor}" text-anchor="middle">${sigStar}</text>
  <text x="${s.sigX + wL + gapW + wS + gapW + 12}" y="${sigBaseline + 12}" font-size="${s.sigSize}" fill="#000" opacity="0.5">${esc(sigRight)}</text>
  <text x="${s.sigX + wL + gapW + wS + gapW}" y="${sigBaseline}" font-size="${s.sigSize}" fill="${s.sigColor}">${esc(sigRight)}</text>
</g>

<g id="guideLayer" pointer-events="none">${guideContent}</g>
</svg>`;
}

function collectFloats() {
  if (state.guideType === 'boss') {
    const arr = [];
    arr.push({
      id: 'boss-base',
      url: BOSS_BASE_URL,
      w: 1000, h: 1000,
      x: 2650, scale: 0.7, rounded: 0, underMiddle: true
    });
    if (state.bossAvatar && state.bossAvatar.url) {
      arr.push({
        id: 'boss-avatar',
        url: state.bossAvatar.url,
        w: state.bossAvatar.w,
        h: state.bossAvatar.h,
        x: 2650, scale: 0.5, rounded: 100, underMiddle: true
      });
    }
    return arr;
  }
  if (state.guideType === 'character') {
    if (state.characterArt && state.characterArt.url) {
      return [{
        id: 'character-art',
        url: state.characterArt.url,
        w: state.characterArt.w,
        h: state.characterArt.h,
        x: state.characterX, scale: 1, rounded: 0,
        underMiddle: true
      }];
    }
    return [];
  }
  return state.floatImg;
}

/* =========================================================================
 * 预览挂载与增量更新
 * ========================================================================= */
let previewSvgEl = null;
let heavyPreviewTimer = 0;

function mountPreview() {
  const host = $('svgPreviewHost');
  if (!host) return;
  host.innerHTML = buildSVG(state.showGuides);
  previewSvgEl = host.querySelector('svg');
}

/* 模糊/亮度这类重活：80ms 防抖后再重绘，拖动滑块不再卡顿 */
function scheduleHeavyPreview() {
  if (heavyPreviewTimer) clearTimeout(heavyPreviewTimer);
  heavyPreviewTimer = setTimeout(() => {
    heavyPreviewTimer = 0;
    mountPreview();
  }, 80);
}

function updateCharImgX() {
  if (!previewSvgEl) return;
  const el = previewSvgEl.querySelector('[data-float-id="character-art"]');
  if (!el || !state.characterArt) return;
  const img = state.characterArt;
  const imgH = SVG_H * 1;
  const imgW = imgH * (img.w / Math.max(1, img.h));
  el.setAttribute('x', state.characterX - imgW / 2);
}

function updateFieldText(field, text) {
  if (!previewSvgEl) return false;
  const els = previewSvgEl.querySelectorAll(`[data-field="${field}"]`);
  if (!els.length) return false;
  els.forEach(el => { el.textContent = String(text ?? ''); });
  return true;
}

/* =========================================================================
 * 模式切换与输入
 * ========================================================================= */
function applyModeUI() {
  const type = state.guideType;

  const cp = $('characterPanel');
  const csp = $('customPanel');
  if (cp) cp.classList.toggle('hidden', type !== 'character');
  if (csp) csp.classList.toggle('hidden', type !== 'custom');

  document.querySelectorAll('.tab-bar .tab-btn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.type === type);
  });

  const sub1SizeRow = $('sub1SizeRow');
  const sub2SizeRow = $('sub2SizeRow');
  if (sub1SizeRow) sub1SizeRow.classList.toggle('hidden', type !== 'custom');
  if (sub2SizeRow) sub2SizeRow.classList.toggle('hidden', type !== 'custom');

  const mainSection = $('mainSection');
  const capSection = $('capSection');
  if (mainSection) mainSection.classList.toggle('hidden', type !== 'custom');
  if (capSection) capSection.classList.toggle('hidden', type !== 'custom');

  const labels = MODE_SUB_LABELS[type] ?? MODE_SUB_LABELS.custom;
  const sub1Label = $('sub1Label');
  const sub2Label = $('sub2Label');
  if (sub1Label) sub1Label.textContent = labels.sub1;
  if (sub2Label) sub2Label.textContent = labels.sub2;

  const sub1Input = $('sub1Input');
  if (sub1Input) {
    sub1Input.readOnly = (type === 'character');
    sub1Input.placeholder = type === 'character' ? '自动生成' : '第一行文字';
  }
}

async function setGuideType(type) {
  state.guideType = type;

  if (type === 'character' || type === 'boss') {
    state.mainText = MODE_MAIN_TEXTS[type];
    state.capText = MODE_CAP_TEXT[type];
  } else {
    state.mainText = '';
    state.capText = '';
  }

  state.sub1 = '';
  state.sub2 = '';

  if (type === 'character') {
    state.sub1Size = 200;
    state.sub2Size = 250;
  } else if (type === 'boss') {
    state.sub1Size = 250;
    state.sub2Size = 200;
  }

  state.bg = '';

  if (type !== 'character') state.characterArt = null;
  if (type !== 'boss') state.bossAvatar = null;

  const mainInput = $('mainTextInput');
  if (mainInput) mainInput.value = state.mainText;
  const capInput = $('capTextInput');
  if (capInput) capInput.value = state.capText;
  const sub1Input = $('sub1Input');
  if (sub1Input) sub1Input.value = '';
  const sub2Input = $('sub2Input');
  if (sub2Input) sub2Input.value = '';

  const bgNameEl = $('bgFileName');
  if (bgNameEl) bgNameEl.textContent = '点击上传背景图';
  const bgThumb = $('bgThumb');
  if (bgThumb) bgThumb.removeAttribute('src');

  updateSizeDropdown('sub1', state.sub1Size);
  updateSizeDropdown('sub2', state.sub2Size);

  applyModeUI();
  await loadBgImage();
  mountPreview();
  persist();
}

function onSub1Input(v) {
  if (state.guideType === 'character') return;
  state.sub1 = v;
  if (!updateFieldText('sub1', v)) mountPreview();
  persist();
}
function onSub1Blur(v) {
  if (state.guideType !== 'boss') return;
  matchBossName(v);
}
function onSub2Input(v) {
  state.sub2 = v;
  if (!updateFieldText('sub2', v)) mountPreview();
  persist();
}
function onSub2Blur(v) {
  if (state.guideType !== 'character') return;
  matchCharacterName(v);
}

async function matchCharacterName(name) {
  name = (name || '').trim();
  state.sub2 = name;
  const sub2Input = $('sub2Input');
  if (sub2Input && document.activeElement !== sub2Input) sub2Input.value = name;

  if (!name) {
    state.characterArt = null;
    state.bg = '';
    state.sub1 = '';
    const sub1Input = $('sub1Input');
    if (sub1Input) sub1Input.value = '';
    const bgNameEl = $('bgFileName');
    if (bgNameEl) bgNameEl.textContent = '点击上传背景图';
    const bgThumb = $('bgThumb');
    if (bgThumb) bgThumb.removeAttribute('src');
    await loadBgImage();
    mountPreview(); persist();
    return;
  }

  const baseName = stripElementSuffix(name);
  const order = CHAR_NAME_TO_ORDER[name] || CHAR_NAME_TO_ORDER[baseName];
  state.sub1 = order ? ('No.' + padOrder(order)) : '';
  const sub1Input = $('sub1Input');
  if (sub1Input) sub1Input.value = state.sub1;

  let artUrl = '';
  if (ART_DICT[name] !== undefined && ART_DICT[name] !== '') artUrl = ART_DICT[name];
  else if (ART_DICT[baseName] !== undefined && ART_DICT[baseName] !== '') artUrl = ART_DICT[baseName];

  if (artUrl) {
    try {
      const img = await loadImage(artUrl);
      state.characterArt = { url: artUrl, w: img.width, h: img.height };
    } catch (e) {
      state.characterArt = null;
      showToast('立绘加载失败：' + artUrl, 'error');
    }
  } else {
    state.characterArt = null;
  }

  let namecardUrl = '';
  if (NAMECARD_DICT[name]) namecardUrl = NAMECARD_DICT[name];
  else if (NAMECARD_DICT[baseName]) namecardUrl = NAMECARD_DICT[baseName];

  if (namecardUrl) {
    state.bg = namecardUrl;
    const bgNameEl = $('bgFileName');
    if (bgNameEl) bgNameEl.textContent = '已自动加载名片图';
    const bgThumb = $('bgThumb');
    if (bgThumb) bgThumb.src = state.bg;
  } else {
    state.bg = '';
    const bgNameEl = $('bgFileName');
    if (bgNameEl) bgNameEl.textContent = '点击上传背景图';
    const bgThumb = $('bgThumb');
    if (bgThumb) bgThumb.removeAttribute('src');
  }

  await loadBgImage();
  mountPreview();
  persist();
}

async function matchBossName(name) {
  name = (name || '').trim();
  state.sub1 = name;
  const sub1Input = $('sub1Input');
  if (sub1Input && document.activeElement !== sub1Input) sub1Input.value = name;

  if (!name) {
    state.bossAvatar = null;
    mountPreview(); persist();
    return;
  }

  if (!window.ICON_LIB || !window.ICON_LIB.fromName) {
    showToast('图标库未加载', 'error');
    return;
  }

  try {
    const r = await window.ICON_LIB.fromName('monsters', name);
    if (r && r.dataURL) {
      const img = await loadImage(r.dataURL);
      state.bossAvatar = { url: r.dataURL, w: img.width, h: img.height };
    } else {
      state.bossAvatar = null;
      showToast('未找到「' + name + '」的怪物图标', 'error');
    }
  } catch (e) {
    state.bossAvatar = null;
    showToast('图标加载失败：' + (e.message || e), 'error');
  }

  mountPreview();
  persist();
}

/* =========================================================================
 * 浮动素材
 * ========================================================================= */
function addFloat() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = () => {
    const f = input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        state.floatImg.push({
          id: 'f_' + Date.now(),
          url: reader.result,
          w: img.width, h: img.height,
          x: SVG_W * 0.75, scale: 1, rounded: 0,
          underMiddle: true
        });
        renderFloatList();
        mountPreview();
        persist();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  };
  input.click();
}

function renderFloatList() {
  const el = $('floatList');
  if (!el) return;
  if (!state.floatImg.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = state.floatImg.map(o => `
    <div class="float-item">
      <div class="float-item-head">
        <div class="float-item-head-thumb">
          <img class="float-thumb" src="${o.url}" alt="" onclick="App.triggerReplaceFloat('${o.id}')" title="点击更换图片">
          <span class="float-thumb-meta">${o.w}×${o.h}</span>
        </div>
        <div class="float-item-head-actions">
          <button type="button" class="btn-icon" data-icon="up" onclick="App.moveFloat('${o.id}',-1)"></button>
          <button type="button" class="btn-icon" data-icon="down" onclick="App.moveFloat('${o.id}',1)"></button>
          <button type="button" class="btn-icon btn-danger" data-icon="trash" onclick="App.removeFloat('${o.id}')"></button>
        </div>
      </div>
      <div class="slider-group">
        <div class="slider-label"><span>X 位置</span></div>
        <div class="slider-row">
          <input type="range" min="0" max="3840" value="${o.x}" oninput="App.setFloat('${o.id}','x',Number(this.value))">
          <div class="number-box"><input type="number" value="${Math.round(o.x)}" oninput="App.setFloat('${o.id}','x',Number(this.value))"><span class="number-unit">px</span></div>
        </div>
      </div>
      <div class="slider-group">
        <div class="slider-label"><span>缩放</span></div>
        <div class="slider-row">
          <input type="range" min="10" max="200" value="${Math.round(o.scale * 100)}" oninput="App.setFloat('${o.id}','scale',Number(this.value)/100)">
          <div class="number-box"><input type="number" min="10" max="200" value="${Math.round(o.scale * 100)}" oninput="App.setFloat('${o.id}','scale',Number(this.value)/100)"><span class="number-unit">%</span></div>
        </div>
      </div>
      <div class="slider-group">
        <div class="slider-label"><span>圆角</span></div>
        <div class="slider-row">
          <input type="range" min="0" max="100" value="${Math.round(o.rounded || 0)}" oninput="App.setFloat('${o.id}','rounded',Number(this.value))">
          <div class="number-box"><input type="number" min="0" max="100" value="${Math.round(o.rounded || 0)}" oninput="App.setFloat('${o.id}','rounded',Number(this.value))"><span class="number-unit">%</span></div>
        </div>
      </div>
      <label class="under-middle-row">
        <input type="checkbox" ${o.underMiddle ? 'checked' : ''} onchange="App.setFloat('${o.id}','underMiddle',this.checked)">
        置于中层背景下方
      </label>
    </div>
  `).join('');
  injectIcons();
}

/* =========================================================================
 * 字体
 * ========================================================================= */
async function loadFontList() {
  try {
    const res = await fetch('../../../shared/fonts/fonts.json?t=' + Date.now());
    if (res.ok) {
      const json = await res.json();
      FONT_LIST = Array.isArray(json.fonts) ? json.fonts : [];
    }
  } catch (e) {}
}

function applyFontStyle() {
  if (!state.fontName || !state.fontData) return;
  let el = $('video-preview-font-style');
  if (!el) {
    el = document.createElement('style');
    el.id = 'video-preview-font-style';
    document.head.appendChild(el);
  }
  el.textContent = `@font-face{font-family:'${state.fontName}';src:url("${state.fontData}");font-display:block}`;
}

function clearFontStyle() {
  $('video-preview-font-style')?.remove();
}

async function installFont() {
  if (!state.fontData || !window.FontFace) return false;
  try {
    if (loadedFontFace) {
      try { document.fonts.delete(loadedFontFace); } catch (e) {}
      loadedFontFace = null;
    }

    let buffer;
    try {
      const res = await fetch(state.fontData);
      buffer = await res.arrayBuffer();
    } catch {
      const raw = atob(state.fontData.split(',')[1] ?? '');
      buffer = Uint8Array.from(raw, c => c.charCodeAt(0));
    }

    const ff = new FontFace(state.fontName, buffer);
    const loaded = await ff.load();
    document.fonts.add(loaded);
    loadedFontFace = loaded;

    applyFontStyle();
    return true;
  } catch (e) {
    console.error('字体解析异常：', e);
    return false;
  }
}

function renderFontDropdown() {
  const panel = $('fontDropdownPanel');
  if (!panel) return;
  const curFile = state.fontFileName;
  let html = `<button type="button" class="dropdown-item${curFile === '' ? ' is-active' : ''}" data-font-index="-1">默认系统字体</button>`;
  FONT_LIST.forEach((f, i) => {
    const isAct = curFile === f.file;
    html += `<button type="button" class="dropdown-item${isAct ? ' is-active' : ''}" data-font-index="${i}">${esc(f.name)}</button>`;
  });
  panel.innerHTML = html;
}

function updateFontDropdownActive(index) {
  const panel = $('fontDropdownPanel');
  if (!panel) return;
  panel.querySelectorAll('.dropdown-item').forEach(el => {
    el.classList.toggle('is-active', Number(el.dataset.fontIndex) === index);
  });
}

function renderLogoDropdown() {
  const panel = $('logoDropdownPanel');
  if (!panel) return;
  const currentFile = (state.capLogo && state.capLogo.startsWith(LOGO_BASE_URL))
    ? state.capLogo.replace(LOGO_BASE_URL, '')
    : '';
  const logoFiles = LOGO_LIST.map(l => l.file);
  if (!logoFiles.includes(currentFile) && LOGO_LIST.length) {
    state.capLogo = LOGO_BASE_URL + LOGO_LIST[0].file;
  }
  const finalFile = state.capLogo.replace(LOGO_BASE_URL, '');
  panel.innerHTML = LOGO_LIST.map(l => {
    const isAct = l.file === finalFile;
    return `<button type="button" class="dropdown-item${isAct ? ' is-active' : ''}" data-logo-file="${esc(l.file)}">${esc(l.name)}</button>`;
  }).join('');

  const label = $('logoDropdownLabel');
  const cur = LOGO_LIST.find(l => l.file === finalFile);
  if (label && cur) label.textContent = cur.name;

  const t = $('logoThumb');
  if (t) t.src = state.capLogo;
}

function updateSizeDropdown(target, size) {
  const dropdown = $(target + 'SizeDropdown');
  if (!dropdown) return;
  const panel = dropdown.querySelector('.dropdown-panel');
  if (!panel) return;
  panel.querySelectorAll('.dropdown-item').forEach(el => {
    const isAct = String(el.dataset.value) === String(size);
    el.classList.toggle('is-active', isAct);
    if (isAct) {
      const label = $(target + 'SizeLabel');
      if (label) label.textContent = el.textContent;
    }
  });
}

async function selectFont(index) {
  const labelEl = $('labelVideoFont');

  if (index === -1) {
    state.fontData = ''; state.fontFileName = ''; state.fontName = '';
    if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch (e) {} loadedFontFace = null; }
    clearFontStyle();
    if (labelEl) labelEl.textContent = '默认系统字体';
    updateFontDropdownActive(-1);
    mountPreview(); persist();
    return;
  }

  const f = FONT_LIST[index];
  if (!f) return;
  if (state.fontFileName === f.file && state.fontData) {
    if (labelEl) labelEl.textContent = '当前：' + f.name;
    updateFontDropdownActive(index);
    return;
  }

  try {
    if (labelEl) labelEl.textContent = `[1/3] 正在下载二进制流...`;
    let res;
    try {
      res = await fetch(`../../../shared/fonts/${encodeURIComponent(f.file)}?t=${Date.now()}`);
    } catch (netErr) {
      throw new Error(`跨域或网络受阻 (${netErr.message})`);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} 文件未找到`);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('服务器返回网页而非字体(可能是404)');
    }

    const buf = await res.arrayBuffer();

    if (labelEl) labelEl.textContent = `[2/3] 正在注入字体渲染引擎...`;
    try {
      const ff = new FontFace(f.name, buf);
      const loaded = await ff.load();
      if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch (e) {} }
      document.fonts.add(loaded);
      loadedFontFace = loaded;
    } catch (fontErr) {
      throw new Error(`该格式无法识别或文件损坏 (${fontErr.message || 'Font Engine Refused'})`);
    }

    if (labelEl) labelEl.textContent = `[3/3] 正在固化存档数据...`;

    const ext = f.file.split('.').pop().toLowerCase();
    const mime = MIME_MAP[ext] ?? 'font/ttf';

    const blob = new Blob([buf], { type: mime });
    const dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('数据过大序列化失败'));
      reader.readAsDataURL(blob);
    });

    state.fontData = dataURL;
    state.fontFileName = f.file;
    state.fontName = f.name;

    applyFontStyle();

    if (labelEl) labelEl.textContent = '当前：' + f.name;
    updateFontDropdownActive(index);
    mountPreview(); persist();

  } catch (err) {
    console.error(`[字体加载失败] ${f.name}:`, err);
    if (labelEl) labelEl.textContent = `异常卡住: ${err.message}`;
    showToast(`字体 [${f.name}] 加载失败: ${err.message}`, 'error');

    state.fontData = '';
    state.fontFileName = '';
    state.fontName = '';
    updateFontDropdownActive(-1);
    persist();
  }
}

/* 按 fontFileName 重新挂载字体（导入配置时用：导出的 JSON 不含 fontData） */
async function reloadFontByName() {
  if (!state.fontFileName) return;
  if (!FONT_LIST.length) { try { await loadFontList(); } catch (e) {} }
  const idx = FONT_LIST.findIndex(f => f.file === state.fontFileName);
  if (idx >= 0) { try { await selectFont(idx); } catch (e) {} }
}

/* =========================================================================
 * IndexedDB 持久化
 * ========================================================================= */
const IDB_NAME = 'video_cover_db';
const IDB_STORE = 'state';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let persistTimer = null;
function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    try {
      const db = await openIDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ ...state }, 'video_state');
    } catch (e) {}
  }, 500);
}

async function loadPersist() {
  try {
    const db = await openIDB();
    return new Promise(resolve => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('video_state');
      req.onsuccess = () => { if (req.result) Object.assign(state, req.result); resolve(); };
      req.onerror = () => resolve();
    });
  } catch (e) {}
}

/* =========================================================================
 * 导出 / 导入
 * ========================================================================= */
function getExportBaseName() {
  const raw = state.sub2?.trim() || state.sub1?.trim() || state.mainText?.trim() || '视频封面';
  return raw.replace(/[\r\n]+/g, '').replace(/[\\/:*?"<>|]/g, '_');
}

async function bakeAndExport() {
  const backup = {
    bg: state.bg,
    capLogo: state.capLogo,
    characterArt: state.characterArt,
    bossAvatar: state.bossAvatar,
    floatImg: state.floatImg
  };

  try {
    if (state.bg) state.bg = await urlToDataURL(state.bg);
    if (state.capLogo) state.capLogo = await urlToDataURL(state.capLogo);
    if (state.characterArt && state.characterArt.url) {
      state.characterArt = { ...state.characterArt, url: await urlToDataURL(state.characterArt.url) };
    }
    if (state.bossAvatar && state.bossAvatar.url) {
      state.bossAvatar = { ...state.bossAvatar, url: await urlToDataURL(state.bossAvatar.url) };
    }
    if (state.floatImg && state.floatImg.length) {
      const baked = [];
      for (const o of state.floatImg) {
        baked.push({ ...o, url: await urlToDataURL(o.url) });
      }
      state.floatImg = baked;
    }

    const svgStr = buildSVG(false, true);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('SVG 渲染失败'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = SVG_W; canvas.height = SVG_H;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, SVG_W, SVG_H);
      const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
      const baseName = getExportBaseName();
      downloadBlob(pngBlob, baseName + '_' + getFormattedDateStr() + '.png');
    } finally { URL.revokeObjectURL(url); }
  } finally {
    Object.assign(state, backup);
  }
}

let exporting = false;
async function exportPNG() {
  if (exporting) return;          /* 防连点：导出过程可能持续数秒 */
  exporting = true;
  try {
    if (document.fonts) await document.fonts.ready;
    await bakeAndExport();
    showToast('导出成功', 'success');
  } catch (e) {
    showToast('导出失败：' + (e && e.message ? e.message : e), 'error');
  } finally {
    exporting = false;
  }
}

function exportConfig() {
  /* fontData 通常是最大的单项（字体二进制 base64，可达数 MB），
   * 导出时剥离，导入时按 fontFileName 重新挂载 */
  const out = { ...state, fontData: '' };

  downloadBlob(
    new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }),
    '视频封面配置_' + getFormattedDateStr() + '.json'
  );
}

function numOr(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}
function strOr(v, fb = '') {
  return typeof v === 'string' ? v : fb;
}

/* 导入归一化：残缺 / 旧版本 / 手改过的 JSON 都不会打乱 state */
function normalizeImported(raw) {
  const r = (raw && typeof raw === 'object') ? raw : {};

  const art = (o) => (o && typeof o === 'object' && typeof o.url === 'string' && o.url)
    ? { url: o.url, w: numOr(o.w, 1), h: numOr(o.h, 1) }
    : null;

  return {
    showGuides: r.showGuides !== false,
    safeBoundX: numOr(r.safeBoundX, state.safeBoundX),
    bg: strOr(r.bg),
    midBrightness: numOr(r.midBrightness, state.midBrightness),
    midBlur: numOr(r.midBlur, state.midBlur),
    capX: numOr(r.capX, state.capX),
    capY: numOr(r.capY, state.capY),
    capH: numOr(r.capH, state.capH),
    capFontSize: numOr(r.capFontSize, state.capFontSize),
    capText: strOr(r.capText),
    capTextBrightness: numOr(r.capTextBrightness, 100),
    capLogo: strOr(r.capLogo),
    capEdgeInset: numOr(r.capEdgeInset, state.capEdgeInset),
    capLogoGap: numOr(r.capLogoGap, state.capLogoGap),
    mainText: strOr(r.mainText),
    mainColor: strOr(r.mainColor, '#ffffff'),
    sub1: strOr(r.sub1),
    sub2: strOr(r.sub2),
    sub1Size: numOr(r.sub1Size, 200),
    sub2Size: numOr(r.sub2Size, 250),
    subColor: strOr(r.subColor, '#ffffff'),
    sigColor: strOr(r.sigColor, '#ffffff'),
    fontData: strOr(r.fontData),
    fontName: strOr(r.fontName),
    fontFileName: strOr(r.fontFileName),
    guideType: ['character', 'boss', 'custom'].includes(r.guideType) ? r.guideType : 'character',
    bossAvatar: art(r.bossAvatar),
    characterArt: art(r.characterArt),
    characterX: numOr(r.characterX, state.characterX),
    floatImg: Array.isArray(r.floatImg)
      ? r.floatImg
          .filter(o => o && typeof o === 'object' && typeof o.url === 'string' && o.url)
          .map(o => ({
            id: strOr(o.id, 'f_' + Math.random().toString(36).slice(2, 9)),
            url: o.url,
            w: numOr(o.w, 1),
            h: numOr(o.h, 1),
            x: numOr(o.x, SVG_W * 0.75),
            scale: numOr(o.scale, 1),
            rounded: numOr(o.rounded, 0),
            underMiddle: o.underMiddle !== false
          }))
      : []
  };
}

async function importConfig(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      Object.assign(state, normalizeImported(JSON.parse(e.target.result)));
      syncInputsFromState();
      applyModeUI();
      if (state.fontData) await installFont();
      else await reloadFontByName();
      await loadBgImage();
      renderFloatList();
      mountPreview();
      persist();
      showToast('配置导入成功', 'success');
    } catch (err) {
      showToast('导入失败：' + (err && err.message ? err.message : err), 'error');
    }
    input.value = '';
  };
  reader.readAsText(f);
}

async function clearAll() {
  const ok = await showConfirm('清空配置', '确定清空视频封面所有配置吗？');
  if (!ok) return;
  try {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete('video_state');
    tx.oncomplete = () => location.reload();
    tx.onerror = () => location.reload();
  } catch (e) {
    location.reload();
  }
}

/* =========================================================================
 * 表单同步与事件绑定
 * ========================================================================= */
function syncInputsFromState() {
  const map = {
    capTextInput: state.capText,
    capTextBrightness: state.capTextBrightness,
    capTextBrightnessInput: state.capTextBrightness,
    mainTextInput: state.mainText,
    sub1Input: state.sub1,
    sub2Input: state.sub2,
    midBrightness: state.midBrightness,
    midBrightnessInput: state.midBrightness,
    midBlur: state.midBlur,
    midBlurInput: state.midBlur,
    characterX: state.characterX,
    characterXInput: state.characterX
  };
  Object.entries(map).forEach(([id, value]) => {
    const el = $(id);
    if (el) el.value = value ?? '';
  });

  updateSizeDropdown('sub1', state.sub1Size);
  updateSizeDropdown('sub2', state.sub2Size);

  const lv = $('labelVideoFont');
  if (lv) lv.textContent = state.fontName ? '当前：' + state.fontName : '默认系统字体';

  renderLogoDropdown();

  const bgThumb = $('bgThumb');
  const bgNameEl = $('bgFileName');
  if (state.bg) {
    if (bgThumb) bgThumb.src = state.bg;
    if (bgNameEl) bgNameEl.textContent = '已载入背景图（点击更换）';
  } else {
    if (bgThumb) bgThumb.removeAttribute('src');
    if (bgNameEl) bgNameEl.textContent = '点击上传背景图';
  }
}

function bindEvents() {
  $('bgFile')?.addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const nameEl = $('bgFileName');
    if (nameEl) nameEl.textContent = f.name;
    const reader = new FileReader();
    reader.onload = async () => {
      state.bg = reader.result;
      const bgThumb = $('bgThumb');
      if (bgThumb) bgThumb.src = state.bg;
      await loadBgImage();
      mountPreview();
      persist();
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  });

  $('btnGuides')?.addEventListener('click', e => {
    e.stopPropagation();
    state.showGuides = !state.showGuides;
    mountPreview(); persist();
  });

  $('btnExportVideo')?.addEventListener('click', e => {
    e.stopPropagation();
    exportConfig();
  });

  $('btnImportVideo')?.addEventListener('click', e => {
    e.stopPropagation();
    $('importVideoInput')?.click();
  });
  $('importVideoInput')?.addEventListener('change', e => {
    importConfig(e.target);
  });

  $('btnClearVideo')?.addEventListener('click', e => {
    e.stopPropagation();
    clearAll();
  });

  const frame = $('previewFrame');
  const toolbar = $('floatToolbar');
  if (frame && toolbar) {
    frame.addEventListener('click', (ev) => {
      if (toolbar.contains(ev.target)) return;
      toolbar.classList.toggle('hidden');
    });
  }

  $('mainTextInput')?.addEventListener('input', e => {
    state.mainText = e.target.value;
    mountPreview(); persist();
  });
  $('capTextInput')?.addEventListener('input', e => {
    state.capText = e.target.value;
    mountPreview(); persist();
  });

  /* 下拉项点击（Logo / 字号 / 字体） */
  document.addEventListener('click', e => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;

    if (item.dataset.logoFile) {
      state.capLogo = LOGO_BASE_URL + item.dataset.logoFile;
      const t = $('logoThumb');
      if (t) t.src = state.capLogo;
      const label = $('logoDropdownLabel');
      if (label) label.textContent = item.textContent;
      const panel = $('logoDropdownPanel');
      if (panel) {
        panel.querySelectorAll('.dropdown-item').forEach(el => {
          el.classList.toggle('is-active', el === item);
        });
      }
      mountPreview(); persist();
      return;
    }

    if (item.dataset.target) {
      const line = item.dataset.target === 'sub1' ? 1 : 2;
      App.setSubSize(line, item.dataset.value);
      const label = $(item.dataset.target + 'SizeLabel');
      if (label) label.textContent = item.textContent;
      const panel = item.closest('.dropdown-panel');
      if (panel) {
        panel.querySelectorAll('.dropdown-item').forEach(el => {
          el.classList.toggle('is-active', el === item);
        });
      }
      return;
    }

    if (item.dataset.fontIndex !== undefined) {
      selectFont(Number(item.dataset.fontIndex));
      return;
    }
  });
}

/* =========================================================================
 * 对外接口
 * ========================================================================= */
const App = {
  set(key, value) {
    if (state[key] === value) return;
    state[key] = value;
    mountPreview();
    persist();
  },
  syncVal(key, val) {
    if (val === '' || Number.isNaN(Number(val))) return;
    state[key] = Number(val);
    const slider = $(key);
    const input = $(key + 'Input');
    if (document.activeElement !== slider && slider) slider.value = val;
    if (document.activeElement !== input && input) input.value = val;

    if (key === 'characterX') {
      updateCharImgX();
    } else if (key === 'midBlur' || key === 'midBrightness') {
      /* 这两个会触发 4K 级别的背景重算，防抖后再画 */
      scheduleHeavyPreview();
    } else {
      mountPreview();
    }
    persist();
  },
  setSubSize(line, value) {
    state[line === 1 ? 'sub1Size' : 'sub2Size'] = Number(value);
    mountPreview();
    persist();
  },

  setGuideType,
  matchCharacterName,
  matchBossName,
  onSub1Input,
  onSub1Blur,
  onSub2Input,
  onSub2Blur,

  addFloat,
  setFloat(id, key, value) {
    const o = state.floatImg.find(x => x.id === id);
    if (!o) return;
    o[key] = value;
    mountPreview(); persist();
  },
  moveFloat(id, dir) {
    const i = state.floatImg.findIndex(o => o.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= state.floatImg.length) return;
    [state.floatImg[i], state.floatImg[j]] = [state.floatImg[j], state.floatImg[i]];
    renderFloatList(); mountPreview(); persist();
  },
  removeFloat(id) {
    state.floatImg = state.floatImg.filter(o => o.id !== id);
    renderFloatList(); mountPreview(); persist();
  },
  triggerReplaceFloat(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const o = state.floatImg.find(x => x.id === id);
      if (!o) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          o.url = reader.result;
          o.w = img.width; o.h = img.height;
          renderFloatList(); mountPreview(); persist();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  selectFont,

  exportPNG,
  exportConfig,
  importConfig,
  clearAll
};
window.App = App;

/* =========================================================================
 * 启动
 * ========================================================================= */
(async function init() {
  try {
    try {
      await window.__bootPromise;
    } catch (e) {
      console.warn('[boot]', e);
    }

    if (typeof window.ICONS === 'undefined') {
      throw new Error('图标库未加载（ui-icons.js），请刷新重试');
    }

    injectIcons();

    try { await loadDataFiles(); } catch (e) {}
    try { await loadFontList(); } catch (e) {}
    try { await loadPersist(); } catch (e) {}

    if (state.guideType === 'character' || state.guideType === 'boss') {
      state.mainText = MODE_MAIN_TEXTS[state.guideType];
      state.capText = MODE_CAP_TEXT[state.guideType];
    }

    try { await installFont(); } catch (e) {}
    try { await loadBgImage(); } catch (e) {}

    syncInputsFromState();
    renderFontDropdown();
    applyModeUI();
    renderFloatList();          /* 内部会调用 injectIcons() 处理动态生成的按钮 */
    bindEvents();
    mountPreview();

    document.body.classList.add('ready');
  } catch (err) {
    console.error('[init]', err);
    const bootEl = document.querySelector('.boot-loading');
    if (bootEl) {
      bootEl.style.whiteSpace = 'pre-wrap';
      bootEl.textContent = '初始化失败：' + (err && err.message ? err.message : String(err)) +
        '\n请刷新重试；若持续失败，请把这条信息反馈给维护者。';
    }
  }
})();

window.addEventListener('message', function (e) {
  if (e.data && e.data.theme) {
    const html = document.documentElement;
    html.classList.add('theme-switching');
    html.setAttribute('data-theme', e.data.theme);
    void html.offsetHeight;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        html.classList.remove('theme-switching');
      });
    });
  }
});

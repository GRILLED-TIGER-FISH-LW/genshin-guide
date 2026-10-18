/* =========================================================================
 * 视频封面 · app.js (2026 现代扁平终极版)
 * ========================================================================= */
'use strict';

const SVG_W = 3840;
const SVG_H = 2160;
const BLUR_MAX_PX = 100;

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

const ART_PATH_PREFIX_OLD = '../../shared/';
const ART_PATH_PREFIX_NEW = '../../../shared/';

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

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function getFormattedDateStr() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
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
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

function showConfirm(title, message) {
  return new Promise(resolve => {
    const backdrop = document.getElementById('modalBackdrop');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    const cancelBtn = document.getElementById('modalCancel');
    const confirmBtn = document.getElementById('modalConfirm');
    const cleanup = (result) => {
      backdrop.classList.remove('show');
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
      backdrop.onclick = null;
      resolve(result);
    };
    cancelBtn.onclick = () => cleanup(false);
    confirmBtn.onclick = () => cleanup(true);
    backdrop.onclick = (e) => { if (e.target === backdrop) cleanup(false); };
    backdrop.classList.add('show');
  });
}

function injectIcons() {
  const upIcon = ICONS.ui.arrowUp || '';
  const iconMap = {
    export: ICONS.ui.export || '',
    import: ICONS.ui.import || '',
    trash: ICONS.ui.trash || '',
    plus: ICONS.ui.plus || '',
    up: upIcon,
    down: '<span class="icon-flip-y">' + upIcon + '</span>',
    font: ICONS.ui.import || '',
    // 替换为你找的参考线图标
    guides: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="currentColor" d="M152 40a8 8 0 0 1-8 8h-32a8 8 0 0 1 0-16h32a8 8 0 0 1 8 8m-8 168h-32a8 8 0 0 0 0 16h32a8 8 0 0 0 0-16m64-176h-24a8 8 0 0 0 0 16h24v24a8 8 0 0 0 16 0V48a16 16 0 0 0-16-16m8 72a8 8 0 0 0-8 8v32a8 8 0 0 0 16 0v-32a8 8 0 0 0-8-8m0 72a8 8 0 0 0-8 8v24h-24a8 8 0 0 0 0 16h24a16 16 0 0 0 16-16v-24a8 8 0 0 0-8-8M40 152a8 8 0 0 0 8-8v-32a8 8 0 0 0-16 0v32a8 8 0 0 0 8 8m32 56H48v-24a8 8 0 0 0-16 0v24a16 16 0 0 0 16 16h24a8 8 0 0 0 0-16m0-176H48a16 16 0 0 0-16 16v24a8 8 0 0 0 16 0V48h24a8 8 0 0 0 0-16"/></svg>'
  };
  document.querySelectorAll('[data-icon]').forEach(el => {
    const key = el.dataset.icon;
    if (iconMap[key]) el.innerHTML = iconMap[key];
  });
}

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

  const W = SVG_W, H = SVG_H;
  const img = cachedBgImage;
  const blurPx = (Math.min(100, Math.max(0, Number(state.midBlur) || 0)) / 100) * BLUR_MAX_PX;
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

    const pad = Math.ceil(blurPx * 3) + 20;
    const BW = W + pad * 2, BH = H + pad * 2;
    const tmp2 = document.createElement('canvas');
    tmp2.width = BW; tmp2.height = BH;
    const t2 = tmp2.getContext('2d');
    t2.drawImage(tmp1, pad, pad);
    t2.drawImage(tmp1, 0, 0, W, 1, pad, 0, W, pad);
    t2.drawImage(tmp1, 0, H - 1, W, 1, pad, pad+H, W, pad);
    t2.drawImage(tmp1, 0, 0, 1, H, 0, pad, pad, H);
    t2.drawImage(tmp1, W-1, 0, 1, H, pad+W, pad, pad, H);
    t2.drawImage(tmp1, 0, 0, 1, 1, 0, 0, pad, pad);
    t2.drawImage(tmp1, W-1, 0, 1, 1, pad+W, 0, pad, pad);
    t2.drawImage(tmp1, 0, H-1, 1, 1, 0, pad+H, pad, pad);
    t2.drawImage(tmp1, W-1, H-1, 1, 1, pad+W, pad+H, pad, pad);

    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(tmp2, -pad, -pad);
    ctx.filter = 'none';
  } else {
    const coverScale = Math.max(W / img.width, H / img.height);
    const coverW = img.width * coverScale;
    const coverH = img.height * coverScale;
    const coverX = (W - coverW) / 2;
    const coverY = (H - coverH) / 2;
    ctx.drawImage(img, coverX, coverY, coverW, coverH);
  }

  if (slope < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - slope})`;
    ctx.fillRect(0, 0, W, H);
  } else if (slope > 1) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, slope - 1)})`;
    ctx.fillRect(0, 0, W, H);
  }

  const dataURL = c.toDataURL('image/png');
  cachedBlurredBg = dataURL;
  cachedBlurredBgKey = key;
  return dataURL;
}

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

function buildSVG(showGuides, forExport = false) {
  const s = state;
  const font = getFontFamily();
  const fontFace = (forExport && s.fontData) ? `@font-face{font-family:'${s.fontName}';src:url("${s.fontData}");font-display:block}` : '';

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

  const usePattern = !!(s.bg && s.capText);
  const capTextFill = usePattern ? 'url(#capTextPattern)' : '#1a1a1a';
  const blurredBgUrl = cachedBgImage ? generateBlurredBgSync() : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
<defs>
  <style>${fontFace} text { font-family: ${font}; paint-order: fill; text-rendering: geometricPrecision; font-synthesis: none; }</style>
  <linearGradient id="midMask" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#fff"/><stop offset="40%" stop-color="#fff"/>
    <stop offset="60%" stop-color="#000"/><stop offset="100%" stop-color="#000"/>
  </linearGradient>
  <mask id="midMaskUse"><rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" fill="url(#midMask)"/></mask>
  ${s.capLogo ? `<clipPath id="logoClip"><rect x="${logoX}" y="${logoY}" width="${LOGO_SIZE_FIXED}" height="${LOGO_SIZE_FIXED}" rx="${LOGO_ROUNDED_FIXED}" ry="${LOGO_ROUNDED_FIXED}"/></clipPath>` : ''}
  ${capShadowFilter}
  ${usePattern ? `<pattern id="capTextPattern" patternUnits="userSpaceOnUse" x="0" y="0" width="${SVG_W}" height="${SVG_H}">
    <image href="${s.bg}" x="0" y="0" width="${SVG_W}" height="${SVG_H}" preserveAspectRatio="xMidYMid slice"/>
  </pattern>` : ''}
  ${floatClipDefs}
</defs>

${s.bg ? `<image href="${s.bg}" x="0" y="0" width="${SVG_W}" height="${SVG_H}" preserveAspectRatio="xMidYMid slice"/>` : '<rect width="3840" height="2160" fill="#1c1c22"/>'}
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

let previewSvgEl = null;

function mountPreview() {
  const host = document.getElementById('svgPreviewHost');
  if (!host) return;
  host.innerHTML = buildSVG(state.showGuides);
  previewSvgEl = host.querySelector('svg');
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

function applyModeUI() {
  const type = state.guideType;

  // 独立面板的显示隐藏
  const cp = document.getElementById('characterPanel');
  const csp = document.getElementById('customPanel');
  if (cp) cp.classList.toggle('hidden', type !== 'character');
  if (csp) csp.classList.toggle('hidden', type !== 'custom');

  // Tab 栏高亮
  const btns = document.querySelectorAll('.tab-bar .tab-btn');
  btns.forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });

  // 其他段落显隐
  const sub1SizeRow = document.getElementById('sub1SizeRow');
  const sub2SizeRow = document.getElementById('sub2SizeRow');
  if (sub1SizeRow) sub1SizeRow.classList.toggle('hidden', type !== 'custom');
  if (sub2SizeRow) sub2SizeRow.classList.toggle('hidden', type !== 'custom');

  const mainSection = document.getElementById('mainSection');
  const capSection = document.getElementById('capSection');
  if (mainSection) mainSection.classList.toggle('hidden', type !== 'custom');
  if (capSection) capSection.classList.toggle('hidden', type !== 'custom');

  // 标签文字
  const sub1Label = document.getElementById('sub1Label');
  const sub2Label = document.getElementById('sub2Label');
  if (sub1Label) {
    sub1Label.textContent =
      type === 'character' ? '第一行（自动编号）' :
      type === 'boss' ? '第一行（BOSS 名）' :
      '第一行';
  }
  if (sub2Label) {
    sub2Label.textContent =
      type === 'character' ? '第二行（角色名）' :
      '第二行';
  }

  const sub1Input = document.getElementById('sub1Input');
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

  const mainInput = document.getElementById('mainTextInput');
  if (mainInput) mainInput.value = state.mainText;
  const capInput = document.getElementById('capTextInput');
  if (capInput) capInput.value = state.capText;
  const sub1Input = document.getElementById('sub1Input');
  if (sub1Input) sub1Input.value = '';
  const sub2Input = document.getElementById('sub2Input');
  if (sub2Input) sub2Input.value = '';

  const bgNameEl = document.getElementById('bgFileName');
  if (bgNameEl) bgNameEl.textContent = '点击上传背景图';
  const bgThumb = document.getElementById('bgThumb');
  if (bgThumb) bgThumb.removeAttribute('src');

  const s1 = document.getElementById('sub1Select');
  const s2 = document.getElementById('sub2Select');
  if (s1) s1.value = String(state.sub1Size);
  if (s2) s2.value = String(state.sub2Size);

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
  const sub2Input = document.getElementById('sub2Input');
  if (sub2Input && document.activeElement !== sub2Input) sub2Input.value = name;

  if (!name) {
    state.characterArt = null;
    state.bg = '';
    state.sub1 = '';
    const sub1Input = document.getElementById('sub1Input');
    if (sub1Input) sub1Input.value = '';
    const bgNameEl = document.getElementById('bgFileName');
    if (bgNameEl) bgNameEl.textContent = '点击上传背景图';
    const bgThumb = document.getElementById('bgThumb');
    if (bgThumb) bgThumb.removeAttribute('src');
    await loadBgImage();
    mountPreview(); persist();
    return;
  }

  const baseName = stripElementSuffix(name);
  const order = CHAR_NAME_TO_ORDER[name] || CHAR_NAME_TO_ORDER[baseName];
  state.sub1 = order ? ('No.' + padOrder(order)) : '';
  const sub1Input = document.getElementById('sub1Input');
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
    const bgNameEl = document.getElementById('bgFileName');
    if (bgNameEl) bgNameEl.textContent = '已自动加载名片图';
    const bgThumb = document.getElementById('bgThumb');
    if (bgThumb) bgThumb.src = state.bg;
  } else {
    state.bg = '';
    const bgNameEl = document.getElementById('bgFileName');
    if (bgNameEl) bgNameEl.textContent = '点击上传背景图';
    const bgThumb = document.getElementById('bgThumb');
    if (bgThumb) bgThumb.removeAttribute('src');
  }

  await loadBgImage();
  mountPreview();
  persist();
}

async function matchBossName(name) {
  name = (name || '').trim();
  state.sub1 = name;
  const sub1Input = document.getElementById('sub1Input');
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
  const el = document.getElementById('floatList');
  if (!el) return;
  // 【核心修改】如果没有素材，直接清空，不再显示"暂无素材"废话
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
          <button class="btn-xs" data-icon="up" onclick="App.moveFloat('${o.id}',-1)"></button>
          <button class="btn-xs" data-icon="down" onclick="App.moveFloat('${o.id}',1)"></button>
          <button class="btn-xs btn-danger" data-icon="trash" onclick="App.removeFloat('${o.id}')"></button>
        </div>
      </div>
      <div class="control-item">
        <div class="control-header"><span>X 位置</span></div>
        <div class="slider-row">
          <input type="range" min="0" max="3840" value="${o.x}" oninput="App.setFloat('${o.id}','x',Number(this.value))">
          <div class="num-box"><input type="number" value="${Math.round(o.x)}" oninput="App.setFloat('${o.id}','x',Number(this.value))"><span class="unit-tag">px</span></div>
        </div>
      </div>
      <div class="control-item">
        <div class="control-header"><span>缩放</span></div>
        <div class="slider-row">
          <input type="range" min="10" max="200" value="${Math.round(o.scale*100)}" oninput="App.setFloat('${o.id}','scale',Number(this.value)/100)">
          <div class="num-box"><input type="number" min="10" max="200" value="${Math.round(o.scale*100)}" oninput="App.setFloat('${o.id}','scale',Number(this.value)/100)"><span class="unit-tag">%</span></div>
        </div>
      </div>
      <div class="control-item">
        <div class="control-header"><span>圆角</span></div>
        <div class="slider-row">
          <input type="range" min="0" max="100" value="${Math.round(o.rounded||0)}" oninput="App.setFloat('${o.id}','rounded',Number(this.value))">
          <div class="num-box"><input type="number" min="0" max="100" value="${Math.round(o.rounded||0)}" oninput="App.setFloat('${o.id}','rounded',Number(this.value))"><span class="unit-tag">%</span></div>
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

async function loadFontList() {
  try {
    const res = await fetch('../../../shared/fonts/fonts.json?t=' + Date.now());
    if (res.ok) {
      const json = await res.json();
      FONT_LIST = Array.isArray(json.fonts) ? json.fonts : [];
    }
  } catch (e) {}
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
    } catch (e) {
      const arr = state.fontData.split(',');
      const raw = atob(arr[1]);
      buffer = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        buffer[i] = raw.charCodeAt(i);
      }
    }

    const ff = new FontFace(state.fontName, buffer);
    const loaded = await ff.load();
    document.fonts.add(loaded);
    loadedFontFace = loaded;

    let styleEl = document.getElementById('video-preview-font-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'video-preview-font-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@font-face{font-family:'${state.fontName}';src:url("${state.fontData}");font-display:block}`;

    return true;
  } catch (e) {
    console.error('字体解析异常：', e);
    return false;
  }
}

function openFontPicker() {
  const listEl = document.getElementById('fontSheetList');
  if (!listEl) return;
  const curFile = state.fontFileName;
  let html = '<button type="button" class="tab-sheet-item ' + (curFile === '' ? 'active' : '') + '" onclick="App.selectFont(-1)">' +
    '<span>默认系统字体</span>' +
    '<svg class="tab-sheet-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
  '</button>';
  FONT_LIST.forEach((f, i) => {
    const isAct = curFile === f.file;
    html += '<button type="button" class="tab-sheet-item ' + (isAct ? 'active' : '') + '" onclick="App.selectFont(' + i + ')">' +
      '<span>' + esc(f.name) + '</span>' +
      '<svg class="tab-sheet-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
    '</button>';
  });
  listEl.innerHTML = html;
  document.getElementById('fontSheetBackdrop').classList.add('show');
  document.getElementById('fontSheet').classList.add('show');
}

function closeFontPicker() {
  document.getElementById('fontSheetBackdrop').classList.remove('show');
  document.getElementById('fontSheet').classList.remove('show');
}

async function selectFont(index) {
  closeFontPicker();
  const labelEl = document.getElementById('labelVideoFont');

  if (index === -1) {
    state.fontData = ''; state.fontFileName = ''; state.fontName = '';
    if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch (e) {} loadedFontFace = null; }
    const oldStyle = document.getElementById('video-preview-font-style');
    if (oldStyle) oldStyle.remove();
    if (labelEl) labelEl.textContent = '默认系统字体';
    mountPreview(); persist();
    return;
  }

  const f = FONT_LIST[index];
  if (!f) return;
  if (state.fontFileName === f.file && state.fontData) {
    if (labelEl) labelEl.textContent = '当前：' + f.name;
    return;
  }

  try {
    if (labelEl) labelEl.textContent = `[1/3] 正在下载二进制流...`;
    let res;
    try {
      res = await fetch('../../../shared/fonts/' + encodeURIComponent(f.file));
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
      if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch(e){} }
      document.fonts.add(loaded);
      loadedFontFace = loaded;
    } catch (fontErr) {
      throw new Error(`该格式无法识别或文件损坏 (${fontErr.message || 'Font Engine Refused'})`);
    }

    if (labelEl) labelEl.textContent = `[3/3] 正在固化存档数据...`;

    let ext = f.file.split('.').pop().toLowerCase();
    let mime = 'font/ttf';
    if (ext === 'otf') mime = 'font/otf';
    else if (ext === 'woff2') mime = 'font/woff2';
    else if (ext === 'woff') mime = 'font/woff';

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

    let styleEl = document.getElementById('video-preview-font-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'video-preview-font-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@font-face{font-family:'${state.fontName}';src:url("${state.fontData}");font-display:block}`;

    if (labelEl) labelEl.textContent = '当前：' + f.name;
    mountPreview(); persist();

  } catch (err) {
    console.error(`[字体加载失败] ${f.name}:`, err);
    if (labelEl) labelEl.textContent = `异常卡住: ${err.message}`;
    showToast(`字体 [${f.name}] 加载失败: ${err.message}`, 'error');

    state.fontData = '';
    state.fontFileName = '';
    state.fontName = '';
    persist();
  }
}

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

function getExportBaseName() {
  const s2 = (state.sub2 || '').trim();
  const s1 = (state.sub1 || '').trim();
  const mt = (state.mainText || '').trim();
  let name = s2 || s1 || mt || '视频封面';
  return name.replace(/[\r\n]+/g, '').replace(/[\\/:*?"<>|]/g, '_');
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

async function exportPNG() {
  try {
    if (document.fonts) await document.fonts.ready;
    await bakeAndExport();
  } catch (e) {
    showToast('导出失败：' + e.message, 'error');
  }
}

function exportConfig() {
  downloadBlob(
    new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
    '视频封面配置_' + getFormattedDateStr() + '.json'
  );
}

async function importConfig(input) {
  const f = input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      Object.assign(state, JSON.parse(e.target.result));
      syncInputsFromState();
      applyModeUI();
      if (state.fontData) await installFont();
      await loadBgImage();
      renderFloatList();
      mountPreview();
      persist();
    } catch (err) { showToast('导入失败', 'error'); }
  };
  reader.readAsText(f);
  input.value = '';
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
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = map[id] ?? '';
  });

  const s1 = document.getElementById('sub1Select');
  const s2 = document.getElementById('sub2Select');
  if (s1) s1.value = String(state.sub1Size);
  if (s2) s2.value = String(state.sub2Size);

  const lv = document.getElementById('labelVideoFont');
  if (lv) lv.textContent = state.fontName ? '当前：' + state.fontName : '默认系统字体';

  const logoSelect = document.getElementById('logoSelect');
  if (logoSelect && state.capLogo) {
    const file = state.capLogo.replace(LOGO_BASE_URL, '');
    logoSelect.value = file;
  }
  const t = document.getElementById('logoThumb');
  if (t && state.capLogo) t.src = state.capLogo;

  const bgThumb = document.getElementById('bgThumb');
  const bgNameEl = document.getElementById('bgFileName');
  if (state.bg) {
    if (bgThumb) bgThumb.src = state.bg;
    if (bgNameEl) bgNameEl.textContent = '已载入背景图（点击更换）';
  } else {
    if (bgThumb) bgThumb.removeAttribute('src');
    if (bgNameEl) bgNameEl.textContent = '点击上传背景图';
  }
}

function bindEvents() {
  document.getElementById('bgFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const nameEl = document.getElementById('bgFileName');
    if (nameEl) nameEl.textContent = f.name;
    const reader = new FileReader();
    reader.onload = async () => {
      state.bg = reader.result;
      const bgThumb = document.getElementById('bgThumb');
      if (bgThumb) bgThumb.src = state.bg;
      await loadBgImage();
      mountPreview();
      persist();
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  });

  document.getElementById('btnGuides').addEventListener('click', e => {
    e.stopPropagation();
    state.showGuides = !state.showGuides;
    mountPreview(); persist();
  });

  document.getElementById('btnExportVideo').addEventListener('click', e => {
    e.stopPropagation();
    exportConfig();
  });

  document.getElementById('btnImportVideo').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('importVideoInput').click();
  });
  document.getElementById('importVideoInput').addEventListener('change', e => {
    importConfig(e.target);
  });

  document.getElementById('btnClearVideo').addEventListener('click', e => {
    e.stopPropagation();
    clearAll();
  });

  const frame = document.getElementById('previewFrame');
  const toolbar = document.getElementById('floatToolbar');
  if (frame && toolbar) {
    frame.addEventListener('click', (ev) => {
      if (toolbar.contains(ev.target)) return;
      toolbar.classList.toggle('hidden');
    });
  }

  document.getElementById('mainTextInput').addEventListener('input', e => {
    state.mainText = e.target.value;
    mountPreview(); persist();
  });
  document.getElementById('capTextInput').addEventListener('input', e => {
    state.capText = e.target.value;
    mountPreview(); persist();
  });
}

const App = {
  set(key, value) {
    if (state[key] === value) return;
    state[key] = value;
    mountPreview();
    persist();
  },
  syncVal(key, val) {
    if (val === '' || isNaN(val)) return;
    state[key] = Number(val);
    const slider = document.getElementById(key);
    const input = document.getElementById(key + 'Input');
    if (document.activeElement !== slider && slider) slider.value = val;
    if (document.activeElement !== input && input) input.value = val;

    if (key === 'characterX') {
      updateCharImgX();
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

  openFontPicker,
  closeFontPicker,
  selectFont,

  exportPNG,
  exportConfig,
  importConfig,
  clearAll
};
window.App = App;

(async function init() {
  try { await window.__bootPromise; } catch (e) { console.warn(e); }

  injectIcons();
  try { await loadDataFiles(); } catch(e) {}
  try { await loadFontList(); } catch(e) {}
  try { await loadPersist(); } catch(e) {}

  if (state.guideType === 'character' || state.guideType === 'boss') {
    state.mainText = MODE_MAIN_TEXTS[state.guideType];
    state.capText = MODE_CAP_TEXT[state.guideType];
  }

  try { await installFont(); } catch(e) {}
  try { await loadBgImage(); } catch(e) {}

  const logoSelect = document.getElementById('logoSelect');
  if (logoSelect) {
    logoSelect.innerHTML = LOGO_LIST.map(l =>
      '<option value="' + esc(l.file) + '">' + esc(l.name) + '</option>'
    ).join('');

    const logoFiles = LOGO_LIST.map(l => l.file);
    const currentLogoFile = (state.capLogo && state.capLogo.startsWith(LOGO_BASE_URL))
      ? state.capLogo.replace(LOGO_BASE_URL, '')
      : '';
    if (!logoFiles.includes(currentLogoFile)) {
      state.capLogo = LOGO_BASE_URL + LOGO_LIST[0].file;
    }

    const curFile = state.capLogo.replace(LOGO_BASE_URL, '');
    logoSelect.value = curFile;

    logoSelect.addEventListener('change', function () {
      state.capLogo = LOGO_BASE_URL + this.value;
      const t = document.getElementById('logoThumb');
      if (t) t.src = state.capLogo;
      mountPreview(); persist();
    });
    const t = document.getElementById('logoThumb');
    if (t) t.src = state.capLogo;
  }

  syncInputsFromState();
  applyModeUI();
  renderFloatList();
  bindEvents();
  mountPreview();
  injectIcons();

  document.body.classList.add('ready');
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

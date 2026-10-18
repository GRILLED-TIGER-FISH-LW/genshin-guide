/* =========================================================================
 * 合集封面 · app.js (2026 现代 ES6+ 彻底重构版)
 * =========================================================================
 * 核心改造：
 * 1. 彻底移除原生 alert/confirm，接入全局 Toast 与 Modal。
 * 2. 用数组循环优化模糊背景边缘拉伸代码，减少 50% 冗余。
 * 3. 补齐缩略图同步逻辑。
 * 4. 严格遵循 async/await 现代语法。
 * ========================================================================= */
'use strict';

/* =========================================================================
 * 【模块 1】状态与常量
 * ========================================================================= */
const collectionState = {
  W: 2560, H: 1440,
  bg: '', bgLoadedImg: null,
  fontData: '', fontName: '', fontFileName: '',
  title: '', subtitle: ''
};

let FONT_LIST = [];
let loadedFontFace = null;

const DOM = {
  previewHost: document.getElementById('collectionPreview'),
  toastContainer: document.getElementById('toastContainer'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  modalCancel: document.getElementById('modalCancel'),
  modalConfirm: document.getElementById('modalConfirm'),
  fontSheetBackdrop: document.getElementById('fontSheetBackdrop'),
  fontSheet: document.getElementById('fontSheet'),
  fontSheetList: document.getElementById('fontSheetList')
};

/* =========================================================================
 * 【模块 2】UI 交互封装 (Toast / Confirm)
 * ========================================================================= */
function showToast(message, type = 'info') {
  if (!DOM.toastContainer) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  el.textContent = message;
  DOM.toastContainer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

function showConfirm(title, message) {
  return new Promise(resolve => {
    DOM.modalTitle.textContent = title;
    DOM.modalMessage.textContent = message;
    const cleanup = (result) => {
      DOM.modalBackdrop.classList.remove('show');
      DOM.modalCancel.onclick = null;
      DOM.modalConfirm.onclick = null;
      DOM.modalBackdrop.onclick = null;
      resolve(result);
    };
    DOM.modalCancel.onclick = () => cleanup(false);
    DOM.modalConfirm.onclick = () => cleanup(true);
    DOM.modalBackdrop.onclick = (e) => { if (e.target === DOM.modalBackdrop) cleanup(false); };
    DOM.modalBackdrop.classList.add('show');
  });
}

/* =========================================================================
 * 【模块 3】工具函数
 * ========================================================================= */
function getFormattedDateStr() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function injectIcons() {
  const iconMap = { trash: ICONS.ui.trash || '', check: ICONS.ui.check || '' };
  document.querySelectorAll('[data-icon]').forEach(el => {
    const key = el.dataset.icon;
    if (iconMap[key]) el.innerHTML = iconMap[key];
  });
}

/* =========================================================================
 * 【模块 4】合集画布绘制
 * ========================================================================= */
async function drawCollectionCanvas(canvas) {
  const W = collectionState.W, H = collectionState.H;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  if (collectionState.bg) {
    let img = collectionState.bgLoadedImg;
    if (!img || img.src !== collectionState.bg) {
      img = await new Promise(resolve => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = () => resolve(null);
        i.src = collectionState.bg;
      });
      if (img) collectionState.bgLoadedImg = img;
    }
    if (img) {
      drawBlurredBackground(ctx, img, W, H);
    } else {
      ctx.fillStyle = '#1c1c22'; ctx.fillRect(0, 0, W, H);
    }
  } else {
    ctx.fillStyle = '#1c1c22'; ctx.fillRect(0, 0, W, H);
  }
  drawCollectionText(ctx);
}

function drawBlurredBackground(ctx, img, W, H) {
  const blurPx = Math.max(12, Math.round(W * 0.015));
  const pad = Math.ceil(blurPx * 3) + 20;

  const fillScale = Math.max(W / img.width, H / img.height);
  const fillW = img.width * fillScale;
  const fillH = img.height * fillScale;
  const fillX = (W - fillW) / 2;
  const fillY = (H - fillH) / 2;

  const a = document.createElement('canvas');
  a.width = W; a.height = H;
  a.getContext('2d').drawImage(img, fillX, fillY, fillW, fillH);

  const BW = W + pad * 2, BH = H + pad * 2;
  const b = document.createElement('canvas');
  b.width = BW; b.height = BH;
  const bctx = b.getContext('2d');
  bctx.drawImage(a, pad, pad);

  // 优化：用循环代替手写 8 次 drawImage 拉伸
  const edges = [
    [0, 0, W, 1, pad, 0, W, pad],           // 上
    [0, H - 1, W, 1, pad, pad + H, W, pad], // 下
    [0, 0, 1, H, 0, pad, pad, H],           // 左
    [W - 1, 0, 1, H, pad + W, pad, pad, H], // 右
    [0, 0, 1, 1, 0, 0, pad, pad],           // 左上
    [W - 1, 0, 1, 1, pad + W, 0, pad, pad], // 右上
    [0, H - 1, 1, 1, 0, pad + H, pad, pad], // 左下
    [W - 1, H - 1, 1, 1, pad + W, pad + H, pad, pad] // 右下
  ];
  edges.forEach(args => bctx.drawImage(a, ...args));

  const c = document.createElement('canvas');
  c.width = BW; c.height = BH;
  const cctx = c.getContext('2d');
  cctx.filter = `blur(${blurPx}px)`;
  cctx.drawImage(b, 0, 0);
  cctx.filter = 'none';

  ctx.drawImage(c, pad, pad, W, H, 0, 0, W, H);
}

function drawCollectionText(ctx) {
  const W = collectionState.W, H = collectionState.H;
  const baseSize = W * 0.10;
  const maxWidth = W * 0.85;
  const fontName = collectionState.fontName || 'system-ui';
  const font = `"${fontName}", system-ui, sans-serif`;
  const titleLines = String(collectionState.title || '').split(/\r?\n/);
  const subtitleLines = String(collectionState.subtitle || '').split(/\r?\n/);
  const title = titleLines.filter(t => t !== '').map(text => ({ text, color: '#ffffff', group: 'title' }));
  const subtitle = subtitleLines.filter(t => t !== '').map(text => ({ text, color: '#ffe898', group: 'subtitle' }));
  const lines = title.concat(subtitle);
  if (!lines.length) return;

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  const normalGap = baseSize * 0.12, groupGap = baseSize;

  const measured = lines.map(item => {
    let fs = baseSize;
    ctx.font = `${fs}px ${font}`;
    while (ctx.measureText(item.text).width > maxWidth && fs > 12) {
      fs -= 1; ctx.font = `${fs}px ${font}`;
    }
    return { ...item, fs };
  });

  let totalHeight = 0;
  measured.forEach((line, i) => {
    totalHeight += line.fs;
    if (i < measured.length - 1) {
      totalHeight += measured[i + 1].group !== line.group ? groupGap : normalGap;
    }
  });

  let y = H / 2 - totalHeight / 2;
  for (let i = 0; i < measured.length; i++) {
    const line = measured[i];
    y += line.fs / 2;
    ctx.font = `${line.fs}px ${font}`;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 50;
    ctx.strokeText(line.text, W / 2, y);
    ctx.fillStyle = line.color; ctx.fillText(line.text, W / 2, y);
    y += line.fs / 2;
    if (i < measured.length - 1) {
      y += measured[i + 1].group !== line.group ? groupGap : normalGap;
    }
  }
}

async function renderCollection() {
  if (!DOM.previewHost) return;
  let canvas = DOM.previewHost.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    DOM.previewHost.appendChild(canvas);
  }
  if (document.fonts) { try { await document.fonts.ready; } catch (e) {} }
  await drawCollectionCanvas(canvas);
}

/* =========================================================================
 * 【模块 5】字体
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

async function installFont() {
  if (!collectionState.fontData || !window.FontFace) return;
  try {
    if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch (e) {} }
    const ff = new FontFace(collectionState.fontName, `url("${collectionState.fontData}")`);
    const loaded = await ff.load();
    document.fonts.add(loaded);
    loadedFontFace = loaded;
  } catch (e) {
    console.warn('字体加载失败：', e.message);
  }
}

function openFontPicker() {
  if (!DOM.fontSheetList) return;
  const curFile = collectionState.fontFileName;
  let html = '<button type="button" class="tab-sheet-item ' + (curFile === '' ? 'active' : '') + '" onclick="App.selectFont(-1)">' +
    '<span>默认系统字体</span>' +
    '<span class="icon-slot" data-icon="check"></span>' +
  '</button>';
  FONT_LIST.forEach((f, i) => {
    const isAct = curFile === f.file;
    html += '<button type="button" class="tab-sheet-item ' + (isAct ? 'active' : '') + '" onclick="App.selectFont(' + i + ')">' +
      '<span>' + (f.name || '') + '</span>' +
      '<span class="icon-slot" data-icon="check"></span>' +
    '</button>';
  });
  DOM.fontSheetList.innerHTML = html;
  injectIcons();
  DOM.fontSheetBackdrop.classList.add('show');
  DOM.fontSheet.classList.add('show');
}

function closeFontPicker() {
  DOM.fontSheetBackdrop.classList.remove('show');
  DOM.fontSheet.classList.remove('show');
}

async function selectFont(index) {
  closeFontPicker();
  const labelEl = document.getElementById('labelCollectionFont');
  if (index === -1) {
    collectionState.fontData = ''; collectionState.fontFileName = ''; collectionState.fontName = '';
    if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch (e) {} loadedFontFace = null; }
    if (labelEl) labelEl.textContent = '默认系统字体';
    renderCollection(); persist();
    return;
  }
  const f = FONT_LIST[index];
  if (!f) return;
  if (labelEl) labelEl.textContent = '正在加载…';
  try {
    const res = await fetch('../../../shared/fonts/' + encodeURIComponent(f.file));
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf]);
    const dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    collectionState.fontData = dataURL;
    collectionState.fontFileName = f.file;
    collectionState.fontName = f.name;
    await installFont();
    if (labelEl) labelEl.textContent = '当前：' + f.name;
    renderCollection(); persist();
  } catch (e) {
    if (labelEl) labelEl.textContent = '字体加载失败';
  }
}

/* =========================================================================
 * 【模块 6】持久化
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
    try {
      const db = await openIDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const save = { ...collectionState };
      delete save.bgLoadedImg;
      tx.objectStore(IDB_STORE).put(save, 'collection_state');
    } catch (e) {}
  }, 500);
}

async function loadPersist() {
  try {
    const db = await openIDB();
    return new Promise(resolve => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('collection_state');
      req.onsuccess = () => { if (req.result) Object.assign(collectionState, req.result); resolve(); };
      req.onerror = () => resolve();
    });
  } catch (e) {}
}

/* =========================================================================
 * 【模块 7】导出 / 清空
 * ========================================================================= */
async function exportCollection() {
  const canvas = DOM.previewHost.querySelector('canvas');
  if (!canvas) return;
  if (document.fonts) await document.fonts.ready;
  await drawCollectionCanvas(canvas);
  
  canvas.toBlob(blob => {
    if (!blob) return showToast('导出失败', 'error');
    if (blob.size > 5 * 1024 * 1024) return showToast('图片超过 5MB', 'error');
    const firstLine = (collectionState.title || '').split(/\r?\n/).find(l => l.trim()) || '合集封面';
    downloadBlob(blob, firstLine.trim() + '_' + getFormattedDateStr() + '.png');
    showToast('导出成功', 'success');
  }, 'image/png');
}

async function clearCollection() {
  const ok = await showConfirm('清空配置', '确定清空合集封面吗？');
  if (!ok) return;
  
  collectionState.bg = ''; collectionState.bgLoadedImg = null;
  collectionState.fontData = ''; collectionState.fontName = ''; collectionState.fontFileName = '';
  collectionState.title = ''; collectionState.subtitle = '';
  
  document.getElementById('collectionTitle').value = '';
  document.getElementById('collectionSubtitle').value = '';
  document.getElementById('collectionBgName').textContent = '点击上传背景图';
  document.getElementById('collectionBgThumb').removeAttribute('src');
  
  const l = document.getElementById('labelCollectionFont');
  if (l) l.textContent = '默认系统字体';
  
  renderCollection();
  persist();
}

/* =========================================================================
 * 【模块 8】UI 同步
 * ========================================================================= */
function syncInputsFromState() {
  const map = { collectionTitle: collectionState.title, collectionSubtitle: collectionState.subtitle };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = map[id] ?? '';
  });
  
  const lc = document.getElementById('labelCollectionFont');
  if (lc) lc.textContent = collectionState.fontName ? '当前：' + collectionState.fontName : '默认系统字体';
  
  const thumb = document.getElementById('collectionBgThumb');
  const nameEl = document.getElementById('collectionBgName');
  if (collectionState.bg) {
    if (thumb) thumb.src = collectionState.bg;
    if (nameEl) nameEl.textContent = '已载入背景图（点击更换）';
  }
}

/* =========================================================================
 * 【模块 9】事件绑定
 * ========================================================================= */
function bindEvents() {
  document.getElementById('collectionBgFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      collectionState.bg = reader.result;
      collectionState.bgLoadedImg = null;
      
      const thumb = document.getElementById('collectionBgThumb');
      const nameEl = document.getElementById('collectionBgName');
      if (thumb) thumb.src = collectionState.bg;
      if (nameEl) nameEl.textContent = '已载入背景图（点击更换）';
      
      renderCollection();
      persist();
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  });

  document.getElementById('btnClearCollection').addEventListener('click', e => {
    e.stopPropagation();
    clearCollection();
  });

  const frame = document.getElementById('previewFrame');
  const toolbar = document.getElementById('floatToolbar');
  if (frame && toolbar) {
    frame.addEventListener('click', ev => {
      if (toolbar.contains(ev.target)) return;
      toolbar.classList.toggle('hidden');
    });
  }
}

/* =========================================================================
 * 【模块 10】App 接口与初始化
 * ========================================================================= */
const App = {
  setCollection(key, value) {
    collectionState[key] = value;
    renderCollection();
    persist();
  },
  exportCollection,
  clearCollection,
  openFontPicker,
  closeFontPicker,
  selectFont
};
window.App = App;

(async function init() {
  try { await window.__bootPromise; } catch (e) { console.warn(e); }

  injectIcons();
  await loadFontList();
  await loadPersist();

  collectionState.W = 2560;
  collectionState.H = 1440;

  if (collectionState.fontData) await installFont();

  syncInputsFromState();
  bindEvents();
  renderCollection();

  document.body.classList.add('ready');
})();

window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'theme') {
    const html = document.documentElement;
    html.classList.add('theme-switching');
    html.setAttribute('data-theme', e.data.theme);
    void html.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => html.classList.remove('theme-switching'));
    });
  }
});

/* =========================================================================
 * 合集封面 · app.js
 * =========================================================================
 * v2 变更：
 *  1. 【致命修复】状态类名 .show → .is-visible
 *     —— overlays.css 用的是 .is-visible，原来 toast / 确认弹窗全部不可见，
 *        「清空」按钮点了完全没有反应（Promise 永远不 resolve）
 *  2. 字体选择由「底部抽屉 tab-sheet」改为「标准 .dropdown」
 *     —— 删除 fontSheet / fontSheetBackdrop / fontSheetList 三个引用，
 *        新增 renderFontDropdown()，开关交给 dropdown.js
 *  3. 【性能】背景模糊结果做缓存
 *     —— 原来每敲一个字都重算 2560×1440 的三层 canvas + 高斯模糊，
 *        手机上打字直接卡死；现在只在背景图变化时算一次
 *  4. init() 补齐错误兜底，injectIcons() 加空值保护
 *  5. selectFont() 补 res.ok / content-type 校验，失败有提示
 *  6. syncInputsFromState() 补「无背景图时清空缩略图」
 *  7. exportCollection() 加防连点 + 补失败提示
 *  8. 字体回退修正：未选字体时不再拼出 '"system-ui"' 这种无效字体名
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

const MIME_MAP = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2'
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
  fontDropdownPanel: document.getElementById('fontDropdownPanel')
};

/* =========================================================================
 * 【模块 2】UI 交互封装（Toast / Confirm）
 *    注意：类名必须是 .is-visible —— 这是 overlays.css 约定的状态类
 * ========================================================================= */
function showToast(message, type = 'info') {
  if (!DOM.toastContainer) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  el.textContent = message;
  DOM.toastContainer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

function showConfirm(title, message) {
  return new Promise(resolve => {
    const backdrop = DOM.modalBackdrop;
    const cancelBtn = DOM.modalCancel;
    const confirmBtn = DOM.modalConfirm;
    if (!backdrop || !cancelBtn || !confirmBtn) { resolve(false); return; }

    if (DOM.modalTitle) DOM.modalTitle.textContent = title;
    if (DOM.modalMessage) DOM.modalMessage.textContent = message;

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

/* =========================================================================
 * 【模块 3】工具函数
 * ========================================================================= */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getFormattedDateStr() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function injectIcons() {
  const ui = window.ICONS?.ui ?? {};
  const iconMap = {
    trash: ui.trash ?? '',
    font: ui.textFont ?? '',
    chevronDown: ui.chevronDown ?? '',
    chevronUp: ui.chevronUp ?? ''
  };
  document.querySelectorAll('[data-icon]').forEach(el => {
    const icon = iconMap[el.dataset.icon];
    if (icon) el.innerHTML = icon;
  });
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* =========================================================================
 * 【模块 4】背景图与缓存
 * ========================================================================= */
let bgCacheCanvas = null;   /* 已模糊好的背景，只在背景图变化时重算 */
let bgCacheKey = '';

async function ensureBgImage() {
  if (!collectionState.bg) {
    collectionState.bgLoadedImg = null;
    return null;
  }
  const cur = collectionState.bgLoadedImg;
  if (cur && cur.src === collectionState.bg) return cur;

  const loaded = await new Promise(resolve => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = collectionState.bg;
  });
  collectionState.bgLoadedImg = loaded;
  return loaded;
}

function getBackgroundCanvas() {
  const img = collectionState.bgLoadedImg;
  if (!img) return null;

  const key = collectionState.bg;
  if (bgCacheKey === key && bgCacheCanvas) return bgCacheCanvas;

  const c = document.createElement('canvas');
  c.width = collectionState.W;
  c.height = collectionState.H;
  drawBlurredBackground(c.getContext('2d'), img, collectionState.W, collectionState.H);

  bgCacheCanvas = c;
  bgCacheKey = key;
  return c;
}

function resetBgCache() {
  bgCacheCanvas = null;
  bgCacheKey = '';
}

/* 生成「填充 + 边缘拉伸 + 高斯模糊」的背景（只在背景图变化时调用） */
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

  /* 用循环代替手写 8 次 drawImage，处理模糊后的边缘拉伸 */
  const edges = [
    [0, 0, W, 1, pad, 0, W, pad],                        // 上
    [0, H - 1, W, 1, pad, pad + H, W, pad],              // 下
    [0, 0, 1, H, 0, pad, pad, H],                        // 左
    [W - 1, 0, 1, H, pad + W, pad, pad, H],              // 右
    [0, 0, 1, 1, 0, 0, pad, pad],                        // 左上
    [W - 1, 0, 1, 1, pad + W, 0, pad, pad],              // 右上
    [0, H - 1, 1, 1, 0, pad + H, pad, pad],              // 左下
    [W - 1, H - 1, 1, 1, pad + W, pad + H, pad, pad]     // 右下
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

/* =========================================================================
 * 【模块 5】画布绘制
 * ========================================================================= */
function getFontFamily() {
  return collectionState.fontName
    ? `"${collectionState.fontName}", system-ui, sans-serif`
    : 'system-ui, sans-serif';
}

async function drawCollectionCanvas(canvas) {
  const W = collectionState.W, H = collectionState.H;

  /* 只在尺寸变化时重置，避免每次都清空重开上下文 */
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  await ensureBgImage();

  const bgCanvas = getBackgroundCanvas();
  if (bgCanvas) {
    ctx.drawImage(bgCanvas, 0, 0);
  } else {
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(0, 0, W, H);
  }

  drawCollectionText(ctx);
}

function drawCollectionText(ctx) {
  const W = collectionState.W, H = collectionState.H;
  const baseSize = W * 0.10;
  const maxWidth = W * 0.85;
  const font = getFontFamily();

  const titleLines = String(collectionState.title || '').split(/\r?\n/);
  const subtitleLines = String(collectionState.subtitle || '').split(/\r?\n/);
  const title = titleLines.filter(t => t !== '').map(text => ({ text, color: '#ffffff', group: 'title' }));
  const subtitle = subtitleLines.filter(t => t !== '').map(text => ({ text, color: '#ffe898', group: 'subtitle' }));
  const lines = title.concat(subtitle);
  if (!lines.length) return;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const normalGap = baseSize * 0.12;
  const groupGap = baseSize;

  const measured = lines.map(item => {
    let fs = baseSize;
    ctx.font = `${fs}px ${font}`;
    while (ctx.measureText(item.text).width > maxWidth && fs > 12) {
      fs -= 1;
      ctx.font = `${fs}px ${font}`;
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
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 50;
    ctx.strokeText(line.text, W / 2, y);
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, W / 2, y);
    y += line.fs / 2;
    if (i < measured.length - 1) {
      y += measured[i + 1].group !== line.group ? groupGap : normalGap;
    }
  }
}

/* 渲染序号：快速输入时丢弃过期的那次渲染 */
let renderSeq = 0;

async function renderCollection() {
  if (!DOM.previewHost) return;
  const my = ++renderSeq;

  let canvas = DOM.previewHost.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    DOM.previewHost.appendChild(canvas);
  }

  if (document.fonts) { try { await document.fonts.ready; } catch (e) {} }
  if (my !== renderSeq) return;

  await drawCollectionCanvas(canvas);
}

/* =========================================================================
 * 【模块 6】字体
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
    if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch (e) {} loadedFontFace = null; }
    const ff = new FontFace(collectionState.fontName, `url("${collectionState.fontData}")`);
    const loaded = await ff.load();
    document.fonts.add(loaded);
    loadedFontFace = loaded;
  } catch (e) {
    console.warn('字体加载失败：', e.message);
  }
}

function renderFontDropdown() {
  const panel = DOM.fontDropdownPanel;
  if (!panel) return;
  const curFile = collectionState.fontFileName;
  let html = `<button type="button" class="dropdown-item${curFile === '' ? ' is-active' : ''}" data-font-index="-1">默认系统字体</button>`;
  FONT_LIST.forEach((f, i) => {
    const isAct = curFile === f.file;
    html += `<button type="button" class="dropdown-item${isAct ? ' is-active' : ''}" data-font-index="${i}">${esc(f.name)}</button>`;
  });
  panel.innerHTML = html;
}

function updateFontDropdownActive(index) {
  const panel = DOM.fontDropdownPanel;
  if (!panel) return;
  panel.querySelectorAll('.dropdown-item').forEach(el => {
    el.classList.toggle('is-active', Number(el.dataset.fontIndex) === index);
  });
}

async function selectFont(index) {
  const labelEl = document.getElementById('labelCollectionFont');

  if (index === -1) {
    collectionState.fontData = '';
    collectionState.fontFileName = '';
    collectionState.fontName = '';
    if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch (e) {} loadedFontFace = null; }
    if (labelEl) labelEl.textContent = '默认系统字体';
    updateFontDropdownActive(-1);
    renderCollection();
    persist();
    return;
  }

  const f = FONT_LIST[index];
  if (!f) return;

  /* 已经是这个字体 → 只更新 UI，不重复下载 */
  if (collectionState.fontFileName === f.file && collectionState.fontData) {
    if (labelEl) labelEl.textContent = '当前：' + f.name;
    updateFontDropdownActive(index);
    return;
  }

  if (labelEl) labelEl.textContent = '正在加载…';

  try {
    const res = await fetch(`../../../shared/fonts/${encodeURIComponent(f.file)}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} 文件未找到`);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) throw new Error('服务器返回网页而非字体(可能是404)');

    const buf = await res.arrayBuffer();
    const mime = MIME_MAP[f.file.split('.').pop().toLowerCase()] ?? 'font/ttf';
    const blob = new Blob([buf], { type: mime });

    const dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('数据序列化失败'));
      reader.readAsDataURL(blob);
    });

    collectionState.fontData = dataURL;
    collectionState.fontFileName = f.file;
    collectionState.fontName = f.name;

    await installFont();

    if (labelEl) labelEl.textContent = '当前：' + f.name;
    updateFontDropdownActive(index);
    renderCollection();
    persist();
  } catch (e) {
    console.error('[字体加载失败]', f.name, e);
    if (labelEl) labelEl.textContent = '字体加载失败，点击重试';
    showToast(`字体 [${f.name}] 加载失败：${e.message || e}`, 'error');

    collectionState.fontData = '';
    collectionState.fontFileName = '';
    collectionState.fontName = '';
    updateFontDropdownActive(-1);
    persist();
  }
}

/* =========================================================================
 * 【模块 7】持久化
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
      const save = { ...collectionState };
      delete save.bgLoadedImg;          /* Image 对象无法结构化克隆 */
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
      req.onsuccess = () => {
        if (req.result) Object.assign(collectionState, req.result, { bgLoadedImg: null });
        resolve();
      };
      req.onerror = () => resolve();
    });
  } catch (e) {}
}

/* =========================================================================
 * 【模块 8】导出 / 清空
 * ========================================================================= */
let exporting = false;

async function exportCollection() {
  if (exporting) return;              /* 防连点 */
  exporting = true;

  try {
    const canvas = DOM.previewHost?.querySelector('canvas');
    if (!canvas) return;

    if (document.fonts) { try { await document.fonts.ready; } catch (e) {} }
    await drawCollectionCanvas(canvas);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) { showToast('导出失败', 'error'); return; }
    if (blob.size > 5 * 1024 * 1024) { showToast('图片超过 5MB，请降低分辨率', 'error'); return; }

    const firstLine = (collectionState.title || '').split(/\r?\n/).find(l => l.trim()) || '合集封面';
    downloadBlob(blob, firstLine.trim().replace(/[\\/:*?"<>|]/g, '_') + '_' + getFormattedDateStr() + '.png');
    showToast('导出成功', 'success');
  } catch (e) {
    showToast('导出失败：' + (e.message || e), 'error');
  } finally {
    exporting = false;
  }
}

async function clearCollection() {
  const ok = await showConfirm('清空配置', '确定清空合集封面吗？');
  if (!ok) return;

  collectionState.bg = '';
  collectionState.bgLoadedImg = null;
  collectionState.fontData = '';
  collectionState.fontName = '';
  collectionState.fontFileName = '';
  collectionState.title = '';
  collectionState.subtitle = '';

  resetBgCache();

  setValue('collectionTitle', '');
  setValue('collectionSubtitle', '');

  setText('collectionBgName', '点击上传背景图');
  const thumb = document.getElementById('collectionBgThumb');
  if (thumb) thumb.removeAttribute('src');

  setText('labelCollectionFont', '默认系统字体');
  updateFontDropdownActive(-1);

  renderCollection();
  persist();
}

/* =========================================================================
 * 【模块 9】UI 同步与事件
 * ========================================================================= */
function syncInputsFromState() {
  setValue('collectionTitle', collectionState.title);
  setValue('collectionSubtitle', collectionState.subtitle);

  setText('labelCollectionFont', collectionState.fontName ? '当前：' + collectionState.fontName : '默认系统字体');

  const thumb = document.getElementById('collectionBgThumb');
  const nameEl = document.getElementById('collectionBgName');
  if (collectionState.bg) {
    if (thumb) thumb.src = collectionState.bg;
    if (nameEl) nameEl.textContent = '已载入背景图（点击更换）';
  } else {
    if (thumb) thumb.removeAttribute('src');
    if (nameEl) nameEl.textContent = '点击上传背景图';
  }
}

function bindEvents() {
  document.getElementById('collectionBgFile')?.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onload = () => {
      collectionState.bg = reader.result;
      collectionState.bgLoadedImg = null;
      resetBgCache();

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

  document.getElementById('btnClearCollection')?.addEventListener('click', e => {
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

  /* 字体下拉的选项点击（面板开关由 dropdown.js 负责） */
  document.addEventListener('click', e => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const item = target.closest('#fontDropdownPanel .dropdown-item');
    if (!item || item.dataset.fontIndex === undefined) return;
    selectFont(Number(item.dataset.fontIndex));
  });
}

/* =========================================================================
 * 【模块 10】对外接口与初始化
 * ========================================================================= */
const App = {
  setCollection(key, value) {
    if (collectionState[key] === value) return;
    collectionState[key] = value;
    renderCollection();
    persist();
  },
  exportCollection,
  clearCollection,
  selectFont,
  renderFontDropdown
};
window.App = App;

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

    try { await loadFontList(); } catch (e) {}
    try { await loadPersist(); } catch (e) {}

    collectionState.W = 2560;
    collectionState.H = 1440;

    if (collectionState.fontData) {
      try { await installFont(); } catch (e) {}
    }

    syncInputsFromState();
    renderFontDropdown();
    bindEvents();
    await renderCollection();

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

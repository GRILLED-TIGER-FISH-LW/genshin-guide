/* =========================================================================
 * 合集封面 · app.js
 * =========================================================================
 * 模块导航（搜索 "【JS 模块 N】" 快速跳转）：
 *   【JS 模块 1】 状态
 *   【JS 模块 2】 工具函数
 *   【JS 模块 3】 图标注入
 *   【JS 模块 4】 合集画布绘制
 *   【JS 模块 5】 字体
 *   【JS 模块 6】 IndexedDB 持久化
 *   【JS 模块 7】 导出 / 清空
 *   【JS 模块 8】 UI 同步
 *   【JS 模块 9】 事件绑定
 *   【JS 模块 10】App 接口
 *   【JS 模块 11】初始化
 * ========================================================================= */
'use strict';

/* =========================================================================
 * 【JS 模块 1】状态
 * ========================================================================= */
const collectionState = {
  W: 2560, H: 1440,
  bg: '', bgLoadedImg: null,
  fontData: '', fontName: '', fontFileName: '',
  title: '', subtitle: ''
};

let FONT_LIST = [];
let loadedFontFace = null;

/* =========================================================================
 * 【JS 模块 2】工具函数
 * ========================================================================= */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
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

/* =========================================================================
 * 【JS 模块 3】图标注入
 * ========================================================================= */
function injectIcons() {
  const iconMap = {
    trash: ICONS.ui.trash || ''
  };
  document.querySelectorAll('[data-icon]').forEach(el => {
    const key = el.dataset.icon;
    if (iconMap[key]) el.innerHTML = iconMap[key];
  });
}

/* =========================================================================
 * 【JS 模块 4】合集画布绘制
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
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
    }
  } else {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
  }

  drawCollectionText(ctx);
}

/**
 * 画模糊背景。
 * 核心：显示区域尺寸、裁切范围跟"不模糊"时**完全一致**，只糊不放大。
 *
 * 思路：
 *   1. 把原图按 Math.max(W/img.w, H/img.h) 铺满 W×H 画布 → 得到"基准图 A"
 *   2. 建一个外扩 pad 的画布 B，把 A 放中间
 *   3. B 的 pad 区域用 A 的边缘像素拉伸填充（不是缩放原图）→ 模糊后边缘不透明
 *   4. 对 B 应用高斯模糊
 *   5. 从 B 的中心裁 W×H 贴到主画布
 */
function drawBlurredBackground(ctx, img, W, H) {
  const blurPx = Math.max(12, Math.round(W * 0.015));
  const pad = Math.ceil(blurPx * 3) + 20;

  /* 步骤 1：按"覆盖 W×H"的尺度铺满到基准画布 A */
  const fillScale = Math.max(W / img.width, H / img.height);
  const fillW = img.width * fillScale;
  const fillH = img.height * fillScale;
  const fillX = (W - fillW) / 2;
  const fillY = (H - fillH) / 2;

  const a = document.createElement('canvas');
  a.width = W; a.height = H;
  const actx = a.getContext('2d');
  actx.drawImage(img, fillX, fillY, fillW, fillH);

  /* 步骤 2：建外扩画布 B，中心放 A */
  const BW = W + pad * 2, BH = H + pad * 2;
  const b = document.createElement('canvas');
  b.width = BW; b.height = BH;
  const bctx = b.getContext('2d');
  bctx.drawImage(a, pad, pad);

  /* 步骤 3：pad 区域用 A 的**边缘像素**拉伸填充（不是缩放 A） */
  /* 四条边：从 A 取 1 像素宽的条，拉伸到 pad 尺寸 */
  bctx.drawImage(a, 0,     0,     W, 1,  pad,     0,     W, pad);       // 上边
  bctx.drawImage(a, 0,     H - 1, W, 1,  pad,     pad + H, W, pad);     // 下边
  bctx.drawImage(a, 0,     0,     1, H,  0,       pad,   pad, H);       // 左边
  bctx.drawImage(a, W - 1, 0,     1, H,  pad + W, pad,   pad, H);       // 右边
  /* 四个角：从 A 取 1 像素的点，拉伸到 pad×pad */
  bctx.drawImage(a, 0,     0,     1, 1,  0,      0,     pad, pad);     // 左上
  bctx.drawImage(a, W - 1, 0,     1, 1,  pad + W, 0,     pad, pad);     // 右上
  bctx.drawImage(a, 0,     H - 1, 1, 1,  0,      pad+H, pad, pad);     // 左下
  bctx.drawImage(a, W - 1, H - 1, 1, 1,  pad + W, pad+H, pad, pad);     // 右下

  /* 步骤 4：对 B 应用高斯模糊 */
  const c = document.createElement('canvas');
  c.width = BW; c.height = BH;
  const cctx = c.getContext('2d');
  cctx.filter = `blur(${blurPx}px)`;
  cctx.drawImage(b, 0, 0);
  cctx.filter = 'none';

  /* 步骤 5：从 B 的中心裁 W×H 贴到主画布 */
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
  const box = document.getElementById('collectionPreview');
  if (!box) return;
  let canvas = box.querySelector('canvas');
  if (!canvas) { canvas = document.createElement('canvas'); box.appendChild(canvas); }
  /* 等字体加载完再画，避免预览用 fallback 字体 */
  if (document.fonts) { try { await document.fonts.ready; } catch (e) {} }
  await drawCollectionCanvas(canvas);
}

/* =========================================================================
 * 【JS 模块 5】字体
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
  const listEl = document.getElementById('fontSheetList');
  if (!listEl) return;
  const curFile = collectionState.fontFileName;
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
 * 【JS 模块 6】IndexedDB 持久化
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
 * 【JS 模块 7】导出 / 清空
 * ========================================================================= */
async function exportCollection() {
  const canvas = document.querySelector('#collectionPreview canvas');
  if (!canvas) return;
  if (document.fonts) await document.fonts.ready;
  await drawCollectionCanvas(canvas);
  canvas.toBlob(blob => {
    if (!blob) return alert('导出失败');
    if (blob.size > 5 * 1024 * 1024) { alert('超过 5MB'); return; }
    const firstLine = (collectionState.title || '').split(/\r?\n/).find(l => l.trim()) || '合集封面';
    downloadBlob(blob, firstLine.trim() + '_' + getFormattedDateStr() + '.png');
  }, 'image/png');
}

function clearCollection() {
  if (!confirm('确定清空合集封面吗？')) return;
  collectionState.bg = ''; collectionState.bgLoadedImg = null;
  collectionState.fontData = ''; collectionState.fontName = ''; collectionState.fontFileName = '';
  collectionState.title = ''; collectionState.subtitle = '';
  document.getElementById('collectionTitle').value = '';
  document.getElementById('collectionSubtitle').value = '';
  document.getElementById('collectionBgName').textContent = '未选择文件';
  const l = document.getElementById('labelCollectionFont');
  if (l) l.textContent = '默认系统字体';
  renderCollection();
  persist();
}

/* =========================================================================
 * 【JS 模块 8】UI 同步
 * ========================================================================= */
function syncInputsFromState() {
  const map = {
    collectionTitle: collectionState.title,
    collectionSubtitle: collectionState.subtitle
  };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = map[id] ?? '';
  });
  const lc = document.getElementById('labelCollectionFont');
  if (lc) lc.textContent = collectionState.fontName ? '当前：' + collectionState.fontName : '默认系统字体';
}

/* =========================================================================
 * 【JS 模块 9】事件绑定
 * ========================================================================= */
function bindEvents() {
  document.getElementById('collectionBgFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const picker = e.target.closest('.file-picker');
    const nameEl = picker && picker.querySelector('.file-picker-name');
    if (nameEl) nameEl.textContent = f.name;
    const reader = new FileReader();
    reader.onload = () => {
      collectionState.bg = reader.result;
      collectionState.bgLoadedImg = null;
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
 * 【JS 模块 10】App 接口
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

/* =========================================================================
 * 【JS 模块 11】初始化
 * ========================================================================= */
(async function init() {
  /* 等资源加载器完成 */
  try { await window.__bootPromise; } catch (e) { console.warn(e); }

  injectIcons();
  await loadFontList();
  await loadPersist();

  /* 强制 W/H = 2K */
  collectionState.W = 2560;
  collectionState.H = 1440;

  if (collectionState.fontData) await installFont();

  syncInputsFromState();
  bindEvents();
  renderCollection();
  injectIcons();

  /* 一切就绪，揭开启动遮罩 */
  document.body.classList.add('ready');
})();

/* =========================================================================
 * 主题同步
 * ========================================================================= */
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'theme') {
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

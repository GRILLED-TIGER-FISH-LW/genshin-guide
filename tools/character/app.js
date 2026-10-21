/* =========================================================================
 * 原神一图流生成器 · app.js
 * ========================================================================= */

'use strict';

/* =========================================================================
 * 【模块 1】DOM 引用集中管理
 * ========================================================================= */
const DOM = {
  svgPreviewHost: document.getElementById('svgPreviewHost'),
  tabBar: document.getElementById('tabBar'),
  toastContainer: document.getElementById('toastContainer'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  modalCancel: document.getElementById('modalCancel'),
  modalConfirm: document.getElementById('modalConfirm'),
  fontSheetList: document.getElementById('fontSheetList')
};

/* =========================================================================
 * 【模块 2】UI 交互封装
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
    DOM.modalTitle.textContent = title;
    DOM.modalMessage.textContent = message;
    const cleanup = (result) => {
      DOM.modalBackdrop.classList.remove('is-visible');
      DOM.modalCancel.onclick = null;
      DOM.modalConfirm.onclick = null;
      DOM.modalBackdrop.onclick = null;
      resolve(result);
    };
    DOM.modalCancel.onclick = () => cleanup(false);
    DOM.modalConfirm.onclick = () => cleanup(true);
    DOM.modalBackdrop.onclick = (e) => { if (e.target === DOM.modalBackdrop) cleanup(false); };
    DOM.modalBackdrop.classList.add('is-visible');
  });
}

/* =========================================================================
 * 【模块 3】基础数据加载
 * ========================================================================= */
let FONT_LIST = [];
let loadedFontFace = null;
const FONT_CACHE_PREFIX = 'font_cache::';

async function loadCharOrderTxt() {
  try {
    const res = await fetch('../../shared/data/characters.txt?t=' + Date.now());
    if (!res.ok) return;
    const text = await res.text();
    CHAR_NAME_TO_ORDER = {};
    text.split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const parts = line.split(/[\s,，\t]+/);
      if (parts.length < 2) return;
      const order = parseInt(parts[0], 10);
      const name = parts.slice(1).join(' ').trim();
      if (order && name) CHAR_NAME_TO_ORDER[name] = order;
    });
  } catch (e) { console.warn('characters.txt 加载失败', e); }
}

async function loadNamecards() {
  try {
    const res = await fetch('../../shared/data/namecards.txt?t=' + Date.now());
    if (!res.ok) return;
    const text = await res.text();
    NAMECARD_DICT = {};
    text.split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const m = line.match(/^(\d+)\s+(\S+)\s+(https?:\/\/\S+)$/);
      if (m) NAMECARD_DICT[m[2]] = m[3];
    });
  } catch (e) { console.warn('namecards.txt 加载失败', e); }
}

async function loadArtDict() {
  try {
    const res = await fetch('../../shared/data/character-art.txt?t=' + Date.now());
    if (!res.ok) return;
    const text = await res.text();
    ART_DICT = {};
    text.split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const m = line.match(/^(\d+)\s+(\S+)\s*(.*)$/);
      if (!m) return;
      ART_DICT[m[2]] = (m[3] || '').trim();
    });
  } catch (e) { console.warn('character-art.txt 加载失败', e); }
}

async function loadFontList() {
  try {
    const res = await fetch('../../shared/fonts/fonts.json?t=' + Date.now());
    if (!res.ok) return;
    const json = await res.json();
    FONT_LIST = Array.isArray(json.fonts) ? json.fonts : [];
  } catch (e) { console.warn('字体清单加载失败', e); }
}

function isValidCharName(name) {
  const t = String(name || '').trim();
  return t ? !!CHAR_NAME_TO_ORDER[t] : false;
}
function stripElementSuffix(name) {
  return String(name || '').split('·')[0].trim();
}
function resolveCharName(input) {
  const t = String(input || '').trim();
  if (!t) return '';
  if (isValidCharName(t)) return t;
  const stripped = stripElementSuffix(t);
  if (stripped && isValidCharName(stripped)) return stripped;
  return '';
}
function themeToElementName() {
  const t = (State.data.theme || '').toLowerCase();
  for (let i = 0; i < elementColors.length; i++) {
    if (elementColors[i][1].toLowerCase() === t) return elementColors[i][0];
  }
  return '';
}
async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return true;
    if (res.status === 405) {
      const res2 = await fetch(url);
      return res2.ok;
    }
    return false;
  } catch (e) {
    try { const res3 = await fetch(url); return res3.ok; } catch (e2) { return false; }
  }
}

/* =========================================================================
 * 【模块 4】字体核心逻辑
 * ========================================================================= */
async function getFontFromCache(fileName) {
  if (!fileName) return '';
  try {
    const db = await openDatabase();
    return await new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(FONT_CACHE_PREFIX + fileName);
      req.onsuccess = () => resolve(req.result || '');
      req.onerror = () => resolve('');
    });
  } catch (e) { return ''; }
}

async function putFontToCache(fileName, dataURL) {
  if (!fileName || !dataURL) return;
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataURL, FONT_CACHE_PREFIX + fileName);
  } catch (e) {}
}

async function clearFontCache() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (String(cursor.key).indexOf(FONT_CACHE_PREFIX) === 0) cursor.delete();
        cursor.continue();
      }
    };
  } catch (e) {}
}

async function installPreviewFont() {
  if (!State.data.fontData || !window.FontFace) return false;
  try {
    if (loadedFontFace) {
      try { document.fonts.delete(loadedFontFace); } catch (e) {}
      loadedFontFace = null;
    }
    let buffer;
    try {
      const res = await fetch(State.data.fontData);
      buffer = await res.arrayBuffer();
    } catch (e) {
      const arr = State.data.fontData.split(',');
      const raw = atob(arr[1]);
      buffer = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);
    }
    const ff = new FontFace('CardCustomFont', buffer);
    loadedFontFace = await ff.load();
    document.fonts.add(loadedFontFace);
    return true;
  } catch (e) {
    console.error('字体解析异常：', e);
    return false;
  }
}

function renderFontDropdown() {
  if (!DOM.fontSheetList) return;
  const curFile = State.data.fontFileName;
  let html = `<button type="button" class="dropdown-item${curFile === '' ? ' is-active' : ''}" data-font-index="-1">默认系统字体</button>`;
  FONT_LIST.forEach((f, i) => {
    const isAct = curFile === f.file;
    html += `<button type="button" class="dropdown-item${isAct ? ' is-active' : ''}" data-font-index="${i}">${esc(f.name)}</button>`;
  });
  DOM.fontSheetList.innerHTML = html;
}

function updateFontDropdownActive(index) {
  if (!DOM.fontSheetList) return;
  DOM.fontSheetList.querySelectorAll('.dropdown-item').forEach(el => {
    el.classList.toggle('is-active', Number(el.dataset.fontIndex) === index);
  });
}

async function selectFont(index) {
  const labelEl = document.getElementById('labelCustomFont');

  if (index === -1) {
    State.data.fontData = ''; State.data.fontFileName = ''; State.data.fontName = '';
    if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch (e) {} loadedFontFace = null; }
    if (labelEl) labelEl.textContent = '默认标准字体';
    updateFontDropdownActive(-1);
    mountPreview(); debouncedSave();
    return;
  }

  const f = FONT_LIST[index];
  if (!f) return;
  if (State.data.fontFileName === f.file && State.data.fontData) {
    if (labelEl) labelEl.textContent = '当前：' + f.name;
    updateFontDropdownActive(index);
    return;
  }

  if (labelEl) labelEl.textContent = `[1/3] 正在检查本地缓存...`;
  const cached = await getFontFromCache(f.file);
  if (cached) {
    if (labelEl) labelEl.textContent = `[2/3] 命中缓存，正在注入...`;
    State.data.fontData = cached;
    State.data.fontFileName = f.file;
    State.data.fontName = f.name;
    await installPreviewFont();
    if (labelEl) labelEl.textContent = '当前：' + f.name;
    updateFontDropdownActive(index);
    mountPreview(); debouncedSave();
    return;
  }

  try {
    if (labelEl) labelEl.textContent = `[1/3] 正在下载二进制流...`;
    let res;
    try {
      res = await fetch('../../shared/fonts/' + encodeURIComponent(f.file) + '?t=' + Date.now());
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

    State.data.fontData = dataURL;
    State.data.fontFileName = f.file;
    State.data.fontName = f.name;

    await putFontToCache(f.file, dataURL);

    if (labelEl) labelEl.textContent = '当前：' + f.name;
    updateFontDropdownActive(index);
    mountPreview(); debouncedSave();

  } catch (err) {
    console.error(`[字体加载失败] ${f.name}:`, err);
    if (labelEl) labelEl.textContent = `异常卡住: ${err.message}`;
    showToast(`字体 [${f.name}] 加载失败: ${err.message}`, 'error');

    State.data.fontData = '';
    State.data.fontFileName = '';
    State.data.fontName = '';
    updateFontDropdownActive(-1);
    debouncedSave();
  }
}

/* =========================================================================
 * 【模块 5】预览挂载与增量更新
 * ========================================================================= */
let previewSvgEl = null;
const previewIndex = new Map();
let renderTimer = null;

function mountPreview() {
  if (!DOM.svgPreviewHost) return;
  DOM.svgPreviewHost.innerHTML = buildSVG(1);
  previewSvgEl = DOM.svgPreviewHost.querySelector('svg');
  previewIndex.clear();
  if (previewSvgEl) {
    previewSvgEl.querySelectorAll('[data-field]').forEach(el => {
      const f = el.dataset.field;
      if (!previewIndex.has(f)) previewIndex.set(f, []);
      previewIndex.get(f).push(el);
    });
  }
}

function updateCharImgX() {
  if (!previewSvgEl) return;
  const el = previewSvgEl.querySelector('#charImgEl');
  if (!el) return;
  const d = State.data;
  const imgX = Number(d.imgX) || 0;
  const leftX = LAYOUT.left.x, leftW = LAYOUT.left.w, leftH = LAYOUT.left.h;
  const imgMeta = d.charImgMeta || {};
  const imgIW = Number(imgMeta.w) || 0;
  const imgIH = Number(imgMeta.h) || 0;
  const charDrawW = (imgIW > 0 && imgIH > 0) ? Math.round(leftH * imgIW / imgIH) : leftW;
  el.setAttribute('x', leftX + (leftW - charDrawW) / 2 + imgX);
}

function applyTextFieldUpdate(el, textValue, fill) {
  el.textContent = textValue == null ? '' : String(textValue);
  if (fill) el.setAttribute('fill', fill);
  const maxW = el.dataset.fitMaxW;
  if (maxW) {
    const base = +el.dataset.fitBase || 12;
    const min = +el.dataset.fitMin || 8;
    el.setAttribute('font-size', fitSize(String(textValue || ''), +maxW, base, min));
  }
}

function getFieldDisplayValue(field) {
  const d = State.data;
  if (field === 'charName') return { text: d.charName || '' };
  if (field === 'version') return { text: d.version ? `当前版本: ${d.version}` : '' };
  if (field === 'date') return { text: d.date ? `制作日期: ${d.date}` : '' };
  if (field === 'author') return { text: d.author ? `作者: ${d.author}` : '' };
  if (field === 'talent.A') return { text: d.talentA || '—' };
  if (field === 'talent.E') return { text: d.talentE || '—' };
  if (field === 'talent.Q') return { text: d.talentQ || '—' };
  if (field === 'stat.sandMain') return { text: d.sandMain || '' };
  if (field === 'stat.gobMain') return { text: d.gobMain || '' };
  if (field === 'stat.cirMain') return { text: d.cirMain || '' };
  if (field.startsWith('panel.')) {
    const key = field.slice(6);
    const v = (d.panel && d.panel[key]) || '';
    return { text: v || PANEL_EMPTY_TEXT, fill: v ? '#fff' : EMPTY_FILL };
  }
  let m = /^weapon\.(\w+)\.(\d+)\.name$/.exec(field);
  if (m) { const arr = d.weaponData?.[m[1]]; return { text: (arr && arr[+m[2]] && arr[+m[2]].name) || '' }; }
  m = /^artifact\.(\d+)\.name$/.exec(field);
  if (m) { const a = d.artifactData?.[+m[1]]; return { text: (a && a.name) || '' }; }
  m = /^team\.(\d+)\.name$/.exec(field);
  if (m) { const t = d.teamData?.[+m[1]]; return { text: (t && t.name) || '' }; }
  m = /^team\.(\d+)\.char\.(\d+)\.name$/.exec(field);
  if (m) {
    const ci = +m[2];
    if (ci === 0) return { text: d.charName || '' };
    const c = d.teamData?.[+m[1]]?.chars?.[ci];
    return { text: (c && c.name) || '' };
  }
  m = /^team\.(\d+)\.char\.(\d+)\.alt\.(\d+)\.name$/.exec(field);
  if (m) {
    const a = d.teamData?.[+m[1]]?.chars?.[+m[2]]?.alts?.[+m[3]];
    return { text: (a && a.name) || '' };
  }
  return null;
}

function updatePreviewField(field) {
  if (!previewSvgEl || !previewIndex.size) { mountPreview(); return; }
  const els = previewIndex.get(field);
  if (!els || !els.length) { mountPreview(); return; }
  const info = getFieldDisplayValue(field);
  if (!info) { mountPreview(); return; }
  els.forEach(el => applyTextFieldUpdate(el, info.text, info.fill));
}

function syncInputs() {
  const map = ['charName','version','date','author','sandMain','gobMain','cirMain','subStats','talentA','talentE','talentQ'];
  map.forEach(id => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = State.data[id] ?? '';
  });
  const elImgX = document.getElementById('imgX');
  const sImgX = document.getElementById('imgXSlider');
  if (elImgX && document.activeElement !== elImgX) elImgX.value = State.data.imgX ?? 0;
  if (sImgX && document.activeElement !== sImgX) sImgX.value = State.data.imgX ?? 0;
  const p = State.data.panel || {};
  const textMap = {
    panelPrimaryValue: p.primaryValue || '',
    panelCr: p.cr || '', panelCd: p.cd || '', panelEm: p.em || '', panelEr: p.er || ''
  };
  Object.keys(textMap).forEach(id => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = textMap[id];
  });
  renderPanelPrimaryDropdown();
}

/* =========================================================================
 * 【模块 6】Tab 栏与编辑器渲染
 * ========================================================================= */
function renderTabBar() {
  if (!DOM.tabBar) return;
  DOM.tabBar.innerHTML = TAB_DEFS.map(t =>
    `<button type="button" class="tab-btn ${t.key === currentTab ? 'is-active' : ''}" data-tab="${t.key}" onclick="App.selectTab('${t.key}')">${t.label}</button>`
  ).join('');
}

function selectTab(tabId) {
  if (!TAB_DEFS.find(t => t.key === tabId)) return;
  currentTab = tabId;
  document.querySelectorAll('.tabs-content .tab-panel').forEach(p => p.classList.remove('is-active'));
  const panel = document.getElementById(`tab-${tabId}`);
  if (panel) panel.classList.add('is-active');
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.tab === tabId);
  });
  const tc = document.querySelector('.tabs-content');
  if (tc) tc.scrollTop = 0;
}

const collapseState = {};

function collapseIconOf(collapsed) {
  return collapsed ? ICONS.chevron : (ICONS.chevronUp || ICONS.chevron);
}

function toggleCollapse(key) {
  collapseState[key] = !collapseState[key];
  const collapsed = collapseState[key];
  document.querySelectorAll('.collapse-toggle[data-collapse-key="' + key + '"]').forEach(btn => {
    btn.classList.toggle('collapsed', collapsed);
    const txt = btn.querySelector('.collapse-text');
    if (txt) txt.textContent = collapsed ? '展开' : '收起';
    const icon = btn.querySelector('.collapse-icon');
    if (icon) icon.innerHTML = collapseIconOf(collapsed);
  });
  document.querySelectorAll('[data-collapse-content="' + key + '"]').forEach(el => {
    el.classList.toggle('hidden', collapsed);
  });
}
function isCollapsed(key) { return !!collapseState[key]; }

function renderColorPicker() {
  const el = document.getElementById('colorPicker');
  if (!el) return;
  el.innerHTML = elementColors.map(([name, color, iconKey]) => {
    const isMatch = (State.data.theme || '').toLowerCase() === color.toLowerCase();
    const icon = ELEMENT_ICONS[iconKey] || '';
    return `<div class="swatch-btn ${isMatch ? 'active' : ''}" data-color="${color}" onclick="App.setTheme('${color}')">
      <span class="swatch-icon-wrap">${icon}</span>
      <span class="swatch-name">${name}</span>
    </div>`;
  }).join('');
  el.querySelectorAll('.swatch-btn').forEach(btn => {
    btn.style.setProperty('--swatch-color', btn.dataset.color);
  });
}

function renderConstellationEditor() {
  const el = document.getElementById('constellationEditor');
  if (!el) return;
  el.innerHTML = State.data.constellationData.map((c, i) => `
    <div class="cons-item ${c.active ? 'active' : ''}">
      <div class="cons-badge" onclick="App.toggleConstellation(${i})">${i + 1}</div>
      <input type="text" value="${esc(c.desc)}" placeholder="${i + 1}命核心效果描述" oninput="App.setConstellationDesc(${i}, this.value)" />
    </div>`).join('');
}

function renderWeaponEditor() {
  const el = document.getElementById('weaponEditor');
  if (!el) return;
  el.innerHTML = WEAPON_ORDER.map(type => {
    const key = `weapon_${type}`;
    const collapsed = isCollapsed(key);
    const group = State.data.weaponData[type];
    const list = group.map((w, i) => {
      const upDisabled = !canMoveWeapon(type, i, -1);
      const downDisabled = !canMoveWeapon(type, i, 1);
      const targetId = `w_img_${type}_${i}`;
      return `
      <div class="card">
        <div class="card-header">
          <span class="card-subtitle">#${i + 1} ${WEAPON_LABELS[type]}武器</span>
          <div class="card-actions">
            <button class="btn" onclick="App.moveWeapon('${type}',${i},-1)" ${upDisabled ? 'disabled' : ''}>${ICONS.up}<span class="btn-text">上移</span></button>
            <button class="btn" onclick="App.moveWeapon('${type}',${i},1)" ${downDisabled ? 'disabled' : ''}>${ICONS.down}<span class="btn-text">下移</span></button>
            <button class="btn btn-danger" onclick="App.removeWeapon('${type}',${i})">${ICONS.trash}<span class="btn-text">删除</span></button>
          </div>
        </div>
        <div class="row">
          <img src="${w.img || placeholder('')}" class="thumb" data-img-target="${targetId}" onclick="App.triggerUpload('${targetId}')" alt="" />
          <input type="text" value="${esc(w.name)}" oninput="App.setWeaponName('${type}',${i},this.value)" onblur="App.matchIconByType('weapons','${type}',${i},this.value)" class="flex-1" />
          <input type="file" id="${targetId}" accept="image/*" class="hidden" onchange="App.uploadImageHandler(this, v => { State.data.weaponData['${type}'][${i}].img = v; State.data.weaponData['${type}'][${i}].imgManual = true; App.renderWeaponEditor(); App.mountPreview(); App.debouncedSave(); })" />
        </div>
      </div>`;
    }).join('');
    return `<div class="panel group-card">
      <div class="group-header">
        <span class="group-title">${WEAPON_LABELS[type]}武器 (${group.length}/${WEAPON_MAX})</span>
        <div class="group-actions">
          <button class="btn" onclick="App.addWeapon('${type}')">${ICONS.plus}<span class="btn-text">添加</span></button>
          <button class="btn collapse-toggle ${collapsed ? 'collapsed' : ''}" data-collapse-key="${key}" onclick="App.toggleCollapse('${key}')">
            <span class="collapse-icon">${collapseIconOf(collapsed)}</span><span class="collapse-text">${collapsed ? '展开' : '收起'}</span>
          </button>
        </div>
      </div>
      <div data-collapse-content="${key}" class="group-content flex-col ${collapsed ? 'hidden' : ''}">
        ${list || '<div class="empty-state">暂无配置</div>'}
      </div>
    </div>`;
  }).join('');
}

function renderArtifactEditor() {
  const sectionKey = 'artifact_section';
  const isSectionCollapsed = isCollapsed(sectionKey);
  const headEl = document.getElementById('artifactSectionHead');
  if (headEl) {
    headEl.innerHTML = `<span>圣遗物推荐 (${State.data.artifactData.length})</span>
      <div class="group-actions">
        <button class="btn" id="btnAddArtifactSingle" onclick="App.addArtifact('single')">${ICONS.plus}<span class="btn-text">整套</span></button>
        <button class="btn" id="btnAddArtifactDouble" onclick="App.addArtifact('double')">${ICONS.plus}<span class="btn-text">散搭</span></button>
        <button class="btn collapse-toggle ${isSectionCollapsed ? 'collapsed' : ''}" data-collapse-key="${sectionKey}" onclick="App.toggleCollapse('${sectionKey}')">
          <span class="collapse-icon">${collapseIconOf(isSectionCollapsed)}</span><span class="collapse-text">${isSectionCollapsed ? '展开' : '收起'}</span>
        </button>
      </div>`;
  }
  const editorEl = document.getElementById('artifactEditor');
  if (!editorEl) return;
  editorEl.classList.toggle('hidden', isSectionCollapsed);
  editorEl.innerHTML = State.data.artifactData.map((a, i) => {
    if (a.type === 'double') {
      const t1 = `a_img1_${i}`, t2 = `a_img2_${i}`;
      return `<div class="card">
        <div class="card-header">
          <span class="card-subtitle text-accent">散搭 #${i + 1}</span>
          <div class="card-actions">
            <button class="btn" onclick="App.moveArtifact(${i},-1)" ${i === 0 ? 'disabled' : ''}>${ICONS.up}<span class="btn-text">上移</span></button>
            <button class="btn" onclick="App.moveArtifact(${i},1)" ${i === State.data.artifactData.length - 1 ? 'disabled' : ''}>${ICONS.down}<span class="btn-text">下移</span></button>
            <button class="btn btn-danger" onclick="App.removeArtifact(${i})">${ICONS.trash}<span class="btn-text">删除</span></button>
          </div>
        </div>
        <input type="text" value="${esc(a.displayText)}" placeholder="卡片显示文本（可选，留空显示两个名字）" oninput="App.setArtifactDisplayText(${i},this.value)" />
        <div class="artifact-dual-row">
          <div class="artifact-dual-item">
            <img src="${a.img1 || placeholder('')}" class="thumb" data-img-target="${t1}" onclick="App.triggerUpload('${t1}')" alt="" />
            <input type="text" value="${esc(a.name1)}" placeholder="圣遗物1" oninput="App.setArtifactName1(${i},this.value)" onblur="App.matchArtifactDoubleIcon(${i},1,this.value)" class="flex-1" />
            <input type="file" id="${t1}" accept="image/*" class="hidden" onchange="App.uploadImageHandler(this, v => { State.data.artifactData[${i}].img1 = v; State.data.artifactData[${i}].img1Manual = true; App.renderArtifactEditor(); App.mountPreview(); App.debouncedSave(); })" />
          </div>
          <div class="artifact-dual-item">
            <img src="${a.img2 || placeholder('')}" class="thumb" data-img-target="${t2}" onclick="App.triggerUpload('${t2}')" alt="" />
            <input type="text" value="${esc(a.name2)}" placeholder="圣遗物2" oninput="App.setArtifactName2(${i},this.value)" onblur="App.matchArtifactDoubleIcon(${i},2,this.value)" class="flex-1" />
            <input type="file" id="${t2}" accept="image/*" class="hidden" onchange="App.uploadImageHandler(this, v => { State.data.artifactData[${i}].img2 = v; State.data.artifactData[${i}].img2Manual = true; App.renderArtifactEditor(); App.mountPreview(); App.debouncedSave(); })" />
          </div>
        </div>
      </div>`;
    }
    const targetId = `a_img_${i}`;
    return `<div class="card">
      <div class="card-header">
        <span class="card-subtitle">整套 #${i + 1}</span>
        <div class="card-actions">
          <button class="btn" onclick="App.moveArtifact(${i},-1)" ${i === 0 ? 'disabled' : ''}>${ICONS.up}<span class="btn-text">上移</span></button>
          <button class="btn" onclick="App.moveArtifact(${i},1)" ${i === State.data.artifactData.length - 1 ? 'disabled' : ''}>${ICONS.down}<span class="btn-text">下移</span></button>
          <button class="btn btn-danger" onclick="App.removeArtifact(${i})">${ICONS.trash}<span class="btn-text">删除</span></button>
        </div>
      </div>
      <div class="row">
        <img src="${a.img || placeholder('')}" class="thumb" data-img-target="${targetId}" onclick="App.triggerUpload('${targetId}')" alt="" />
        <input type="text" value="${esc(a.name)}" oninput="App.setArtifactName(${i},this.value)" onblur="App.matchIconByType('artifacts','${i}',null,this.value)" class="flex-1" />
        <input type="file" id="${targetId}" accept="image/*" class="hidden" onchange="App.uploadImageHandler(this, v => { State.data.artifactData[${i}].img = v; State.data.artifactData[${i}].imgManual = true; App.renderArtifactEditor(); App.mountPreview(); App.debouncedSave(); })" />
      </div>
    </div>`;
  }).join('') || '<div class="empty-state">暂无圣遗物</div>';
}

function renderTeamEditor() {
  const el = document.getElementById('teamEditor');
  if (!el) return;
  el.innerHTML = State.data.teamData.map((team, ti) => {
    const teamKey = `team_${ti}`;
    const teamCollapsed = isCollapsed(teamKey);
    return `<div class="panel group-card">
      <div class="card-header ${teamCollapsed ? 'mb-0' : 'mb-8'}">
        <span class="group-title">队伍 ${ti + 1}</span>
        <div class="card-actions">
          <button class="btn" onclick="App.moveTeam(${ti},-1)" ${ti === 0 ? 'disabled' : ''}>${ICONS.up}<span class="btn-text">上移</span></button>
          <button class="btn" onclick="App.moveTeam(${ti},1)" ${ti === State.data.teamData.length - 1 ? 'disabled' : ''}>${ICONS.down}<span class="btn-text">下移</span></button>
          <button class="btn collapse-toggle ${teamCollapsed ? 'collapsed' : ''}" data-collapse-key="${teamKey}" onclick="App.toggleCollapse('${teamKey}')">
            <span class="collapse-icon">${collapseIconOf(teamCollapsed)}</span><span class="collapse-text">${teamCollapsed ? '展开' : '收起'}</span>
          </button>
          <button class="btn btn-danger" onclick="App.removeTeam(${ti})">${ICONS.trash}<span class="btn-text">删除</span></button>
        </div>
      </div>
      <div data-collapse-content="${teamKey}" class="group-content ${teamCollapsed ? 'hidden' : ''}">
        <input type="text" value="${esc(team.name)}" oninput="App.setTeamName(${ti},this.value)" placeholder="队伍名称" />
        <div class="flex-col">
          ${team.chars.slice(1, 4).map((c, idx) => {
            const ci = idx + 1;
            const charKey = `team_${ti}_char_${ci}`;
            const charCollapsed = isCollapsed(charKey);
            const targetId = `t_${ti}_${ci}_img`;
            return `<div class="card">
              <div class="card-header">
                <span class="card-subtitle text-accent">${ci + 1}号位主角色</span>
                <div class="card-actions">
                  <button class="btn" onclick="App.moveTeamChar(${ti},${ci},-1)" ${ci === 1 ? 'disabled' : ''}>${ICONS.up}<span class="btn-text">上移</span></button>
                  <button class="btn" onclick="App.moveTeamChar(${ti},${ci},1)" ${ci === 3 ? 'disabled' : ''}>${ICONS.down}<span class="btn-text">下移</span></button>
                  <button class="btn collapse-toggle ${charCollapsed ? 'collapsed' : ''}" data-collapse-key="${charKey}" onclick="App.toggleCollapse('${charKey}')">
                    <span class="collapse-icon">${collapseIconOf(charCollapsed)}</span><span class="collapse-text">${charCollapsed ? '展开' : '收起'}</span>
                  </button>
                </div>
              </div>
              <div data-collapse-content="${charKey}" class="group-content ${charCollapsed ? 'hidden' : ''}">
                <div class="row">
                  <img src="${c.img || placeholder('')}" class="thumb" data-img-target="${targetId}" onclick="App.triggerUpload('${targetId}')" alt="" />
                  <input type="text" value="${esc(c.name)}" oninput="App.setTeamCharName(${ti},${ci},this.value)" onblur="App.matchIconByType('characters',${ti},${ci},this.value)" class="flex-1" />
                  <input type="file" id="${targetId}" accept="image/*" class="hidden" onchange="App.uploadImageHandler(this, v => { State.data.teamData[${ti}].chars[${ci}].img = v; State.data.teamData[${ti}].chars[${ci}].imgManual = true; App.renderTeamEditor(); App.mountPreview(); App.debouncedSave(); })" />
                </div>
                <div class="alt-list-wrap">
                  <div class="alt-header">
                    <span class="alt-count">备选角色 (${c.alts.length}/4)</span>
                    <button class="btn ml-auto" onclick="App.addAlt(${ti},${ci})">${ICONS.plus}<span class="btn-text">添加</span></button>
                  </div>
                  ${c.alts.map((a, ai) => {
                    const altTargetId = `t_${ti}_${ci}_${ai}_img`;
                    return `
                    <div class="card sub-card">
                      <div class="card-header">
                        <span class="card-subtitle">备选 #${ai + 1}</span>
                        <div class="card-actions">
                          <button class="btn" onclick="App.moveAlt(${ti},${ci},${ai},-1)" ${ai === 0 ? 'disabled' : ''}>${ICONS.up}<span class="btn-text">上移</span></button>
                          <button class="btn" onclick="App.moveAlt(${ti},${ci},${ai},1)" ${ai === c.alts.length - 1 ? 'disabled' : ''}>${ICONS.down}<span class="btn-text">下移</span></button>
                          <button class="btn btn-danger" onclick="App.removeAlt(${ti},${ci},${ai})">${ICONS.trash}<span class="btn-text">删除</span></button>
                        </div>
                      </div>
                      <div class="row">
                        <img src="${a.img || placeholder('')}" class="thumb" data-img-target="${altTargetId}" onclick="App.triggerUpload('${altTargetId}')" alt="" />
                        <input type="text" value="${esc(a.name)}" oninput="App.setAltName(${ti},${ci},${ai},this.value)" onblur="App.matchIconByType('characters_alt',${ti},${ci},this.value,${ai})" class="flex-1" />
                        <input type="file" id="${altTargetId}" accept="image/*" class="hidden" onchange="App.uploadImageHandler(this, v => { State.data.teamData[${ti}].chars[${ci}].alts[${ai}].img = v; State.data.teamData[${ti}].chars[${ci}].alts[${ai}].imgManual = true; App.renderTeamEditor(); App.mountPreview(); App.debouncedSave(); })" />
                      </div>
                    </div>`;
                  }).join('')}
                  ${!c.alts.length ? `<input type="text" value="${esc(c.emptyAltText || '暂无备选')}" oninput="App.setEmptyAltText(${ti},${ci},this.value)" placeholder="无备选时显示的文字" />` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }).join('') || '<div class="empty-state">暂未添加配队</div>';
}

function renderEditorsByKey() {
  renderColorPicker();
  renderWeaponEditor();
  renderArtifactEditor();
  renderConstellationEditor();
  renderTeamEditor();
  renderPanelPrimaryDropdown();
}

/* =========================================================================
 * 【模块 6.5】面板区 · 属性类型下拉（渲染由本文件负责，开关由 dropdown.js 接管）
 * ========================================================================= */
const PANEL_PRIMARY_OPTIONS = [
  { key: 'hp',  label: '生命值' },
  { key: 'atk', label: '攻击力' },
  { key: 'def', label: '防御力' }
];

function renderPanelPrimaryDropdown() {
  const panel = document.getElementById('panelPrimaryKeyPanel');
  const label = document.getElementById('panelPrimaryKeyLabel');
  if (!panel || !label) return;

  const current = State.data.panel?.primaryKey || 'hp';
  const currentOpt = PANEL_PRIMARY_OPTIONS.find(o => o.key === current) || PANEL_PRIMARY_OPTIONS[0];
  label.textContent = currentOpt.label;

  panel.innerHTML = PANEL_PRIMARY_OPTIONS.map(o =>
    `<button type="button" class="dropdown-item ${o.key === current ? 'is-active' : ''}" data-value="${o.key}">${o.label}</button>`
  ).join('');
}

/* =========================================================================
 * 【模块 7】上传与缩略图
 * ========================================================================= */
const IMAGE_WARN_SIZE = 15 * 1024 * 1024;

function updateThumb(thumbId, labelId, src, labelText) {
  const thumb = document.getElementById(thumbId);
  if (thumb) thumb.src = src;
  const label = document.getElementById(labelId);
  if (label) label.textContent = labelText;
}
function resetThumb(thumbId, labelId, labelText) {
  const thumb = document.getElementById(thumbId);
  if (thumb) thumb.removeAttribute('src');
  const label = document.getElementById(labelId);
  if (label) label.textContent = labelText;
}

function initThumbnails() {
  const d = State.data;
  if (d.charImg) updateThumb('thumbCharImg', 'labelCharImg', d.charImg, '已载入立绘（点击更换）');
  else resetThumb('thumbCharImg', 'labelCharImg', '点击上传立绘');
  if (d.nameBgImg) updateThumb('thumbNameBg', 'labelNameBg', d.nameBgImg, '已载入元素图（点击更换）');
  else resetThumb('thumbNameBg', 'labelNameBg', '点击上传元素图');
  if (d.bgImg) updateThumb('thumbBg', 'labelBg', d.bgImg, '已载入大背景（点击更换）');
  else resetThumb('thumbBg', 'labelBg', '默认暗黑原力色');
  if (d.teamCoreImg) updateThumb('thumbTeamCore', 'labelTeamCore', d.teamCoreImg, '已载入1号位头像（点击更换）');
  else resetThumb('thumbTeamCore', 'labelTeamCore', '主角色一号位头像（点击更换）');
  const fontLabel = document.getElementById('labelCustomFont');
  if (fontLabel) {
    if (d.fontName) fontLabel.textContent = '当前：' + d.fontName;
    else if (d.fontData) fontLabel.textContent = '已载入自定义字体';
    else fontLabel.textContent = '默认标准字体';
  }
  updateImgXHint();
}

function clearImage(stateKey, thumbId, labelId) {
  State.data[stateKey] = '';
  State.data[stateKey + 'Deleted'] = true;
  State.data[stateKey + 'Manual'] = false;
  if (stateKey === 'charImg') State.data.charImgMeta = null;
  if (stateKey === 'nameBgImg') State.data.nameBgImgMeta = null;
  resetThumb(thumbId, labelId, '点击上传图片');
  updateImgXHint();
  mountPreview();
  debouncedSave();
}

function onThumbClick(inputId, stateKey) {
  if (State.data[stateKey]) {
    showToast('已有图片，如需更换请先删除', 'info');
    return;
  }
  triggerUpload(inputId);
}

function triggerUpload(id) { document.getElementById(id)?.click(); }

async function uploadImageHandler(input, setter) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  if (file.size > IMAGE_WARN_SIZE) {
    const ok = await showConfirm('图片较大', `该图片 ${formatBytes(file.size)}，可能影响保存速度。是否继续？`);
    if (!ok) {
      input.value = '';
      return;
    }
  }

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      setter(e.target.result, img.width, img.height);
      mountPreview();
      debouncedSave();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
  input.value = '';
}

function updateImgXHint() {
  const el = document.getElementById('imgXHint');
  if (!el) return;
  const meta = State.data.charImgMeta;
  if (meta && meta.w && meta.h) {
    el.textContent = `立绘偏移（原图 ${meta.w}×${meta.h}）`;
  } else {
    el.textContent = '立绘偏移（左右移动）';
  }
}

/* =========================================================================
 * 【模块 8】核心匹配逻辑
 * ========================================================================= */
async function matchIconByType(type, arg1, arg2, name, altIndex = null) {
  if (!window.ICON_LIB || !name || !name.trim()) return;
  const trimmed = name.trim();

  if (type === 'weapons') {
    const cell = State.data.weaponData[arg1]?.[arg2];
    if (!cell) return;
    try {
      const r = await ICON_LIB.fromName('weapons', trimmed);
      cell.img = r?.dataURL || '';
    } catch (e) { cell.img = ''; }
    cell.imgManual = false;
    document.querySelector(`[data-img-target="w_img_${arg1}_${arg2}"]`)?.setAttribute('src', cell.img || placeholder(''));
  }
  else if (type === 'artifacts') {
    const cell = State.data.artifactData[arg1];
    if (!cell) return;
    try {
      const r = await ICON_LIB.fromName('artifacts', trimmed);
      cell.img = r?.dataURL || '';
    } catch (e) { cell.img = ''; }
    cell.imgManual = false;
    document.querySelector(`[data-img-target="a_img_${arg1}"]`)?.setAttribute('src', cell.img || placeholder(''));
  }
  else if (type === 'characters') {
    const cell = State.data.teamData[arg1]?.chars?.[arg2];
    if (!cell) return;
    const matchedName = resolveCharName(trimmed);
    if (!matchedName) { cell.img = ''; cell.imgManual = false; return; }
    try {
      const r = await ICON_LIB.fromName('characters', matchedName);
      cell.img = r?.dataURL || '';
    } catch (e) { cell.img = ''; }
    cell.imgManual = false;
    document.querySelector(`[data-img-target="t_${arg1}_${arg2}_img"]`)?.setAttribute('src', cell.img || placeholder(''));
  }
  else if (type === 'characters_alt') {
    const cell = State.data.teamData[arg1]?.chars?.[arg2]?.alts?.[altIndex];
    if (!cell) return;
    const matchedName = resolveCharName(trimmed);
    if (!matchedName) { cell.img = ''; cell.imgManual = false; return; }
    try {
      const r = await ICON_LIB.fromName('characters', matchedName);
      cell.img = r?.dataURL || '';
    } catch (e) { cell.img = ''; }
    cell.imgManual = false;
    document.querySelector(`[data-img-target="t_${arg1}_${arg2}_${altIndex}_img"]`)?.setAttribute('src', cell.img || placeholder(''));
  }

  mountPreview();
  debouncedSave();
}

async function matchArtifactDoubleIcon(i, part, name) {
  if (!window.ICON_LIB || !name || !name.trim()) return;
  const trimmed = name.trim();
  const imgKey = part === 1 ? 'img1' : 'img2';
  const manualKey = part === 1 ? 'img1Manual' : 'img2Manual';
  const targetId = part === 1 ? `a_img1_${i}` : `a_img2_${i}`;
  const cell = State.data.artifactData[i];
  if (!cell) return;

  try {
    const r = await ICON_LIB.fromName('artifacts', trimmed);
    cell[imgKey] = r?.dataURL || '';
  } catch (e) { cell[imgKey] = ''; }
  cell[manualKey] = false;
  document.querySelector(`[data-img-target="${targetId}"]`)?.setAttribute('src', cell[imgKey] || placeholder(''));
  mountPreview(); debouncedSave();
}

async function matchCharAvatar(name) {
  if (!window.ICON_LIB) return;
  const trimmed = (name || '').trim();
  if (!trimmed || !isValidCharName(trimmed)) {
    State.data.teamCoreImg = '';
    State.data.teamCoreImgManual = false;
    resetThumb('thumbTeamCore', 'labelTeamCore', '主角色一号位头像（点击更换）');
    mountPreview(); debouncedSave();
    return;
  }
  try {
    const r = await ICON_LIB.fromName('characters', trimmed);
    if (r && r.dataURL) {
      State.data.teamCoreImg = r.dataURL;
      State.data.teamCoreImgManual = false;
      updateThumb('thumbTeamCore', 'labelTeamCore', r.dataURL, '已载入1号位头像（点击更换）');
    } else {
      State.data.teamCoreImg = '';
      State.data.teamCoreImgManual = false;
      resetThumb('thumbTeamCore', 'labelTeamCore', '主角色一号位头像（点击更换）');
    }
    mountPreview(); debouncedSave();
  } catch (e) {
    State.data.teamCoreImg = '';
    State.data.teamCoreImgManual = false;
    resetThumb('thumbTeamCore', 'labelTeamCore', '主角色一号位头像（点击更换）');
    mountPreview(); debouncedSave();
  }
}

async function matchStyleImages(onlyEmpty) {
  const name = (State.data.charName || '').trim();
  if (!name) { if (!onlyEmpty) showToast('请先填写角色名', 'error'); return; }
  State.data.charImgDeleted = false;
  State.data.nameBgImgDeleted = false;
  State.data.bgImgDeleted = false;
  if (!onlyEmpty) showToast('正在匹配样式图…', 'info');

  const nameValid = isValidCharName(name);
  const results = { standing: false, element: false, namecard: false, standingError: '' };
  const elementName = themeToElementName();

  const tasks = [];

  if (!onlyEmpty || !State.data.charImg) {
    tasks.push(async () => {
      if (!nameValid) {
        State.data.charImg = ''; State.data.charImgMeta = null; State.data.charImgManual = false;
        resetThumb('thumbCharImg', 'labelCharImg', '点击上传立绘');
        results.standingError = '角色清单无此名字';
        return;
      }
      const artKeyWithEle = elementName ? name + '·' + elementName : '';
      const artUrl = ART_DICT[artKeyWithEle] || ART_DICT[name] || '';
      if (artUrl) {
        const meta = await loadImageMeta(artUrl);
        if (meta) {
          State.data.charImg = artUrl;
          State.data.charImgMeta = meta;
          State.data.charImgManual = false;
          updateThumb('thumbCharImg', 'labelCharImg', artUrl, '已匹配立绘');
          results.standing = true;
        } else {
          State.data.charImg = ''; State.data.charImgMeta = null; State.data.charImgManual = false;
          resetThumb('thumbCharImg', 'labelCharImg', '点击上传立绘');
          results.standingError = '链接加载失败';
        }
      } else {
        State.data.charImg = ''; State.data.charImgMeta = null; State.data.charImgManual = false;
        resetThumb('thumbCharImg', 'labelCharImg', '点击上传立绘');
        results.standingError = ART_DICT[name] === undefined && ART_DICT[artKeyWithEle] === undefined ? '字典无此角色' : '暂无立绘链接';
      }
    });
  }

  if (!onlyEmpty || !State.data.nameBgImg) {
    tasks.push(async () => {
      let elementUrl = '';
      if (elementName) {
        const ghUrl = '../../shared/assets/characters/element/' + elementName + '.png';
        if (await urlExists(ghUrl)) elementUrl = ghUrl;
      }
      if (elementUrl) {
        State.data.nameBgImg = elementUrl; State.data.nameBgImgMeta = null; State.data.nameBgImgManual = false;
        updateThumb('thumbNameBg', 'labelNameBg', elementUrl, '已匹配元素图：' + elementName);
        results.element = true;
      } else {
        State.data.nameBgImg = ''; State.data.nameBgImgManual = false;
        resetThumb('thumbNameBg', 'labelNameBg', '点击上传元素图');
      }
    });
  }

  if (!onlyEmpty || !State.data.bgImg) {
    tasks.push(async () => {
      if (!nameValid) {
        State.data.bgImg = ''; State.data.bgImgManual = false;
        resetThumb('thumbBg', 'labelBg', '默认暗黑原力色');
        return;
      }
      const namecardUrl = NAMECARD_DICT[name] || '';
      if (namecardUrl) {
        State.data.bgImg = namecardUrl; State.data.bgImgManual = false;
        updateThumb('thumbBg', 'labelBg', namecardUrl, '已匹配名片图');
        results.namecard = true;
      } else {
        State.data.bgImg = ''; State.data.bgImgManual = false;
        resetThumb('thumbBg', 'labelBg', '默认暗黑原力色');
      }
    });
  }

  await Promise.all(tasks.map(fn => fn()));

  if (!onlyEmpty) {
    if (!nameValid) {
      showToast('角色「' + name + '」不在 characters.txt 中', 'error');
    } else {
      const failed = [];
      if (!results.standing) failed.push('立绘（' + (results.standingError || '未匹配') + '）');
      if (elementName && !results.element) failed.push('元素图');
      if (!results.namecard) failed.push('名片图（字典无此角色）');
      if (!elementName) failed.push('元素图（未选元素色）');
      if (failed.length) showToast('未找到：' + failed.join('、'), 'error');
      else showToast('全部匹配成功', 'success');
    }
    updateImgXHint(); mountPreview(); debouncedSave();
  }
}

async function loadSaveFromRepo() {
  const name = (State.data.charName || '').trim();
  if (!name) { showToast('请先填写角色名', 'error'); return; }
  const order = CHAR_NAME_TO_ORDER[name];
  if (!order) { showToast('characters.txt 中找不到「' + name + '」', 'error'); return; }
  const filename = padOrder(order) + '.' + name + '.json';
  const url = '../../shared/saves/characters/' + filename;
  showToast('正在查找存档…', 'info');

  try {
    const res = await fetch(url + '?t=' + Date.now());
    if (!res.ok) { showToast('未找到存档「' + filename + '」', 'error'); return; }
    const json = await res.json();
    const ok = await showConfirm('发现存档', '是否载入「' + name + '」的存档？当前编辑内容会被覆盖。');
    if (!ok) return;
    await applyImportedData(json);
    showToast('存档载入成功', 'success');
  } catch (e) {
    showToast('存档读取失败：' + e.message, 'error');
  }
}

/* =========================================================================
 * 【模块 9】数据归一化
 * ========================================================================= */
function normalizeWeaponList(list) {
  return Array.isArray(list) ? list.map(w => ({ name: String(w?.name ?? ''), img: String(w?.img ?? ''), imgManual: !!w?.imgManual })) : [];
}
function normalizeArtifactList(list) {
  return Array.isArray(list) ? list.map(a => {
    if (a?.type === 'double') {
      return {
        type: 'double', name1: String(a?.name1 ?? a?.name ?? ''), name2: String(a?.name2 ?? ''), displayText: String(a?.displayText ?? ''),
        img1: String(a?.img1 ?? ''), img1Manual: !!a?.img1Manual, img2: String(a?.img2 ?? ''), img2Manual: !!a?.img2Manual
      };
    }
    return { type: 'single', name: String(a?.name ?? ''), img: String(a?.img ?? ''), imgManual: !!a?.imgManual };
  }) : [];
}
function normalizeAlts(list) {
  return Array.isArray(list) ? list.map(a => ({ name: String(a?.name ?? ''), img: String(a?.img ?? ''), imgManual: !!a?.imgManual })) : [];
}
function normalizeTeamChars(chars) {
  return Array.from({ length: 4 }, (_, i) => {
    const c = chars?.[i] || {};
    return {
      name: String(c.name ?? ''), img: String(c.img ?? ''), imgManual: !!c.imgManual,
      emptyAltText: String(c.emptyAltText ?? '暂无备选'), alts: normalizeAlts(c.alts)
    };
  });
}
function normalizePanel(p) {
  const src = p || {};
  return {
    primaryKey: PANEL_PRIMARY_KEYS.includes(src.primaryKey) ? src.primaryKey : 'hp',
    primaryValue: String(src.primaryValue ?? ''), cr: String(src.cr ?? ''), cd: String(src.cd ?? ''), em: String(src.em ?? ''), er: String(src.er ?? '')
  };
}
function normalizeState(data = {}) {
  return {
    ...State.data, ...data,
    charImg: data.charImg || '', charImgMeta: data.charImgMeta || null, charImgDeleted: !!data.charImgDeleted, charImgManual: !!data.charImgManual,
    bgImg: data.bgImg || '', bgImgDeleted: !!data.bgImgDeleted, bgImgManual: !!data.bgImgManual,
    nameBgImg: data.nameBgImg || '', nameBgImgMeta: data.nameBgImgMeta || null, nameBgImgDeleted: !!data.nameBgImgDeleted, nameBgImgManual: !!data.nameBgImgManual,
    teamCoreImg: data.teamCoreImg || '', teamCoreImgManual: !!data.teamCoreImgManual,
    fontData: data.fontData || '', fontName: data.fontName || '', fontFileName: data.fontFileName || '',
    theme: data.theme || '#939393', imgX: Number(data.imgX) || 0,
    weaponData: {
      graduate: normalizeWeaponList(data?.weaponData?.graduate), optional: normalizeWeaponList(data?.weaponData?.optional), newbie: normalizeWeaponList(data?.weaponData?.newbie)
    },
    artifactData: normalizeArtifactList(data.artifactData),
    constellationData: Array.from({ length: 6 }, (_, i) => ({ active: !!data?.constellationData?.[i]?.active, desc: String(data?.constellationData?.[i]?.desc ?? '') })),
    panel: normalizePanel(data.panel),
    teamData: Array.isArray(data.teamData) ? data.teamData.map(team => ({ ...team, chars: normalizeTeamChars(team?.chars) })) : []
  };
}

/* =========================================================================
 * 【模块 10】导出 / 导入
 * ========================================================================= */
async function urlToDataURL(url) {
  if (!url || /^data:/i.test(url)) return url;
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

async function bakeImagesToDataURL() {
  const data = JSON.parse(JSON.stringify(State.data));
  const tasks = [];

  ['charImg', 'bgImg', 'nameBgImg', 'teamCoreImg'].forEach(key => {
    if (data[key]) tasks.push((async () => { data[key] = await urlToDataURL(data[key]); })());
  });

  WEAPON_ORDER.forEach(type => {
    (data.weaponData[type] || []).forEach(w => {
      if (w.img) tasks.push((async () => { w.img = await urlToDataURL(w.img); })());
    });
  });

  (data.artifactData || []).forEach(a => {
    if (a.img) tasks.push((async () => { a.img = await urlToDataURL(a.img); })());
    if (a.img1) tasks.push((async () => { a.img1 = await urlToDataURL(a.img1); })());
    if (a.img2) tasks.push((async () => { a.img2 = await urlToDataURL(a.img2); })());
  });

  (data.teamData || []).forEach(t => {
    (t.chars || []).forEach(c => {
      if (c.img) tasks.push((async () => { c.img = await urlToDataURL(c.img); })());
      (c.alts || []).forEach(a => {
        if (a.img) tasks.push((async () => { a.img = await urlToDataURL(a.img); })());
      });
    });
  });

  await Promise.all(tasks);
  return data;
}

function buildExportPayload(data) {
  const out = JSON.parse(JSON.stringify(data));
  out.fontData = '';
  if (!out.charImgManual) { out.charImg = ''; out.charImgMeta = null; }
  if (!out.bgImgManual) out.bgImg = '';
  if (!out.nameBgImgManual) { out.nameBgImg = ''; out.nameBgImgMeta = null; }
  if (!out.teamCoreImgManual) out.teamCoreImg = '';
  WEAPON_ORDER.forEach(type => {
    (out.weaponData[type] || []).forEach(w => { if (!w.imgManual) w.img = ''; });
  });
  (out.artifactData || []).forEach(a => {
    if (!a.imgManual) a.img = '';
    if (!a.img1Manual) a.img1 = '';
    if (!a.img2Manual) a.img2 = '';
  });
  (out.teamData || []).forEach(t => {
    (t.chars || []).forEach(c => {
      if (!c.imgManual) c.img = '';
      (c.alts || []).forEach(a => { if (!a.imgManual) a.img = ''; });
    });
  });
  return out;
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function exportPNG() {
  const bd = document.getElementById('exportDesktopBtn');
  const bm = document.getElementById('exportMobileBtn');
  const btns = [bd ? { el: bd, text: bd.textContent } : null, bm ? { el: bm, text: bm.textContent } : null].filter(Boolean);
  btns.forEach(b => { b.el.disabled = true; b.el.textContent = '正在导出...'; });

  try {
    if (document.fonts) await document.fonts.ready;
    const baked = await bakeImagesToDataURL();
    const original = State.data;
    let svg;
    try {
      State.data = baked;
      svg = buildSVG(EXPORT_SCALE, true);
    } finally {
      State.data = original;
    }

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('SVG 渲染失败'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = SVG_W * EXPORT_SCALE;
      canvas.height = SVG_H * EXPORT_SCALE;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
      const now = new Date();
      const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
      downloadBlob(pngBlob, `${original.charName || '角色'}_${y}-${m}-${d}.png`);
      showToast('导出成功', 'success');
    } finally { URL.revokeObjectURL(url); }
  } catch (e) {
    showToast('导出失败：' + (e.message || e), 'error');
  } finally {
    btns.forEach(b => { b.el.disabled = false; b.el.textContent = b.text; });
  }
}

function exportConfig() {
  const name = State.data.charName || '角色';
  const order = CHAR_NAME_TO_ORDER[name];
  const filename = order ? (padOrder(order) + '.' + name + '.json') : (name + '.json');
  const payload = buildExportPayload(State.data);
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename);
}

async function silentFromName(type, name) {
  if (!window.ICON_LIB) return '';
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  try {
    const r = await ICON_LIB.fromName(type, trimmed);
    return r?.dataURL || '';
  } catch (e) { return ''; }
}

async function runConcurrent(tasks, limit) {
  const max = limit ? Math.min(limit, tasks.length) : tasks.length;
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const my = idx++;
      try { await tasks[my](); } catch (e) {}
    }
  }
  await Promise.all(Array.from({ length: max }, worker));
}

async function autoRematchAll() {
  const d = State.data;
  const tasks = [];

  if (d.charName && (!d.charImg || !d.nameBgImg || !d.bgImg)) tasks.push(() => matchStyleImages(true));

  WEAPON_ORDER.forEach(type => {
    (d.weaponData[type] || []).forEach(w => {
      if (w.name && !w.img) tasks.push(async () => { const u = await silentFromName('weapons', w.name); if (u) w.img = u; });
    });
  });

  (d.artifactData || []).forEach(a => {
    if (a.type === 'double') {
      if (a.name1 && !a.img1) tasks.push(async () => { const u = await silentFromName('artifacts', a.name1); if (u) a.img1 = u; });
      if (a.name2 && !a.img2) tasks.push(async () => { const u = await silentFromName('artifacts', a.name2); if (u) a.img2 = u; });
    } else {
      if (a.name && !a.img) tasks.push(async () => { const u = await silentFromName('artifacts', a.name); if (u) a.img = u; });
    }
  });

  (d.teamData || []).forEach(team => {
    (team.chars || []).forEach((c, ci) => {
      if (ci === 0) return;
      if (c.name && !c.img) {
        const hit = resolveCharName(c.name);
        if (hit) tasks.push(async () => { const u = await silentFromName('characters', hit); if (u) c.img = u; });
      }
      (c.alts || []).forEach(alt => {
        if (alt.name && !alt.img) {
          const hit = resolveCharName(alt.name);
          if (hit) tasks.push(async () => { const u = await silentFromName('characters', hit); if (u) alt.img = u; });
        }
      });
    });
  });

  if (d.charName && !d.teamCoreImg && isValidCharName(d.charName)) {
    tasks.push(async () => { const u = await silentFromName('characters', d.charName); if (u) d.teamCoreImg = u; });
  }

  await runConcurrent(tasks);
}

async function reloadFontByFileName() {
  if (State.data.fontFileName) {
    if (!FONT_LIST.length) await loadFontList();
    const idx = FONT_LIST.findIndex(x => x.file === State.data.fontFileName);
    if (idx >= 0) { await selectFont(idx); return true; }
    if (State.data.fontData) { await installPreviewFont(); return true; }
  } else {
    if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch (e) {} loadedFontFace = null; }
  }
  return false;
}

async function applyImportedData(data) {
  State.data = normalizeState(data);
  showToast('正在恢复字体与图片…', 'info');

  const fontPromise = reloadFontByFileName();
  const iconPromise = autoRematchAll();

  await iconPromise;
  initThumbnails(); renderEditorsByKey(); syncInputs(); mountPreview();

  await fontPromise;
  if (document.fonts) { try { await document.fonts.ready; } catch (e) {} }
  mountPreview();

  debouncedSave();
}

async function importConfig(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      await applyImportedData(data);
      showToast('配置导入成功', 'success');
    } catch (err) {
      showToast('配置解析失败', 'error');
    }
    input.value = '';
  };
  reader.readAsText(input.files[0]);
}

async function clearAllData() {
  const ok = await showConfirm('清空全部数据', '确定清空所有角色配置与图片数据吗？此操作不可撤销。');
  if (!ok) return;
  try {
    await clearFontCache();
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete('current_state');
    store.put({ author: State.data.author }, 'current_state');
  } catch (e) {}
  location.reload();
}

/* =========================================================================
 * 【模块 11】交互逻辑
 * ========================================================================= */
const FIELD_MAP = {
  charName: 'charName', version: 'version', date: 'date', author: 'author',
  talentA: 'talent.A', talentE: 'talent.E', talentQ: 'talent.Q',
  sandMain: 'stat.sandMain', gobMain: 'stat.gobMain', cirMain: 'stat.cirMain'
};

function setField(key, value) {
  if (key === 'imgX' && value !== '') value = Number(value) || 0;
  State.data[key] = value;
  if (key === 'imgX') {
    const s = document.getElementById('imgXSlider');
    const n = document.getElementById('imgX');
    if (s && document.activeElement !== s) s.value = value;
    if (n && document.activeElement !== n) n.value = value;
    updateCharImgX();
  } else if (key === 'subStats') {
    mountPreview();
  } else if (key === 'sandMain' || key === 'gobMain' || key === 'cirMain') {
    mountPreview();
  } else if (FIELD_MAP[key]) {
    updatePreviewField(FIELD_MAP[key]);
  } else {
    mountPreview();
  }
  debouncedSave();
}

function canMoveWeapon(type, i, dir) {
  const list = State.data.weaponData[type];
  if (!list) return false;
  const target = i + dir;
  if (target >= 0 && target < list.length) return true;
  const ti = WEAPON_ORDER.indexOf(type);
  const adjTi = ti + dir;
  if (adjTi < 0 || adjTi >= WEAPON_ORDER.length) return false;
  return State.data.weaponData[WEAPON_ORDER[adjTi]].length < WEAPON_MAX;
}

function moveWeapon(type, i, dir) {
  const list = State.data.weaponData[type];
  if (!list || i < 0 || i >= list.length) return;
  const target = i + dir;
  if (target >= 0 && target < list.length) {
    [list[i], list[target]] = [list[target], list[i]];
    renderWeaponEditor(); mountPreview(); debouncedSave(); return;
  }
  const ti = WEAPON_ORDER.indexOf(type);
  const adjTi = ti + dir;
  if (adjTi < 0 || adjTi >= WEAPON_ORDER.length) return;
  const adjType = WEAPON_ORDER[adjTi];
  const adjList = State.data.weaponData[adjType];
  if (adjList.length >= WEAPON_MAX) return showToast(`「${WEAPON_LABELS[adjType]}」区已满 ${WEAPON_MAX} 个`, 'error');
  const [item] = list.splice(i, 1);
  if (dir === 1) adjList.unshift(item); else adjList.push(item);
  renderWeaponEditor(); mountPreview(); debouncedSave();
}

function addWeapon(type) {
  const list = State.data.weaponData[type];
  if (list.length >= WEAPON_MAX) return showToast(`「${WEAPON_LABELS[type]}」区最多 ${WEAPON_MAX} 个`, 'error');
  list.push({ name: '', img: '', imgManual: false });
  collapseState[`weapon_${type}`] = false;
  renderWeaponEditor(); mountPreview(); debouncedSave();
}

function removeWeapon(type, i) { State.data.weaponData[type].splice(i, 1); renderWeaponEditor(); mountPreview(); debouncedSave(); }
function setWeaponName(type, i, v) { State.data.weaponData[type][i].name = v; updatePreviewField(`weapon.${type}.${i}.name`); debouncedSave(); }

function addArtifact(type) {
  State.data.artifactData.push(type === 'double'
    ? { type, name1: '', name2: '', displayText: '', img1: '', img1Manual: false, img2: '', img2Manual: false }
    : { type, name: '', img: '', imgManual: false });
  collapseState['artifact_section'] = false;
  renderArtifactEditor(); mountPreview(); debouncedSave();
}
function removeArtifact(i) { State.data.artifactData.splice(i, 1); renderArtifactEditor(); mountPreview(); debouncedSave(); }
function moveArtifact(i, dir) { if (moveItem(State.data.artifactData, i, dir)) { renderArtifactEditor(); mountPreview(); debouncedSave(); } }
function setArtifactName(i, v) { State.data.artifactData[i].name = v; updatePreviewField(`artifact.${i}.name`); debouncedSave(); }

function addTeam() {
  if (State.data.teamData.length >= 3) return showToast('最多支持 3 组队伍', 'error');
  State.data.teamData.push({ name: '', chars: Array.from({ length: 4 }, () => ({ name: '', img: '', imgManual: false, alts: [], emptyAltText: '暂无备选' })) });
  collapseState[`team_${State.data.teamData.length - 1}`] = false;
  renderTeamEditor(); mountPreview(); debouncedSave();
}
function removeTeam(ti) { State.data.teamData.splice(ti, 1); renderTeamEditor(); mountPreview(); debouncedSave(); }
function moveTeam(ti, dir) { if (moveItem(State.data.teamData, ti, dir)) { renderTeamEditor(); mountPreview(); debouncedSave(); } }
function setTeamName(ti, v) { State.data.teamData[ti].name = v; updatePreviewField(`team.${ti}.name`); debouncedSave(); }

function moveTeamChar(ti, ci, dir) {
  const chars = State.data.teamData[ti]?.chars;
  if (!chars) return;
  const target = ci + dir;
  if (target < 1 || target >= chars.length) return;
  if (moveItem(chars, ci, dir)) { renderTeamEditor(); mountPreview(); debouncedSave(); }
}
function setTeamCharName(ti, ci, v) {
  State.data.teamData[ti].chars[ci].name = v;
  updatePreviewField(ci === 0 ? 'charName' : `team.${ti}.char.${ci}.name`);
  debouncedSave();
}

function addAlt(ti, ci) {
  const alts = State.data.teamData[ti]?.chars?.[ci]?.alts;
  if (!alts) return;
  if (alts.length >= 4) return showToast('每位角色最多 4 个备选', 'error');
  alts.push({ name: '', img: '', imgManual: false });
  renderTeamEditor(); mountPreview(); debouncedSave();
}
function removeAlt(ti, ci, ai) {
  const alts = State.data.teamData[ti]?.chars?.[ci]?.alts;
  if (!alts) return;
  alts.splice(ai, 1);
  renderTeamEditor(); mountPreview(); debouncedSave();
}
function moveAlt(ti, ci, ai, dir) {
  const alts = State.data.teamData[ti]?.chars?.[ci]?.alts;
  if (alts && moveItem(alts, ai, dir)) { renderTeamEditor(); mountPreview(); debouncedSave(); }
}
function setAltName(ti, ci, ai, v) {
  State.data.teamData[ti].chars[ci].alts[ai].name = v;
  updatePreviewField(`team.${ti}.char.${ci}.alt.${ai}.name`);
  debouncedSave();
}
function setEmptyAltText(ti, ci, v) {
  State.data.teamData[ti].chars[ci].emptyAltText = v;
  mountPreview(); debouncedSave();
}
function setArtifactName1(i, v) { State.data.artifactData[i].name1 = v; mountPreview(); debouncedSave(); }
function setArtifactName2(i, v) { State.data.artifactData[i].name2 = v; mountPreview(); debouncedSave(); }
function setArtifactDisplayText(i, v) { State.data.artifactData[i].displayText = v; mountPreview(); debouncedSave(); }
function toggleConstellation(i) {
  if (!State.data.constellationData[i]) return;
  State.data.constellationData[i].active = !State.data.constellationData[i].active;
  renderConstellationEditor(); mountPreview(); debouncedSave();
}
function setConstellationDesc(i, value) {
  if (!State.data.constellationData[i]) return;
  State.data.constellationData[i].desc = value;
  mountPreview(); debouncedSave();
}
function setTheme(color) {
  State.data.theme = color;
  renderColorPicker(); mountPreview(); debouncedSave();
}
function setPanelPrimaryKey(key) {
  State.data.panel.primaryKey = PANEL_PRIMARY_KEYS.includes(key) ? key : 'hp';
  renderPanelPrimaryDropdown();
  mountPreview(); debouncedSave();
}
function setPanelField(key, value) {
  if (!State.data.panel) State.data.panel = normalizePanel(null);
  State.data.panel[key] = value;
  updatePreviewField(`panel.${key}`);
  debouncedSave();
}

/* =========================================================================
 * 【模块 12】App 导出接口与初始化
 * ========================================================================= */
const App = {
  selectTab, setField, setTheme, setPanelPrimaryKey, setPanelField,
  toggleCollapse, toggleConstellation, setConstellationDesc,
  addWeapon, removeWeapon, moveWeapon, setWeaponName,
  addArtifact, removeArtifact, moveArtifact, setArtifactName,
  addTeam, removeTeam, moveTeam, setTeamName, moveTeamChar, setTeamCharName,
  addAlt, removeAlt, moveAlt, setAltName, setEmptyAltText,
  renderWeaponEditor, renderArtifactEditor, renderTeamEditor,
  mountPreview, debouncedSave, triggerUpload, uploadImageHandler,
  updateThumb, updateImgXHint, clearImage, onThumbClick,
  exportPNG, exportConfig, importConfig, clearAllData,
  matchIconByType, matchArtifactDoubleIcon, setArtifactName1, setArtifactName2, setArtifactDisplayText,
  matchCharAvatar, matchStyleImages, loadSaveFromRepo,
  selectFont
};
window.App = App;

/* 按硬编码 id 注入图标（这些按钮的 HTML 里没有 data-icon） */
function injectFloatIcons() {
  const S = window.ICONS || { ui: {} };
  const icons = ['floatExportBtn', 'floatImportBtn', 'floatClearBtn', 'btnDelCharImg', 'btnDelNameBg', 'btnDelBg', 'btnDelTeamCore', 'btnAddTeamIcon', 'btnMatchStyleIcon', 'btnLoadSaveIcon'];
  icons.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id.includes('Export')) el.innerHTML = S.ui.export;
    if (id.includes('Import') || id.includes('LoadSave')) el.innerHTML = S.ui.import;
    if (id.includes('Clear') || id.includes('Del')) el.innerHTML = S.ui.trash;
    if (id.includes('AddTeam') || id.includes('MatchStyle')) el.innerHTML = S.ui.plus;
  });
}

/* 按 data-icon 属性注入图标（面板下拉箭头、字体下拉箭头、字体按钮图标） */
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

function bindPreviewTapToggle() {
  const frame = document.getElementById('previewFrame');
  const toolbar = document.getElementById('floatToolbar');
  if (!frame || !toolbar) return;
  frame.addEventListener('click', () => toolbar.classList.toggle('hidden'));
}

/* 全局点击委托：字体 / 面板属性类型 */
document.addEventListener('click', (e) => {
  const fontItem = e.target.closest('#fontSheetList .dropdown-item');
  if (fontItem && fontItem.dataset.fontIndex !== undefined) {
    selectFont(Number(fontItem.dataset.fontIndex));
    return;
  }
  const panelItem = e.target.closest('#panelPrimaryKeyPanel .dropdown-item');
  if (panelItem) {
    setPanelPrimaryKey(panelItem.dataset.value);
  }
});

(async function init() {
  try { await window.__bootPromise; } catch (e) { console.warn(e); }

  injectFloatIcons();
  injectIcons();
  tightenAllIconViewBoxes();

  const saved = await loadStateFromIDB();
  State.data = normalizeState(saved || {});

  await loadCharOrderTxt();
  await loadNamecards();
  await loadArtDict();
  await loadFontList();

  try { await installPreviewFont(); } catch(e) {}

  initThumbnails();
  syncInputs();
  renderEditorsByKey();
  renderTabBar();
  renderFontDropdown();
  mountPreview();
  selectTab(currentTab);
  bindPreviewTapToggle();

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

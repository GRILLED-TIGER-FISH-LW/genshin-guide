/* =========================================================================
 * 原神一图流生成器 · app.js
 * =========================================================================
 * 模块导航（搜索 "【JS 模块 N】" 快速跳转）：
 *   【JS 模块 1】  Toast 提示 + Confirm 弹窗
 *   【JS 模块 2】  预览挂载 + 字段增量更新
 *   【JS 模块 3】  横向 Tab 栏
 *   【JS 模块 4】  UI 编辑器渲染
 *   【JS 模块 5】  图片上传
 *   【JS 模块 6】  字体库（含 IndexedDB 缓存）
 *   【JS 模块 7】  数据字典读取 + 角色名校验
 *   【JS 模块 8】  样式图匹配 + 在线存档
 *   【JS 模块 9】  图标库匹配
 *   【JS 模块 10】 数据归一化
 *   【JS 模块 11】 导出 / 导入 / 清空
 *   【JS 模块 12】 UI 交互（字段 / 增删改 / 移动）
 *   【JS 模块 13】 App 接口
 *   【JS 模块 14】 初始化
 * =========================================================================
 * 依赖：
 *   consts.js —— 常量 / LAYOUT / State / 工具函数 / IndexedDB
 *   svg.js    —— SVG 绘制 / 排版 / buildSVG / tightenAllIconViewBoxes
 *   shared/ui-icons.js / shared/gi-icons/*.js
 * ========================================================================= */

/* =========================================================================
 * 【JS 模块 1】Toast 与 Confirm
 * ========================================================================= */
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

/* =========================================================================
 * 【JS 模块 2】预览挂载与字段增量更新
 * ========================================================================= */
let previewSvgEl = null;
const previewIndex = new Map();
let renderTimer = null;

function mountPreview() {
  const host = document.getElementById('svgPreviewHost');
  if (!host) return;
  host.innerHTML = buildSVG(1);
  previewSvgEl = host.querySelector('svg');
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
  const newX = leftX + (leftW - charDrawW) / 2 + imgX;
  el.setAttribute('x', newX);
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
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => { syncInputs(); mountPreview(); debouncedSave(); }, 40);
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
  const panelMap = {
    panelPrimaryKey: p.primaryKey || 'hp',
    panelPrimaryValue: p.primaryValue || '',
    panelCr: p.cr || '', panelCd: p.cd || '', panelEm: p.em || '', panelEr: p.er || ''
  };
  Object.keys(panelMap).forEach(id => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = panelMap[id];
  });
  document.documentElement.style.setProperty('--accent', State.data.theme);
  document.documentElement.style.setProperty('--accent-dark', darken(State.data.theme, 50));
}

/* =========================================================================
 * 【JS 模块 3】横向 Tab 栏
 * ========================================================================= */
function renderTabBar() {
  const el = document.getElementById('tabBar');
  if (!el) return;
  el.innerHTML = TAB_DEFS.map(t =>
    `<button type="button" class="tab-btn ${t.key === currentTab ? 'active' : ''}" data-tab="${t.key}" onclick="App.selectTab('${t.key}')">${t.label}</button>`
  ).join('');
}
function scrollTabIntoView(btn) {
  const bar = document.getElementById('tabBar');
  if (!bar || !btn) return;
  const barRect = bar.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  if (btnRect.left < barRect.left) {
    bar.scrollLeft -= (barRect.left - btnRect.left) + 16;
  } else if (btnRect.right > barRect.right) {
    bar.scrollLeft += (btnRect.right - barRect.right) + 16;
  }
}
function selectTab(tabId) {
  if (!TAB_DEFS.find(t => t.key === tabId)) return;
  currentTab = tabId;
  document.querySelectorAll('.tabs-content .tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`tab-${tabId}`);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  const tc = document.querySelector('.tabs-content');
  if (tc) tc.scrollTop = 0;
  const activeBtn = document.querySelector('.tab-btn.active');
  scrollTabIntoView(activeBtn);
}

/* =========================================================================
 * 【JS 模块 4】UI 编辑器渲染
 * ========================================================================= */
const collapseState = {};

function toggleCollapse(key) {
  collapseState[key] = !collapseState[key];
  const collapsed = collapseState[key];
  document.querySelectorAll('.collapse-toggle[data-collapse-key="' + key + '"]').forEach(btn => {
    btn.classList.toggle('collapsed', collapsed);
    const txt = btn.querySelector('.collapse-text');
    if (txt) txt.textContent = collapsed ? '展开' : '收起';
  });
  document.querySelectorAll('[data-collapse-content="' + key + '"]').forEach(el => {
    el.style.display = collapsed ? 'none' : '';
  });
}
function isCollapsed(key) { return !!collapseState[key]; }

function renderColorPicker() {
  const el = document.getElementById('colorPicker');
  if (!el) return;
  el.innerHTML = elementColors.map(([name, color, iconKey]) => {
    const isMatch = (State.data.theme || '').toLowerCase() === color.toLowerCase();
    const icon = ELEMENT_ICONS[iconKey] || '';
    return `<div class="swatch-btn ${isMatch ? 'active' : ''}" onclick="App.setTheme('${color}')" style="color:${color};">
      <span style="display:inline-flex;width:1em;height:1em;">${icon}</span>
      <span style="color:var(--text-secondary);">${name}</span>
    </div>`;
  }).join('');
}
function setTheme(color) {
  State.data.theme = color;
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-dark', darken(color, 50));
  renderColorPicker();
  mountPreview();
  debouncedSave();
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
      <div class="item-card">
        <div class="item-header">
          <span style="font-size:12px;color:var(--text-secondary);font-weight:600;">#${i + 1} ${WEAPON_LABELS[type]}武器</span>
          <div class="item-actions">
            <button class="btn-xs" onclick="App.moveWeapon('${type}',${i},-1)" ${upDisabled ? 'disabled' : ''}>${ICONS.up}上移</button>
            <button class="btn-xs" onclick="App.moveWeapon('${type}',${i},1)" ${downDisabled ? 'disabled' : ''}>${ICONS.down}下移</button>
            <button class="btn-xs btn-danger" onclick="App.removeWeapon('${type}',${i})">${ICONS.trash}删除</button>
          </div>
        </div>
        <div class="item-row">
          <img src="${w.img || placeholder('')}" class="clickable-thumb" data-img-target="${targetId}" onclick="App.triggerUpload('${targetId}')" alt="" />
          <input type="text" value="${esc(w.name)}" oninput="App.setWeaponName('${type}',${i},this.value)" onblur="App.matchWeaponIcon('${type}',${i},this.value)" style="flex:1;" />
          <input type="file" id="${targetId}" accept="image/*" style="display:none" onchange="App.uploadImageHandler(this, v => { State.data.weaponData['${type}'][${i}].img = v; State.data.weaponData['${type}'][${i}].imgManual = true; App.renderWeaponEditor(); App.mountPreview(); App.debouncedSave(); })" />
        </div>
      </div>`;
    }).join('');
    return `<div class="ios-group" style="padding:10px;">
      <div style="display:flex;align-items:center;margin-bottom:${collapsed ? '0' : '8px'};flex-wrap:wrap;gap:6px;">
        <span style="font-size:13px;font-weight:600;color:var(--accent);">${WEAPON_LABELS[type]}武器 (${group.length}/${WEAPON_MAX})</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;margin-left:auto;">
          <button class="ios-btn-fill btn-xs" onclick="App.addWeapon('${type}')">${ICONS.plus}添加</button>
          <button class="btn-xs collapse-toggle ${collapsed ? 'collapsed' : ''}" data-collapse-key="${key}" onclick="App.toggleCollapse('${key}')">
            <span class="collapse-icon">${ICONS.chevron}</span><span class="collapse-text">${collapsed ? '展开' : '收起'}</span>
          </button>
        </div>
      </div>
      <div data-collapse-content="${key}" style="display:${collapsed ? 'none' : 'flex'};flex-direction:column;gap:6px;">
        ${list || '<div style="font-size:12px;color:var(--text-tertiary);padding:4px 0;">暂无配置</div>'}
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
      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end; margin-left:auto;">
        <button class="ios-btn-fill btn-xs" onclick="App.addArtifact('single')">${ICONS.plus}整套</button>
        <button class="ios-btn-fill btn-xs" onclick="App.addArtifact('double')">${ICONS.plus}散搭</button>
        <button class="btn-xs collapse-toggle ${isSectionCollapsed ? 'collapsed' : ''}" data-collapse-key="${sectionKey}" onclick="App.toggleCollapse('${sectionKey}')">
          <span class="collapse-icon">${ICONS.chevron}</span><span class="collapse-text">${isSectionCollapsed ? '展开' : '收起'}</span>
        </button>
      </div>`;
  }
  const editorEl = document.getElementById('artifactEditor');
  if (!editorEl) return;
  editorEl.style.display = isSectionCollapsed ? 'none' : 'flex';
  editorEl.innerHTML = State.data.artifactData.map((a, i) => {
    if (a.type === 'double') {
      const t1 = `a_img1_${i}`, t2 = `a_img2_${i}`;
      return `<div class="item-card">
        <div class="item-header">
          <span style="font-size:12px;color:var(--accent);font-weight:600;">散搭 #${i + 1}</span>
          <div class="item-actions">
            <button class="btn-xs" onclick="App.moveArtifact(${i},-1)" ${i === 0 ? 'disabled' : ''}>${ICONS.up}上移</button>
            <button class="btn-xs" onclick="App.moveArtifact(${i},1)" ${i === State.data.artifactData.length - 1 ? 'disabled' : ''}>${ICONS.down}下移</button>
            <button class="btn-xs btn-danger" onclick="App.removeArtifact(${i})">${ICONS.trash}删除</button>
          </div>
        </div>
        <input type="text" value="${esc(a.displayText)}" placeholder="卡片显示文本（可选，留空显示两个名字）" oninput="App.setArtifactDisplayText(${i},this.value)" />
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;display:flex;align-items:center;gap:8px;min-width:140px;">
            <img src="${a.img1 || placeholder('')}" class="clickable-thumb" data-img-target="${t1}" onclick="App.triggerUpload('${t1}')" alt="" />
            <input type="text" value="${esc(a.name1)}" placeholder="圣遗物1" oninput="App.setArtifactName1(${i},this.value)" onblur="App.matchArtifactDoubleIcon(${i},1,this.value)" style="flex:1;min-width:0;" />
            <input type="file" id="${t1}" accept="image/*" style="display:none" onchange="App.uploadImageHandler(this, v => { State.data.artifactData[${i}].img1 = v; State.data.artifactData[${i}].img1Manual = true; App.renderArtifactEditor(); App.mountPreview(); App.debouncedSave(); })" />
          </div>
          <div style="flex:1;display:flex;align-items:center;gap:8px;min-width:140px;">
            <img src="${a.img2 || placeholder('')}" class="clickable-thumb" data-img-target="${t2}" onclick="App.triggerUpload('${t2}')" alt="" />
            <input type="text" value="${esc(a.name2)}" placeholder="圣遗物2" oninput="App.setArtifactName2(${i},this.value)" onblur="App.matchArtifactDoubleIcon(${i},2,this.value)" style="flex:1;min-width:0;" />
            <input type="file" id="${t2}" accept="image/*" style="display:none" onchange="App.uploadImageHandler(this, v => { State.data.artifactData[${i}].img2 = v; State.data.artifactData[${i}].img2Manual = true; App.renderArtifactEditor(); App.mountPreview(); App.debouncedSave(); })" />
          </div>
        </div>
      </div>`;
    }
    const targetId = `a_img_${i}`;
    return `<div class="item-card">
      <div class="item-header">
        <span style="font-size:12px;color:var(--text-primary);font-weight:600;">整套 #${i + 1}</span>
        <div class="item-actions">
          <button class="btn-xs" onclick="App.moveArtifact(${i},-1)" ${i === 0 ? 'disabled' : ''}>${ICONS.up}上移</button>
          <button class="btn-xs" onclick="App.moveArtifact(${i},1)" ${i === State.data.artifactData.length - 1 ? 'disabled' : ''}>${ICONS.down}下移</button>
          <button class="btn-xs btn-danger" onclick="App.removeArtifact(${i})">${ICONS.trash}删除</button>
        </div>
      </div>
      <div class="item-row">
        <img src="${a.img || placeholder('')}" class="clickable-thumb" data-img-target="${targetId}" onclick="App.triggerUpload('${targetId}')" alt="" />
        <input type="text" value="${esc(a.name)}" oninput="App.setArtifactName(${i},this.value)" onblur="App.matchArtifactIcon(${i},this.value)" style="flex:1;" />
        <input type="file" id="${targetId}" accept="image/*" style="display:none" onchange="App.uploadImageHandler(this, v => { State.data.artifactData[${i}].img = v; State.data.artifactData[${i}].imgManual = true; App.renderArtifactEditor(); App.mountPreview(); App.debouncedSave(); })" />
      </div>
    </div>`;
  }).join('') || '<div style="font-size:12px;color:var(--text-tertiary);padding:4px 0;">暂无圣遗物</div>';
}
function renderTeamEditor() {
  const el = document.getElementById('teamEditor');
  if (!el) return;
  el.innerHTML = State.data.teamData.map((team, ti) => {
    const teamKey = `team_${ti}`;
    const teamCollapsed = isCollapsed(teamKey);
    return `<div class="ios-group" style="padding:10px;">
      <div class="item-header" style="margin-bottom:${teamCollapsed ? '0' : '8px'};">
        <span style="font-size:13px;color:var(--accent);font-weight:600;">队伍 ${ti + 1}</span>
        <div class="item-actions">
          <button class="btn-xs" onclick="App.moveTeam(${ti},-1)" ${ti === 0 ? 'disabled' : ''}>${ICONS.up}上移</button>
          <button class="btn-xs" onclick="App.moveTeam(${ti},1)" ${ti === State.data.teamData.length - 1 ? 'disabled' : ''}>${ICONS.down}下移</button>
          <button class="btn-xs collapse-toggle ${teamCollapsed ? 'collapsed' : ''}" data-collapse-key="${teamKey}" onclick="App.toggleCollapse('${teamKey}')">
            <span class="collapse-icon">${ICONS.chevron}</span><span class="collapse-text">${teamCollapsed ? '展开' : '收起'}</span>
          </button>
          <button class="btn-xs btn-danger" onclick="App.removeTeam(${ti})">${ICONS.trash}删除</button>
        </div>
      </div>
      <div data-collapse-content="${teamKey}" style="display:${teamCollapsed ? 'none' : 'block'};">
        <input type="text" value="${esc(team.name)}" oninput="App.setTeamName(${ti},this.value)" />
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
          ${team.chars.slice(1, 4).map((c, idx) => {
            const ci = idx + 1;
            const charKey = `team_${ti}_char_${ci}`;
            const charCollapsed = isCollapsed(charKey);
            const targetId = `t_${ti}_${ci}_img`;
            return `<div class="item-card">
              <div class="item-header">
                <span style="font-size:12px;color:var(--accent);font-weight:600;">${ci + 1}号位主角色</span>
                <div class="item-actions">
                  <button class="btn-xs" onclick="App.moveTeamChar(${ti},${ci},-1)" ${ci === 1 ? 'disabled' : ''}>${ICONS.up}上移</button>
                  <button class="btn-xs" onclick="App.moveTeamChar(${ti},${ci},1)" ${ci === 3 ? 'disabled' : ''}>${ICONS.down}下移</button>
                  <button class="btn-xs collapse-toggle ${charCollapsed ? 'collapsed' : ''}" data-collapse-key="${charKey}" onclick="App.toggleCollapse('${charKey}')">
                    <span class="collapse-icon">${ICONS.chevron}</span><span class="collapse-text">${charCollapsed ? '展开' : '收起'}</span>
                  </button>
                </div>
              </div>
              <div data-collapse-content="${charKey}" style="display:${charCollapsed ? 'none' : 'block'};">
                <div class="item-row">
                  <img src="${c.img || placeholder('')}" class="clickable-thumb" data-img-target="${targetId}" onclick="App.triggerUpload('${targetId}')" alt="" />
                  <input type="text" value="${esc(c.name)}" oninput="App.setTeamCharName(${ti},${ci},this.value)" onblur="App.matchTeamCharIcon(${ti},${ci},this.value)" style="flex:1;" />
                  <input type="file" id="${targetId}" accept="image/*" style="display:none" onchange="App.uploadImageHandler(this, v => { State.data.teamData[${ti}].chars[${ci}].img = v; State.data.teamData[${ti}].chars[${ci}].imgManual = true; App.renderTeamEditor(); App.mountPreview(); App.debouncedSave(); })" />
                </div>
                <div style="margin-left:8px;padding-left:8px;border-left:2px solid var(--border-subtle);display:flex;flex-direction:column;gap:6px;margin-top:4px;">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-size:11px;color:var(--text-secondary);font-weight:600;">备选角色 (${c.alts.length}/4)</span>
                    <button class="ios-btn-fill btn-xs" style="margin-left:auto;" onclick="App.addAlt(${ti},${ci})">${ICONS.plus}添加</button>
                  </div>
                  ${c.alts.map((a, ai) => {
                    const altTargetId = `t_${ti}_${ci}_${ai}_img`;
                    return `
                    <div class="item-card" style="background:var(--bg-surface);padding:8px;">
                      <div class="item-header">
                        <span style="font-size:11px;color:var(--text-secondary);">备选 #${ai + 1}</span>
                        <div class="item-actions">
                          <button class="btn-xs" onclick="App.moveAlt(${ti},${ci},${ai},-1)" ${ai === 0 ? 'disabled' : ''}>${ICONS.up}上移</button>
                          <button class="btn-xs" onclick="App.moveAlt(${ti},${ci},${ai},1)" ${ai === c.alts.length - 1 ? 'disabled' : ''}>${ICONS.down}下移</button>
                          <button class="btn-xs btn-danger" onclick="App.removeAlt(${ti},${ci},${ai})">${ICONS.trash}删除</button>
                        </div>
                      </div>
                      <div class="item-row">
                        <img src="${a.img || placeholder('')}" class="clickable-thumb" data-img-target="${altTargetId}" onclick="App.triggerUpload('${altTargetId}')" alt="" />
                        <input type="text" value="${esc(a.name)}" oninput="App.setAltName(${ti},${ci},${ai},this.value)" onblur="App.matchAltIcon(${ti},${ci},${ai},this.value)" style="flex:1;" />
                        <input type="file" id="${altTargetId}" accept="image/*" style="display:none" onchange="App.uploadImageHandler(this, v => { State.data.teamData[${ti}].chars[${ci}].alts[${ai}].img = v; State.data.teamData[${ti}].chars[${ci}].alts[${ai}].imgManual = true; App.renderTeamEditor(); App.mountPreview(); App.debouncedSave(); })" />
                      </div>
                    </div>`;
                  }).join('')}
                  ${!c.alts.length ? `<input type="text" value="${esc(c.emptyAltText || '暂无备选')}" oninput="App.setEmptyAltText(${ti},${ci},this.value)" />` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }).join('') || '<div style="font-size:12px;color:var(--text-tertiary);padding:4px 0;">暂未添加配队</div>';
}
function renderEditorsByKey() {
  renderColorPicker();
  renderWeaponEditor();
  renderArtifactEditor();
  renderConstellationEditor();
  renderTeamEditor();
}
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

/* =========================================================================
 * 【JS 模块 5】图片上传
 * ========================================================================= */
const IMAGE_WARN_SIZE = 15 * 1024 * 1024;
function triggerUpload(id) { document.getElementById(id)?.click(); }
function uploadImageHandler(input, setter) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > IMAGE_WARN_SIZE) {
    showConfirm('图片较大', `该图片 ${formatBytes(file.size)}，可能影响保存速度。是否继续？`).then(ok => {
      if (ok) doUpload(input, setter);
      else input.value = '';
    });
  } else {
    doUpload(input, setter);
  }
}
function doUpload(input, setter) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => { setter(e.target.result, img.width, img.height); mountPreview(); debouncedSave(); };
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
 * 【JS 模块 6】字体库（含 IndexedDB 缓存）
 * ========================================================================= */
let FONT_LIST = [];
let fontSheetOpen = false;
let loadedFontFace = null;

const FONT_CACHE_PREFIX = 'font_cache::';

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
        if (String(cursor.key).indexOf(FONT_CACHE_PREFIX) === 0) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (e) {}
}

async function loadFontList() {
  try {
    const res = await fetch('../../shared/fonts/fonts.json?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    FONT_LIST = Array.isArray(json.fonts) ? json.fonts : [];
  } catch (e) {
    FONT_LIST = [];
    console.warn('字体清单加载失败：', e.message);
  }
}

function renderFontSheetList() {
  const el = document.getElementById('fontSheetList');
  if (!el) return;
  const currentFile = State.data.fontFileName || '';
  let html = '<button type="button" class="tab-sheet-item ' + (currentFile === '' ? 'active' : '') + '" onclick="App.selectFont(-1)">' +
    '<span>默认系统字体</span>' +
    '<svg class="tab-sheet-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
  '</button>';
  if (!FONT_LIST.length) {
    html += '<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:13px;">字体库为空</div>';
  } else {
    html += FONT_LIST.map((f, i) => {
      const isActive = currentFile === f.file;
      return '<button type="button" class="tab-sheet-item ' + (isActive ? 'active' : '') + '" onclick="App.selectFont(' + i + ')">' +
        '<span>' + esc(f.name) + '</span>' +
        '<svg class="tab-sheet-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
      '</button>';
    }).join('');
  }
  el.innerHTML = html;
}

function openFontPicker() {
  if (fontSheetOpen) return;
  fontSheetOpen = true;
  renderFontSheetList();
  document.getElementById('fontSheetBackdrop').classList.add('show');
  document.getElementById('fontSheet').classList.add('show');
}
function closeFontPicker() {
  if (!fontSheetOpen) return;
  fontSheetOpen = false;
  document.getElementById('fontSheetBackdrop').classList.remove('show');
  document.getElementById('fontSheet').classList.remove('show');
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
      for (let i = 0; i < raw.length; i++) {
        buffer[i] = raw.charCodeAt(i);
      }
    }
    const ff = new FontFace('CardCustomFont', buffer);
    const loaded = await ff.load();
    document.fonts.add(loaded);
    loadedFontFace = loaded;
    return true;
  } catch (e) {
    console.error('字体解析异常：', e);
    return false;
  }
}

async function applyFontData(fileName, fontName, dataURL) {
  State.data.fontData = dataURL;
  State.data.fontFileName = fileName;
  State.data.fontName = fontName;
  await installPreviewFont();
  const labelEl = document.getElementById('labelCustomFont');
  if (labelEl) labelEl.textContent = '当前：' + fontName;
  mountPreview();
  debouncedSave();
}

async function selectFont(index) {
  closeFontPicker();
  const labelEl = document.getElementById('labelCustomFont');

  if (index === -1) {
    State.data.fontData = ''; State.data.fontFileName = ''; State.data.fontName = '';
    if (loadedFontFace) { try { document.fonts.delete(loadedFontFace); } catch (e) {} loadedFontFace = null; }
    if (labelEl) labelEl.textContent = '默认标准字体';
    mountPreview(); debouncedSave();
    return;
  }

  const f = FONT_LIST[index];
  if (!f) return;

  if (State.data.fontFileName === f.file && State.data.fontData) {
    if (labelEl) labelEl.textContent = '当前：' + f.name;
    return;
  }

  if (labelEl) labelEl.textContent = `[1/3] 正在检查本地缓存...`;
  const cached = await getFontFromCache(f.file);
  if (cached) {
    if (labelEl) labelEl.textContent = `[2/3] 命中缓存，正在注入字体...`;
    await applyFontData(f.file, f.name, cached);
    return;
  }

  try {
    if (labelEl) labelEl.textContent = `[1/3] 正在下载二进制流...`;
    let res;
    try {
      res = await fetch('../../shared/fonts/' + encodeURIComponent(f.file));
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
      const ff = new FontFace('CardCustomFont', buf);
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
    mountPreview(); debouncedSave();

  } catch (err) {
    console.error(`[字体加载失败] ${f.name}:`, err);
    if (labelEl) labelEl.textContent = `异常卡住: ${err.message}`;
    showToast(`字体 [${f.name}] 加载失败: ${err.message}`, 'error');

    State.data.fontData = '';
    State.data.fontFileName = '';
    State.data.fontName = '';
    debouncedSave();
  }
}

/* =========================================================================
 * 【JS 模块 7】数据字典读取 + 角色名校验
 * ========================================================================= */
async function loadCharOrderTxt() {
  try {
    const res = await fetch('../../shared/data/characters.txt?t=' + Date.now());
    if (!res.ok) { console.warn('characters.txt HTTP ' + res.status); return; }
    const text = await res.text();
    CHAR_NAME_TO_ORDER = {};
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const parts = line.split(/[\s,，\t]+/);
      if (parts.length < 2) return;
      const order = parseInt(parts[0], 10);
      const name = parts.slice(1).join(' ').trim();
      if (!order || !name) return;
      CHAR_NAME_TO_ORDER[name] = order;
    });
    console.log('characters.txt 加载成功，共 ' + Object.keys(CHAR_NAME_TO_ORDER).length + ' 条');
  } catch (e) {
    console.warn('characters.txt 加载失败：', e.message);
  }
}

function isValidCharName(name) {
  var t = String(name || '').trim();
  if (!t) return false;
  return !!CHAR_NAME_TO_ORDER[t];
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

async function loadNamecards() {
  try {
    const res = await fetch('../../shared/data/namecards.txt?t=' + Date.now());
    if (!res.ok) { console.warn('namecards.txt HTTP ' + res.status); return; }
    const text = await res.text();
    NAMECARD_DICT = {};
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const m = line.match(/^(\d+)\s+(\S+)\s+(https?:\/\/\S+)$/);
      if (!m) return;
      NAMECARD_DICT[m[2]] = m[3];
    });
    console.log('namecards.txt 加载成功，共 ' + Object.keys(NAMECARD_DICT).length + ' 条');
  } catch (e) {
    console.warn('namecards.txt 加载失败：', e.message);
  }
}

async function loadArtDict() {
  try {
    const res = await fetch('../../shared/data/character-art.txt?t=' + Date.now());
    if (!res.ok) { console.warn('character-art.txt HTTP ' + res.status); return; }
    const text = await res.text();
    ART_DICT = {};
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const m = line.match(/^(\d+)\s+(\S+)\s*(.*)$/);
      if (!m) return;
      const name = m[2];
      const url = (m[3] || '').trim();
      ART_DICT[name] = url;
    });
    console.log('character-art.txt 加载成功，共 ' + Object.keys(ART_DICT).length + ' 条');
  } catch (e) {
    console.warn('character-art.txt 加载失败：', e.message);
  }
}

/* =========================================================================
 * 【JS 模块 8】样式图匹配 + 在线存档
 * ========================================================================= */
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

  var tasks = [];

  if (!onlyEmpty || !State.data.charImg) {
    tasks.push(async function () {
      if (!nameValid) {
        State.data.charImg = '';
        State.data.charImgMeta = null;
        State.data.charImgManual = false;
        resetThumb('thumbCharImg', 'labelCharImg', '点击上传立绘');
        results.standingError = '角色清单无此名字';
        return;
      }
      const artKeyWithEle = elementName ? name + '·' + elementName : '';
      let artUrl = '';
      if (artKeyWithEle && ART_DICT[artKeyWithEle] !== undefined && ART_DICT[artKeyWithEle] !== '') {
        artUrl = ART_DICT[artKeyWithEle];
      } else if (ART_DICT[name] !== undefined && ART_DICT[name] !== '') {
        artUrl = ART_DICT[name];
      }
      if (artUrl) {
        const meta = await loadImageMeta(artUrl);
        if (meta) {
          State.data.charImg = artUrl;
          State.data.charImgMeta = meta;
          State.data.charImgManual = false;
          updateThumb('thumbCharImg', 'labelCharImg', artUrl, '已匹配立绘');
          results.standing = true;
        } else {
          State.data.charImg = '';
          State.data.charImgMeta = null;
          State.data.charImgManual = false;
          resetThumb('thumbCharImg', 'labelCharImg', '点击上传立绘');
          results.standingError = '链接加载失败';
        }
      } else {
        State.data.charImg = '';
        State.data.charImgMeta = null;
        State.data.charImgManual = false;
        resetThumb('thumbCharImg', 'labelCharImg', '点击上传立绘');
        if (ART_DICT[name] === undefined && ART_DICT[artKeyWithEle] === undefined) {
          results.standingError = '字典无此角色';
        } else {
          results.standingError = '暂无立绘链接';
        }
      }
    });
  }

  if (!onlyEmpty || !State.data.nameBgImg) {
    tasks.push(async function () {
      let elementUrl = '';
      if (elementName) {
        const ghUrl = '../../shared/assets/characters/element/' + elementName + '.png';
        if (await urlExists(ghUrl)) elementUrl = ghUrl;
      }
      if (elementUrl) {
        State.data.nameBgImg = elementUrl;
        State.data.nameBgImgMeta = null;
        State.data.nameBgImgManual = false;
        updateThumb('thumbNameBg', 'labelNameBg', elementUrl, '已匹配元素图：' + elementName);
        results.element = true;
      } else {
        State.data.nameBgImg = '';
        State.data.nameBgImgManual = false;
        resetThumb('thumbNameBg', 'labelNameBg', '点击上传元素图');
      }
    });
  }

  if (!onlyEmpty || !State.data.bgImg) {
    tasks.push(async function () {
      if (!nameValid) {
        State.data.bgImg = '';
        State.data.bgImgManual = false;
        resetThumb('thumbBg', 'labelBg', '默认暗黑原力色');
        return;
      }
      const namecardUrl = NAMECARD_DICT[name] || '';
      if (namecardUrl) {
        State.data.bgImg = namecardUrl;
        State.data.bgImgManual = false;
        updateThumb('thumbBg', 'labelBg', namecardUrl, '已匹配名片图');
        results.namecard = true;
      } else {
        State.data.bgImg = '';
        State.data.bgImgManual = false;
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
    updateImgXHint();
    mountPreview(); debouncedSave();
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
 * 【JS 模块 9】图标库匹配
 * ========================================================================= */
function updateImgTarget(targetId, src) {
  const el = document.querySelector('[data-img-target="' + targetId + '"]');
  if (el) el.src = src || placeholder('');
}

async function matchWeaponIcon(type, i, name) {
  if (!window.ICON_LIB) return;
  const trimmed = (name || '').trim();
  const targetId = `w_img_${type}_${i}`;
  const cell = State.data.weaponData[type] && State.data.weaponData[type][i];
  if (!cell) return;

  if (!trimmed) {
    cell.img = '';
    cell.imgManual = false;
    updateImgTarget(targetId, '');
    mountPreview(); debouncedSave();
    return;
  }
  try {
    const r = await ICON_LIB.fromName('weapons', trimmed);
    cell.img = (r && r.dataURL) ? r.dataURL : '';
    cell.imgManual = false;
  } catch (e) {
    cell.img = '';
    cell.imgManual = false;
  }
  updateImgTarget(targetId, cell.img);
  mountPreview(); debouncedSave();
}

async function matchArtifactIcon(i, name) {
  if (!window.ICON_LIB) return;
  const trimmed = (name || '').trim();
  const targetId = `a_img_${i}`;
  const cell = State.data.artifactData[i];
  if (!cell) return;

  if (!trimmed) {
    cell.img = '';
    cell.imgManual = false;
    updateImgTarget(targetId, '');
    mountPreview(); debouncedSave();
    return;
  }
  try {
    const r = await ICON_LIB.fromName('artifacts', trimmed);
    cell.img = (r && r.dataURL) ? r.dataURL : '';
    cell.imgManual = false;
  } catch (e) {
    cell.img = '';
    cell.imgManual = false;
  }
  updateImgTarget(targetId, cell.img);
  mountPreview(); debouncedSave();
}

async function matchArtifactDoubleIcon(i, part, name) {
  if (!window.ICON_LIB) return;
  const trimmed = (name || '').trim();
  const imgKey = part === 1 ? 'img1' : 'img2';
  const manualKey = part === 1 ? 'img1Manual' : 'img2Manual';
  const targetId = part === 1 ? `a_img1_${i}` : `a_img2_${i}`;
  const cell = State.data.artifactData[i];
  if (!cell) return;

  if (!trimmed) {
    cell[imgKey] = '';
    cell[manualKey] = false;
    updateImgTarget(targetId, '');
    mountPreview(); debouncedSave();
    return;
  }
  try {
    const r = await ICON_LIB.fromName('artifacts', trimmed);
    cell[imgKey] = (r && r.dataURL) ? r.dataURL : '';
  } catch (e) { cell[imgKey] = ''; }
  cell[manualKey] = false;
  updateImgTarget(targetId, cell[imgKey]);
  mountPreview(); debouncedSave();
}

function setArtifactName1(i, v) { State.data.artifactData[i].name1 = v; mountPreview(); debouncedSave(); }
function setArtifactName2(i, v) { State.data.artifactData[i].name2 = v; mountPreview(); debouncedSave(); }
function setArtifactDisplayText(i, v) { State.data.artifactData[i].displayText = v; mountPreview(); debouncedSave(); }

async function matchTeamCharIcon(ti, ci, name) {
  if (!window.ICON_LIB) return;
  const targetId = `t_${ti}_${ci}_img`;
  const cell = State.data.teamData[ti]?.chars?.[ci];
  if (!cell) return;

  const matchedName = resolveCharName(name);
  if (!matchedName) {
    cell.img = '';
    cell.imgManual = false;
    updateImgTarget(targetId, '');
    mountPreview(); debouncedSave();
    return;
  }
  try {
    const r = await ICON_LIB.fromName('characters', matchedName);
    cell.img = (r && r.dataURL) ? r.dataURL : '';
    cell.imgManual = false;
  } catch (e) {
    cell.img = '';
    cell.imgManual = false;
  }
  updateImgTarget(targetId, cell.img);
  mountPreview(); debouncedSave();
}

async function matchAltIcon(ti, ci, ai, name) {
  if (!window.ICON_LIB) return;
  const alt = State.data.teamData[ti]?.chars?.[ci]?.alts?.[ai];
  if (!alt) return;
  const targetId = `t_${ti}_${ci}_${ai}_img`;

  const matchedName = resolveCharName(name);
  if (!matchedName) {
    alt.img = '';
    alt.imgManual = false;
    updateImgTarget(targetId, '');
    mountPreview(); debouncedSave();
    return;
  }
  try {
    const r = await ICON_LIB.fromName('characters', matchedName);
    alt.img = (r && r.dataURL) ? r.dataURL : '';
    alt.imgManual = false;
  } catch (e) {
    alt.img = '';
    alt.imgManual = false;
  }
  updateImgTarget(targetId, alt.img);
  mountPreview(); debouncedSave();
}

async function matchCharAvatar(name) {
  if (!window.ICON_LIB) return;
  var trimmed = (name || '').trim();
  if (!trimmed || !isValidCharName(trimmed)) {
    State.data.teamCoreImg = '';
    State.data.teamCoreImgManual = false;
    resetThumb('thumbTeamCore', 'labelTeamCore', '主角色一号位头像（点击更换）');
    mountPreview(); debouncedSave(); return;
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

/* =========================================================================
 * 【JS 模块 10】数据归一化
 * ========================================================================= */
function normalizeWeaponList(list) {
  return Array.isArray(list) ? list.map(w => ({
    name: String(w?.name ?? ''),
    img: String(w?.img ?? ''),
    imgManual: !!w?.imgManual
  })) : [];
}
function normalizeArtifactList(list) {
  return Array.isArray(list) ? list.map(a => {
    if (a?.type === 'double') {
      return {
        type: 'double',
        name1: String(a?.name1 ?? a?.name ?? ''),
        name2: String(a?.name2 ?? ''),
        displayText: String(a?.displayText ?? ''),
        img1: String(a?.img1 ?? ''), img1Manual: !!a?.img1Manual,
        img2: String(a?.img2 ?? ''), img2Manual: !!a?.img2Manual
      };
    }
    return { type: 'single', name: String(a?.name ?? ''), img: String(a?.img ?? ''), imgManual: !!a?.imgManual };
  }) : [];
}
function normalizeAlts(list) {
  return Array.isArray(list) ? list.map(a => ({
    name: String(a?.name ?? ''),
    img: String(a?.img ?? ''),
    imgManual: !!a?.imgManual
  })) : [];
}
function normalizeTeamChars(chars) {
  return Array.from({ length: 4 }, (_, i) => {
    const c = chars?.[i] || {};
    return {
      name: String(c.name ?? ''), img: String(c.img ?? ''), imgManual: !!c.imgManual,
      emptyAltText: String(c.emptyAltText ?? '暂无备选'),
      alts: normalizeAlts(c.alts)
    };
  });
}
function normalizePanel(p) {
  const src = p || {};
  return {
    primaryKey: PANEL_PRIMARY_KEYS.includes(src.primaryKey) ? src.primaryKey : 'hp',
    primaryValue: String(src.primaryValue ?? ''), cr: String(src.cr ?? ''),
    cd: String(src.cd ?? ''), em: String(src.em ?? ''), er: String(src.er ?? '')
  };
}
function normalizeState(data = {}) {
  return {
    ...State.data, ...data,
    charImg: data.charImg || '', charImgMeta: data.charImgMeta || null,
    charImgDeleted: !!data.charImgDeleted,
    charImgManual: !!data.charImgManual,
    bgImg: data.bgImg || '', bgImgDeleted: !!data.bgImgDeleted,
    bgImgManual: !!data.bgImgManual,
    nameBgImg: data.nameBgImg || '', nameBgImgMeta: data.nameBgImgMeta || null,
    nameBgImgDeleted: !!data.nameBgImgDeleted,
    nameBgImgManual: !!data.nameBgImgManual,
    teamCoreImg: data.teamCoreImg || '',
    teamCoreImgManual: !!data.teamCoreImgManual,
    fontData: data.fontData || '',
    fontName: data.fontName || '',
    fontFileName: data.fontFileName || '',
    theme: data.theme || '#939393', imgX: Number(data.imgX) || 0,
    weaponData: {
      graduate: normalizeWeaponList(data?.weaponData?.graduate),
      optional: normalizeWeaponList(data?.weaponData?.optional),
      newbie: normalizeWeaponList(data?.weaponData?.newbie)
    },
    artifactData: normalizeArtifactList(data.artifactData),
    constellationData: Array.from({ length: 6 }, (_, i) => ({
      active: !!data?.constellationData?.[i]?.active,
      desc: String(data?.constellationData?.[i]?.desc ?? '')
    })),
    panel: normalizePanel(data.panel),
    teamData: Array.isArray(data.teamData) ? data.teamData.map(team => ({ ...team, chars: normalizeTeamChars(team?.chars) })) : []
  };
}

/* =========================================================================
 * 【JS 模块 11】导出 / 导入 / 清空
 * ========================================================================= */

/* ---- 图片洗 dataURL（导出 PNG 前用）------------------------------------ */

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
    console.warn('[bake] 转 dataURL 失败，保留原 URL：', url, '—', e.message);
    return url;
  }
}

async function bakeImagesToDataURL() {
  const data = JSON.parse(JSON.stringify(State.data));
  const tasks = [];

  ['charImg', 'bgImg', 'nameBgImg', 'teamCoreImg'].forEach(function (key) {
    if (data[key]) {
      tasks.push((async function () { data[key] = await urlToDataURL(data[key]); })());
    }
  });

  WEAPON_ORDER.forEach(function (type) {
    (data.weaponData[type] || []).forEach(function (w) {
      if (w.img) tasks.push((async function () { w.img = await urlToDataURL(w.img); })());
    });
  });

  (data.artifactData || []).forEach(function (a) {
    if (a.img) tasks.push((async function () { a.img = await urlToDataURL(a.img); })());
    if (a.img1) tasks.push((async function () { a.img1 = await urlToDataURL(a.img1); })());
    if (a.img2) tasks.push((async function () { a.img2 = await urlToDataURL(a.img2); })());
  });

  (data.teamData || []).forEach(function (t) {
    (t.chars || []).forEach(function (c) {
      if (c.img) tasks.push((async function () { c.img = await urlToDataURL(c.img); })());
      (c.alts || []).forEach(function (a) {
        if (a.img) tasks.push((async function () { a.img = await urlToDataURL(a.img); })());
      });
    });
  });

  await Promise.all(tasks);
  return data;
}

/* ---- 导出 -------------------------------------------------------------- */

function buildExportPayload(data) {
  var out = JSON.parse(JSON.stringify(data));
  out.fontData = '';
  if (!out.charImgManual) { out.charImg = ''; out.charImgMeta = null; }
  if (!out.bgImgManual) out.bgImg = '';
  if (!out.nameBgImgManual) { out.nameBgImg = ''; out.nameBgImgMeta = null; }
  if (!out.teamCoreImgManual) out.teamCoreImg = '';
  WEAPON_ORDER.forEach(function (type) {
    (out.weaponData[type] || []).forEach(function (w) {
      if (!w.imgManual) w.img = '';
    });
  });
  (out.artifactData || []).forEach(function (a) {
    if (!a.imgManual) a.img = '';
    if (!a.img1Manual) a.img1 = '';
    if (!a.img2Manual) a.img2 = '';
  });
  (out.teamData || []).forEach(function (t) {
    (t.chars || []).forEach(function (c) {
      if (!c.imgManual) c.img = '';
      (c.alts || []).forEach(function (a) {
        if (!a.imgManual) a.img = '';
      });
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
  const btns = [
    bd ? { el: bd, text: bd.textContent } : null,
    bm ? { el: bm, text: bm.textContent } : null
  ].filter(Boolean);
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
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
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
  var name = State.data.charName || '角色';
  var order = CHAR_NAME_TO_ORDER[name];
  var filename = order ? (padOrder(order) + '.' + name + '.json') : (name + '.json');
  var payload = buildExportPayload(State.data);
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    filename
  );
}

/* ---- 导入 -------------------------------------------------------------- */

async function silentFromName(type, name) {
  if (!window.ICON_LIB) return '';
  var trimmed = String(name || '').trim();
  if (!trimmed) return '';
  try {
    var r = await ICON_LIB.fromName(type, trimmed);
    return (r && r.dataURL) ? r.dataURL : '';
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
  var d = State.data;
  var tasks = [];

  if (d.charName && (!d.charImg || !d.nameBgImg || !d.bgImg)) {
    tasks.push(function () { return matchStyleImages(true); });
  }

  WEAPON_ORDER.forEach(function (type) {
    (d.weaponData[type] || []).forEach(function (w) {
      if (w.name && !w.img) {
        tasks.push(async function () {
          const u = await silentFromName('weapons', w.name);
          if (u) w.img = u;
        });
      }
    });
  });

  (d.artifactData || []).forEach(function (a) {
    if (a.type === 'double') {
      if (a.name1 && !a.img1) {
        tasks.push(async function () {
          const u = await silentFromName('artifacts', a.name1);
          if (u) a.img1 = u;
        });
      }
      if (a.name2 && !a.img2) {
        tasks.push(async function () {
          const u = await silentFromName('artifacts', a.name2);
          if (u) a.img2 = u;
        });
      }
    } else {
      if (a.name && !a.img) {
        tasks.push(async function () {
          const u = await silentFromName('artifacts', a.name);
          if (u) a.img = u;
        });
      }
    }
  });

  (d.teamData || []).forEach(function (team) {
    (team.chars || []).forEach(function (c, ci) {
      if (ci === 0) return;
      if (c.name && !c.img) {
        const hit = resolveCharName(c.name);
        if (hit) {
          tasks.push(async function () {
            const u = await silentFromName('characters', hit);
            if (u) c.img = u;
          });
        }
      }
      (c.alts || []).forEach(function (alt) {
        if (alt.name && !alt.img) {
          const hit = resolveCharName(alt.name);
          if (hit) {
            tasks.push(async function () {
              const u = await silentFromName('characters', hit);
              if (u) alt.img = u;
            });
          }
        }
      });
    });
  });

  if (d.charName && !d.teamCoreImg && isValidCharName(d.charName)) {
    tasks.push(async function () {
      const u = await silentFromName('characters', d.charName);
      if (u) d.teamCoreImg = u;
    });
  }

  await runConcurrent(tasks);
}

async function reloadFontByFileName() {
  if (State.data.fontFileName) {
    if (!FONT_LIST.length) await loadFontList();
    var idx = FONT_LIST.findIndex(x => x.file === State.data.fontFileName);
    if (idx >= 0) {
      await selectFont(idx);
      return true;
    }
    if (State.data.fontData) {
      await installPreviewFont();
      return true;
    }
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
  initThumbnails();
  renderEditorsByKey();
  syncInputs();
  mountPreview();

  await fontPromise;
  if (document.fonts) { try { await document.fonts.ready; } catch (e) {} }
  mountPreview();

  debouncedSave();
}

function importConfig(input) {
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
 * 【JS 模块 12】UI 交互
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
function setPanelPrimaryKey(key) {
  State.data.panel.primaryKey = PANEL_PRIMARY_KEYS.includes(key) ? key : 'hp';
  mountPreview(); debouncedSave();
}
function setPanelField(key, value) {
  if (!State.data.panel) State.data.panel = normalizePanel(null);
  State.data.panel[key] = value;
  updatePreviewField(`panel.${key}`);
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
  const adjList = State.data.weaponData[WEAPON_ORDER[adjTi]];
  return adjList.length < WEAPON_MAX;
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
  if (adjList.length >= WEAPON_MAX) {
    return showToast(`「${WEAPON_LABELS[adjType]}」区已满 ${WEAPON_MAX} 个`, 'error');
  }
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
  State.data.teamData.push({
    name: '',
    chars: Array.from({ length: 4 }, () => ({ name: '', img: '', imgManual: false, alts: [], emptyAltText: '暂无备选' }))
  });
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
  if (ci === 0) updatePreviewField('charName');
  else updatePreviewField(`team.${ti}.char.${ci}.name`);
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

/* =========================================================================
 * 【JS 模块 13】App 接口
 * ========================================================================= */
const App = {
  selectTab,
  setField, setTheme, setPanelPrimaryKey, setPanelField,
  toggleCollapse, toggleConstellation, setConstellationDesc,
  addWeapon, removeWeapon, moveWeapon, setWeaponName,
  addArtifact, removeArtifact, moveArtifact, setArtifactName,
  addTeam, removeTeam, moveTeam, setTeamName,
  moveTeamChar, setTeamCharName,
  addAlt, removeAlt, moveAlt, setAltName, setEmptyAltText,
  renderWeaponEditor, renderArtifactEditor, renderTeamEditor,
  mountPreview, debouncedSave,
  triggerUpload, uploadImageHandler,
  updateThumb, updateImgXHint, clearImage, onThumbClick,
  exportPNG, exportConfig, importConfig, clearAllData,
  matchWeaponIcon, matchArtifactIcon, matchArtifactDoubleIcon,
  setArtifactName1, setArtifactName2, setArtifactDisplayText,
  matchTeamCharIcon, matchAltIcon, matchCharAvatar,
  matchStyleImages, loadSaveFromRepo,
  openFontPicker, closeFontPicker, selectFont
};
window.App = App;

/* =========================================================================
 * 【JS 模块 14】初始化
 * ========================================================================= */
function injectFloatIcons() {
  const S = window.ICONS || { ui: {} };
  const ex = document.getElementById('floatExportBtn');
  const im = document.getElementById('floatImportBtn');
  const cl = document.getElementById('floatClearBtn');
  if (ex && S.ui) ex.innerHTML = S.ui.export || '';
  if (im && S.ui) im.innerHTML = S.ui.import || '';
  if (cl && S.ui) cl.innerHTML = S.ui.trash || '';
  const delTargets = ['btnDelCharImg', 'btnDelNameBg', 'btnDelBg', 'btnDelTeamCore'];
  delTargets.forEach(id => {
    const el = document.getElementById(id);
    if (el && S.ui) el.innerHTML = S.ui.trash || '';
  });
  const addTeamIcon = document.getElementById('btnAddTeamIcon');
  if (addTeamIcon && S.ui) addTeamIcon.innerHTML = S.ui.plus || '';
  const matchStyleIcon = document.getElementById('btnMatchStyleIcon');
  if (matchStyleIcon && S.ui) matchStyleIcon.innerHTML = S.ui.plus || '';
  const loadSaveIcon = document.getElementById('btnLoadSaveIcon');
  if (loadSaveIcon && S.ui) loadSaveIcon.innerHTML = S.ui.import || '';
}
function bindPreviewTapToggle() {
  const frame = document.getElementById('previewFrame');
  const toolbar = document.getElementById('floatToolbar');
  if (!frame || !toolbar) return;
  frame.addEventListener('click', () => {
    toolbar.classList.toggle('hidden');
  });
}
async function init() {
  /* 等资源加载器完成（ui-icons / theme / style / icon-loader / icon-dict / consts / svg / app） */
  try { await window.__bootPromise; } catch (e) { console.warn(e); }

  injectFloatIcons();
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
  mountPreview();
  selectTab(currentTab);
  bindPreviewTapToggle();

  /* 一切就绪，揭开启动遮罩 */
  document.body.classList.add('ready');
}
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'theme') {
    var html = document.documentElement;
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

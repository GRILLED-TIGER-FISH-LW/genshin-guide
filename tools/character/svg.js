/* =========================================================================
 * 原神一图流生成器 · svg.js (25%黑叠加版)
 * ========================================================================= */

/* =========================================================================
 * 【S1】图标 viewBox 收紧
 * ========================================================================= */
function tightenSvgToSquareViewBox(svgString) {
  const ns = 'http://www.w3.org/2000/svg';
  const host = document.createElementNS(ns, 'svg');
  host.style.position = 'absolute'; host.style.left = '-9999px'; host.style.top = '-9999px';
  host.style.width = '1px'; host.style.height = '1px'; host.style.visibility = 'hidden';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const wrap = document.createElementNS(ns, 'svg');
  wrap.innerHTML = svgString;
  host.appendChild(wrap);
  const paths = wrap.querySelectorAll('path');
  if (!paths.length) { host.remove(); return svgString; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  paths.forEach(p => {
    let b;
    try { b = p.getBBox(); } catch (e) { return; }
    if (!b || (b.width === 0 && b.height === 0)) return;
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
  });
  host.remove();
  if (!isFinite(minX) || !isFinite(minY)) return svgString;
  const w = maxX - minX, h = maxY - minY, side = Math.max(w, h);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const nx = cx - side / 2, ny = cy - side / 2;
  const fmt = n => +n.toFixed(4);
  const vb = `${fmt(nx)} ${fmt(ny)} ${fmt(side)} ${fmt(side)}`;
  return svgString.replace(/viewBox="[^"]*"/, `viewBox="${vb}"`);
}
function tightenAllIconViewBoxes() {
  Object.keys(ELEMENT_ICONS).forEach(k => { ELEMENT_ICONS[k] = tightenSvgToSquareViewBox(ELEMENT_ICONS[k]); });
  document.querySelectorAll('svg.icon').forEach(svg => {
    const outer = svg.outerHTML;
    const fixed = tightenSvgToSquareViewBox(outer);
    if (fixed !== outer) {
      const tpl = document.createElement('div');
      tpl.innerHTML = fixed;
      const next = tpl.firstElementChild;
      if (next) svg.replaceWith(next);
    }
  });
}

/* =========================================================================
 * 【S2】文本测量与自动排版
 * ========================================================================= */
function measureTextWidth(content, fontSize) {
  content = String(content || '');
  const family = State.data.fontData ? FONT_FAMILY_CUSTOM : FONT_FAMILY_DEFAULT;
  const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px ${family}`;
  return ctx.measureText(content).width;
}
function fitSize(textContent, maxW, base, min = 8) {
  textContent = String(textContent || '');
  if (!textContent) return base;
  let size = base;
  while (size > min) { if (measureTextWidth(textContent, size) <= maxW) break; size -= 1; }
  return size;
}
function wrapTextLines(content, maxW, size, maxLines) {
  const chars = Array.from(String(content || ''));
  if (!chars.length) return [];
  const lines = [];
  let line = '';
  chars.forEach(ch => {
    const next = line + ch;
    if (!line || measureTextWidth(next, size) <= maxW) { line = next; }
    else { lines.push(line); line = ch; }
  });
  if (line) lines.push(line);
  if (lines.length > maxLines) return null;
  if (lines.some(l => measureTextWidth(l, size) > maxW)) return null;
  return lines;
}
function wrappedCenteredText(x, areaTop, areaW, areaH, content, maxW, base, min, fill = '#ddd') {
  const centerX = x + areaW / 2;
  for (let size = base; size >= min; size -= 1) {
    const lineH = Math.round(size * 1.08);
    const maxLines = Math.max(1, Math.floor(areaH / lineH));
    const lines = wrapTextLines(content, maxW, size, maxLines);
    if (!lines) continue;
    const blockH = lines.length * lineH;
    const firstY = areaTop + (areaH - blockH) / 2 + lineH / 2;
    return lines.map((line, i) => text(centerX, firstY + i * lineH, line, size, { fill, anchor: 'middle' })).join('');
  }
  return text(centerX, areaTop + areaH / 2, content, min, { fill, anchor: 'middle' });
}
function wrappedLeftText(x, areaTop, areaW, areaH, content, maxW, base, min, fill = '#ddd', padY = 0) {
  const fitH = areaH - padY * 2;
  for (let size = base; size >= min; size -= 1) {
    const lineH = Math.round(size * 1.08);
    const maxLines = Math.max(1, Math.floor(fitH / lineH));
    const lines = wrapTextLines(content, maxW, size, maxLines);
    if (!lines) continue;
    const blockH = lines.length * lineH;
    const firstY = areaTop + (areaH - blockH) / 2 + lineH / 2;
    return lines.map((line, i) => text(x, firstY + i * lineH, line, size, { fill })).join('');
  }
  const lineH = Math.round(min * 1.08);
  const forcedLines = wrapTextLines(content, maxW, min, 999);
  if (forcedLines && forcedLines.length) {
    const firstY = areaTop + lineH / 2;
    return forcedLines.map((line, i) => text(x, firstY + i * lineH, line, min, { fill })).join('');
  }
  return text(x, areaTop + areaH / 2, content, min, { fill });
}

/* =========================================================================
 * 【S3】SVG 绘制原语
 * ========================================================================= */
function text(x, y, content, size, opts = {}) {
  const fill = opts.fill || '#F2F1EA';
  const anchor = opts.anchor || 'start';
  const weight = opts.weight || '400';
  const opacity = opts.opacity == null ? 1 : opts.opacity;
  const baseline = opts.baseline || 'middle';
  const parts = [
    `x="${x}"`, `y="${y}"`, `fill="${fill}"`, `font-size="${size}"`,
    `font-weight="${weight}"`, `text-anchor="${anchor}"`,
    `dominant-baseline="${baseline}"`, `opacity="${opacity}"`
  ];
  if (opts.stroke) {
    parts.push(`stroke="${opts.stroke}"`, `stroke-width="${opts.strokeWidth || 0}"`,
      `stroke-linejoin="round"`, `stroke-linecap="round"`, `paint-order="stroke fill"`);
  }
  if (opts.extra) parts.push(opts.extra);
  if (opts.field) parts.push(`data-field="${esc(opts.field)}"`);
  if (opts.fit) {
    parts.push(`data-fit-max-w="${opts.fit.maxW}"`, `data-fit-base="${opts.fit.base}"`, `data-fit-min="${opts.fit.min || 8}"`);
  }
  return `<text ${parts.join(' ')}>${esc(content)}</text>`;
}
function rect(x, y, w, h, fill, stroke = '', sw = 0, rx = 8, opacity = 1, clip = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" opacity="${opacity}" ${stroke ? `stroke="${stroke}" stroke-width="${sw}"` : ''}${clip ? ` clip-path="url(#${clip})"` : ''}/>`;
}
function image(href, x, y, w, h, fit = 'xMidYMid slice', extra = '') {
  return `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${fit}" ${extra}/>`;
}
function sectionTitle(x, y, title) {
  const fs = LAYOUT.title.fs, dotR = LAYOUT.title.dotR, dotGap = LAYOUT.title.dotGap;
  const textX = x + dotR * 2 + dotGap;
  return `<circle cx="${x + dotR}" cy="${y}" r="${dotR}" fill="${State.data.theme || '#939393'}"/>${text(textX, y, title, fs, { weight: 600, fill: '#FFFFFF' })}`;
}
function slot(x, y, size, img, name, key, field) {
  const cp = `clip_${key}`;
  const radius = Math.round(size * LAYOUT.radius.slotFactor);
  const labelH = Math.round(size / 5);
  const maxW = size - (radius / 3) * 2;
  const base = labelH * 0.8;
  const labelSize = fitSize(name, maxW, base, 3);
  const labelTextY = y + size - labelH / 2 + labelSize * 0.35;
  const showLabel = !!(name || field);
  let labelEl = '';
  if (showLabel) {
    const opts = { anchor: 'middle', baseline: 'alphabetic' };
    if (field) { opts.field = field; opts.fit = { maxW, base, min: 3 }; }
    labelEl = text(x + size / 2, labelTextY, name || '', labelSize, opts);
  }
  const bg = showLabel ? `<rect x="${x}" y="${y + size - labelH}" width="${size}" height="${labelH}" fill="url(#slotBottomGrad)" clip-path="url(#${cp})"/>` : '';
  return `
    <clipPath id="${cp}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}"/></clipPath>
    ${rect(x, y, size, size, 'rgba(0,0,0,.4)', '', 0, radius)}
    ${image(img || placeholder(''), x, y, size, size, 'xMidYMid slice', `clip-path="url(#${cp})"`)}
    ${bg}${labelEl}`;
}
function doubleArtifact(x, y, size, a, key) {
  const gap = LAYOUT.doubleGap;
  const w = size * 2 + gap, h = size;
  const radius = Math.round(size * LAYOUT.radius.slotFactor);
  const cpL = `clip_${key}_l`, cpR = `clip_${key}_r`;
  const labelH = Math.round(h / 5);
  const maxW = w - (radius / 3) * 2;
  const base = labelH * 0.8;
  const displayName = a.displayText || [a.name1, a.name2].filter(Boolean).join(' + ');
  const fs = fitSize(displayName, maxW, base, 4);
  const labelTextY = y + h - labelH / 2 + fs * 0.35;
  const showLabel = !!displayName;
  let labelEl = '';
  if (showLabel) { labelEl = text(x + w / 2, labelTextY, displayName, fs, { anchor: 'middle', baseline: 'alphabetic' }); }
  const bg = showLabel ? `
    <rect x="${x}" y="${y + h - labelH}" width="${size}" height="${labelH}" fill="url(#slotBottomGrad)" clip-path="url(#${cpL})"/>
    <rect x="${x + size}" y="${y + h - labelH}" width="${gap}" height="${labelH}" fill="url(#slotBottomGrad)"/>
    <rect x="${x + size + gap}" y="${y + h - labelH}" width="${size}" height="${labelH}" fill="url(#slotBottomGrad)" clip-path="url(#${cpR})"/>` : '';
  return `
    <clipPath id="${cpL}"><path d="M${x + radius} ${y}H${x + size}V${y + size}H${x + radius}Q${x} ${y + size} ${x} ${y + size - radius}V${y + radius}Q${x} ${y} ${x + radius} ${y}Z"/></clipPath>
    <clipPath id="${cpR}"><path d="M${x + size + gap} ${y}H${x + size + gap + size - radius}Q${x + size + gap + size} ${y} ${x + size + gap + size} ${y + radius}V${y + size - radius}Q${x + size + gap + size} ${y + size} ${x + size + gap + size - radius} ${y + size}H${x + size + gap}Z"/></clipPath>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="rgba(0,0,0,.4)" clip-path="url(#${cpL})"/>
    <rect x="${x + size + gap}" y="${y}" width="${size}" height="${size}" fill="rgba(0,0,0,.4)" clip-path="url(#${cpR})"/>
    ${image(a.img1 || placeholder(''), x, y, size, size, 'xMidYMid slice', `clip-path="url(#${cpL})"`)}
    ${image(a.img2 || placeholder(''), x + size + gap, y, size, size, 'xMidYMid slice', `clip-path="url(#${cpR})"`)}
    ${bg}${labelEl}`;
}

/* =========================================================================
 * 【S4】图层构建
 * ========================================================================= */
function panelRect(x, y, w, h, rx) {
  // 一级面板：25%的黑
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="rgba(0, 0, 0, 0.25)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1"/>`;
}
function midSection(layerCfg, title, contentSvg) {
  const y = LAYOUT.layers.mid.y, h = LAYOUT.layers.mid.h;
  return `
    ${panelRect(layerCfg.x, y, layerCfg.w, h, LAYOUT.radius.panel)}
    ${sectionTitle(layerCfg.x + LAYOUT.title.offX, y + LAYOUT.title.offY, title)}
    ${contentSvg}`;
}

/* ---- 武器 ---- */
function buildWeapons() {
  const keys = WEAPON_ORDER.filter(k => State.data.weaponData[k].length);
  if (!keys.length) return '';
  let out = '';
  const step = LAYOUT.iconSize + LAYOUT.iconGap, size = LAYOUT.iconSize;
  const slotY = LAYOUT.weaponSlotY;
  const labelFs = LAYOUT.weaponLabelFs, labelOffsetY = LAYOUT.weaponLabelOffsetY;
  const sepGap = 20;
  let x = LAYOUT.right.x + LAYOUT.padX;
  keys.forEach((k, groupIndex) => {
    if (groupIndex > 0) out += `<rect x="${x - sepGap - 1}" y="${slotY}" width="2" height="${size}" fill="url(#sepGrad)"/>`;
    const group = State.data.weaponData[k];
    group.slice(0, WEAPON_MAX).forEach((w, i) => {
      out += slot(x + i * step, slotY, size, w.img, w.name, `w_${k}_${i}`, `weapon.${k}.${i}.name`);
    });
    const labelTop = slotY + size + labelOffsetY;
    const labelY = labelTop + labelFs / 2;
    const labelX = x + Math.max(26, (group.length * step - (step - size)) / 2);
    out += text(labelX, labelY, WEAPON_LABELS[k], labelFs, { fill: LAYOUT.labelColor, anchor: 'middle', weight: 500 });
    x += group.length * step + (sepGap + 2 + sepGap) - (step - size);
  });
  return out;
}

/* ---- 圣遗物 ---- */
function buildArtifacts() {
  if (!State.data.artifactData.length) return '';
  let out = '';
  const step = LAYOUT.iconSize + LAYOUT.iconGap, size = LAYOUT.iconSize;
  const doubleStep = size * 2 + LAYOUT.doubleGap + LAYOUT.iconGap;
  const iconY = LAYOUT.artifactSlotY;
  let x = LAYOUT.layers.artifact.x + LAYOUT.padX;
  State.data.artifactData.forEach((a, i) => {
    if (a.type === 'double') { out += doubleArtifact(x, iconY, size, a, `a_${i}`); x += doubleStep; }
    else { out += slot(x, iconY, size, a.img, a.name, `a_${i}`, `artifact.${i}.name`); x += step; }
  });
  return out;
}
function renderArtifactIcon(iconKey, cx, cy, size) {
  const paths = ARTIFACT_ICON_PATHS[iconKey];
  if (!paths) return '';
  const scale = size / 1024;
  const iconX = cx - size / 2, iconY = cy - size / 2;
  const pathsStr = paths.map(d => `<path d="${d}"/>`).join('');
  return `<g transform="translate(${iconX}, ${iconY}) scale(${scale})" fill="${State.data.theme}">${pathsStr}</g>`;
}

/* ---- 词条 ---- */
function statBox(x, y, w, h, iconKey, title, value, field) {
  const boxRx = LAYOUT.radius.inner, iconSize = LAYOUT.stat.iconSize;
  const gap = 4, labelFs = LAYOUT.stat.labelFs;
  const labelW = measureTextWidth(title, labelFs);
  const totalW = iconSize + gap + labelW;
  const startX = x + (w - totalW) / 2;
  const centerY = y + 16;
  const iconCx = startX + iconSize / 2;
  const textX = startX + iconSize + gap;
  const iconElem = renderArtifactIcon(iconKey, iconCx, centerY, iconSize);
  const valueAreaTop = y + 32, valueAreaH = h - 36;
  const maxW = w - boxRx * 2;
  const valueSvg = value
    ? wrappedCenteredText(x + boxRx, valueAreaTop, maxW, valueAreaH, value, maxW, 12, 6, '#fff')
    : '';
  return `
    ${rect(x, y, w, h, LAYOUT.innerBoxFill, '', 0, boxRx)}
    ${iconElem}
    ${text(textX, centerY, title, labelFs, { fill: LAYOUT.labelColor, weight: 500 })}
    ${valueSvg}`;
}
function buildStats() {
  const layer = LAYOUT.layers.mid.stat;
  const contentX = layer.x + LAYOUT.padX;
  const contentW = layer.w - LAYOUT.padX * 2;
  const contentY = MID_CONTENT_Y;
  const boxW = LAYOUT.stat.boxW, boxH = LAYOUT.stat.boxH, gap = LAYOUT.stat.gap;
  const subH = LAYOUT.stat.subH, subGap = LAYOUT.stat.subGap;
  const subY = contentY + boxH + subGap;
  const totalW = boxW * 3 + gap * 2;
  const offsetX = contentX + (contentW - totalW) / 2;
  const subLabelX = offsetX + 10;
  const subLabelFs = LAYOUT.stat.subLabelFs;
  const subLabelW = measureTextWidth('副词条：', subLabelFs);
  const subTextX = subLabelX + subLabelW + 5;
  const subRightLimit = offsetX + totalW - 10;
  const subTextW = subRightLimit - subTextX;
  return `
    ${statBox(offsetX, contentY, boxW, boxH, 'flower', '时之沙', State.data.sandMain, 'stat.sandMain')}
    ${statBox(offsetX + boxW + gap, contentY, boxW, boxH, 'cup', '空之杯', State.data.gobMain, 'stat.gobMain')}
    ${statBox(offsetX + (boxW + gap) * 2, contentY, boxW, boxH, 'crown', '理之冠', State.data.cirMain, 'stat.cirMain')}
    ${rect(offsetX, subY, totalW, subH, LAYOUT.innerBoxFill, '', 0, LAYOUT.radius.inner)}
    ${text(subLabelX, subY + subH / 2, '副词条：', subLabelFs, { fill: LAYOUT.labelColor, weight: 500 })}
    ${wrappedLeftText(subTextX, subY, subTextW, subH, State.data.subStats, subTextW, 12, 6, '#fff', 4)}`;
}

/* ---- 天赋 ---- */
function buildTalents() {
  const layer = LAYOUT.layers.talent;
  const contentX = layer.x + LAYOUT.padX;
  const contentW = layer.w - LAYOUT.padX * 2;
  const contentY = LAYOUT.layers.row2.y + LAYOUT.contentOffsetY;
  const contentH = LAYOUT.talent.boxH;
  const colGap = LAYOUT.talent.colGap;
  const colW = (contentW - colGap * 2) / 3;
  const r = LAYOUT.radius.inner;
  const items = [
    ['普通攻击', State.data.talentA, 'talent.A'],
    ['元素战技', State.data.talentE, 'talent.E'],
    ['元素爆发', State.data.talentQ, 'talent.Q']
  ];
  return items.map((it, i) => {
    const x = contentX + i * (colW + colGap);
    const val = it[1] || '—';
    const labelY = contentY + 17, valueY = contentY + 44;
    const maxW = colW - 16, base = LAYOUT.talent.valueFs;
    return `
      ${rect(x, contentY, colW, contentH, LAYOUT.innerBoxFill, '', 0, r)}
      ${text(x + colW / 2, labelY, it[0], LAYOUT.talent.labelFs, { fill: LAYOUT.labelColor, anchor: 'middle', weight: 500 })}
      ${text(x + colW / 2, valueY, val, fitSize(val, maxW, base, 10), { fill: '#fff', anchor: 'middle', weight: 600, field: it[2], fit: { maxW, base, min: 10 } })}`;
  }).join('');
}

/* ---- 面板 ---- */
function buildPanel() {
  const d = State.data.panel || {};
  const P = LAYOUT.panel;
  const layer = LAYOUT.layers.mid.panel;
  const contentX = layer.x + LAYOUT.padX;
  const baseY = MID_CONTENT_Y;
  const r = LAYOUT.radius.inner;
  const primaryLabel = PANEL_PRIMARY_LABELS[d.primaryKey] || PANEL_PRIMARY_LABELS.hp;
  const items = [
    { key: 'primaryValue', label: primaryLabel, value: d.primaryValue || '' },
    { key: 'em', label: '元素精通', value: d.em || '' },
    { key: 'cr', label: '暴击率', value: d.cr || '' },
    { key: 'cd', label: '暴击伤害', value: d.cd || '' },
    { key: 'er', label: '充能效率', value: d.er || '' }
  ];
  const { cols, cellW, cellH, gapX, gapY, innerPadX, labelFs, valueFs } = P;
  return items.map((it, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = contentX + col * (cellW + gapX);
    const cy = baseY + row * (cellH + gapY);
    const midY = cy + cellH / 2;
    const empty = !it.value;
    return `
      ${rect(cx, cy, cellW, cellH, LAYOUT.innerBoxFill, '', 0, r)}
      ${text(cx + innerPadX, midY, it.label, labelFs, { fill: LAYOUT.labelColor, weight: 500 })}
      ${text(cx + cellW - innerPadX, midY, empty ? PANEL_EMPTY_TEXT : it.value, valueFs, { fill: empty ? EMPTY_FILL : '#fff', anchor: 'end', weight: 400, field: `panel.${it.key}` })}`;
  }).join('');
}

/* ---- 命座 ---- */
function buildConstellations() {
  const layer = LAYOUT.layers.mid.cons;
  const colX = layer.x + LAYOUT.padX;
  const boxW = LAYOUT.cons.boxW, boxH = LAYOUT.cons.boxH;
  const gapX = LAYOUT.cons.gapX, gapY = LAYOUT.cons.gapY;
  const contentY = MID_CONTENT_Y;
  const theme = State.data.theme;
  const list = State.data.constellationData;
  return list.map((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = colX + col * (boxW + gapX);
    const y = contentY + row * (boxH + gapY);
    const active = !!c.active;
    const boxRx = LAYOUT.radius.inner;
    const badgeCx = x + 15, badgeCy = y + boxH / 2;
    const descX = x + 30;
    const descRightLimit = x + boxW - 5;
    const descAreaW = descRightLimit - descX;
    const descText = c.desc ? wrappedLeftText(descX, y + 2, descAreaW, boxH - 4, c.desc, descAreaW, LAYOUT.cons.descFs, 6, '#fff') : '';
    const badgeFill = active ? theme : 'rgba(0,0,0,.4)';
    
    if (active) {
      return `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="${boxRx}" fill="${theme}" fill-opacity="0.25" stroke="${theme}" stroke-opacity="0.5" stroke-width="1"/>
        <circle cx="${badgeCx}" cy="${badgeCy}" r="10" fill="${badgeFill}"/>
        ${text(badgeCx, badgeCy + 0.5, i + 1, LAYOUT.cons.seqFs, { fill: '#fff', anchor: 'middle', weight: 600 })}
        ${descText}`;
    }
    return `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="${boxRx}" fill="${LAYOUT.innerBoxFill}"/>
      <circle cx="${badgeCx}" cy="${badgeCy}" r="10" fill="${badgeFill}"/>
      ${text(badgeCx, badgeCy + 0.5, i + 1, LAYOUT.cons.seqFs, { fill: '#fff', anchor: 'middle', weight: 500 })}
      ${descText}`;
  }).join('');
}

/* ---- 配队 ---- */
function buildTeams() {
  if (!State.data.teamData.length) return '';
  const T = LAYOUT.team;
  const whiteBoxY = LAYOUT.layers.team.y + LAYOUT.contentOffsetY;
  const whiteBoxH = LAYOUT.layers.team.h - LAYOUT.contentOffsetY - LAYOUT.bottomPad;
  return State.data.teamData.slice(0, 3).map((team, ti) => {
    const teamW = T.w, teamGap = T.gap;
    const x = LAYOUT.right.x + LAYOUT.padX + ti * (teamW + teamGap);
    const teamRx = LAYOUT.radius.inner;
    let out = `<rect x="${x}" y="${whiteBoxY}" width="${teamW}" height="${whiteBoxH}" rx="${teamRx}" fill="${LAYOUT.innerBoxFill}"/>`;
    const nameY = whiteBoxY + T.nameOffsetY;
    if (team.name) {
      out += text(x + teamW / 2, nameY, team.name, fitSize(team.name, 240, T.nameFs, 8),
        { fill: LAYOUT.labelColor, anchor: 'middle', weight: 500, field: `team.${ti}.name`, fit: { maxW: 240, base: T.nameFs, min: 8 } });
    }
    const mainSize = T.mainSize, mainGap = T.mainGap;
    const mainStartX = x + (teamW - (mainSize * 4 + mainGap * 3)) / 2;
    const mainY = whiteBoxY + T.mainOffsetY;
    const coreChar = {
      name: State.data.charName || team.chars[0].name || '',
      img: State.data.teamCoreImg || team.chars[0].img || ''
    };
    const mainChars = [coreChar, ...team.chars.slice(1, 4)];
    const plusSize = LAYOUT.plusSize;
    mainChars.forEach((c, ci) => {
      const cx = mainStartX + ci * (mainSize + mainGap);
      const mainField = ci === 0 ? 'charName' : `team.${ti}.char.${ci}.name`;
      out += slot(cx, mainY, mainSize, c.img, c.name, `t_${ti}_${ci}`, mainField);
      if (ci < 3) {
        const plusX = cx + mainSize + mainGap / 2 - plusSize / 2;
        const plusY = mainY + mainSize / 2 - plusSize / 2;
        const plusScale = plusSize / 16;
        out += `<g transform="translate(${plusX}, ${plusY}) scale(${plusScale})"><path d="${PLUS_ICON_PATH}" fill="${LAYOUT.labelColor}" stroke="${LAYOUT.labelColor}" stroke-width="${LAYOUT.plusStrokeW}" stroke-linejoin="round"/></g>`;
      }
    });
    const altStartY = whiteBoxY + T.altOffsetY;
    team.chars.slice(1, 4).forEach((c, ci) => {
      const rowY = altStartY + ci * (T.altSize + T.altRowGap);
      const alts = c.alts.filter(a => a.name || a.img).slice(0, 4);
      const altSize = T.altSize, altGap = T.altGap;
      const label = `${ci + 2}号位备选`;
      const labelFs = 10;
      const labelW = measureTextWidth(label, labelFs);
      const rangeL = x + T.altLabelPadL + labelW;
      const rangeR = x + teamW - T.altRangePadR;
      const rangeW = rangeR - rangeL;
      const centerX = rangeL + rangeW / 2;
      const clusterW = alts.length ? alts.length * altSize + (alts.length - 1) * altGap : 0;
      const startX = centerX - clusterW / 2;
      const emptyAltText = c.emptyAltText || '暂无备选';
      out += text(x + T.altLabelPadL, rowY + altSize / 2, label, labelFs, { fill: LAYOUT.labelColor, weight: 500 });
      if (!alts.length) out += wrappedCenteredText(rangeL, rowY, rangeW, altSize, emptyAltText, rangeW, 10, 5, EMPTY_FILL);
      alts.forEach((a, ai) => {
        const ax = startX + ai * (altSize + altGap);
        const altField = `team.${ti}.char.${ci + 1}.alt.${ai}.name`;
        out += slot(ax, rowY, altSize, a.img, a.name, `ta_${ti}_${ci + 1}_${ai}`, altField);
      });
    });
    return out;
  }).join('');
}

/* =========================================================================
 * 【S5】总入口 buildSVG
 * ========================================================================= */
function buildSVG(scale = 1, forExport = false) {
  const d = State.data;
  const W = SVG_W * scale, H = SVG_H * scale;
  const fontFace = (forExport && d.fontData)
    ? `@font-face{font-family:CardCustomFont;src:url("${d.fontData}");font-display:block}`
    : '';
  const fontFamily = d.fontData ? FONT_FAMILY_CUSTOM : FONT_FAMILY_DEFAULT;
  const nameFs = fitSize(d.charName, 280, 50, 18);
  const imgX = Number(d.imgX) || 0;
  const leftX = LAYOUT.left.x, leftY = LAYOUT.left.y, leftW = LAYOUT.left.w, leftH = LAYOUT.left.h;
  const imgMeta = d.charImgMeta || {};
  const imgIW = Number(imgMeta.w) || 0;
  const imgIH = Number(imgMeta.h) || 0;
  const charDrawH = leftH;
  const charDrawW = (imgIW > 0 && imgIH > 0) ? Math.round(leftH * imgIW / imgIH) : leftW;
  const charDrawY = leftY;
  const charDrawX = leftX + (leftW - charDrawW) / 2 + imgX;
  const nameElemCenterX = leftX + leftW / 2;
  const nameElemCenterY = leftY + leftH - 100;
  const nbMeta = d.nameBgImgMeta || {};
  const nbW = Number(nbMeta.w) || 0, nbH = Number(nbMeta.h) || 0;
  let elemBgW, elemBgH;
  if (nbW > 0 && nbH > 0) {
    if (nbW >= nbH) { elemBgW = leftW / 2; elemBgH = Math.round(elemBgW * nbH / nbW); }
    else { elemBgH = leftW / 2; elemBgW = Math.round(elemBgH * nbW / nbH); }
  } else { elemBgW = leftW / 2; elemBgH = elemBgW; }
  const elemBgX = nameElemCenterX - elemBgW / 2;
  const elemBgY = nameElemCenterY - elemBgH / 2;
  const infoRows = [
    d.version ? ['当前版本:', d.version, 'version'] : null,
    d.date ? ['制作日期:', d.date, 'date'] : null,
    d.author ? ['作者:', d.author, 'author'] : null
  ].filter(Boolean);
  const infoFs = 12;
  const CI = LAYOUT.charInfo;
  const infoBottomCenterY = leftY + leftH - CI.padB - infoFs / 2;
  let info = '';
  infoRows.forEach((r, i) => {
    const ix = leftX + CI.padL;
    const iy = infoBottomCenterY - (infoRows.length - 1 - i) * CI.lineGap;
    info += text(ix, iy, `${r[0]} ${r[1]}`, infoFs, { fill: '#ffffff', stroke: '#000000', strokeWidth: 1.2, field: r[2] });
  });
  const row2Y = LAYOUT.layers.row2.y, row2H = LAYOUT.layers.row2.h;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
    <defs>
      <style>${fontFace} text { font-family: ${fontFamily}; paint-order: stroke fill; }</style>
      <linearGradient id="slotBottomGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity="0"/>
        <stop offset="50%" stop-color="#000" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="#000" stop-opacity="1"/>
      </linearGradient>
      <linearGradient id="sepGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
        <stop offset="50%" stop-color="#fff" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <clipPath id="leftClip"><rect x="${leftX}" y="${leftY}" width="${leftW}" height="${leftH}" rx="${LAYOUT.radius.panel}"/></clipPath>
    </defs>
    
    <!-- 背景：深炭灰 -->
    <rect width="${SVG_W}" height="${SVG_H}" fill="#141312"/>
    
    ${d.bgImg ? image(d.bgImg, 0, 0, SVG_W, SVG_H) : ''}
    
    <!-- 已彻底删除全局遮罩 -->

    <!-- 左侧立绘面板 -->
    ${panelRect(leftX, leftY, leftW, leftH, LAYOUT.radius.panel)}
    
    ${d.charImg ? image(d.charImg, charDrawX, charDrawY, charDrawW, charDrawH, 'xMidYMid meet', 'clip-path="url(#leftClip)" id="charImgEl"') : ''}
    ${info}
    ${d.nameBgImg ? image(d.nameBgImg, elemBgX, elemBgY, elemBgW, elemBgH, 'xMidYMid meet', 'opacity="0.75"') : ''}
    
    ${text(nameElemCenterX, nameElemCenterY, d.charName, nameFs, { anchor: 'middle', weight: 400, field: 'charName', fit: { maxW: 280, base: 50, min: 18 }, extra: 'filter="drop-shadow(0 2px 8px rgba(0,0,0,.6))"' })}
    
    ${panelRect(LAYOUT.right.x, LAYOUT.layers.weapon.y, LAYOUT.right.w, LAYOUT.layers.weapon.h, LAYOUT.radius.panel)}
    ${sectionTitle(LAYOUT.right.x + LAYOUT.title.offX, LAYOUT.layers.weapon.y + LAYOUT.title.offY, '武器推荐')}
    ${buildWeapons()}
    
    ${panelRect(LAYOUT.layers.artifact.x, row2Y, LAYOUT.layers.artifact.w, row2H, LAYOUT.radius.panel)}
    ${sectionTitle(LAYOUT.layers.artifact.x + LAYOUT.title.offX, row2Y + LAYOUT.title.offY, '圣遗物推荐')}
    ${buildArtifacts()}
    
    ${panelRect(LAYOUT.layers.talent.x, row2Y, LAYOUT.layers.talent.w, row2H, LAYOUT.radius.panel)}
    ${sectionTitle(LAYOUT.layers.talent.x + LAYOUT.title.offX, row2Y + LAYOUT.title.offY, '天赋加点')}
    ${buildTalents()}
    
    ${midSection(LAYOUT.layers.mid.stat, '词条推荐', buildStats())}
    ${midSection(LAYOUT.layers.mid.panel, '面板参考', buildPanel())}
    ${midSection(LAYOUT.layers.mid.cons, '核心命座', buildConstellations())}
    
    ${panelRect(LAYOUT.right.x, LAYOUT.layers.team.y, LAYOUT.right.w, LAYOUT.layers.team.h, LAYOUT.radius.panel)}
    ${sectionTitle(LAYOUT.right.x + LAYOUT.title.offX, LAYOUT.layers.team.y + LAYOUT.title.offY, '配队参考')}
    ${buildTeams()}
  </svg>`;
}

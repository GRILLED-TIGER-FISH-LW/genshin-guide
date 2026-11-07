/* =========================================================================
 * 角色一图流 · 绘制引擎
 * =========================================================================
 * 与旧 public/tools/character/svg.js 同源：坐标尺寸全走 guideConsts.js 的 LAYOUT，
 * 输出一整段 <svg> 字符串。预览和导出共用这一个入口 —— 预览把它塞进 v-html，
 * 导出时把同一段字符串喂给 canvas（下一批接视频封面那条 svgToPng 链）。
 *
 * 字体：视频封面那套共享设施（src/lib/fonts.js）把字体按真实字体名注册进文档，
 * 所以这里只要把 font-family 写成 '字体名', 兜底族 就行，不需要旧版的 CardCustomFont。
 * 量宽必须用同一个族，否则自适应字号会按兜底字体算。
 *
 * icons 参数是 shared/ui-icons.js 整份：
 *   icons.artifact  花 / 杯 / 冠 三个词条图标（路径数据）
 *   icons.card.plusPath  配队里主角色之间的加号
 *
 * 相对旧版的删除：text() 的 data-field / data-fit-*（旧版按 DOM 节点局部改字用）、
 * slot() 的 field 参数、图片上的 id="charImgEl"。
 *
 * shortcut: 每次输入整份重拼字符串（1280×720、无滤镜），量小，不值得做局部更新。
 * ========================================================================= */
import {
  EMPTY_FILL, FONT_FAMILY_DEFAULT, LAYOUT, MID_CONTENT_Y, PANEL_EMPTY_TEXT, PANEL_PRIMARY_LABELS,
  SVG_H, SVG_W, TALENT_EMPTY_TEXT, WEAPON_LABELS, WEAPON_MAX, WEAPON_ORDER,
} from './guideConsts.js'

/* 字段名与旧版一图流、IDB 里的草稿逐字一致 */
export const DEFAULTS = {
  charName: '', version: '', date: '', author: '烤吃虎鱼LW',
  theme: '#939393',
  imgX: 0,
  charImg: '', charImgMeta: null, charImgDeleted: false, charImgManual: false,
  nameBgImg: '', nameBgImgMeta: null, nameBgImgDeleted: false, nameBgImgManual: false,
  bgImg: '', bgImgDeleted: false, bgImgManual: false,
  sandMain: '', gobMain: '', cirMain: '', subStats: '',
  talentA: '', talentE: '', talentQ: '',
  panel: { primaryKey: 'hp', primaryValue: '', cr: '', cd: '', em: '', er: '' },
  weaponData: { graduate: [], optional: [], newbie: [] },
  artifactData: [],
  constellationData: Array.from({ length: 6 }, () => ({ active: false, desc: '' })),
  teamCoreImg: '', teamCoreImgManual: false,
  teamData: [],
  fontData: '', fontName: '', fontFileName: '',
}

export const fresh = () => structuredClone(DEFAULTS)

/* 一支队伍固定四格：0 号是卡片主角（由角色名称 / 1 号位头像决定，编辑器不碰） */
export const makeTeam = () => ({
  name: '',
  chars: Array.from({ length: 4 }, () => ({
    name: '', img: '', imgManual: false, emptyAltText: '暂无备选', alts: [],
  })),
})

/* =========================================================================
 * 文本测量与自动排版
 * -------------------------------------------------------------------------
 * family 是当前这次出图用的字体族，由 buildGuideSVG 在开始时定，
 * 量宽和 SVG 里的 font-family 必须一致。
 * ========================================================================= */
const measureCtx = document.createElement('canvas').getContext('2d')

let family = FONT_FAMILY_DEFAULT

const fontFamilyOf = (name) => (name ? `'${name}', ${FONT_FAMILY_DEFAULT}` : FONT_FAMILY_DEFAULT)

const measureTextWidth = (content, size) => {
  measureCtx.font = `${size}px ${family}`
  return measureCtx.measureText(String(content ?? '')).width
}

/* 从 base 逐级降到放得下为止；空文本直接给 base */
const fitSize = (content, maxW, base, min = 8) => {
  const str = String(content ?? '')
  if (!str) return base
  let size = base
  while (size > min && measureTextWidth(str, size) > maxW) size -= 1
  return size
}

/* 折行：放不下就给 null，让调用方换更小的字号再试 */
const wrapTextLines = (content, maxW, size, maxLines) => {
  const chars = Array.from(String(content ?? ''))
  if (!chars.length) return []

  const lines = []
  let line = ''
  for (const ch of chars) {
    const next = line + ch
    if (!line || measureTextWidth(next, size) <= maxW) line = next
    else { lines.push(line); line = ch }
  }
  if (line) lines.push(line)

  if (lines.length > maxLines) return null
  if (lines.some((l) => measureTextWidth(l, size) > maxW)) return null
  return lines
}

/* 整块居中折行（词条盒子里的值、备选为空时的提示） */
const wrappedCenteredText = (x, areaTop, areaW, areaH, content, maxW, base, min, fill = '#ddd') => {
  const centerX = x + areaW / 2
  for (let size = base; size >= min; size -= 1) {
    const lineH = Math.round(size * 1.08)
    const lines = wrapTextLines(content, maxW, size, Math.max(1, Math.floor(areaH / lineH)))
    if (!lines) continue

    const firstY = areaTop + (areaH - lines.length * lineH) / 2 + lineH / 2
    return lines.map((line, i) => text(centerX, firstY + i * lineH, line, size, { fill, anchor: 'middle' })).join('')
  }
  return text(centerX, areaTop + areaH / 2, content, min, { fill, anchor: 'middle' })
}

/* 左对齐折行（副词条、命座描述），放不下就一路降到 min，再放不下就硬排 */
const wrappedLeftText = (x, areaTop, areaW, areaH, content, maxW, base, min, fill = '#ddd', padY = 0) => {
  const fitH = areaH - padY * 2
  for (let size = base; size >= min; size -= 1) {
    const lineH = Math.round(size * 1.08)
    const lines = wrapTextLines(content, maxW, size, Math.max(1, Math.floor(fitH / lineH)))
    if (!lines) continue

    const firstY = areaTop + (areaH - lines.length * lineH) / 2 + lineH / 2
    return lines.map((line, i) => text(x, firstY + i * lineH, line, size, { fill })).join('')
  }

  const lineH = Math.round(min * 1.08)
  const forced = wrapTextLines(content, maxW, min, 999)
  if (forced?.length) {
    return forced.map((line, i) => text(x, areaTop + lineH / 2 + i * lineH, line, min, { fill })).join('')
  }
  return text(x, areaTop + areaH / 2, content, min, { fill })
}

/* =========================================================================
 * SVG 绘制原语
 * ========================================================================= */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

const text = (x, y, content, size, opts = {}) => {
  const fill = opts.fill || '#F2F1EA'
  const anchor = opts.anchor || 'start'
  const weight = opts.weight || '400'
  const opacity = opts.opacity == null ? 1 : opts.opacity
  const baseline = opts.baseline || 'middle'

  let attrs = `x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="${baseline}" opacity="${opacity}"`
  if (opts.stroke) attrs += ` stroke="${opts.stroke}" stroke-width="${opts.strokeWidth || 0}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill"`
  if (opts.extra) attrs += ' ' + opts.extra

  return `<text ${attrs}>${esc(content)}</text>`
}

const rect = (x, y, w, h, fill, stroke = '', sw = 0, rx = 8, opacity = 1, clip = '') => {
  let attrs = `x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" opacity="${opacity}"`
  if (stroke) attrs += ` stroke="${stroke}" stroke-width="${sw}"`
  if (clip) attrs += ` clip-path="url(#${clip})"`
  return `<rect ${attrs}/>`
}

const image = (href, x, y, w, h, fit = 'xMidYMid slice', extra = '') =>
  `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${fit}" ${extra}/>`

const panelRect = (x, y, w, h, rx) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="rgba(0, 0, 0, 0.4)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1"/>`

/* 面板标题：小圆点 + 标题，圆点取元素色 */
const sectionTitle = (x, y, title, theme) => {
  const { fs, dotR, dotGap } = LAYOUT.title
  return `<circle cx="${x + dotR}" cy="${y}" r="${dotR}" fill="${theme || '#939393'}"/>` +
    text(x + dotR * 2 + dotGap, y, title, fs, { fill: '#FFFFFF' })
}

/* 没有图标时的灰底占位：一张 200×200 的 SVG（旧版原样） */
export const placeholder = (label = '') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="100" y="112" font-size="52" text-anchor="middle" fill="#666" font-family="sans-serif">${esc(label)}</text></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/* ui-icons.js 的路径图标（1024 视框）绘制到 size 大小，填充取元素色 */
const pathIcon = (paths, cx, cy, size, theme) => {
  if (!paths?.length) return ''
  const half = size / 2
  const body = paths.map((d) => `<path d="${d}"/>`).join('')
  return `<g transform="translate(${cx - half}, ${cy - half}) scale(${size / 1024})" fill="${theme}" stroke="#FFFFFF" stroke-width="12" stroke-linejoin="round" stroke-linecap="round">${body}</g>`
}

/* =========================================================================
 * 图标槽：方图 + 底部渐变压条 + 条上名字
 * ========================================================================= */
const slot = (x, y, size, img, name, key) => {
  const cp = `clip_${key}`
  const radius = Math.round(size * LAYOUT.radius.slotFactor)
  const labelH = Math.round(size / 5)
  const maxW = size - (radius / 3) * 2
  const labelSize = fitSize(name, maxW, labelH * 0.8, 3)
  const labelY = y + size - labelH / 2 + labelSize * 0.35

  return `
    <clipPath id="${cp}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}"/></clipPath>
    ${rect(x, y, size, size, 'rgba(0,0,0,.4)', '', 0, radius)}
    ${image(img || placeholder(), x, y, size, size, 'xMidYMid slice', `clip-path="url(#${cp})"`)}
    <rect x="${x}" y="${y + size - labelH}" width="${size}" height="${labelH}" fill="url(#slotBottomGrad)" clip-path="url(#${cp})"/>
    ${name ? text(x + size / 2, labelY, name, labelSize, { anchor: 'middle', baseline: 'alphabetic' }) : ''}`
}

/* 散搭双图标：两个方图并排，中间一道缝，外面两角圆、内侧方 */
const doubleArtifact = (x, y, size, a, key) => {
  const gap = LAYOUT.doubleGap
  const w = size * 2 + gap
  const radius = Math.round(size * LAYOUT.radius.slotFactor)
  const cpL = `clip_${key}_l`
  const cpR = `clip_${key}_r`
  const labelH = Math.round(size / 5)
  const maxW = w - (radius / 3) * 2
  const displayName = a.displayText || [a.name1, a.name2].filter(Boolean).join(' + ')
  const fs = fitSize(displayName, maxW, labelH * 0.8, 4)
  const labelY = y + size - labelH / 2 + fs * 0.35
  const right = x + size + gap

  const label = displayName
    ? `
    <rect x="${x}" y="${y + size - labelH}" width="${size}" height="${labelH}" fill="url(#slotBottomGrad)" clip-path="url(#${cpL})"/>
    <rect x="${x + size}" y="${y + size - labelH}" width="${gap}" height="${labelH}" fill="url(#slotBottomGrad)"/>
    <rect x="${right}" y="${y + size - labelH}" width="${size}" height="${labelH}" fill="url(#slotBottomGrad)" clip-path="url(#${cpR})"/>
    ${text(x + w / 2, labelY, displayName, fs, { anchor: 'middle', baseline: 'alphabetic' })}`
    : ''

  return `
    <clipPath id="${cpL}"><path d="M${x + radius} ${y}H${x + size}V${y + size}H${x + radius}Q${x} ${y + size} ${x} ${y + size - radius}V${y + radius}Q${x} ${y} ${x + radius} ${y}Z"/></clipPath>
    <clipPath id="${cpR}"><path d="M${right} ${y}H${right + size - radius}Q${right + size} ${y} ${right + size} ${y + radius}V${y + size - radius}Q${right + size} ${y + size} ${right + size - radius} ${y + size}H${right}Z"/></clipPath>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="rgba(0,0,0,.4)" clip-path="url(#${cpL})"/>
    <rect x="${right}" y="${y}" width="${size}" height="${size}" fill="rgba(0,0,0,.4)" clip-path="url(#${cpR})"/>
    ${image(a.img1 || placeholder(), x, y, size, size, 'xMidYMid slice', `clip-path="url(#${cpL})"`)}
    ${image(a.img2 || placeholder(), right, y, size, size, 'xMidYMid slice', `clip-path="url(#${cpR})"`)}
    ${label}`
}

/* =========================================================================
 * 各区块内容
 * ========================================================================= */
const buildWeapons = (d) => {
  const groups = WEAPON_ORDER.filter((type) => d.weaponData[type]?.length)
  if (!groups.length) return ''

  const size = LAYOUT.iconSize
  const step = size + LAYOUT.iconGap
  const { weaponSlotY: slotY, weaponLabelOffsetY: labelOffsetY, weaponLabelFs: labelFs } = LAYOUT
  const sepGap = 20
  let out = ''
  let x = LAYOUT.right.x + LAYOUT.padX

  groups.forEach((type, gi) => {
    if (gi > 0) out += `<rect x="${x - sepGap - 1}" y="${slotY}" width="2" height="${size}" fill="url(#sepGrad)"/>`

    const group = d.weaponData[type]
    group.slice(0, WEAPON_MAX).forEach((w, i) => {
      out += slot(x + i * step, slotY, size, w.img, w.name, `w_${type}_${i}`)
    })

    const labelX = x + Math.max(26, (group.length * step - (step - size)) / 2)
    out += text(labelX, slotY + size + labelOffsetY + labelFs / 2, WEAPON_LABELS[type], labelFs, { fill: LAYOUT.labelColor, anchor: 'middle', weight: 500 })

    x += group.length * step + (sepGap + 2 + sepGap) - (step - size)
  })

  return out
}

const buildArtifacts = (d) => {
  if (!d.artifactData.length) return ''

  const size = LAYOUT.iconSize
  const step = size + LAYOUT.iconGap
  const doubleStep = size * 2 + LAYOUT.doubleGap + LAYOUT.iconGap
  let out = ''
  let x = LAYOUT.layers.artifact.x + LAYOUT.padX

  d.artifactData.forEach((a, i) => {
    if (a.type === 'double') {
      out += doubleArtifact(x, LAYOUT.artifactSlotY, size, a, `a_${i}`)
      x += doubleStep
    } else {
      out += slot(x, LAYOUT.artifactSlotY, size, a.img, a.name, `a_${i}`)
      x += step
    }
  })

  return out
}

const buildTalents = (d) => {
  const layer = LAYOUT.layers.talent
  const contentX = layer.x + LAYOUT.padX
  const contentY = LAYOUT.layers.row2.y + LAYOUT.contentOffsetY
  const { boxH, colGap, labelFs, valueFs } = LAYOUT.talent
  const colW = (layer.w - LAYOUT.padX * 2 - colGap * 2) / 3
  const rx = LAYOUT.radius.inner
  const maxW = colW - 16

  const items = [
    ['普通攻击', d.talentA],
    ['元素战技', d.talentE],
    ['元素爆发', d.talentQ],
  ]

  return items.map(([label, value], i) => {
    const x = contentX + i * (colW + colGap)
    const empty = !value
    const shown = empty ? TALENT_EMPTY_TEXT : value

    return `
      ${rect(x, contentY, colW, boxH, LAYOUT.innerBoxFill, '', 0, rx)}
      ${text(x + colW / 2, contentY + 17, label, labelFs, { fill: LAYOUT.labelColor, anchor: 'middle', weight: 500 })}
      ${text(x + colW / 2, contentY + 44, shown, fitSize(shown, maxW, valueFs, 10), { fill: empty ? EMPTY_FILL : '#fff', anchor: 'middle', weight: 600 })}`
  }).join('')
}

const statBox = (d, artIcons, x, y, w, h, iconKey, title, value) => {
  const boxRx = LAYOUT.radius.inner
  const iconSize = LAYOUT.stat.iconSize
  const labelFs = LAYOUT.stat.labelFs
  const gap = 4
  const totalW = iconSize + gap + measureTextWidth(title, labelFs)
  const startX = x + (w - totalW) / 2
  const centerY = y + 16
  const valueAreaTop = y + 32
  const valueAreaH = h - 36
  const maxW = w - boxRx * 2

  return `
    ${rect(x, y, w, h, LAYOUT.innerBoxFill, '', 0, boxRx)}
    ${pathIcon(artIcons[iconKey], startX + iconSize / 2, centerY, iconSize, d.theme)}
    ${text(startX + iconSize + gap, centerY, title, labelFs, { fill: LAYOUT.labelColor, weight: 500 })}
    ${value ? wrappedCenteredText(x + boxRx, valueAreaTop, maxW, valueAreaH, value, maxW, 12, 6, '#fff') : ''}`
}

const buildStats = (d, artIcons) => {
  const layer = LAYOUT.layers.mid.stat
  const contentX = layer.x + LAYOUT.padX
  const contentW = layer.w - LAYOUT.padX * 2
  const { boxW, boxH, gap, subH, subGap, subLabelFs } = LAYOUT.stat
  const subY = MID_CONTENT_Y + boxH + subGap
  const totalW = boxW * 3 + gap * 2
  const offsetX = contentX + (contentW - totalW) / 2
  const subLabelX = offsetX + 10
  const subTextX = subLabelX + measureTextWidth('副词条：', subLabelFs) + 5
  const subTextW = offsetX + totalW - 10 - subTextX

  return `
    ${statBox(d, artIcons, offsetX, MID_CONTENT_Y, boxW, boxH, 'flower', '时之沙', d.sandMain)}
    ${statBox(d, artIcons, offsetX + boxW + gap, MID_CONTENT_Y, boxW, boxH, 'cup', '空之杯', d.gobMain)}
    ${statBox(d, artIcons, offsetX + (boxW + gap) * 2, MID_CONTENT_Y, boxW, boxH, 'crown', '理之冠', d.cirMain)}
    ${rect(offsetX, subY, totalW, subH, LAYOUT.innerBoxFill, '', 0, LAYOUT.radius.inner)}
    ${text(subLabelX, subY + subH / 2, '副词条：', subLabelFs, { fill: LAYOUT.labelColor, weight: 500 })}
    ${wrappedLeftText(subTextX, subY, subTextW, subH, d.subStats, subTextW, 12, 6, '#fff', 4)}`
}

const buildPanel = (d) => {
  const p = d.panel || {}
  const contentX = LAYOUT.layers.mid.panel.x + LAYOUT.padX
  const { cols, cellW, cellH, gapX, gapY, innerPadX, labelFs, valueFs } = LAYOUT.panel
  const rx = LAYOUT.radius.inner

  const items = [
    { label: PANEL_PRIMARY_LABELS[p.primaryKey] || PANEL_PRIMARY_LABELS.hp, value: p.primaryValue },
    { label: '元素精通', value: p.em },
    { label: '暴击率', value: p.cr },
    { label: '暴击伤害', value: p.cd },
    { label: '充能效率', value: p.er },
  ]

  return items.map((it, i) => {
    const cx = contentX + (i % cols) * (cellW + gapX)
    const cy = MID_CONTENT_Y + Math.floor(i / cols) * (cellH + gapY)
    const midY = cy + cellH / 2
    const empty = !it.value

    return `
      ${rect(cx, cy, cellW, cellH, LAYOUT.innerBoxFill, '', 0, rx)}
      ${text(cx + innerPadX, midY, it.label, labelFs, { fill: LAYOUT.labelColor, weight: 500 })}
      ${text(cx + cellW - innerPadX, midY, empty ? PANEL_EMPTY_TEXT : it.value, valueFs, { fill: empty ? EMPTY_FILL : '#fff', anchor: 'end' })}`
  }).join('')
}

const buildConstellations = (d) => {
  const layer = LAYOUT.layers.mid.cons
  const colX = layer.x + LAYOUT.padX
  const { boxW, boxH, gapX, gapY, seqFs, descFs } = LAYOUT.cons
  const theme = d.theme
  const rx = LAYOUT.radius.inner

  return d.constellationData.map((c, i) => {
    const x = colX + (i % 2) * (boxW + gapX)
    const y = MID_CONTENT_Y + Math.floor(i / 2) * (boxH + gapY)
    const badgeCx = x + 15
    const badgeCy = y + boxH / 2
    const descX = x + 30
    const descAreaW = x + boxW - 5 - descX
    const active = !!c.active

    const desc = c.desc
      ? wrappedLeftText(descX, y + 2, descAreaW, boxH - 4, c.desc, descAreaW, descFs, 6, '#fff')
      : ''

    const box = active
      ? `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="${rx}" fill="${theme}" fill-opacity="0.25" stroke="${theme}" stroke-opacity="0.5" stroke-width="1"/>`
      : rect(x, y, boxW, boxH, LAYOUT.innerBoxFill, '', 0, rx)

    const badge = `<circle cx="${badgeCx}" cy="${badgeCy}" r="10" fill="${active ? theme : 'rgba(0,0,0,.4)'}"/>` +
      text(badgeCx, badgeCy + 0.5, i + 1, seqFs, { fill: '#fff', anchor: 'middle', weight: active ? 600 : 500 })

    return `
    ${box}
    ${badge}
    ${desc}`
  }).join('')
}

const buildTeams = (d, plusPath) => {
  if (!d.teamData.length) return ''

  const T = LAYOUT.team
  const whiteBoxY = LAYOUT.layers.team.y + LAYOUT.contentOffsetY
  const whiteBoxH = LAYOUT.layers.team.h - LAYOUT.contentOffsetY - LAYOUT.bottomPad

  return d.teamData.slice(0, 3).map((team, ti) => {
    const x = LAYOUT.right.x + LAYOUT.padX + ti * (T.w + T.gap)
    let out = rect(x, whiteBoxY, T.w, whiteBoxH, LAYOUT.innerBoxFill, '', 0, LAYOUT.radius.inner)

    if (team.name) {
      out += text(x + T.w / 2, whiteBoxY + T.nameOffsetY, team.name, fitSize(team.name, 240, T.nameFs, 8),
        { fill: LAYOUT.labelColor, anchor: 'middle', weight: 500 })
    }

    /* 第一格是卡片主角：用左栏那份立绘对应的头像，没单独传 1 号位头像就用角色自己的图 */
    const first = team.chars?.[0] || {}
    const mainChars = [
      { name: d.charName || first.name || '', img: d.teamCoreImg || first.img || '' },
      ...(team.chars || []).slice(1, 4),
    ]
    const mainSize = T.mainSize
    const mainStep = mainSize + T.mainGap
    const mainY = whiteBoxY + T.mainOffsetY
    const mainStartX = x + (T.w - (mainSize * 4 + T.mainGap * 3)) / 2

    mainChars.forEach((c, ci) => {
      const cx = mainStartX + ci * mainStep
      out += slot(cx, mainY, mainSize, c.img, c.name, `t_${ti}_${ci}`)

      if (ci < 3 && plusPath) {
        const plusScale = LAYOUT.plusSize / 16
        out += `<g transform="translate(${cx + mainSize + T.mainGap / 2 - LAYOUT.plusSize / 2}, ${mainY + mainSize / 2 - LAYOUT.plusSize / 2}) scale(${plusScale})"><path d="${plusPath}" fill="${LAYOUT.labelColor}" stroke="${LAYOUT.labelColor}" stroke-width="${LAYOUT.plusStrokeW}" stroke-linejoin="round"/></g>`
      }
    })

    const altStartY = whiteBoxY + T.altOffsetY
    ;(team.chars || []).slice(1, 4).forEach((c, ci) => {
      const rowY = altStartY + ci * (T.altSize + T.altRowGap)
      const alts = (c.alts || []).filter((a) => a.name || a.img).slice(0, 4)
      const label = `${ci + 2}号位备选`
      const labelFs = 10
      const rangeL = x + T.altLabelPadL + measureTextWidth(label, labelFs)
      const rangeW = x + T.w - T.altRangePadR - rangeL
      const centerX = rangeL + rangeW / 2
      const clusterW = alts.length ? alts.length * T.altSize + (alts.length - 1) * T.altGap : 0
      const startX = centerX - clusterW / 2

      out += text(x + T.altLabelPadL, rowY + T.altSize / 2, label, labelFs, { fill: LAYOUT.labelColor, weight: 500 })
      if (!alts.length) {
        out += wrappedCenteredText(rangeL, rowY, rangeW, T.altSize, c.emptyAltText || '暂无备选', rangeW, 10, 5, EMPTY_FILL)
      }

      alts.forEach((a, ai) => {
        out += slot(startX + ai * (T.altSize + T.altGap), rowY, T.altSize, a.img, a.name, `ta_${ti}_${ci + 1}_${ai}`)
      })
    })

    return out
  }).join('')
}

/* =========================================================================
 * 出图
 * ========================================================================= */
export function buildGuideSVG(d, icons = {}) {
  const L = LAYOUT
  const left = L.left

  /* 这次出图用的字体族 —— 量宽与 SVG 里的 font-family 都取它 */
  family = fontFamilyOf(d.fontName)

  const meta = d.charImgMeta || {}
  const iw = Number(meta.w) || 0
  const ih = Number(meta.h) || 0
  const charW = iw > 0 && ih > 0 ? Math.round(left.h * iw / ih) : left.w
  const charX = left.x + (left.w - charW) / 2 + (Number(d.imgX) || 0)

  const nameX = left.x + left.w / 2
  const nameY = left.y + left.h - 100
  const nameFs = fitSize(d.charName, 280, 50, 18)

  const nb = d.nameBgImgMeta || {}
  const nbW = Number(nb.w) || 0
  const nbH = Number(nb.h) || 0
  let elemW = left.w / 2
  let elemH = elemW
  if (nbW > 0 && nbH > 0) {
    if (nbW >= nbH) { elemW = left.w / 2; elemH = Math.round(elemW * nbH / nbW) }
    else { elemH = left.w / 2; elemW = Math.round(elemH * nbW / nbH) }
  }
  const elemX = nameX - elemW / 2
  const elemY = nameY - elemH / 2

  const rows = [
    d.version && ['当前版本:', d.version],
    d.date && ['制作日期:', d.date],
    d.author && ['作者:', d.author],
  ].filter(Boolean)
  const CI = L.charInfo
  const lastY = left.y + left.h - CI.padB - 6
  let info = ''
  rows.forEach(([label, value], i) => {
    const y = lastY - (rows.length - 1 - i) * CI.lineGap
    info += text(left.x + CI.padL, y, `${label} ${value}`, 12, { fill: '#ffffff', stroke: '#000000', strokeWidth: 1.2 })
  })

  const layers = L.layers
  const mid = layers.mid
  const panel = (x, y, w, h, title) =>
    panelRect(x, y, w, h, L.radius.panel) + sectionTitle(x + L.title.offX, y + L.title.offY, title, d.theme)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
    <defs>
      <style>text { font-family: ${family}; paint-order: stroke fill; }</style>
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
      <clipPath id="leftClip"><rect x="${left.x}" y="${left.y}" width="${left.w}" height="${left.h}" rx="${L.radius.panel}"/></clipPath>
    </defs>

    <rect width="${SVG_W}" height="${SVG_H}" fill="#141312"/>
    ${d.bgImg ? image(d.bgImg, 0, 0, SVG_W, SVG_H) : ''}
    ${panelRect(left.x, left.y, left.w, left.h, L.radius.panel)}
    ${d.charImg ? image(d.charImg, charX, left.y, charW, left.h, 'xMidYMid meet', 'clip-path="url(#leftClip)"') : ''}
    ${info}
    ${d.nameBgImg ? image(d.nameBgImg, elemX, elemY, elemW, elemH, 'xMidYMid meet', 'opacity="0.75"') : ''}
    ${text(nameX, nameY, d.charName, nameFs, { anchor: 'middle', extra: 'filter="drop-shadow(0 2px 8px rgba(0,0,0,.6))"' })}

    ${panel(L.right.x, layers.weapon.y, L.right.w, layers.weapon.h, '武器推荐')}
    ${buildWeapons(d)}
    ${panel(layers.artifact.x, layers.row2.y, layers.artifact.w, layers.row2.h, '圣遗物推荐')}
    ${buildArtifacts(d)}
    ${panel(layers.talent.x, layers.row2.y, layers.talent.w, layers.row2.h, '天赋加点')}
    ${buildTalents(d)}
    ${panel(mid.stat.x, mid.y, mid.stat.w, mid.h, '词条推荐')}
    ${buildStats(d, icons.artifact || {})}
    ${panel(mid.panel.x, mid.y, mid.panel.w, mid.h, '面板参考')}
    ${buildPanel(d)}
    ${panel(mid.cons.x, mid.y, mid.cons.w, mid.h, '核心命座')}
    ${buildConstellations(d)}
    ${panel(L.right.x, layers.team.y, L.right.w, layers.team.h, '配队参考')}
    ${buildTeams(d, icons.card?.plusPath)}
  </svg>`
}

/* =========================================================================
 * 角色一图流 · 绘制引擎
 * =========================================================================
 * 与旧 public/tools/character/svg.js 同源：坐标尺寸全走 guideConsts.js 的 LAYOUT，
 * 输出一整段 <svg> 字符串。预览和导出共用这一个入口 —— 预览把它塞进 v-html，
 * 导出时把同一段字符串喂给 canvas（批 5 接上视频封面那条 svgToPng 链）。
 *
 * 已搬：左栏角色区、武器推荐、圣遗物推荐（含散搭）、词条推荐、面板参考
 *       + 七个面板底与标题。
 * 待搬：天赋 / 命座 / 配队的内容（批 4）。
 *
 * icons 参数是 ui-icons.js 的 artifact 组（花 / 杯 / 冠 路径），由界面取好传进来；
 * 没有就少画三个小图标，不影响别的。
 *
 * 相对旧版的删除：text() 里 data-field / data-fit-* 那组属性是给旧版「按 DOM 节点
 * 局部改字」用的，Vue 里整份重画，不需要；slot()/doubleArtifact() 的 field 参数
 * （同一个用途）、图片上 id="charImgEl" 同理。
 *
 * shortcut: 每次输入整份重拼字符串（1280×720、无滤镜），量小，不值得做局部更新；
 *           等出现大图模糊或几十个 text 一起量宽时再改成只重画变的块。
 * ========================================================================= */
import {
  EMPTY_FILL, FONT_FAMILY_DEFAULT, LAYOUT, MID_CONTENT_Y, PANEL_EMPTY_TEXT, PANEL_PRIMARY_LABELS,
  SVG_H, SVG_W, WEAPON_LABELS, WEAPON_MAX, WEAPON_ORDER,
} from './guideConsts.js'

/* 字段名与旧版一图流、IDB 里的草稿逐字一致，旧档才读得进来。
   批 4 再往里加天赋 / 命座 / 配队字段。 */
export const DEFAULTS = {
  charName: '', version: '', date: '', author: '烤吃虎鱼LW',
  theme: '#939393',
  imgX: 0,
  charImg: '', charImgMeta: null, charImgDeleted: false, charImgManual: false,
  nameBgImg: '', nameBgImgMeta: null, nameBgImgDeleted: false, nameBgImgManual: false,
  bgImg: '', bgImgDeleted: false, bgImgManual: false,
  sandMain: '', gobMain: '', cirMain: '', subStats: '',
  panel: { primaryKey: 'hp', primaryValue: '', cr: '', cd: '', em: '', er: '' },
  weaponData: { graduate: [], optional: [], newbie: [] },
  artifactData: [],
}

export const fresh = () => structuredClone(DEFAULTS)

/* =========================================================================
 * 文本测量与自动排版：字号自适应靠 canvas 量宽，同一个文本要反复量
 * ========================================================================= */
const measureCtx = document.createElement('canvas').getContext('2d')

const measureTextWidth = (content, size) => {
  measureCtx.font = `${size}px ${FONT_FAMILY_DEFAULT}`
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

/* 整块居中折行（词条盒子里的值） */
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

/* 左对齐折行（副词条那一行），放不下就一路降到 min，再放不下就硬排 */
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
 * SVG 绘制原语（与旧 svg.js 逐个对齐）
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
 * 图标槽：方图 + 底部渐变压条 + 条上名字（名字太长自动缩字号）
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
/* 武器：毕业 / 可选 / 新手，三组横向排，组间一条竖分隔线 */
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

/* 圣遗物：整套一个槽，散搭两个槽 */
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

/* 词条：三个主词条盒（图标 + 标题 + 值），下面一条副词条 */
const statBox = (d, icons, x, y, w, h, iconKey, title, value) => {
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
    ${pathIcon(icons[iconKey], startX + iconSize / 2, centerY, iconSize, d.theme)}
    ${text(startX + iconSize + gap, centerY, title, labelFs, { fill: LAYOUT.labelColor, weight: 500 })}
    ${value ? wrappedCenteredText(x + boxRx, valueAreaTop, maxW, valueAreaH, value, maxW, 12, 6, '#fff') : ''}`
}

const buildStats = (d, icons) => {
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
    ${statBox(d, icons, offsetX, MID_CONTENT_Y, boxW, boxH, 'flower', '时之沙', d.sandMain)}
    ${statBox(d, icons, offsetX + boxW + gap, MID_CONTENT_Y, boxW, boxH, 'cup', '空之杯', d.gobMain)}
    ${statBox(d, icons, offsetX + (boxW + gap) * 2, MID_CONTENT_Y, boxW, boxH, 'crown', '理之冠', d.cirMain)}
    ${rect(offsetX, subY, totalW, subH, LAYOUT.innerBoxFill, '', 0, LAYOUT.radius.inner)}
    ${text(subLabelX, subY + subH / 2, '副词条：', subLabelFs, { fill: LAYOUT.labelColor, weight: 500 })}
    ${wrappedLeftText(subTextX, subY, subTextW, subH, d.subStats, subTextW, 12, 6, '#fff', 4)}`
}

/* 面板：主属性 + 四项副属性，两列排，空值显示「任意」 */
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

/* =========================================================================
 * 出图
 * ========================================================================= */
export function buildGuideSVG(d, icons = {}) {
  const L = LAYOUT
  const left = L.left

  /* 立绘：按原图比例贴满左栏高度，imgX 左右挪 */
  const meta = d.charImgMeta || {}
  const iw = Number(meta.w) || 0
  const ih = Number(meta.h) || 0
  const charW = iw > 0 && ih > 0 ? Math.round(left.h * iw / ih) : left.w
  const charX = left.x + (left.w - charW) / 2 + (Number(d.imgX) || 0)

  const nameX = left.x + left.w / 2
  const nameY = left.y + left.h - 100
  const nameFs = fitSize(d.charName, 280, 50, 18)

  /* 元素图：等比缩进左栏一半宽度，居中在名字背后 */
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

  /* 版本 / 日期 / 作者：贴着左栏底部往上排，空值不占行 */
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

  /* 一块面板 = 底 + 标题。天赋 / 命座 / 配队的内容按批 4 往里填 */
  const layers = L.layers
  const mid = layers.mid
  const panel = (x, y, w, h, title) =>
    panelRect(x, y, w, h, L.radius.panel) + sectionTitle(x + L.title.offX, y + L.title.offY, title, d.theme)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
    <defs>
      <style>text { font-family: ${FONT_FAMILY_DEFAULT}; paint-order: stroke fill; }</style>
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
    ${panel(mid.stat.x, mid.y, mid.stat.w, mid.h, '词条推荐')}
    ${buildStats(d, icons)}
    ${panel(mid.panel.x, mid.y, mid.panel.w, mid.h, '面板参考')}
    ${buildPanel(d)}
    ${panel(mid.cons.x, mid.y, mid.cons.w, mid.h, '核心命座')}
    ${panel(L.right.x, layers.team.y, L.right.w, layers.team.h, '配队参考')}
  </svg>`
}

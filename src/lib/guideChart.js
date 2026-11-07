/* =========================================================================
 * 角色一图流 · 绘制引擎
 * =========================================================================
 * 与旧 public/tools/character/svg.js 同源：坐标尺寸全走 guideConsts.js 的 LAYOUT，
 * 输出一整段 <svg> 字符串。预览和导出共用这一个入口 —— 预览把它塞进 v-html，
 * 导出时把同一段字符串喂给 canvas（批 4 接上视频封面那条 svgToPng 链）。
 *
 * 批 1 只画骨架：左栏角色区 + 右栏七个空面板。
 * 武器 / 圣遗物 / 词条 / 面板 / 命座 / 配队的内容按批 2、批 3 往里填。
 *
 * 相对旧版的删除：text() 里 data-field / data-fit-* 那组属性是给旧版「按 DOM 节点
 * 局部改字」用的，Vue 里整份重画，不需要；图片上 id="charImgEl" 同理（那是旧版
 * 上传后手动改 src 的钩子）。
 *
 * shortcut: 每次输入整份重拼字符串（1280×720、无滤镜），量小，不值得做局部更新；
 *           等出现大图模糊或几十个 text 一起量宽时再改成只重画变的块。
 * ========================================================================= */
import { LAYOUT, SVG_W, SVG_H, FONT_FAMILY_DEFAULT } from './guideConsts.js'

/* 字段名与旧版一图流、IDB 里的草稿逐字一致，旧档才读得进来。
   批 2 起往里加武器 / 圣遗物 / 词条 / 面板 / 命座 / 配队字段。 */
export const DEFAULTS = {
  charName: '', version: '', date: '', author: '',
  theme: '#939393',
  imgX: 0,
  charImg: '', charImgMeta: null, charImgDeleted: false, charImgManual: false,
  nameBgImg: '', nameBgImgMeta: null, nameBgImgDeleted: false, nameBgImgManual: false,
  bgImg: '', bgImgDeleted: false, bgImgManual: false,
}

export const fresh = () => structuredClone(DEFAULTS)

/* =========================================================================
 * 文本测量：字号自适应靠 canvas 量宽，所以同一个文本要反复量
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

/* =========================================================================
 * SVG 绘制原语（与旧 svg.js 逐个对齐）
 * ========================================================================= */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

const text = (x, y, content, size, opts = {}) => {
  const fill = opts.fill || '#F2F1EA'
  const anchor = opts.anchor || 'start'
  const weight = opts.weight || '400'
  const baseline = opts.baseline || 'middle'

  let attrs = `x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="${baseline}"`
  if (opts.stroke) attrs += ` stroke="${opts.stroke}" stroke-width="${opts.strokeWidth || 0}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill"`
  if (opts.extra) attrs += ' ' + opts.extra

  return `<text ${attrs}>${esc(content)}</text>`
}

const image = (href, x, y, w, h, fit = 'xMidYMid slice', extra = '') =>
  `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${fit}" ${extra}/>`

const panelRect = (x, y, w, h, rx) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="rgba(0, 0, 0, 0.4)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1"/>`

/* 面板标题：小圆点 + 标题。圆点取元素色 */
const sectionTitle = (x, y, title, theme) => {
  const { fs, dotR, dotGap } = LAYOUT.title
  return `<circle cx="${x + dotR}" cy="${y}" r="${dotR}" fill="${theme || '#939393'}"/>` +
    text(x + dotR * 2 + dotGap, y, title, fs, { fill: '#FFFFFF' })
}

/* =========================================================================
 * 出图
 * ========================================================================= */
export function buildGuideSVG(d) {
  const L = LAYOUT
  const left = L.left
  const isNote = ''

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

  /* 一块面板 = 底 + 标题。内容按批 2、批 3 塞进 section 里 */
  const layers = L.layers
  const mid = layers.mid
  const panel = (x, y, w, h, title) =>
    panelRect(x, y, w, h, L.radius.panel) + sectionTitle(x + L.title.offX, y + L.title.offY, title, d.theme)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
    <defs>
      <style>text { font-family: ${FONT_FAMILY_DEFAULT}; paint-order: stroke fill; }</style>
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
    ${panel(layers.artifact.x, layers.row2.y, layers.artifact.w, layers.row2.h, '圣遗物推荐')}
    ${panel(layers.talent.x, layers.row2.y, layers.talent.w, layers.row2.h, '天赋加点')}
    ${panel(mid.stat.x, mid.y, mid.stat.w, mid.h, '词条推荐')}
    ${panel(mid.panel.x, mid.y, mid.panel.w, mid.h, '面板参考')}
    ${panel(mid.cons.x, mid.y, mid.cons.w, mid.h, '核心命座')}
    ${panel(L.right.x, layers.team.y, L.right.w, layers.team.h, '配队参考')}
  </svg>`
}

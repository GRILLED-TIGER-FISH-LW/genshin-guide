/* =========================================================================
 * 视频封面 · 绘制与导出引擎
 * =========================================================================
 * 三块，都不碰界面：
 *   1. 数据与几何：状态默认值、模式表、图片字典里的序号 / 立绘 / 名片与 logos 解析、
 *      胶囊与浮层几何、文本测量、签名栏
 *   2. 素材：模糊背景条（带缓存）、图片加载、URL → data URL
 *   3. 出图与存档：SVG 克隆烘焙 → PNG、配置导入导出、IndexedDB
 *
 * 预览是 VideoCover.vue 里那份真正的 <svg> 模板，这里只负责给它的数字，
 * 以及「导出时怎么把这份节点变成 PNG」。
 *
 * shortcut: loadImage / urlToDataURL / download 与 collectionCover.js 里那三个
 *           是同一套。第三个工具出现时抽到 src/lib/assets.js。
 * ========================================================================= */

import { loadGlobalScript } from '../composables/useData.js'

export const W = 3840
export const H = 2160

const BLUR_MAX_PX = 100
const BLUR_RENDER_SCALE = 0.5
const LOGO_SIZE = 200
const LOGO_ROUNDED = 50

export const BASE = import.meta.env.BASE_URL
export const LOGO_BASE = `${BASE}images/cover/`
const BOSS_BASE = `${LOGO_BASE}boss-base.png`
const DEFAULT_LOGO_FILE = 'gi-logo.png'

/* =========================================================================
 * 1. 状态默认值与模式表
 * ------------------------------------------------------------------------
 * 字段名与旧版 state 逐字一致：IDB 里的草稿和旧版导出的配置 JSON
 * 都能原样读进来。
 * ========================================================================= */
export const DEFAULTS = {
  showGuides: true,
  safeBoundX: 480,
  bg: '',
  midBrightness: -50,
  midBlur: 50,
  capX: 550,
  capY: 150,
  capH: 250,
  capFontSize: 180,
  capText: '',
  capTextBrightness: 100,
  capLogo: '',
  capEdgeInset: 2 / 3,
  capLogoGap: 40,
  mainX: 550,
  mainY: 760,
  mainSize: 340,
  mainLineGap: 350,
  mainText: '',
  mainColor: '#ffffff',
  subX: 550,
  subY: 1500,
  sub1Size: 200,
  sub2Size: 250,
  sub1: '',
  sub2: '',
  subColor: '#ffffff',
  subLineGap: 250,
  sigX: 550,
  sigY: 1980,
  sigSize: 100,
  sigStarBoost: 15,
  sigColor: '#ffffff',
  fontData: '',
  fontName: '',
  fontFileName: '',
  guideType: 'character',
  bossAvatar: null,
  characterArt: null,
  characterX: 2650,
  floatImg: [],
}

export const fresh = () => structuredClone(DEFAULTS)

export const MODE_MAIN_TEXTS = {
  character: '角色培养\n攻略图鉴',
  boss: '世界Boss\n&地方传奇',
}
export const MODE_CAP_TEXT = { character: '攻略', boss: '攻略' }
export const MODE_SUB_LABELS = {
  character: { sub1: '第一行（自动编号）', sub2: '第二行（角色名）' },
  boss: { sub1: '第一行（BOSS 名）', sub2: '第二行' },
  custom: { sub1: '第一行', sub2: '第二行' },
}
export const MODE_LABEL = { character: '角色攻略', boss: 'Boss攻略', custom: '自定义' }
export const MODE_OPTIONS = ['character', 'boss', 'custom'].map((value) => ({
  value,
  label: MODE_LABEL[value],
}))

export const SUB_SIZE_OPTIONS = [
  { value: '200', label: '小字号' },
  { value: '250', label: '大字号' },
]

/* 切换模式：旧 setGuideType 里「能带走的都不带」那一段，逐条照搬 */
export function applyMode(s, type) {
  s.guideType = type

  if (type === 'character' || type === 'boss') {
    s.mainText = MODE_MAIN_TEXTS[type]
    s.capText = MODE_CAP_TEXT[type]
  } else {
    s.mainText = ''
    s.capText = ''
  }

  s.sub1 = ''
  s.sub2 = ''

  if (type === 'character') {
    s.sub1Size = 200
    s.sub2Size = 250
  } else if (type === 'boss') {
    s.sub1Size = 250
    s.sub2Size = 200
  }

  s.bg = ''

  if (type !== 'character') s.characterArt = null
  if (type !== 'boss') s.bossAvatar = null
}

/* 切模式会连带清掉的东西，用来写确认框文案 */
export function lostOnSwitch(s) {
  const lost = []
  if (s.bg) lost.push('背景图')
  if (s.characterArt) lost.push('角色立绘')
  if (s.bossAvatar) lost.push('Boss 头像')
  return lost
}

/* =========================================================================
 * 2. 数据文件
 * ========================================================================= */
const text = async (path) => {
  try {
    const res = await fetch(`${BASE}${path}?t=${Date.now()}`)
    return res.ok ? await res.text() : ''
  } catch {
    return ''
  }
}

const lines = (txt) => txt.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))

/* 旧配置里存的是工具页时代的相对路径（../../shared/…），走这里统一改写成站点基址。
   姓名与序号那三张 txt 已经退休，本函数现在只服务旧配置的兼容。 */
export function artUrl(raw) {
  const m = String(raw || '').match(/^(?:\.\.\/)+/)
  return m ? `${BASE}${String(raw).slice(m[0].length)}` : raw || ''
}

/* 数据来源换成图片字典（shared/image-dict.js）：序号 / 立绘 / 名片都在里面，
   原来那三张数据表从这一版起退休，本文件不再读 data/ 下的表（只剩 logos）。
   字典里「旅行者·冰」这类分元素条目是独立一条，所以编号与名片不会再丢。 */
export async function loadData() {
  const [logoTxt] = await Promise.all([text('data/logos.txt')])
  await imageLib()

  const dict = window.IMAGE_DICT || {}
  const cardCfg = dict.config?.characters?.card

  const orders = {}
  const art = {}
  const namecards = {}
  for (const [key, item] of Object.entries(dict.characters || {})) {
    const name = item.name || key
    if (item.order) orders[name] = item.order
    if (item.art?.url) art[name] = item.art.url

    const cardKey = item.card?.key
    if (!cardKey || !cardCfg) continue
    const src = item.card?.alt && cardCfg.alt ? cardCfg.alt : cardCfg
    if (src.prefix) namecards[name] = src.prefix + cardKey + (src.ext || '')
  }

  const logos = []
  for (const line of lines(logoTxt)) {
    const parts = line.split(/\s+/)
    if (parts.length >= 2) logos.push({ name: parts[0], file: parts[1] })
  }
  if (!logos.length) logos.push({ name: '原神', file: DEFAULT_LOGO_FILE })

  return { orders, art, namecards, logos }
}

/* 「刻晴·雷」这种带元素后缀的名字，查表时要能回退到本体 */
export const stripElementSuffix = (name) => String(name || '').replace(/[（(][^）)]*[）)]\s*$/, '').trim()
export const padOrder = (n) => String(n).padStart(3, '0')

function pick(dict, name) {
  if (!name) return ''
  const base = stripElementSuffix(name)
  if (dict[name] !== undefined && dict[name] !== '') return dict[name]
  if (dict[base] !== undefined && dict[base] !== '') return dict[base]
  return ''
}

export const artOf = (dicts, name) => pick(dicts.art, name)
export const namecardOf = (dicts, name) => pick(dicts.namecards, name)

export function characterNo(dicts, name) {
  if (!name) return ''
  const order = dicts.orders[name] ?? dicts.orders[stripElementSuffix(name)]
  return order ? `No.${padOrder(order)}` : ''
}

/* =========================================================================
 * 3. 图片字典（Boss 头像）
 * ------------------------------------------------------------------------
 * 走图片字典编辑器那套：把共享脚本当全局挂上，再调它的 fromName。
 * window 只在这里露一次面，不外溢。
 * ========================================================================= */
export const logoUrl = (file) => `${LOGO_BASE}${file}`
export const logoFileOf = (url) =>
  url && url.startsWith(LOGO_BASE) ? url.slice(LOGO_BASE.length) : ''

let imageLibTask = null

function imageLib() {
  if (!imageLibTask) {
    imageLibTask = (async () => {
      await loadGlobalScript('shared/image-dict.js', 'IMAGE_DICT')
      await loadGlobalScript('shared/image-loader.js', 'IMAGE_LIB')
      return window.IMAGE_LIB
    })().catch((err) => {
      imageLibTask = null /* 失败允许下次重试 */
      throw err
    })
  }
  return imageLibTask
}

export async function findMonsterIcon(name) {
  const lib = await imageLib()
  if (!lib?.fromName) throw new Error('图标库缺少 fromName')
  const found = await lib.fromName('monsters', name)
  return found?.dataURL || ''
}

/* =========================================================================
 * 4. 素材
 * ========================================================================= */
export const BASE64_IMAGE = 'image/*'

export function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/* 导出前把所有远程图换成 data URL，导出的 SVG 才能自包含 */
export async function urlToDataURL(url) {
  if (!url || /^data:/i.test(url)) return url
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('FileReader 失败'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return url /* 拿不到就原样留着，让浏览器自己再试一次 */
  }
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const stamp = () => {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/* =========================================================================
 * 5. 模糊背景条
 * ------------------------------------------------------------------------
 * 只在半分辨率上算：3840×2160 连开三层 canvas 加高斯模糊，
 * 手机上每动一次滑块就卡一下。结果按「图 + 模糊 + 亮度」缓存。
 * ========================================================================= */
let blurCacheKey = ''
let blurCacheUrl = ''

export function blurStrip(img, blur, brightness) {
  if (!img) return ''
  const key = `${img.src}|${blur}|${brightness}`
  if (blurCacheKey === key) return blurCacheUrl

  const SS = BLUR_RENDER_SCALE
  const w = Math.round(W * SS)
  const h = Math.round(H * SS)
  const blurNorm = Math.min(100, Math.max(0, Number(blur) || 0)) / 100
  const blurPx = blurNorm * BLUR_MAX_PX * SS
  const slope = 1 + Number(brightness || 0) / 100

  const coverScale = Math.max(w / img.width, h / img.height)
  const coverW = img.width * coverScale
  const coverH = img.height * coverScale
  const coverX = (w - coverW) / 2
  const coverY = (h - coverH) / 2

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')

  if (blurPx > 0) {
    const base = document.createElement('canvas')
    base.width = w
    base.height = h
    base.getContext('2d').drawImage(img, coverX, coverY, coverW, coverH)

    /* 模糊会把边缘透空，所以先垫一圈拉伸出来的边，再看不出接缝 */
    const pad = Math.ceil(blurPx * 3) + 10
    const bw = w + pad * 2
    const bh = h + pad * 2
    const pad2 = document.createElement('canvas')
    pad2.width = bw
    pad2.height = bh
    const p = pad2.getContext('2d')
    p.drawImage(base, pad, pad)
    p.drawImage(base, 0, 0, w, 1, pad, 0, w, pad)
    p.drawImage(base, 0, h - 1, w, 1, pad, pad + h, w, pad)
    p.drawImage(base, 0, 0, 1, h, 0, pad, pad, h)
    p.drawImage(base, w - 1, 0, 1, h, pad + w, pad, pad, h)
    p.drawImage(base, 0, 0, 1, 1, 0, 0, pad, pad)
    p.drawImage(base, w - 1, 0, 1, 1, pad + w, 0, pad, pad)
    p.drawImage(base, 0, h - 1, 1, 1, 0, pad + h, pad, pad)
    p.drawImage(base, w - 1, h - 1, 1, 1, pad + w, pad + h, pad, pad)

    ctx.filter = `blur(${blurPx}px)`
    ctx.drawImage(pad2, -pad, -pad)
    ctx.filter = 'none'
  } else {
    ctx.drawImage(img, coverX, coverY, coverW, coverH)
  }

  if (slope < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - slope})`
    ctx.fillRect(0, 0, w, h)
  } else if (slope > 1) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, slope - 1)})`
    ctx.fillRect(0, 0, w, h)
  }

  blurCacheUrl = out.toDataURL('image/jpeg', 0.92)
  blurCacheKey = key
  return blurCacheUrl
}

export function resetBlurCache() {
  blurCacheKey = ''
  blurCacheUrl = ''
}

/* =========================================================================
 * 6. 几何：全部按 3840×2160 的原始坐标算，缩放交给 viewBox
 * ========================================================================= */
const measureCtx = document.createElement('canvas').getContext('2d')

/* 旧版只给字体名、靠 SVG 内的 <style> 兜底；这里补上通用回退，
   首帧字体没装好时中文至少还能显示 */
export const fontFamily = (name) =>
  name ? `'${name}', system-ui, sans-serif` : 'system-ui, sans-serif'

export function measureText(text, size, font) {
  measureCtx.font = `${size}px ${font}`
  return measureCtx.measureText(String(text)).width
}

/* 以 #1a1a1a 为基准按倍率算灰度（k = 1 → #1a1a1a） */
export function greyHex(base, k) {
  const v = Math.max(0, Math.min(255, Math.round(base * k)))
  const h = v.toString(16).padStart(2, '0')
  return '#' + h + h + h
}

export function capsulePath(x, y, w, h) {
  const r = h / 2
  return (
    `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} ` +
    `A ${r} ${r} 0 0 1 ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  )
}

export function capsule(s) {
  const font = fontFamily(s.fontName)
  const r = s.capH / 2
  const inset = (s.capEdgeInset ?? 2 / 3) * r
  const logoW = s.capLogo ? LOGO_SIZE : 0
  const textW = measureText(s.capText, s.capFontSize, font)
  const logoGap = logoW ? (s.capLogoGap ?? 40) : 0
  const w = logoW + logoGap + textW + 2 * inset

  return {
    r,
    w,
    path: capsulePath(s.capX, s.capY, w, s.capH),
    logoX: s.capX + inset,
    logoY: s.capY + (s.capH - LOGO_SIZE) / 2,
    textRightX: s.capX + w - inset,
    textBaseline: s.capY + s.capH / 2 + s.capFontSize * 0.35,
  }
}

export const LOGO = { size: LOGO_SIZE, radius: LOGO_ROUNDED }

/* 胶囊里的文字：有背景图就挖背景（配套 pattern），否则用灰度底色。
   亮度 0–200%，100% 为原始 */
export function capsuleText(s) {
  const raw = Number(s.capTextBrightness)
  const k = Number.isFinite(raw) ? Math.max(0, Math.min(2, raw / 100)) : 1
  const pattern = !!(s.bg && s.capText)
  return { k, pattern, fill: pattern ? 'url(#capTextPattern)' : greyHex(0x1a, k) }
}

export function floatGeom(o) {
  const h = H * o.scale
  const w = h * (o.w / Math.max(1, o.h))
  return { x: o.x - w / 2, y: (H - h) / 2, w, h }
}

export function floatRadius(o, geom) {
  const r = Math.min(100, Math.max(0, Number(o.rounded) || 0))
  return (Math.min(geom.w, geom.h) / 2) * (r / 100)
}

/* 三个模式各画什么浮层 —— 与旧 collectFloats 一字不差 */
export function collectFloats(s) {
  if (s.guideType === 'boss') {
    const out = [
      { id: 'boss-base', url: BOSS_BASE, w: 1000, h: 1000, x: 2650, scale: 0.7, rounded: 0, underMiddle: true },
    ]
    if (s.bossAvatar?.url) {
      out.push({
        id: 'boss-avatar',
        url: s.bossAvatar.url,
        w: s.bossAvatar.w,
        h: s.bossAvatar.h,
        x: 2650,
        scale: 0.5,
        rounded: 100,
        underMiddle: true,
      })
    }
    return out
  }

  if (s.guideType === 'character') {
    if (!s.characterArt?.url) return []
    return [
      {
        id: 'character-art',
        url: s.characterArt.url,
        w: s.characterArt.w,
        h: s.characterArt.h,
        x: s.characterX,
        scale: 1,
        rounded: 0,
        underMiddle: true,
      },
    ]
  }

  return s.floatImg
}

/* 最多两行，空行只保留开头那一行（旧行为的怪脾气，照抄） */
export const mainLines = (s) =>
  String(s.mainText || '')
    .split('\n')
    .filter((line, i) => line.trim() !== '' || i === 0)
    .slice(0, 2)

export function subLines(s) {
  const out = []
  if (s.sub1) out.push({ key: 'sub1', text: s.sub1, size: s.sub1Size || 200 })
  if (s.sub2) out.push({ key: 'sub2', text: s.sub2, size: s.sub2Size || 250 })
  return out
}

/* 只有一行时往下挪半个行距，视觉上才居中 */
export function subY(s, count, i) {
  const gap = s.subLineGap ?? 250
  return (count === 1 ? s.subY + gap / 2 : s.subY) + i * gap
}

export function signature(s) {
  const font = fontFamily(s.fontName)
  const left = 'GENSHIN IMPACT'
  const star = '✧'
  const right = 'GRILLED TIGER FISH LW'
  const starSize = s.sigSize + s.sigStarBoost
  const gap = measureText(' ', s.sigSize, font)
  const wLeft = measureText(left, s.sigSize, font)
  const wStar = measureText(star, starSize, font)

  return {
    left,
    star,
    right,
    starSize,
    leftX: s.sigX,
    starX: s.sigX + wLeft + gap + wStar / 2,
    rightX: s.sigX + wLeft + gap + wStar + gap,
    baseline: s.sigY,
  }
}

/* 安全区参考线：4/3 裁切框的左边、中间、3/4、右边 */
export function guideLines(s) {
  if (!s.showGuides) return []
  const cropW = (H * 4) / 3
  return [s.safeBoundX, s.safeBoundX + cropW / 2, s.safeBoundX + (cropW * 3) / 4, s.safeBoundX + cropW]
}

/* =========================================================================
 * 7. 出图
 * ------------------------------------------------------------------------
 * 不再有「备份 state → 改成 data URL → buildSVG(forExport) → 还原」那一套：
 * 直接克隆当前这份 SVG 节点，把里面的远程图换成 data URL 就完事。
 * ========================================================================= */
async function bakeSvg(svgEl, fontCss) {
  const clone = svgEl.cloneNode(true)

  /* 参考线（虚线）是预览里对齐用的，导出图一律不要 —— 跟预览开没开无关 */
  for (const el of clone.querySelectorAll('[data-guides]')) el.remove()

  /* 字体：导出的 SVG 是独立文档，摸不到页面的 document.fonts，@font-face 只能内嵌。
     用 createElementNS 建这个 <style>（和角色一图流同一套）—— 别让它以别的命名空间
     进树，那样 XMLSerializer 会给它补另一个 xmlns，这段 CSS 就白写了。 */
  if (fontCss) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = fontCss
    const host = clone.querySelector('defs') || clone
    host.prepend(style)
  }

  /* 自包含：外链图一张都不能留 —— SVG 当图片渲染时不加载任何外部资源 */
  let lost = 0
  for (const img of clone.querySelectorAll('image')) {
    const href = img.getAttribute('href')
    if (!href || /^data:/i.test(href)) continue
    const baked = await urlToDataURL(href)
    if (/^data:/i.test(baked)) img.setAttribute('href', baked)
    else {
      /* 网络 / 跨域拿不到：留着也是空白，删掉并记账，由调用方提示用户 */
      img.remove()
      lost += 1
    }
  }

  /* 预览靠 CSS 撑满，节点本身没有宽高；导出必须给上，
     否则 Image 会按 300×150 的默认尺寸栅格化，出来一张糊图 */
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(W))
  clone.setAttribute('height', String(H))

  return { svg: new XMLSerializer().serializeToString(clone), lost }
}

/* 把同一份 SVG 画到指定尺寸的 canvas 上。
   SVG 是矢量的：同一个 URL 画几次就重新栅格化几次，所以可以先出小图预热字体。 */
async function rasterize(url, w, h) {
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = () => reject(new Error('SVG 渲染失败'))
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

/* 出图：返回 { blob, lost, font }，lost = 没能烘进去的图张数（0 表示与预览一致） */
export async function svgToPng(svgEl, fontCss) {
  const baked = await bakeSvg(svgEl, fontCss)
  const url = URL.createObjectURL(new Blob([baked.svg], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    /* 字体的 data URL 是几兆，第一次栅格化常常在它加载完之前就出图了（导出图退回
       默认字体）。先用同一张 SVG 出一张 320×180 的小图，把字体喂进浏览器的缓存，
       再出大图 —— 小图那点代价可以忽略。 */
    if (fontCss) {
      await rasterize(url, 320, 180)
      await new Promise((resolve) => setTimeout(resolve, 150))
    }

    const canvas = await rasterize(url, W, H)
    const out = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1))
    return { blob: out, lost: baked.lost, font: !!fontCss }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* 文件名：副标题 → 第一行 → 主标题 → 兜底 */
export function pngName(s) {
  const raw = s.sub2?.trim() || s.sub1?.trim() || s.mainText?.trim() || '视频封面'
  return `${raw.replace(/[\r\n]+/g, '').replace(/[\\/:*?"<>|]/g, '_')}_${stamp()}.png`
}

/* =========================================================================
 * 8. 配置导入导出
 * ========================================================================= */
export function exportConfig(s) {
  /* 字体 base64 太大，配置里不带 —— 与旧版一致 */
  const out = { ...s, fontData: '' }
  return {
    text: JSON.stringify(out, null, 2),
    filename: `视频封面配置_${stamp()}.json`,
  }
}

const numOr = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback)
const strOr = (v, fallback = '') => (typeof v === 'string' ? v : fallback)

/* 逐字段归一化 + 路径改写：旧版导出的配置里，立绘 / Logo 还是
   ../../shared/… 那种相对路径，读进来必须换成站点基址 */
export function normalizeImported(raw, cur) {
  const r = raw && typeof raw === 'object' ? raw : {}

  const art = (o) =>
    o && typeof o === 'object' && typeof o.url === 'string' && o.url
      ? { url: artUrl(o.url), w: numOr(o.w, 1), h: numOr(o.h, 1) }
      : null

  return {
    showGuides: r.showGuides !== false,
    safeBoundX: numOr(r.safeBoundX, cur.safeBoundX),
    bg: artUrl(strOr(r.bg)),
    midBrightness: numOr(r.midBrightness, cur.midBrightness),
    midBlur: numOr(r.midBlur, cur.midBlur),
    capX: numOr(r.capX, cur.capX),
    capY: numOr(r.capY, cur.capY),
    capH: numOr(r.capH, cur.capH),
    capFontSize: numOr(r.capFontSize, cur.capFontSize),
    capText: strOr(r.capText),
    capTextBrightness: numOr(r.capTextBrightness, 100),
    capLogo: artUrl(strOr(r.capLogo)),
    capEdgeInset: numOr(r.capEdgeInset, cur.capEdgeInset),
    capLogoGap: numOr(r.capLogoGap, cur.capLogoGap),
    mainText: strOr(r.mainText),
    mainColor: strOr(r.mainColor, '#ffffff'),
    sub1: strOr(r.sub1),
    sub2: strOr(r.sub2),
    sub1Size: numOr(r.sub1Size, 200),
    sub2Size: numOr(r.sub2Size, 250),
    subColor: strOr(r.subColor, '#ffffff'),
    sigColor: strOr(r.sigColor, '#ffffff'),
    fontData: strOr(r.fontData),
    fontName: strOr(r.fontName),
    fontFileName: strOr(r.fontFileName),
    guideType: ['character', 'boss', 'custom'].includes(r.guideType) ? r.guideType : 'character',
    bossAvatar: art(r.bossAvatar),
    characterArt: art(r.characterArt),
    characterX: numOr(r.characterX, cur.characterX),
    floatImg: Array.isArray(r.floatImg)
      ? r.floatImg
          .filter((o) => o && typeof o === 'object' && typeof o.url === 'string' && o.url)
          .map((o) => ({
            id: strOr(o.id, 'f_' + Math.random().toString(36).slice(2, 9)),
            url: artUrl(o.url),
            w: numOr(o.w, 1),
            h: numOr(o.h, 1),
            x: numOr(o.x, W * 0.75),
            scale: numOr(o.scale, 1),
            rounded: numOr(o.rounded, 0),
            underMiddle: o.underMiddle !== false,
          }))
      : [],
  }
}

/* =========================================================================
 * 9. 存档
 * ------------------------------------------------------------------------
 * 库名 / 表名 / 键名与旧版逐字一致：老用户切到 SPA 后草稿还在。
 * ========================================================================= */
const IDB = 'video_cover_db'
const STORE = 'state'
const KEY = 'video_state'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadSaved() {
  try {
    const conn = await openDb()
    const record = await new Promise((resolve) => {
      const req = conn.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
    if (!record) return null
    /* 老草稿里也有相对路径，一并改写 */
    return normalizeImported(record, DEFAULTS)
  } catch {
    return null
  }
}

let saveTimer = null

export function save(s) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    saveTimer = null
    try {
      const conn = await openDb()
      /* reactive 代理不能直接进 IDB：嵌套的数组 / 对象还是 Proxy，structured
         clone 抛 DataCloneError，被下面那句 catch 吞掉就是「草稿永远不更新」——
         每次进页面读到的都是上一次成功写入的旧草稿。先过一次 JSON 变纯数据。
         字体的几兆 base64 不进草稿，进页面按文件名重新取（见 ensureFont）。 */
      const plain = JSON.parse(JSON.stringify(s))
      plain.fontData = ''
      conn.transaction(STORE, 'readwrite').objectStore(STORE).put(plain, KEY)
    } catch {
      /* 存不下就算了：这是本地草稿，不是用户的数据源 */
    }
  }, 500)
}

export async function clearSaved() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  try {
    const conn = await openDb()
    conn.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY)
  } catch {
    /* 删不掉也不影响：内存里的状态已经被清空了 */
  }
}

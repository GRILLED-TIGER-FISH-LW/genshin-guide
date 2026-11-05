/* =========================================================================
 * 合集封面 · 绘制与导出引擎
 * -------------------------------------------------------------------------
 * 纯函数 + 模块级缓存。它只回答两件事：「这张 2560×1440 怎么画」
 * 「导出那一步怎么做」。界面状态全部由 Vue 持有。
 *
 * 预览与导出共用同一个 drawCover —— 预览看到什么，导出的就是什么。
 * ========================================================================= */

export const W = 2560
export const H = 1440

/* 没有背景图时的底色 */
const EMPTY_BG = '#1c1c22'

const MIME = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }

/* 动态资源一律带时间戳，绕开浏览器与 Pages 的缓存 */
export const withTs = (url) => `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`

/* shared/ 下的资源一律走站点基址：SPA 里相对路径是按仓库根算的，
   工具页那种 ../../ 在这里会跑到域名根外面 */
const asset = (path) => withTs(`${import.meta.env.BASE_URL}shared/${path}`)

/* ------------------------------------------------------------------ 素材 */

export function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/* ------------------------------------------------------------------ 字体 */

export async function fetchFontList() {
  const res = await fetch(asset('fonts/fonts.json'))
  if (!res.ok) throw new Error(`字体清单读取失败：HTTP ${res.status}`)
  const json = await res.json()
  return Array.isArray(json.fonts) ? json.fonts : []
}

/* 取字体文件 → data URL。失败抛可读的错，交给调用方提示 */
export async function fetchFontData(file) {
  const res = await fetch(asset(`fonts/${encodeURIComponent(file)}`))
  if (!res.ok) throw new Error(`HTTP ${res.status} 文件未找到`)
  if ((res.headers.get('content-type') || '').includes('text/html')) {
    throw new Error('服务器返回网页而非字体（可能是 404）')
  }
  const buf = await res.arrayBuffer()
  const mime = MIME[file.split('.').pop().toLowerCase()] ?? 'font/ttf'
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('数据序列化失败'))
    reader.readAsDataURL(new Blob([buf], { type: mime }))
  })
}

let installed = null

export async function installFont({ name, data } = {}) {
  dropFont()
  if (!name || !data) return false
  try {
    const face = await new FontFace(name, `url("${data}")`).load()
    document.fonts.add(face)
    installed = face
    return true
  } catch {
    return false
  }
}

export function dropFont() {
  if (!installed) return
  try {
    document.fonts.delete(installed)
  } catch {
    /* 老浏览器没有 FontFaceSet.delete，忽略即可 */
  }
  installed = null
}

/* ------------------------------------------------------------------ 背景 */

let cacheCanvas = null
let cacheKey = ''

/* 「填充 + 边缘拉伸 + 高斯模糊」的背景，同一张图只算一次。
   2560×1440 连开三层 canvas 加高斯模糊，每敲一个字都重算在手机上会直接卡死。 */
function blurredBg(img, key) {
  if (cacheCanvas && cacheKey === key) return cacheCanvas

  const blurPx = Math.max(12, Math.round(W * 0.015))
  const pad = Math.ceil(blurPx * 3) + 20

  /* 先按 cover 铺满，多出来的居中裁掉 */
  const scale = Math.max(W / img.width, H / img.height)
  const fw = img.width * scale
  const fh = img.height * scale

  const base = document.createElement('canvas')
  base.width = W
  base.height = H
  base.getContext('2d').drawImage(img, (W - fw) / 2, (H - fh) / 2, fw, fh)

  /* 模糊会把边缘透空，所以把四条边和四个角各拉一条/块到画布外，垫满再看不出接缝 */
  const BW = W + pad * 2
  const BH = H + pad * 2
  const b = document.createElement('canvas')
  b.width = BW
  b.height = BH
  const bctx = b.getContext('2d')
  bctx.drawImage(base, pad, pad)

  const edges = [
    [0, 0, W, 1, pad, 0, W, pad],
    [0, H - 1, W, 1, pad, pad + H, W, pad],
    [0, 0, 1, H, 0, pad, pad, H],
    [W - 1, 0, 1, H, pad + W, pad, pad, H],
    [0, 0, 1, 1, 0, 0, pad, pad],
    [W - 1, 0, 1, 1, pad + W, 0, pad, pad],
    [0, H - 1, 1, 1, 0, pad + H, pad, pad],
    [W - 1, H - 1, 1, 1, pad + W, pad + H, pad, pad],
  ]
  for (const args of edges) bctx.drawImage(base, ...args)

  const out = document.createElement('canvas')
  out.width = BW
  out.height = BH
  const octx = out.getContext('2d')
  octx.filter = `blur(${blurPx}px)`
  octx.drawImage(b, 0, 0)
  octx.filter = 'none'

  cacheCanvas = out
  cacheKey = key
  return out
}

export function resetBgCache() {
  cacheCanvas = null
  cacheKey = ''
}

/* ------------------------------------------------------------------ 绘制 */

const fontStack = (name) => (name ? `"${name}", system-ui, sans-serif` : 'system-ui, sans-serif')

/* 主标题白字、副标题浅金，整块在画面正中垂直居中；
   先粗黑描边再填色，保证压在任何背景上都读得清 */
function drawText(ctx, title, subtitle, fontName) {
  const baseSize = W * 0.1
  const maxWidth = W * 0.85
  const font = fontStack(fontName)

  const lines = [
    ...title.split(/\r?\n/).filter(Boolean).map((text) => ({ text, color: '#ffffff', group: 'title' })),
    ...subtitle.split(/\r?\n/).filter(Boolean).map((text) => ({ text, color: '#ffe898', group: 'subtitle' })),
  ]
  if (!lines.length) return

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  const gap = baseSize * 0.12
  const groupGap = baseSize

  /* 单行超宽就逐级缩字号，直到塞进 85% 宽度 */
  const measured = lines.map((line) => {
    let fs = baseSize
    ctx.font = `${fs}px ${font}`
    while (ctx.measureText(line.text).width > maxWidth && fs > 12) {
      fs -= 1
      ctx.font = `${fs}px ${font}`
    }
    return { ...line, fs }
  })

  /* 先算总高，再把整块垂直居中 */
  let total = 0
  measured.forEach((line, i) => {
    total += line.fs
    if (i < measured.length - 1) total += measured[i + 1].group === line.group ? gap : groupGap
  })

  let y = H / 2 - total / 2
  for (let i = 0; i < measured.length; i++) {
    const line = measured[i]
    y += line.fs / 2
    ctx.font = `${line.fs}px ${font}`
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 50
    ctx.strokeText(line.text, W / 2, y)
    ctx.fillStyle = line.color
    ctx.fillText(line.text, W / 2, y)
    y += line.fs / 2
    if (i < measured.length - 1) y += measured[i + 1].group === line.group ? gap : groupGap
  }
}

export function drawCover(canvas, { bgImg, key, title, subtitle, fontName } = {}) {
  /* 尺寸没变就别动 width —— 赋值会清空位图，无谓地闪一下 */
  if (canvas.width !== W) canvas.width = W
  if (canvas.height !== H) canvas.height = H

  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  const bg = bgImg ? blurredBg(bgImg, key) : null
  if (bg) {
    ctx.drawImage(bg, 0, 0)
  } else {
    ctx.fillStyle = EMPTY_BG
    ctx.fillRect(0, 0, W, H)
  }

  drawText(ctx, String(title ?? ''), String(subtitle ?? ''), fontName)
}

/* ------------------------------------------------------------------ 导出 */

export const toPng = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))

/* 文件名取主标题第一行，去掉文件名不接受的字符 */
export function pngName(title) {
  const first = String(title || '').split(/\r?\n/).find((line) => line.trim()) || '合集封面'
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `${first.trim().replace(/[\\/:*?"<>|]/g, '_')}_${stamp}.png`
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

/* ------------------------------------------------------------------ 存档 */
/* 库名 / 表名 / 键名与旧版逐字一致：老用户切到 SPA 后草稿还在 */

const IDB = 'video_cover_db'
const STORE = 'state'
const KEY = 'collection_state'

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
    return await new Promise((resolve) => {
      const req = conn.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

let saveTimer = null

/* 500ms 防抖：打字期间不要每敲一下就写一次库 */
export function save(state) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    saveTimer = null
    try {
      const conn = await openDb()
      conn.transaction(STORE, 'readwrite').objectStore(STORE).put({ ...state }, KEY)
    } catch {
      /* 存不下就算了：这是本地草稿，不是用户的数据源 */
    }
  }, 500)
}

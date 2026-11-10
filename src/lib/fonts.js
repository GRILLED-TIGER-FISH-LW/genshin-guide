/* =========================================================================
 * 字体：清单 / 取字节 / 装进文档 / 内嵌用的 @font-face 文本
 * -------------------------------------------------------------------------
 * 合集封面与视频封面共用，所以留在共享层。
 * 动态资源一律带时间戳；路径一律走站点基址 —— SPA 里相对路径是按仓库根算的，
 * 工具页那种 ../../ 在这里会跑到域名根外面。
 * ========================================================================= */

import { ref } from 'vue'

export const withTs = (url) => `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`

const asset = (path) => withTs(`${import.meta.env.BASE_URL}${path}`)

const MIME = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }

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

/* 导出的 SVG 是独立文档，摸不到页面的 document.fonts，字体必须内嵌 */
export const fontFaceCss = (name, data) =>
  `@font-face{font-family:'${name}';src:url("${data}");font-display:block}`

let installed = null

/* 装好 / 卸掉字体 = 文字度量变了。
   那些「按文字宽度算位置」的几何都写在 computed 里（胶囊标签、底部签名、一图流的配队标题…），
   而 computed 只认它读过的响应式字段 —— 把 s.fontName 设成同一个值不会触发重算，
   于是成了「重进页面时位置是偏的，动一下 / 删掉再添一个才正」。所以装 / 卸成功都自增一下，
   量过文字的 computed 里读一次 fontRev 就行（不要另建机制，这是唯一入口）。 */
export const fontRev = ref(0)

export async function installFont({ name, data } = {}) {
  dropFont()
  if (!name || !data) return false
  try {
    const face = await new FontFace(name, `url("${data}")`).load()
    document.fonts.add(face)
    installed = face
    fontRev.value += 1
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
  fontRev.value += 1
}

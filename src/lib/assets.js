/* =========================================================================
 * 静态资源小工具：量尺寸 / 远程图转 dataURL / 存文件 / SVG 转 PNG
 * =========================================================================
 * 前三个从 videoCover.js 抄过来（那边还有一份同名实现，收尾那批一并删掉改从这里引，
 * 这就是那条 shortcut 说的「第三个工具出现时抽 assets.js」）。
 * ========================================================================= */

/* 图片自然尺寸；加载失败回 null —— 调用方靠 null 判断「这张图能不能用」 */
export function loadImageMeta(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/* 远程图 → data URL。导出的 SVG 必须是自包含文档：外站图不烘成 data URL，
   画进 canvas 会污染画布、toBlob 直接抛错。
   拿不到就原样返回，让浏览器自己再试一次 */
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
    return url
  }
}

/* 存文件 */
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

/* 一段（图已经烘成 data URL 的）SVG → PNG blob。
   宽高由调用方给：SVG 自带 viewBox，在 clone 上写死宽高即可放大导出 */
export async function svgToPng(svgEl, width, height) {
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(svgEl)], { type: 'image/svg+xml;charset=utf-8' }),
  )

  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('SVG 渲染失败'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, width, height)

    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1))
  } finally {
    URL.revokeObjectURL(url)
  }
}

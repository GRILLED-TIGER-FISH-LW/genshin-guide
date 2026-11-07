/* =========================================================================
 * 静态资源小工具
 * =========================================================================
 * shortcut: videoCover.js / collectionCover.js 里各有一份 loadImage（那边还带
 *           urlToDataURL / download），批 6 一并合并到这里，这个文件是正本。
 * ========================================================================= */

/* 图片自然尺寸；加载失败回 null —— 调用方靠 null 判断「这张图能不能用」 */
export function loadImageMeta(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/* 存文件：临时链接用完就回收 */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

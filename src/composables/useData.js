const cache = new Map()

/**
 * 从 public/ 加载「挂全局变量」的数据脚本，同一 src 只请求一次。
 * · 绝对 URL（http/https 开头）原样使用
 * · 相对路径拼 BASE_URL（形如 /genshin-guide/）
 * · 失败不写入缓存，允许下次重试
 */
export function loadGlobalScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName])
  if (cache.has(src)) return cache.get(src)

  const url = /^https?:\/\//i.test(src) ? src : import.meta.env.BASE_URL + src

  const task = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = url
    el.async = true
    el.onload = () => {
      const value = window[globalName]
      if (value === undefined) {
        cache.delete(src)
        reject(new Error(`${globalName} 未定义，检查 ${src}`))
        return
      }
      resolve(value)
    }
    el.onerror = () => {
      cache.delete(src)
      reject(new Error(`加载失败：${url}`))
    }
    document.head.appendChild(el)
  })

  cache.set(src, task)
  return task
}

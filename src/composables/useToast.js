import { reactive, readonly } from 'vue'

/* 模块级单例：任何组件调 useToast() 拿到的是同一份队列 */

const items = reactive([])
let seq = 0

const KEEP = 3
const DEFAULT_DURATION = 3200
const ERROR_DURATION = 5000

export function useToast() {
  function remove(id) {
    const i = items.findIndex((t) => t.id === id)
    if (i < 0) return
    if (items[i].timer) clearTimeout(items[i].timer)
    items.splice(i, 1)
  }

  function push(text, opts = {}) {
    const type = opts.type ?? 'info'
    const duration = opts.duration ?? (type === 'error' ? ERROR_DURATION : DEFAULT_DURATION)
    const id = ++seq

    items.push({
      id,
      text,
      type,
      timer: duration > 0 ? setTimeout(() => remove(id), duration) : null,
    })

    /* 超出上限先淘汰最早的，避免连点堆成一屏 */
    while (items.length > KEEP) remove(items[0].id)

    return id
  }

  return {
    toasts: readonly(items),
    remove,
    show: push,
    success: (text, opts) => push(text, { ...opts, type: 'success' }),
    error: (text, opts) => push(text, { ...opts, type: 'error' }),
  }
}

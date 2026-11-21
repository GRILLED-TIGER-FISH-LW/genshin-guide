import { ElMessage } from 'element-plus'

/* 全站提示：内部直接交给 EP 的 ElMessage（顶部消息、同样的文案会自动合并、不会连点堆一屏）。
   调用方仍然写 useToast().success(...) / .error(...)，一处都没改 ——
   这样 ToastHost 那个自造浮层可以整个删掉。 */

const DEFAULT_DURATION = 3200
const ERROR_DURATION = 5000

export function useToast() {
  function push(text, opts = {}) {
    const type = opts.type ?? 'info'
    const duration = opts.duration ?? (type === 'error' ? ERROR_DURATION : DEFAULT_DURATION)
    ElMessage({
      message: String(text ?? ''),
      type,
      duration,
      /* 同一句连续触发时合并，不叠一堆 */
      grouping: true,
      /* 让开顶栏（el-header 56px） */
      offset: 64,
    })
    return 0
  }

  return {
    show: push,
    success: (text, opts) => push(text, { ...opts, type: 'success' }),
    error: (text, opts) => push(text, { ...opts, type: 'error' }),
  }
}

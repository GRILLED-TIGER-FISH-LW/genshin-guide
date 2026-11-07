import { loadGlobalScript } from './useData.js'

/* =========================================================================
 * 图标字典 · 取图入口
 * -------------------------------------------------------------------------
 * 字典本体是 shared/gi-icons/icon-dict.js（两个仓库共用的数据文件），
 * 查名字 / 拼地址 / 星级底色在 icon-loader.js 里。SPA 侧不改这两个文件，
 * 只用运行时全局脚本的方式挂上，再调 ICON_LIB —— window 只在这里露一次面。
 *
 * 名字匹配优先精确的（「旅行者·冰」不会被削成「旅行者」），见 loader 的 match()。
 * ========================================================================= */
let libTask = null

function iconLib() {
  if (!libTask) {
    libTask = (async () => {
      await loadGlobalScript('shared/gi-icons/icon-dict.js', 'ICON_DICT')
      await loadGlobalScript('shared/gi-icons/icon-loader.js', 'ICON_LIB')
      return window.ICON_LIB
    })().catch((err) => {
      libTask = null /* 失败允许下次重试 */
      throw err
    })
  }
  return libTask
}

/* 名字 → 图标 dataURL（已带星级底色）。查不到 / 取图失败都给 ''，由调用方退回占位图。
   type 用字典里的组名：characters / artifacts / weapons / monsters */
export async function matchIcon(type, name) {
  const query = String(name || '').trim()
  if (!query) return ''
  try {
    const hit = await (await iconLib()).fromName(type, query)
    return hit?.dataURL || ''
  } catch {
    return ''
  }
}

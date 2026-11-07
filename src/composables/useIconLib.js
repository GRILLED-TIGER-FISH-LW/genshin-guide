import { loadGlobalScript } from './useData.js'

/* =========================================================================
 * 共享脚本 · 取图入口
 * -------------------------------------------------------------------------
 * · shared/gi-icons/icon-dict.js + icon-loader.js：图标字典本体与查询
 * · shared/ui-icons.js：本仓库的图标真源。SPA 界面的图标走构建期虚拟模块
 *   （vite.config.js 的 virtual:gg-icons），但那个模块只收「值是 <svg 字符串」
 *   的条目 —— element / artifact 两组存的是路径数据，界面用不到、绘制要用，
 *   所以这里在运行时取一次（花 / 杯 / 冠 三个词条图标）。
 *
 * SPA 侧不改这三个文件，只把它们当全局脚本挂上。window 只在这个文件里露面。
 * ========================================================================= */

let dictTask = null
let uiTask = null

function sharedGlobal(path, name) {
  return (async () => {
    await loadGlobalScript(path, name)
    return window[name]
  })().catch((err) => {
    /* 失败不缓存，下次还能重试 */
    throw err
  })
}

function iconLib() {
  if (!dictTask) {
    dictTask = (async () => {
      await sharedGlobal('shared/gi-icons/icon-dict.js', 'ICON_DICT')
      await sharedGlobal('shared/gi-icons/icon-loader.js', 'ICON_LIB')
      return window.ICON_LIB
    })().catch((err) => {
      dictTask = null
      throw err
    })
  }
  return dictTask
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

/* shared/ui-icons.js 的 artifact 组：花 / 杯 / 冠 的路径数据。取不到就给空对象，
   卡片少画三个小图标，其余照画 */
export function loadArtifactIcons() {
  if (!uiTask) {
    uiTask = (async () => {
      const icons = await sharedGlobal('shared/ui-icons.js', 'ICONS')
      return icons?.artifact || {}
    })().catch((err) => {
      uiTask = null
      throw err
    })
  }
  return uiTask
}

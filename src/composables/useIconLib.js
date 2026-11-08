import { loadGlobalScript } from './useData.js'

/* =========================================================================
 * 共享脚本 · 取图入口
 * -------------------------------------------------------------------------
 * · shared/image-dict.js + image-loader.js：图片字典本体与查询
 * · shared/ui-icons.js：本仓库的图标真源。SPA 界面的图标走构建期虚拟模块
 *   （vite.config.js 的 virtual:gg-icons），但那个模块只收「值是 <svg 字符串」
 *   的条目 —— element / artifact / card 三组存的是路径数据，界面用不到、
 *   绘制要用（词条的花杯冠、配队的加号），所以这里在运行时取整份。
 *
 * SPA 侧不改这三个文件，只把它们当全局脚本挂上。window 只在这个文件里露面。
 * ========================================================================= */

let dictTask = null
let uiTask = null

function sharedGlobal(path, name) {
  return (async () => {
    await loadGlobalScript(path, name)
    return window[name]
  })()
}

function imageLib() {
  if (!dictTask) {
    dictTask = (async () => {
      await sharedGlobal('shared/image-dict.js', 'IMAGE_DICT')
      await sharedGlobal('shared/image-loader.js', 'IMAGE_LIB')
      return window.IMAGE_LIB
    })().catch((err) => {
      dictTask = null /* 失败不缓存，下次还能重试 */
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
    const hit = await (await imageLib()).fromName(type, query)
    return hit?.dataURL || ''
  } catch {
    return ''
  }
}

/* 名字 → 字典条目原样（要 order 推存档文件名、要 art 取立绘、要 card 取名片时才用）。
   找不到回 null */
export async function dictEntry(type, name) {
  const query = String(name || '').trim()
  if (!query) return null
  try {
    const hit = (await imageLib()).match(type, query)
    return hit ? window.IMAGE_DICT?.[type]?.[hit.key] || null : null
  } catch {
    return null
  }
}

/* 某组的地址规则（config[type]）：prefix / ext 是主源，alt 是备用源，
   card / art 各有一组。字典条目只记代号，地址按这套规则拼 */
export async function dictConfig(type) {
  try {
    await imageLib()
    return window.IMAGE_DICT?.config?.[type] || null
  } catch {
    return null
  }
}

/* shared/ui-icons.js 整份（含 ui / element / artifact / nav / card 各组的路径数据）。
   取不到就给空对象，卡片少画几个小图标，其余照画 */
export function loadUiIcons() {
  if (!uiTask) {
    uiTask = sharedGlobal('shared/ui-icons.js', 'ICONS').catch((err) => {
      uiTask = null
      throw err
    })
  }
  return uiTask
}

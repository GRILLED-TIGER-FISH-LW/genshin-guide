import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const BASE = '/genshin-guide/'

/* -------------------------------------------------------------------------
 * 插件 1：把工具页里的 ../../shared/… 重写成站点绝对路径
 * -------------------------------------------------------------------------
 * 那些相对路径是按「工具页自己的层级」写的。搬进 SPA 后页面在仓库根，
 * ../../ 会跑到域名根外面 —— 缩略图、字典、白名单文本会全 404。
 *
 * app.js 动辄上千行、手机上没法改，所以改在构建期重写。副作用是好的：
 * 老 iframe 页面照样能用，因为绝对路径在「SPA 根目录」和「工具页子目录」
 * 两种布局下都成立。
 *
 * shortcut: 只认「字符串 / url() 一开头就是 ../ 的 shared/」，把 ../ 写在
 *           中途的不管；等工具文件挪进 src/lib/ 之后，收紧匹配条件。
 * ---------------------------------------------------------------------- */
function sharedPathFix() {
  const RE = /(["'`(])(?:\.\.\/)+shared\//g
  return {
    name: 'gg-shared-path-fix',
    enforce: 'pre',
    transform(code, id) {
      const f = id.replace(/\\/g, '/')
      if (!f.includes('/tools/')) return null
      if (!/\.(js|css)$/.test(f)) return null

      const out = code.replace(RE, `$1${BASE}shared/`)
      return out === code ? null : { code: out, map: null }
    },
  }
}

/* -------------------------------------------------------------------------
 * 插件 2：把本仓库自己的两个共享脚本变成构建期虚拟模块
 * -------------------------------------------------------------------------
 *   shared/ui-icons.js            → virtual:gg-icons      （图标路径）
 *   shared/gi-icons/icon-loader.js → virtual:gg-icon-lib   （星级底色表）
 *
 * 目的：SPA 侧不再运行时加载这两个脚本、也不依赖 window 全局。
 * 数据源仍是本仓库自己的文件（不是跨仓库），只是读取时机挪到构建期。
 * 读取手法与 app.js 读 icon-dict.js 完全一样：把脚本跑一遍，取 window 上的结果。
 *
 * 两个必须知道的细节：
 *   · icon-loader.js 在加载时就会摸 document（推自己的目录），所以要给垫片
 *   · ui-icons.js 的 element / artifact 组存的是路径数据、不是 UI 图标，
 *     这里只收「值是 <svg 开头的字符串」的条目，并顺手剥掉外层 <svg>
 * ---------------------------------------------------------------------- */
const ICONS_ID = 'virtual:gg-icons'
const ICONS_RESOLVED = '\0' + ICONS_ID
const LIB_ID = 'virtual:gg-icon-lib'
const LIB_RESOLVED = '\0' + LIB_ID

/* 够 icon-loader.js 在加载期跑完的最小 document 垫片 */
const DOC_STUB = {
  getElementsByTagName: () => [{ src: 'https://local/shared/gi-icons/icon-loader.js' }],
  createElement: () => ({ getContext: () => null, style: {}, setAttribute() {} }),
  head: { appendChild() {} },
  body: { appendChild() {} },
  addEventListener() {},
  removeEventListener() {},
}

/* 把「挂全局」的共享脚本跑一遍，返回它写到 window 上的东西 */
function runSharedScript(file) {
  const win = {}
  new Function('window', 'document', readFileSync(file, 'utf8'))(win, DOC_STUB)
  return win
}

function sharedModules() {
  const path = (rel) => fileURLToPath(new URL(rel, import.meta.url))

  return {
    name: 'gg-shared-modules',

    resolveId(id) {
      if (id === ICONS_ID) return ICONS_RESOLVED
      if (id === LIB_ID) return LIB_RESOLVED
      return null
    },

    load(id) {
      if (id === ICONS_RESOLVED) {
        const file = path('public/shared/ui-icons.js')
        this.addWatchFile(file)

        const win = runSharedScript(file)
        const out = {}
        for (const [group, bag] of Object.entries(win.ICONS || {})) {
          if (!bag || typeof bag !== 'object') continue
          for (const [key, value] of Object.entries(bag)) {
            if (typeof value !== 'string' || !value.startsWith('<svg')) continue
            out[`${group}.${key}`] = value.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
          }
        }
        return `export const ICONS = ${JSON.stringify(out)}`
      }

      if (id === LIB_RESOLVED) {
        const file = path('public/shared/gi-icons/icon-loader.js')
        this.addWatchFile(file)

        const win = runSharedScript(file)
        const starColors = win.ICON_LIB?.starColors || {}
        return `export const STAR_COLORS = ${JSON.stringify(starColors)}`
      }

      return null
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [sharedPathFix(), sharedModules(), vue(), tailwindcss()],
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
})

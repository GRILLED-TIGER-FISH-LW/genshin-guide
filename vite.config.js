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
 *           中途的不管；等工具文件挪进 src/lib/ 之后，插件的匹配条件收紧。
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
 * 插件 2：把本仓库自己的 shared/ui-icons.js 变成构建期图标模块
 * -------------------------------------------------------------------------
 * 目的：SPA 侧不要再运行时加载 51KB 的 ui-icons.js，也不要有 window.ICONS
 * 这种全局。图标应该在打包结果里就是一份普通 JS 对象。
 *
 * 数据源仍然是本仓库自己的文件（不是跨仓库），只是读取时机挪到构建期。
 * 读取手法和 app.js 读 icon-dict.js 完全一样：把文件当脚本跑一次，取 window 上的结果。
 *   · 只收「值是 <svg 开头的字符串」的条目 —— element / artifact 组存的是路径数据
 *     和数组，不是 UI 图标，故意跳过
 *   · 顺手剥掉外层 <svg>…</svg>：Icon.vue 自己提供 viewBox 和无障碍属性
 *   · addWatchFile 让改 ui-icons.js 能触发 HMR / 重新构建
 * ---------------------------------------------------------------------- */
const ICONS_ID = 'virtual:gg-icons'
const ICONS_RESOLVED = '\0' + ICONS_ID

function iconsFromShared() {
  return {
    name: 'gg-icons-from-shared',
    resolveId(id) {
      return id === ICONS_ID ? ICONS_RESOLVED : null
    },
    load(id) {
      if (id !== ICONS_RESOLVED) return null

      const file = fileURLToPath(new URL('shared/ui-icons.js', import.meta.url))
      this.addWatchFile(file)

      const sandbox = {}
      new Function('window', readFileSync(file, 'utf8'))(sandbox)

      const out = {}
      for (const [group, bag] of Object.entries(sandbox.window?.ICONS || {})) {
        if (!bag || typeof bag !== 'object') continue
        for (const [key, value] of Object.entries(bag)) {
          if (typeof value !== 'string' || !value.startsWith('<svg')) continue
          out[`${group}.${key}`] = value.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
        }
      }

      return `export const ICONS = ${JSON.stringify(out)}`
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [sharedPathFix(), iconsFromShared(), vue(), tailwindcss()],
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
})

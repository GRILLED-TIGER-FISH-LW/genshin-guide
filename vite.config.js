import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const BASE = '/genshin-guide/'

/* -------------------------------------------------------------------------
 * 工具页里的 ../../shared/… 是按「工具页自己的层级」写的相对路径。
 * 搬进 SPA 后页面在仓库根，../../ 会跑到域名根外面 —— 缩略图、字典、
 * 白名单文本会全 404。
 *
 * 那些 app.js 动辄上千行、手机上没法改，所以改在构建期把这类路径重写成
 * 站点绝对路径。副作用是好的：老 iframe 页面照样能用，因为绝对路径在
 * 「SPA 根目录」和「工具页子目录」两种布局下都成立。
 *
 * shortcut: 只认「字符串/url() 一开头就是 ../ 的 shared/」，把 ../ 写在中途的
 *           不管；等工具文件挪进 src/lib/ 之后，这个插件和相对路径一起删。
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

export default defineConfig({
  base: BASE,
  plugins: [sharedPathFix(), vue(), tailwindcss()],
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
})

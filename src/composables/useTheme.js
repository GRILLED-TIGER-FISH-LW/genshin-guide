import { ref } from 'vue'

/* 主题唯一来源。index.html 里的内联脚本已做首次应用，这里只负责后续切换 */

const KEY = window.__THEME_KEY || 'gi-theme'
const root = document.documentElement
const meta = document.querySelector('meta[name="theme-color"]')
const media = window.matchMedia('(prefers-color-scheme: dark)')

const THEME_COLOR = { light: '#f5f0e8', dark: '#181715' }

function readStored() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/* 初始值直接取 <html data-theme>，避免与首帧不一致 */
export const theme = ref(root.dataset.theme === 'dark' ? 'dark' : 'light')

/* 加类 → 同步布局 → 改值 → 同步布局 → 去类。
   两次 offsetHeight 是刻意的：让浏览器在过渡被禁用后才提交新颜色 */
export function applyTheme(next) {
  root.classList.add('theme-switching')
  void root.offsetHeight

  root.dataset.theme = next
  if (meta) meta.setAttribute('content', THEME_COLOR[next])

  void root.offsetHeight
  root.classList.remove('theme-switching')
}

export function setTheme(next) {
  if (next !== 'light' && next !== 'dark') return
  theme.value = next
  applyTheme(next)
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* 隐私模式下写入会抛错，忽略即可 */
  }
}

export function toggleTheme() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}

/* 用户从未手动选择时，跟随系统变化 */
media.addEventListener('change', (e) => {
  if (readStored()) return
  const next = e.matches ? 'dark' : 'light'
  theme.value = next
  applyTheme(next)
})

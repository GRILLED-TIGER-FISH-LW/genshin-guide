import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.js'
import './styles/app.css'

/* ---------- 把看不见的错误画到页面上 ---------- */
function showFatal(msg) {
  const el = document.getElementById('app')
  if (!el) return
  el.dataset.fatal = '1'
  el.textContent = ''

  const box = document.createElement('pre')
  box.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:99999',
    'padding:16px',
    'overflow:auto',
    'background:#1a1816',
    'color:#f4f1ea',
    'font:12px/1.7 ui-monospace,SFMono-Regular,monospace',
    'white-space:pre-wrap',
    'word-break:break-word',
  ].join(';')

  box.textContent = `页面启动失败\n\n${msg}\n\n—— 请截图本页发给维护者 ——`
  el.appendChild(box)
}

/* 资源 404 不算脚本错误，跳过（交给下面的兜底定时器） */
window.addEventListener('error', (e) => {
  if (e.target && e.target !== window) return
  showFatal(e.message || '未知错误')
})

window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason
  showFatal(r?.stack || r?.message || String(r))
})

/* ---------- 启动 ---------- */
const host = document.getElementById('app')
/* 清掉「正在载入工具集…」占位。
   不依赖 Vue 是否清空容器 —— 各版本行为不一致，自己来最稳 */
host.textContent = ''

const app = createApp(App)

app.config.errorHandler = (err) => {
  showFatal(err?.stack || err?.message || String(err))
}

app.use(router)
app.mount(host)

/* 挂载成功的唯一信号。加载守卫和下面的兜底都认这个标记 */
host.dataset.mounted = '1'

/* 3 秒后仍然没挂上 → 脚本根本没执行（典型是缓存了旧 HTML） */
setTimeout(() => {
  if (host.dataset.mounted === '1') return
  showFatal(
    [
      '脚本没有执行成功，页面无法渲染。',
      '',
      '最常见的原因：浏览器缓存了旧版 HTML，它引用的 JS 文件已被新部署替换。',
      '',
      '请依次尝试：',
      '1. 在网址后加 ?t=当前时间 再打开',
      '2. 关闭标签页后重新打开',
      '3. 清除本站点数据',
      '',
      '如果三步都无效，请截图本页。',
    ].join('\n'),
  )
}, 3000)

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import SyncReport from '../components/SyncReport.vue'

/* 图标字典编辑器 · 已搬进 SPA
 * -------------------------------------------------------------------------
 * · 模板与 tools/icon-editor/index.html 的 <body> 逐字对应，id / class 一个不改
 *   —— app.js 全靠 id 和这些类名找元素
 * · 引擎 app.js 原文不动：里面 ../../shared/… 的相对路径由 vite.config.js
 *   的 sharedPathFix 插件在构建期改写成站点绝对路径
 * · 唯一的结构改动：外面套了个 flex 纵列容器，顶替原来 body 的角色
 *   （老页面靠 body 做 flex 外壳；SPA 里 body 归外壳所有）
 * · 本视图由 App.vue 的 <KeepAlive> 常驻，不会因为切走而重挂
 *   —— 所以 app.js 那个 IIFE 只会执行一次
 * ------------------------------------------------------------------------- */

import '../../tools/icon-editor/style.css'
import '../styles/legacy-bridge.css'

const TABS = [
  { key: 'characters', label: '角色' },
  { key: 'artifacts', label: '圣遗物' },
  { key: 'weapons', label: '武器' },
  { key: 'monsters', label: '怪物' },
]

const ACTIONS = [
  { id: 'btnSync', icon: 'import', text: '从 Amber 同步' },
  { id: 'btnSyncLog', icon: 'file', text: '日志' },
  { id: 'btnPaste', icon: 'plus', text: '粘贴 URL' },
  { id: 'btnLoad', icon: 'import', text: '载入' },
  { id: 'btnExport', icon: 'export', text: '导出' },
  { id: 'btnClear', icon: 'trash', text: '清空', danger: true },
]

const booted = ref(false)
const error = ref('')

/* SPA 的页面在仓库根（/genshin-guide/），相对文档算基准最稳；
   不要写 ../../shared —— 那是按「工具页层级」算的，搬进 SPA 会跑到域名根外面。 */
const SHARED = new URL('shared/', document.baseURI).href

const withTs = (url) => url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()

function loadStyle(href) {
  return new Promise((resolve, reject) => {
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = withTs(href)
    l.onload = resolve
    l.onerror = () => reject(new Error('加载失败：' + href))
    document.head.appendChild(l)
  })
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = withTs(src)
    s.onload = resolve
    s.onerror = () => reject(new Error('加载失败：' + src))
    document.head.appendChild(s)
  })
}

onMounted(async () => {
  try {
    /* 顺序与老页面一致：三个并行 → icon-loader → 最后 app.js */
    await Promise.all([
      loadStyle(SHARED + 'css/theme.css'),
      loadScript(SHARED + 'ui-icons.js'),
      loadScript(SHARED + 'css/dropdown.js'),
    ])
    await loadScript(SHARED + 'gi-icons/icon-loader.js')

    booted.value = true
    await nextTick() /* 等模板落地，app.js 才找得到全部 id */

    await import('../../tools/icon-editor/app.js')
  } catch (e) {
    error.value = e?.message || String(e)
  }
})
</script>

<template>
  <!-- 顶替老页面的 body：flex 纵向 + 满高，让 .main 能内部滚动 -->
  <div class="flex h-full min-h-0 flex-col">
    <template v-if="booted">
      <header class="sticky-head">
        <div class="sticky-inner">
          <nav class="tab-bar" role="tablist" aria-label="图标分类">
            <button
              v-for="(t, i) in TABS"
              :key="t.key"
              type="button"
              class="tab-btn"
              :class="i === 0 && 'is-active'"
              :data-tab="t.key"
              role="tab"
              :aria-selected="i === 0 ? 'true' : 'false'"
            >
              {{ t.label }}
            </button>
          </nav>

          <div class="search">
            <span class="search-icon" data-icon="search"></span>
            <input
              type="text"
              class="search-input"
              id="searchInput"
              placeholder="搜索名字或 key…"
              autocomplete="off"
              spellcheck="false"
            />
            <button type="button" class="search-clear" id="searchClear" aria-label="清除搜索">
              <span data-icon="close"></span>
            </button>
          </div>

          <div class="actions-group">
            <button
              v-for="a in ACTIONS"
              :key="a.id"
              type="button"
              class="btn"
              :class="a.danger && 'btn-danger'"
              :id="a.id"
            >
              <span class="icon-slot" :data-icon="a.icon"></span
              ><span class="btn-text">{{ a.text }}</span>
            </button>
          </div>
        </div>
      </header>

      <main class="main">
        <div class="entries" id="entries"></div>

        <div class="empty-state hidden" id="emptyTip">
          <span class="empty-icon" id="emptyIcon" data-icon="inbox"></span>
          <span id="emptyText">当前分类还没有条目<br />点上方按钮开始</span>
        </div>
      </main>

      <!-- 确认框与粘贴框共用同一个外壳，靠 #pasteWrap 切换内容 -->
      <div class="modal-backdrop" id="modalBackdrop">
        <div class="modal-box">
          <div class="modal-title" id="modalTitle">提示</div>
          <div class="modal-message" id="modalMessage"></div>
          <div id="pasteWrap" class="hidden">
            <textarea
              id="pasteArea"
              placeholder="https://api.lunaris.moe/data/assets/avataricon/UI_AvatarIcon_SkirkNew.webp"
            ></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" id="modalCancel">取消</button>
            <button type="button" class="modal-confirm" id="modalConfirm">确定</button>
          </div>
        </div>
      </div>

      <div class="status-bar" id="status">就绪</div>

      <!-- 同步报告 / 更新日志。挂在这里是为了让它比 app.js 先注册监听 -->
      <SyncReport />
    </template>

    <p
      v-else
      class="grid flex-1 place-items-center px-6 text-center text-xs leading-relaxed"
      :class="error ? 'text-danger' : 'text-muted'"
    >
      {{ error ? '载入失败：' + error + '\n请刷新重试' : '正在载入图标字典编辑器…' }}
    </p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TOOLS } from '../router.js'
import { theme } from '../composables/useTheme.js'

const route = useRoute()
const router = useRouter()

/* -------------------------------------------------------------------------
 * 把 TOOLS 摊平成「一个页面一条记录」。
 * video-cover 的两个子工具各有一页 → 两个 iframe；
 * image-tools / chart 的子工具共用父页面 → 一个 iframe，靠 postMessage 切页。
 *
 * 【pointer-events 是这里的关键】
 * 本组件的根节点是一块常驻的全屏空容器，它盖在 RouterView 上面。
 * 如果它自己也接收事件，就会把首页卡片、以及搬进 SPA 的工具视图
 * （IconEditor 等）的点击全部吃掉 —— 表现为「点什么都没反应」。
 * 所以：根节点 pointer-events: none，只有真正在显示的那一帧和加载遮罩
 * 才 pointer-events: auto。
 * ------------------------------------------------------------------------- */
const FRAMES = (() => {
  const seen = new Set()
  const list = []

  const push = (frame, title, tool, sub) => {
    if (!frame || seen.has(frame)) return
    seen.add(frame)
    list.push({ frame, title, tool, sub })
  }

  for (const t of TOOLS) {
    const own = (t.subtools || []).filter((s) => s.frame)
    if (own.length) own.forEach((s) => push(s.frame, `${t.label} · ${s.label}`, t.key, s.key))
    else push(t.frame, t.label, t.key, '')
  }

  return list
})()

/* 本次加载的时间戳，与旧版 window.__pageLoadTs 同义 */
const TS = window.__pageLoadTs || Date.now()
const srcOf = (frame) => frame + (frame.includes('?') ? '&' : '?') + 't=' + TS

const active = computed(() => route.meta?.frame || '')
const current = computed(() => FRAMES.find((f) => f.frame === active.value) || null)

/* visited 一旦加入就永不移除 —— iframe 常驻，切换工具不重新加载（旧版行为） */
const visited = reactive(new Set())
const loaded = reactive(new Set())
const els = new Map()

watch(
  active,
  (f) => {
    if (f) visited.add(f)
  },
  { immediate: true },
)

const showMask = computed(() => !!current.value && !loaded.has(current.value.frame))

function register(frame, el) {
  if (el) els.set(frame, el)
  else els.delete(frame)
}

function post(f, data) {
  const el = els.get(f.frame)
  try {
    el?.contentWindow?.postMessage(data, '*')
  } catch (e) {}
}

/* 未迁移的工具页不会自己读主题，由这里直写兜底 */
function syncTheme(f, value = theme.value) {
  const el = els.get(f.frame)
  try {
    const doc = el?.contentDocument
    if (doc?.documentElement) doc.documentElement.setAttribute('data-theme', value)
  } catch (e) {}
}

/* 子工具共用父页面时，通知它切到对应子工具 */
function postNavigate(f) {
  if (!f.sub && !route.meta?.sub) return
  if (f.sub) return /* f.sub 有值 = 这个子工具自带页面，不需要通知 */
  if (route.meta?.frame !== f.frame) return
  if (!loaded.has(f.frame)) return /* 没加载完就等 load，那里会补发 */
  post(f, { type: 'navigate', subtool: route.meta.sub })
}

function onLoad(f) {
  loaded.add(f.frame)
  syncTheme(f)
  post(f, { type: 'theme', theme: theme.value })
  postNavigate(f)
}

watch(
  () => [route.meta?.frame, route.meta?.sub],
  () => {
    if (current.value) postNavigate(current.value)
  },
)

watch(theme, (value) => {
  for (const f of FRAMES) {
    if (!loaded.has(f.frame)) continue
    syncTheme(f, value)
    post(f, { type: 'theme', theme: value })
  }
})

/* 工具页内部自己切了子工具 → 把路由同步过去，菜单和顶栏跟着走 */
function onMessage(e) {
  const d = e.data
  if (!d || typeof d !== 'object') return
  if (d.type !== 'active-subtool' || !d.toolKey || !d.subtoolKey) return

  const tool = TOOLS.find((t) => t.key === d.toolKey)
  if (!tool) return
  if (!(tool.subtools || []).some((s) => s.key === d.subtoolKey)) return

  const target = `/${d.toolKey}/${d.subtoolKey}`
  if (route.path !== target) router.replace(target).catch(() => {})
}

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <!-- 根节点只负责占位，绝不接收事件 -->
  <div class="pointer-events-none absolute inset-0">
    <!-- 所有 iframe 常驻：v-show 只隐藏，绝不销毁，所以切走再切回不重新加载 -->
    <div
      v-for="f in FRAMES"
      v-show="current?.frame === f.frame"
      :key="f.frame"
      class="pointer-events-auto absolute inset-0"
    >
      <iframe
        v-if="visited.has(f.frame)"
        :ref="(el) => register(f.frame, el)"
        :src="srcOf(f.frame)"
        :title="f.title"
        loading="lazy"
        class="size-full border-0 bg-canvas"
        @load="onLoad(f)"
      />
    </div>

    <!-- 加载遮罩：要挡住下面，所以自己也接收事件 -->
    <Transition name="ld">
      <div
        v-if="showMask"
        class="pointer-events-auto absolute inset-0 grid place-items-center gap-3 bg-canvas"
      >
        <span
          class="size-5 animate-spin rounded-full border-2 border-line-3 border-t-accent"
          aria-hidden="true"
        />
        <span class="text-xs text-muted">正在载入工具…</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ld-enter-active,
.ld-leave-active {
  transition: opacity 160ms var(--ease-spring);
}
.ld-enter-from,
.ld-leave-to {
  opacity: 0;
}
</style>

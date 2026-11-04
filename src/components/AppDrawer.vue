<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TOOLS } from '../router.js'
import Icon from './Icon.vue'

const open = defineModel({ type: Boolean, default: false })

const route = useRoute()
const router = useRouter()

const expanded = ref(new Set())

const isHome = computed(() => !route.meta?.tool)
const toolOf = computed(() => route.meta?.tool || '')
const subOf = computed(() => route.meta?.sub || '')

const ROW =
  'flex h-11 w-full items-center gap-2.5 rounded-ctl px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'
const SUB_ROW =
  'flex h-9 w-full items-center gap-2 rounded-ctl px-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/* 进到某个带子工具的工具，就把它的分组展开（与旧版一致） */
watch(
  toolOf,
  (key) => {
    if (key && TOOLS.find((t) => t.key === key)?.subtools) expanded.value.add(key)
  },
  { immediate: true },
)

function toggle(key) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

function close() {
  open.value = false
}

watch(() => route.fullPath, close)

const appRoot = document.getElementById('app')
const panel = ref(null)
let lastFocused = null

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/* Esc 关闭；Tab 在抽屉内循环（与 Modal 同一套规则） */
function onKey(e) {
  if (e.key === 'Escape') {
    close()
    return
  }
  if (e.key !== 'Tab') return

  const nodes = panel.value?.querySelectorAll(FOCUSABLE)
  if (!nodes?.length) {
    e.preventDefault()
    return
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement

  if (e.shiftKey && (active === first || active === panel.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(open, async (v) => {
  if (appRoot) appRoot.inert = v
  if (v) {
    lastFocused = document.activeElement
    document.addEventListener('keydown', onKey)
    await nextTick()
    panel.value?.focus()
  } else {
    document.removeEventListener('keydown', onKey)
    lastFocused?.focus?.()
    lastFocused = null
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  if (appRoot) appRoot.inert = false
})

function go(path) {
  router.push(path)
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dr">
      <div v-if="open" class="fixed inset-0 z-[90] bg-mask" @mousedown.self="close"></div>
    </Transition>

    <Transition name="drp">
      <aside
        v-if="open"
        ref="panel"
        role="dialog"
        aria-modal="true"
        aria-label="工具导航"
        tabindex="-1"
        class="fixed inset-y-0 left-0 z-[100] flex w-64 max-w-[85vw] flex-col border-r border-line bg-canvas focus:outline-none"
      >
        <div class="flex h-14 shrink-0 items-center border-b border-line px-4">
          <h2 class="text-sm font-semibold text-ink">工具导航</h2>
        </div>

        <nav class="grid content-start gap-1 overflow-y-auto p-2">
          <button
            type="button"
            :class="[
              ROW,
              isHome ? 'bg-surface font-semibold text-ink' : 'text-body hover:bg-hover',
            ]"
            :aria-current="isHome ? 'page' : undefined"
            @click="go('/')"
          >
            <span
              class="grid size-5 shrink-0 place-items-center"
              :class="isHome ? 'text-accent-strong' : 'text-muted'"
            >
              <Icon name="nav.home" :bold="isHome" size="sm" />
            </span>
            <span class="min-w-0 truncate">首页</span>
          </button>

          <template v-for="t in TOOLS" :key="t.key">
            <button
              type="button"
              :class="[
                ROW,
                toolOf === t.key ? 'bg-surface font-semibold text-ink' : 'text-body hover:bg-hover',
              ]"
              :aria-expanded="t.subtools ? expanded.has(t.key) : undefined"
              @click="t.subtools ? toggle(t.key) : go('/' + t.key)"
            >
              <span
                class="grid size-5 shrink-0 place-items-center"
                :class="toolOf === t.key ? 'text-accent-strong' : 'text-muted'"
              >
                <Icon :name="t.icon" :bold="toolOf === t.key" size="sm" />
              </span>
              <span class="min-w-0 flex-1 truncate">{{ t.label }}</span>
              <span
                v-if="t.subtools"
                class="grid size-4 shrink-0 place-items-center text-muted transition-transform duration-150 ease-spring"
                :class="expanded.has(t.key) && 'rotate-180'"
                aria-hidden="true"
              >
                <!-- 子工具展开箭头一律实心：基础名是空心三角，bold 才是实心 -->
                <Icon name="ui.chevronDown" bold size="sm" />
              </span>
            </button>

            <div v-if="t.subtools" v-show="expanded.has(t.key)" class="grid gap-0.5 pb-1 pl-9 pr-2">
              <button
                v-for="s in t.subtools"
                :key="s.key"
                type="button"
                :class="[
                  SUB_ROW,
                  subOf === s.key && toolOf === t.key
                    ? 'bg-surface font-semibold text-ink'
                    : 'text-muted hover:bg-hover',
                ]"
                :aria-current="subOf === s.key && toolOf === t.key ? 'page' : undefined"
                @click="go('/' + t.key + '/' + s.key)"
              >
                <span
                  class="size-1 shrink-0 rounded-full"
                  :class="subOf === s.key && toolOf === t.key ? 'bg-accent' : 'bg-line-3'"
                  aria-hidden="true"
                />
                <span class="min-w-0 truncate">{{ s.label }}</span>
              </button>
            </div>
          </template>
        </nav>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dr-enter-active,
.dr-leave-active {
  transition: opacity 200ms var(--ease-spring);
}
.dr-enter-from,
.dr-leave-to {
  opacity: 0;
}

.drp-enter-active,
.drp-leave-active {
  transition: transform 200ms var(--ease-spring);
}
.drp-enter-from,
.drp-leave-to {
  transform: translateX(-100%);
}
</style>

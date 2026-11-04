<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { theme, toggleTheme } from '../composables/useTheme.js'
import Icon from './Icon.vue'

defineEmits(['open-menu'])

const route = useRoute()

/* 有 label 就是工具页，标题拼上子工具名；没有就是首页 */
const title = computed(() => {
  const m = route.meta || {}
  if (!m.label) return m.title || '原神攻略工具集'
  return m.subLabel ? `${m.label} · ${m.subLabel}` : m.label
})

const titleIcon = computed(() => route.meta?.icon || '')

const themeLabel = computed(() =>
  theme.value === 'dark' ? '切换到浅色模式' : '切换到深色模式',
)
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas px-3">
    <button
      type="button"
      class="grid size-9 shrink-0 place-items-center rounded-ctl border border-line-2 bg-surface text-ink hover:border-line-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      aria-label="打开菜单"
      @click="$emit('open-menu')"
    >
      <Icon name="app.hamburger" size="sm" />
    </button>

    <span
      v-if="titleIcon"
      class="grid size-7 shrink-0 place-items-center rounded-ctl bg-accent-soft text-accent-strong"
      aria-hidden="true"
    >
      <Icon :name="titleIcon" size="sm" />
    </span>

    <h1 class="min-w-0 flex-1 truncate text-base font-semibold text-ink">{{ title }}</h1>

    <button
      type="button"
      class="grid size-9 shrink-0 place-items-center rounded-ctl border border-line-2 bg-surface text-ink hover:border-line-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      :aria-label="themeLabel"
      @click="toggleTheme"
    >
      <Icon :name="theme === 'dark' ? 'app.moon' : 'app.sun'" size="sm" />
    </button>
  </header>
</template>

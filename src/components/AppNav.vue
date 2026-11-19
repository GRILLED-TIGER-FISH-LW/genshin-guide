<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { theme, toggleTheme } from '../composables/useTheme.js'
import SolarIcon from './SolarIcon.vue'

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
      class="grid size-icon-btn shrink-0 place-items-center rounded-md border border-line-2 bg-surface text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      aria-label="打开菜单"
      @click="$emit('open-menu')"
    >
      <SolarIcon name="solar:hamburger-menu" size="20" aria-hidden="true" />
    </button>

    <span
      v-if="titleIcon"
      class="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-strong"
      aria-hidden="true"
    >
      <SolarIcon :name="titleIcon" :bold="true" size="20" />
    </span>

    <h1 class="min-w-0 flex-1 truncate text-heading-5 text-ink">{{ title }}</h1>

    <button
      type="button"
      class="grid size-icon-btn shrink-0 place-items-center rounded-md border border-line-2 bg-surface text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      :aria-label="themeLabel"
      @click="toggleTheme"
    >
      <SolarIcon :name="theme === 'dark' ? 'solar:moon' : 'solar:sun-2'" :bold="true" size="20" aria-hidden="true" />
    </button>
  </header>
</template>

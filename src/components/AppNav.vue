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
  <el-header class="ah-appnav">
    <el-button circle aria-label="打开菜单" @click="$emit('open-menu')">
      <SolarIcon name="solar:hamburger-menu" size="20" />
    </el-button>

    <span
      v-if="titleIcon"
      class="grid size-7 shrink-0 place-items-center rounded-ctl bg-accent-soft text-accent-strong"
      aria-hidden="true"
    >
      <SolarIcon :name="titleIcon" :bold="true" size="20" />
    </span>

    <h1 class="min-w-0 flex-1 truncate text-base font-semibold text-ink">{{ title }}</h1>

    <el-button circle :aria-label="themeLabel" @click="toggleTheme">
      <SolarIcon :name="theme === 'dark' ? 'solar:moon' : 'solar:sun-2'" size="20" />
    </el-button>
  </el-header>
</template>

<style scoped>
/* 顶栏高度与内边距沿用改版前的尺寸（EP 默认 60px / 20px，这里拉回 56px / 12px） */
.ah-appnav {
  --el-header-padding: 0 12px;
  height: 56px;
}
</style>

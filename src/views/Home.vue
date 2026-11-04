<script setup>
import { TOOLS } from '../router.js'
import Icon from '../components/Icon.vue'

const subCount = (t) => (t.subtools || []).length
</script>

<template>
  <!-- Bento 网格：窄屏 2 列 / ≥640 三列 / ≥1024 四列，与原 .home-view 一致 -->
  <div
    class="absolute inset-0 grid grid-cols-2 content-start gap-2 overflow-y-auto p-4 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
  >
    <RouterLink
      v-for="t in TOOLS"
      :key="t.key"
      :to="'/' + t.key"
      class="flex flex-col items-start gap-2 overflow-hidden rounded-panel border border-line bg-surface p-4 transition-colors duration-150 ease-spring hover:bg-hover active:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
    >
      <!-- 图标固定 32px：外层给死尺寸，内层 svg 撑满，不吃 Icon 的档位 -->
      <span class="size-8 shrink-0 text-accent [&>svg]:size-full" aria-hidden="true">
        <Icon :name="t.icon" size="lg" />
      </span>

      <span class="w-full truncate text-sm font-semibold text-ink">{{ t.label }}</span>

      <span v-if="subCount(t)" class="w-full truncate text-xs text-muted">
        {{ subCount(t) }} 个子工具
      </span>
    </RouterLink>
  </div>
</template>

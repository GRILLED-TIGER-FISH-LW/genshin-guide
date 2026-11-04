<script setup>
import { TOOLS } from '../router.js'
import Icon from '../components/Icon.vue'

/* 一句描述（<=1 行）。不写数量 —— 数量随数据会变，改起来容易漏。
   三行结构（图标 / 标题 / 描述）+ 描述锁两行高，是卡片严格等高的前提。 */
const DESC = {
  character: '武器 / 圣遗物 / 天赋 / 命座总览',
  'icon-editor': '维护图标字典 · 查缺补漏',
  'video-cover': '视频封面 / 合集封面排版',
  'image-tools': '背景修改 / 双图羽化 / 图层拼接',
  chart: '雷达图 / 柱状图',
  tier: 'S / A / B 三档排行',
}
</script>

<template>
  <!-- 外壳：冒险之证的网格 + 本页必需的绝对定位滚动容器（FrameLayer 与它同格） -->
  <div
    class="absolute inset-0 grid grid-cols-2 content-start gap-2 overflow-y-auto p-3 sm:grid-cols-3 lg:grid-cols-4"
  >
    <RouterLink
      v-for="t in TOOLS"
      :key="t.key"
      :to="'/' + t.key"
      class="grid content-start gap-2 rounded-panel border border-line bg-surface p-3 hover:bg-hover active:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
    >
      <span
        class="grid size-8 place-items-center rounded-ctl bg-accent-soft text-accent-strong"
        aria-hidden="true"
      >
        <Icon :name="t.icon" size="sm" />
      </span>

      <span class="grid min-w-0 gap-0.5">
        <span class="truncate text-sm font-semibold text-ink">{{ t.label }}</span>
        <span class="line-clamp-2 min-h-8 text-xs leading-snug text-muted">{{ DESC[t.key] }}</span>
      </span>
    </RouterLink>
  </div>
</template>

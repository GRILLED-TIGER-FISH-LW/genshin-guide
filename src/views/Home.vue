<script setup>
import { TOOLS } from '../router.js'
import SolarIcon from '../components/SolarIcon.vue'

/* 一句描述（<=1 行）。不写数量 —— 数量随数据会变，改起来容易漏。
   三行结构（图标 / 标题 / 描述）+ 描述锁两行高，是卡片严格等高的前提。 */
const DESC = {
  character: '武器 / 圣遗物 / 天赋 / 命座总览',
  'image-dict': '维护图片字典 · 查缺补漏',
  'video-cover': '视频封面 / 合集封面排版',
  'image-tools': '背景修改 / 双图羽化 / 图层拼接',
  chart: '雷达图 / 柱状图',
  tier: 'S / A / B 三档排行',
}
</script>

<template>
  <!-- 外壳：滚动交给 el-scrollbar；网格布局保留 Tailwind（EP 不承担布局网格） -->
  <el-scrollbar class="absolute inset-0 p-3">
    <div class="grid grid-cols-2 content-start gap-2 sm:grid-cols-3 lg:grid-cols-4">
      <RouterLink v-for="t in TOOLS" :key="t.key" :to="'/' + t.key" class="ah-home-card">
        <el-card :body-style="{ padding: '12px' }" class="ah-home-card__inner">
          <span
            class="grid size-8 place-items-center rounded-ctl bg-accent-soft text-accent-strong"
            aria-hidden="true"
          >
            <SolarIcon :name="t.icon" size="20" />
          </span>

          <div class="grid min-w-0 gap-0.5">
            <el-text class="ah-text-block truncate font-semibold ah-text-ink" tag="span">
              {{ t.label }}
            </el-text>
            <el-text class="ah-text-block line-clamp-2 min-h-8 ah-text-muted" tag="span" size="small">
              {{ DESC[t.key] }}
            </el-text>
          </div>
        </el-card>
      </RouterLink>
    </div>
  </el-scrollbar>
</template>

<style scoped>
/* el-card 换成本站 token：去阴影、圆角用面板圆角、底色用表面色 */
.ah-home-card {
  display: block;
}

.ah-home-card__inner {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  background-color: var(--color-surface);
  box-shadow: none;
}

.ah-home-card:hover .ah-home-card__inner {
  background-color: var(--color-hover);
}

.ah-home-card:active .ah-home-card__inner {
  background-color: var(--color-sunken);
}
</style>

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
  <el-row class="ah-home">
    <el-col v-for="t in TOOLS" :key="t.key" :xs="24" :sm="12" :md="8" :lg="6">
      <RouterLink :to="'/' + t.key" class="ah-home__link">
        <el-card shadow="never" class="ah-home__card">
          <span class="ah-home__icon" aria-hidden="true">
            <SolarIcon :name="t.icon" :size="18" />
          </span>

          <div class="ah-home__body">
            <div class="ah-home__title">{{ t.label }}</div>
            <div class="ah-home__desc">{{ DESC[t.key] }}</div>
          </div>
        </el-card>
      </RouterLink>
    </el-col>
  </el-row>
</template>

<style scoped>
.ah-home {
  padding: 12px;
  column-gap: 12px;
  row-gap: 12px;
}

.ah-home__link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.ah-home__link:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.ah-home__card {
  color: inherit;
  transition: background-color var(--el-transition-duration-fast);
}

.ah-home__link:hover .ah-home__card,
.ah-home__link:focus-visible .ah-home__card {
  background-color: var(--el-fill-color-dark);
}

.ah-home__card :deep(.el-card__body) {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.ah-home__icon {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: var(--el-border-radius-base);
  place-items: center;
  background-color: color-mix(in srgb, var(--color-accent) 12%, #faf9f5);
  color: var(--color-accent-strong);
}

[data-theme='dark'] .ah-home__icon {
  background-color: color-mix(in srgb, var(--color-accent) 18%, #1f1e1b);
}

.ah-home__body {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.ah-home__title {
  color: var(--el-text-color-primary);
  font-size: var(--el-font-size-base);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ah-home__desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-small);
  overflow: hidden;
}
</style>

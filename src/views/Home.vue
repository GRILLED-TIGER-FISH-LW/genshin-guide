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
  <el-scrollbar class="ah-home__scroll">
    <el-row class="ah-home" :gutter="12">
      <el-col v-for="t in TOOLS" :key="t.key" :span="12">
        <RouterLink :to="'/' + t.key" class="ah-home__link">
          <el-card shadow="never" class="ah-home__card">
            <div class="ah-home__inner">
              <span class="ah-home__icon" aria-hidden="true">
                <SolarIcon :name="t.icon" :size="18" />
              </span>

              <div class="ah-home__body">
                <div class="ah-home__title">{{ t.label }}</div>
                <div class="ah-home__desc">{{ DESC[t.key] }}</div>
              </div>
            </div>
          </el-card>
        </RouterLink>
      </el-col>
    </el-row>
  </el-scrollbar>
</template>

<style scoped>
/* 与冒险之证首页一比一：只写 EP 不提供的三件事——卡片固定高度、图标块尺寸、两行截断。
   宽度固定半栏由 el-col 的 :span="12" 决定，水平间距由 el-row 的 gutter 决定；
   垂直间距 EP 不提供，只能给 el-row 补 row-gap（gutter 只吃 number，写成数组会变 NaN）。
   圆角 / 内边距 / 字号 / 颜色全部走 EP 默认值与站点令牌。 */
.ah-home__scroll {
  height: 100%;
}

.ah-home {
  padding: 12px;
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

/* 固定高度：卡片不再随标题长短高低不齐 */
.ah-home__card {
  /* 半栏宽度下「图片字典编辑器」要折两行，104px 装不下，固定 132px */
  height: 132px;
  color: inherit;
  transition: background-color var(--el-transition-duration-fast);
}

.ah-home__link:hover .ah-home__card,
.ah-home__link:focus-visible .ah-home__card {
  background-color: var(--el-fill-color-dark);
}

/* EP 的 card 体默认不撑满，固定高度必须补这一行 */
.ah-home__card :deep(.el-card__body) {
  box-sizing: border-box;
  height: 100%;
}

.ah-home__inner {
  display: flex;
  gap: 12px;
  /* 顶部对齐：标题折两行时图标不会跟着上下浮动，所有卡片的图标落在同一水平线 */
  align-items: flex-start;
  height: 100%;
}

.ah-home__icon {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: var(--el-border-radius-base);
  place-items: center;
  /* 垫色昼夜各一档：白天 12% 陶土橙叠 #faf9f5，黑夜 18% 叠 #1f1e1b */
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
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  color: var(--el-text-color-primary);
  font-size: var(--el-font-size-base);
  font-weight: 500;
  overflow: hidden;
  /* 半栏放不下 7 个字（「图片字典编辑器」），折到第二行而不是省略成 … */
  word-break: break-word;
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

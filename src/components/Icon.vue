<script setup>
import { computed } from 'vue'
import { ICONS } from 'virtual:gg-icons'

/* 图标数据来自 shared/ui-icons.js —— 本仓库自己的图标真源，
   由 vite.config.js 的 iconsFromShared 插件在构建期读进来、
   剥掉外层 <svg> 并拍平成一维 map（键名 `组.名字`，如 ui.close）。

   运行时不再有任何图标脚本，也没有 window.ICONS 全局。 */

const props = defineProps({
  name: { type: String, required: true },
  /* 默认线框版；箭头类图标由调用方显式传 bold */
  bold: { type: Boolean, default: false },
  /* sm 16 / md 20 / lg 24 */
  size: { type: String, default: 'md' },
  /* 有 label 就是有意义图像，会被读屏念；没 label 自动 aria-hidden */
  label: { type: String, default: '' },
})

const SIZE = { sm: 'size-4', md: 'size-5', lg: 'size-6' }

const inner = computed(() => {
  const base = ICONS[props.name]
  const bold = ICONS[`${props.name}Bold`]
  return props.bold ? (bold ?? base ?? '') : (base ?? bold ?? '')
})
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    focusable="false"
    :class="[SIZE[size], 'shrink-0']"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    v-html="inner"
  />
</template>

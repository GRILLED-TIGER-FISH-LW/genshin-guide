<script setup>
import { computed } from 'vue'
import { ICONS } from '../icons/index.js'

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

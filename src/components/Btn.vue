<script setup>
import { computed } from 'vue'

const props = defineProps({
  /* primary  实心强调（accent-solid + 白字）
     secondary 描边（默认）
     ghost     无底无边，工具栏用
     danger    危险操作 */
  variant: {
    type: String,
    default: 'secondary',
    validator: (v) => ['primary', 'secondary', 'ghost', 'danger'].includes(v),
  },
  /* md 标准按钮 / sm 紧凑按钮（工具栏、列表行、卡片角） */
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['md', 'sm'].includes(v),
  },
  /* 纯图标：去掉左右 padding，锁定正方形。必须自己传 aria-label */
  square: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

/* md 窄屏 40px（配表单/弹窗），宽屏 36px；sm 恒定 36px（配工具栏的输入框/下拉） */
const MD = 'h-10 px-4 text-sm gap-2 sm:h-9'
const SM = 'h-9 px-3 text-xs gap-1.5'
const MD_SQ = 'size-10 p-0 gap-0 sm:size-9'
const SM_SQ = 'size-9 p-0 gap-0'

const VARIANTS = {
  primary: 'bg-accent-solid text-on-accent hover:bg-accent-hover',
  secondary: 'bg-surface text-ink border border-line-2 hover:bg-hover',
  ghost: 'bg-transparent text-body hover:bg-hover',
  danger: 'bg-danger-soft text-danger hover:bg-danger-soft/70',
}

const isDisabled = computed(() => props.disabled || props.loading)

const rootClass = computed(() => [
  'relative inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-ctl',
  'font-medium select-none',
  'transition-transform duration-100 ease-spring active:scale-[0.98]',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
  'disabled:pointer-events-none disabled:opacity-50',
  VARIANTS[props.variant],
  props.square ? (props.size === 'sm' ? SM_SQ : MD_SQ) : props.size === 'sm' ? SM : MD,
])

/* 图标槽尺寸：20px / 36px = 55%，40px 高时 50%，都不再是原来那 44% */
const iconBox = computed(() => (props.size === 'sm' ? 'size-4' : 'size-5'))
</script>

<template>
  <button
    type="button"
    :class="rootClass"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
  >
    <span class="contents" :class="loading && 'invisible'">
      <span
        v-if="$slots.icon"
        class="grid shrink-0 place-items-center [&>svg]:size-full"
        :class="iconBox"
      >
        <slot name="icon" />
      </span>
      <slot />
    </span>

    <span
      v-if="loading"
      class="absolute inset-0 grid place-items-center"
      aria-hidden="true"
    >
      <span
        class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      ></span>
    </span>
  </button>
</template>

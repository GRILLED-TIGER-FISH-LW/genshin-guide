<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  /* [{ value: 'all', label: '全部' }, ...] */
  options: { type: Array, required: true },
  /* 整行铺满（用于筛选条），否则按内容宽度 */
  full: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const model = defineModel({ type: String, default: '' })

const uid = useId()
const groupName = computed(() => `seg-${uid}`)

/* 内层 32px + 外层 p-1×2 = 40px 恒定，与表单里的 Field 同高 */
const itemClass = computed(() => [
  'grid place-items-center rounded-ctl px-3',
  'text-xs font-medium text-muted',
  'transition-shadow duration-150 ease-spring',
  'h-8',
  'peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-panel',
  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent',
  'peer-disabled:opacity-50',
  props.full ? 'min-w-0 flex-1' : 'shrink-0',
])
</script>

<template>
  <div
    class="inline-flex items-center gap-1 rounded-panel border border-line bg-sunken p-1"
    :class="full && 'flex w-full'"
  >
    <label
      v-for="opt in options"
      :key="opt.value"
      class="cursor-pointer"
      :class="full ? 'min-w-0 flex-1' : 'shrink-0'"
    >
      <input
        type="radio"
        class="peer sr-only"
        :name="groupName"
        :value="opt.value"
        :checked="model === opt.value"
        :disabled="disabled"
        @change="model = opt.value"
      />
      <span :class="itemClass">{{ opt.label }}</span>
    </label>
  </div>
</template>

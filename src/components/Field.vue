<script setup>
import { computed, useId } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  /* text | number | search | password | textarea */
  type: { type: String, default: 'text' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  /* 有值即视为错误态：红边 + 红字 + aria-invalid */
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  maxlength: { type: Number, default: undefined },
  showCount: { type: Boolean, default: false },
  rows: { type: Number, default: 3 },
  /* 仅 textarea：自适应高度用 field-sizing，不支持的浏览器回落到 rows */
  autoGrow: { type: Boolean, default: false },
})

const model = defineModel({ type: String, default: '' })

const uid = useId()
const id = computed(() => `${uid}`)
const descId = computed(() => `${id.value}-desc`)

const isTextarea = computed(() => props.type === 'textarea')
const hasDesc = computed(() => Boolean(props.error || props.hint))
const len = computed(() => (model.value ?? '').length)

const isNumber = computed(() => props.type === 'number')

/* 输入框比按钮高一档：40px vs 36px（桌面），移动端两者都 40px。
   焦点环用 outline（全站统一），错误态换成红色；边框变色瞬时 —— 不做颜色过渡 */
const fieldClass = computed(() => [
  'w-full min-w-0 rounded-ctl border bg-surface px-3 text-sm text-ink',
  'placeholder:text-muted',
  'transition-colors duration-150 ease-spring',
  'hover:border-line-3',
  'focus-visible:outline-2 focus-visible:outline-offset-1',
  'disabled:pointer-events-none disabled:opacity-50 disabled:bg-sunken',
  'readonly:bg-sunken',
  props.error
    ? 'border-danger focus-visible:outline-danger'
    : 'border-line-2 focus-visible:border-accent focus-visible:outline-accent',
  isTextarea.value ? 'resize-none py-2 leading-relaxed' : 'h-10',
  isNumber.value
    ? '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
    : '',
])
</script>

<template>
  <div class="grid gap-1.5">
    <div v-if="label || showCount" class="flex items-center justify-between gap-2">
      <label v-if="label" :for="id" class="text-xs font-medium text-muted">
        {{ label }}
        <span v-if="required" class="text-danger" aria-hidden="true">*</span>
      </label>
      <span v-if="showCount" class="shrink-0 text-xs tabular-nums text-faint">
        {{ len }}<template v-if="maxlength">/{{ maxlength }}</template>
      </span>
    </div>

    <textarea
      v-if="isTextarea"
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :class="[fieldClass, autoGrow ? 'field-sizing-content' : '']"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :maxlength="maxlength"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="hasDesc ? descId : undefined"
    />

    <input
      v-else
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :type="type"
      :class="fieldClass"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :maxlength="maxlength"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="hasDesc ? descId : undefined"
    />

    <p
      v-if="hasDesc"
      :id="descId"
      class="text-xs leading-relaxed"
      :class="error ? 'text-danger' : 'text-faint'"
      :aria-live="error ? 'polite' : undefined"
    >
      {{ error || hint }}
    </p>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, useId } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  /* 单项最大显示数 */
  max: { type: Number, default: 40 },
  /* 允许「当前输入的文字」成为一个可选项 */
  allowCustom: { type: Boolean, default: false },
  /* 自定义项的显示文案，如 v => '＋ 新增地区：' + v */
  customLabel: { type: Function, default: null },
  /* 返回 true 时不展开建议（例如输入里有分隔符，正在批量粘贴） */
  suppressWhen: { type: Function, default: null },
})

const emit = defineEmits(['update:modelValue', 'select'])

const uid = useId()
const listId = `cb-${uid}`
const optId = (i) => `cb-${uid}-${i}`

const inputEl = ref(null)
const open = ref(false)
const highlight = ref(0)

const suppressed = computed(() => Boolean(props.suppressWhen?.(props.modelValue)))

const options = computed(() => {
  const q = props.modelValue.trim().toLowerCase()
  const matched = (q ? props.items.filter((x) => x.toLowerCase().includes(q)) : props.items).slice(
    0,
    props.max,
  )
  const out = matched.map((v) => ({ value: v, isNew: false }))
  const raw = props.modelValue.trim()
  if (props.allowCustom && raw && !props.items.includes(raw)) {
    out.push({ value: raw, isNew: true })
  }
  return out
})

const showPopup = computed(() => open.value && !suppressed.value)

const activeId = computed(() =>
  showPopup.value && options.value.length ? optId(highlight.value) : undefined,
)

function onFocus() {
  highlight.value = 0
  open.value = true
}

function onInput(e) {
  emit('update:modelValue', e.target.value)
  highlight.value = 0
  open.value = true
}

function onKeydown(e) {
  const n = options.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!showPopup.value) open.value = true
    else highlight.value = n ? Math.min(highlight.value + 1, n - 1) : 0
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlight.value = n ? Math.max(highlight.value - 1, 0) : 0
  } else if (e.key === 'Enter') {
    if (!showPopup.value || !n) return
    e.preventDefault()
    choose(highlight.value)
  } else if (e.key === 'Escape') {
    if (open.value) {
      e.preventDefault()
      open.value = false
    }
  }
}

async function choose(i) {
  const it = options.value[i]
  if (!it) return
  emit('update:modelValue', it.value)
  emit('select', it.value)
  open.value = false
  await nextTick()
  inputEl.value?.focus()
}

function onBlur() {
  setTimeout(() => {
    open.value = false
  }, 150)
}

function onOptionDown(e, i) {
  e.preventDefault()
  choose(i)
}

function labelOf(it) {
  return it.isNew && props.customLabel ? props.customLabel(it.value) : it.value
}
</script>

<template>
  <div class="relative">
    <div class="relative flex items-center">
      <slot name="prefix" />
      <input
        ref="inputEl"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="showPopup"
        :aria-controls="showPopup ? listId : undefined"
        :aria-activedescendant="activeId"
        :aria-label="ariaLabel || undefined"
        :value="modelValue"
        :placeholder="placeholder || undefined"
        autocomplete="off"
        spellcheck="false"
        class="h-10 w-full min-w-0 rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        :class="$slots.prefix && 'pl-11'"
        @focus="onFocus"
        @input="onInput"
        @keydown="onKeydown"
        @blur="onBlur"
      />
    </div>

    <ul
      v-if="showPopup"
      :id="listId"
      role="listbox"
      class="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-60 overflow-y-auto rounded-panel border border-line-2 bg-surface p-1 shadow-float"
    >
      <li v-if="!options.length" class="px-2 py-1.5 text-xs text-muted">
        无匹配，可直接输入新值
      </li>
      <li
        v-for="(it, i) in options"
        :id="optId(i)"
        :key="it.value"
        role="option"
        :aria-selected="it.value === modelValue"
        class="cursor-pointer truncate rounded-ctl px-2 py-1.5 text-sm"
        :class="[
          it.isNew ? 'text-accent-strong' : it.value === modelValue ? 'text-accent-strong' : 'text-ink',
          i === highlight ? 'bg-hover' : it.value === modelValue ? 'bg-accent-soft' : '',
        ]"
        @mouseenter="highlight = i"
        @pointerdown="onOptionDown($event, i)"
      >
        {{ labelOf(it) }}
      </li>
    </ul>
  </div>
</template>

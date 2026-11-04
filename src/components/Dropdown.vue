<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  /* [{ value: '蒙德', label: '蒙德' }, ...] */
  options: { type: Array, default: () => [] },
  /* 仅用于无障碍（aria-label），不再渲染成可见文字 —— 工具栏高度紧张 */
  label: { type: String, default: '' },
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
})

const model = defineModel({ type: String, default: '' })

const uid = useId()
const trigger = ref(null)
const panel = ref(null)
const isOpen = ref(false)
const activeIndex = ref(-1)
const panelStyle = ref({})

const listId = computed(() => `dd-${uid}`)
const optionId = (i) => `dd-${uid}-${i}`
const activeId = computed(() =>
  isOpen.value && activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined,
)
const currentLabel = computed(() => props.options.find((o) => o.value === model.value)?.label ?? '')
const triggerLabel = computed(() =>
  props.label ? `${props.label}：${currentLabel.value || props.placeholder}` : undefined,
)

/* ---------- 定位：宽度锁死为触发器宽度，空间不足时向上翻 ---------- */
function position() {
  const el = trigger.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const GAP = 4
  const spaceBelow = window.innerHeight - r.bottom - GAP - 8
  const spaceAbove = r.top - GAP - 8
  const openUp = spaceBelow < 160 && spaceAbove > spaceBelow
  const maxHeight = Math.min(320, Math.max(96, openUp ? spaceAbove : spaceBelow))

  panelStyle.value = {
    position: 'fixed',
    left: `${r.left}px`,
    width: `${r.width}px`,
    maxHeight: `${maxHeight}px`,
    ...(openUp
      ? { bottom: `${window.innerHeight - r.top + GAP}px` }
      : { top: `${r.bottom + GAP}px` }),
  }
}

let frame = 0
function onViewportChange() {
  if (!isOpen.value || frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    position()
  })
}

/* ---------- 开合 ---------- */
function open() {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  const idx = props.options.findIndex((o) => o.value === model.value)
  activeIndex.value = idx >= 0 ? idx : props.options.length ? 0 : -1
  nextTick(position)
}

function close(restoreFocus = true) {
  if (!isOpen.value) return
  isOpen.value = false
  activeIndex.value = -1
  if (restoreFocus) trigger.value?.focus()
}

function toggle() {
  isOpen.value ? close() : open()
}

function choose(i) {
  const opt = props.options[i]
  if (!opt) return
  model.value = opt.value
  close()
}

/* ---------- 键盘 ---------- */
function onKeydown(e) {
  if (props.disabled) return
  const k = e.key
  const n = props.options.length

  if (!isOpen.value) {
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
      e.preventDefault()
      open()
    }
    return
  }

  if (k === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (k === 'Tab') {
    close(false)
    return
  }
  if (k === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = n ? (activeIndex.value + 1) % n : -1
  } else if (k === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = n ? (activeIndex.value - 1 + n) % n : -1
  } else if (k === 'Home') {
    e.preventDefault()
    activeIndex.value = n ? 0 : -1
  } else if (k === 'End') {
    e.preventDefault()
    activeIndex.value = n ? n - 1 : -1
  } else if (k === 'Enter' || k === ' ') {
    e.preventDefault()
    choose(activeIndex.value)
  }
}

/* ---------- 点外部关闭 ---------- */
function onDocDown(e) {
  if (trigger.value?.contains(e.target)) return
  if (panel.value?.contains(e.target)) return
  close(false)
}

function bind() {
  document.addEventListener('mousedown', onDocDown, true)
  window.addEventListener('scroll', onViewportChange, { passive: true, capture: true })
  window.addEventListener('resize', onViewportChange)
}
function unbind() {
  document.removeEventListener('mousedown', onDocDown, true)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
}

watch(isOpen, (v) => (v ? bind() : unbind()))

watch(activeIndex, async () => {
  if (!isOpen.value || activeIndex.value < 0) return
  await nextTick()
  document.getElementById(optionId(activeIndex.value))?.scrollIntoView({ block: 'nearest' })
})

onBeforeUnmount(unbind)

function itemClass(i, value) {
  const selected = value === model.value
  const active = i === activeIndex.value
  return [
    'cursor-pointer rounded-ctl px-2.5 py-1.5 text-xs',
    selected ? 'font-medium text-accent-strong' : 'text-ink',
    active ? 'bg-hover' : selected ? 'bg-accent-soft' : '',
  ]
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="flex h-9 w-full min-w-0 items-center gap-1.5 rounded-ctl border border-line-2 bg-surface px-2.5 text-xs text-ink hover:border-line-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50"
    :disabled="disabled"
    :aria-expanded="isOpen"
    aria-haspopup="listbox"
    :aria-controls="isOpen ? listId : undefined"
    :aria-activedescendant="activeId"
    :aria-label="triggerLabel"
    @click="toggle"
    @keydown="onKeydown"
  >
    <span class="min-w-0 flex-1 truncate text-left" :class="currentLabel ? 'text-ink' : 'text-muted'">
      {{ currentLabel || placeholder }}
    </span>
    <span class="grid size-4 shrink-0 place-items-center text-muted">
      <Icon
        name="ui.chevronDown"
        bold
        size="sm"
        class="transition-transform duration-150 ease-spring"
        :class="isOpen && 'rotate-180'"
      />
    </span>
  </button>

  <Teleport to="body">
    <ul
      v-if="isOpen"
      :id="listId"
      ref="panel"
      role="listbox"
      :style="panelStyle"
      class="z-[60] overflow-y-auto rounded-panel border border-line-3 bg-surface p-1 shadow-float"
    >
      <li v-if="!options.length" class="px-2.5 py-1.5 text-xs text-muted" role="presentation">
        没有可选项
      </li>

      <li
        v-for="(opt, i) in options"
        :id="optionId(i)"
        :key="opt.value"
        role="option"
        :aria-selected="opt.value === model"
        :class="itemClass(i, opt.value)"
        @mouseenter="activeIndex = i"
        @click="choose(i)"
      >
        {{ opt.label }}
      </li>
    </ul>
  </Teleport>
</template>

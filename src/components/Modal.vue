<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import Btn from './Btn.vue'

const props = defineProps({
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  /* 确认按钮用危险色（删除、清空） */
  danger: { type: Boolean, default: false },
  /* 确认按钮转圈，期间两个按钮都不可点 */
  loading: { type: Boolean, default: false },
  hideCancel: { type: Boolean, default: false },
  /* 点遮罩 / 按 Esc 不关闭（强确认场景） */
  persistent: { type: Boolean, default: false },
})

const open = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['confirm', 'cancel'])

const uid = useId()
const dialog = ref(null)
const titleId = computed(() => `md-${uid}-title`)
const bodyId = computed(() => `md-${uid}-body`)

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/* 滚动锁：计数式，防嵌套弹窗提前解锁 */
let lockCount = 0
function lockScroll() {
  if (++lockCount === 1) document.documentElement.style.overflow = 'hidden'
}
function unlockScroll() {
  if (lockCount > 0 && --lockCount === 0) document.documentElement.style.overflow = ''
}

const appRoot = document.getElementById('app')
let lastFocused = null

/* Tab 在面板内循环。背景已 inert，这里只处理首尾衔接 */
function onKeydown(e) {
  if (e.key === 'Escape' && !props.persistent) {
    e.preventDefault()
    close('cancel')
    return
  }
  if (e.key !== 'Tab') return

  const nodes = dialog.value?.querySelectorAll(FOCUSABLE)
  if (!nodes?.length) {
    e.preventDefault()
    return
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement

  if (e.shiftKey && (active === first || active === dialog.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

function close(action) {
  if (props.loading) return
  open.value = false
  if (action === 'confirm') emit('confirm')
  else emit('cancel')
}

function onBackdrop() {
  if (!props.persistent) close('cancel')
}

watch(open, async (v) => {
  if (v) {
    lastFocused = document.activeElement
    lockScroll()
    if (appRoot) appRoot.inert = true
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    const target =
      dialog.value?.querySelector('[data-autofocus]') ||
      dialog.value?.querySelector(FOCUSABLE) ||
      dialog.value
    target?.focus()
  } else {
    document.removeEventListener('keydown', onKeydown)
    unlockScroll()
    if (appRoot) appRoot.inert = false
    lastFocused?.focus?.()
    lastFocused = null
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  if (open.value) {
    unlockScroll()
    if (appRoot) appRoot.inert = false
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="md">
      <div
        v-if="open"
        class="fixed inset-0 z-[200] grid place-items-center bg-mask p-4"
        @mousedown.self="onBackdrop"
      >
        <div
          ref="dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          :aria-describedby="$slots.default || message ? bodyId : undefined"
          tabindex="-1"
          class="grid w-full max-w-md gap-4 rounded-panel border border-line bg-surface p-5 shadow-float focus:outline-none"
        >
          <h2 v-if="title" :id="titleId" class="text-base font-semibold text-ink">
            {{ title }}
          </h2>

          <div :id="bodyId" class="grid gap-2 text-sm leading-relaxed text-body">
            <slot>
              <p v-if="message">{{ message }}</p>
            </slot>
          </div>

          <div class="flex justify-end gap-2">
            <Btn
              v-if="!hideCancel"
              variant="secondary"
              :disabled="loading"
              @click="close('cancel')"
            >
              {{ cancelText }}
            </Btn>
            <Btn
              :variant="danger ? 'danger' : 'primary'"
              :loading="loading"
              data-autofocus
              @click="close('confirm')"
            >
              {{ confirmText }}
            </Btn>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 只动 opacity 与 transform，不碰颜色 */
.md-enter-active,
.md-leave-active {
  transition: opacity 200ms var(--ease-spring);
}
.md-enter-from,
.md-leave-to {
  opacity: 0;
}

.md-enter-active > div,
.md-leave-active > div {
  transition: transform 200ms var(--ease-spring);
}
.md-enter-from > div,
.md-leave-to > div {
  transform: translateY(8px) scale(0.98);
}
</style>

<script setup>
import Icon from './Icon.vue'
import { useToast } from '../composables/useToast.js'

const { toasts, remove } = useToast()

const DOT = {
  info: 'bg-accent',
  success: 'bg-success',
  error: 'bg-danger',
}

const FRAME = {
  info: 'border-line-2',
  success: 'border-line-2',
  error: 'border-danger',
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-14 z-[300] grid justify-items-center gap-2 p-4 sm:justify-items-end"
      role="region"
      aria-label="通知"
    >
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          role="status"
          :aria-live="t.type === 'error' ? 'assertive' : 'polite'"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-panel border bg-surface px-3 py-2 shadow-float"
          :class="FRAME[t.type]"
        >
          <span class="grid h-5 shrink-0 place-items-center" aria-hidden="true">
            <span class="size-2 rounded-full" :class="DOT[t.type]"></span>
          </span>

          <p class="min-w-0 flex-1 text-sm leading-relaxed text-ink">{{ t.text }}</p>

          <button
            type="button"
            class="grid size-6 shrink-0 place-items-center rounded-ctl text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            aria-label="关闭通知"
            @click="remove(t.id)"
          >
            <Icon name="ui.close" size="sm" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
/* 只动 opacity 与 transform */
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 200ms var(--ease-spring),
    transform 200ms var(--ease-spring);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.toast-leave-active {
  position: absolute;
}
.toast-move {
  transition: transform 200ms var(--ease-spring);
}
</style>

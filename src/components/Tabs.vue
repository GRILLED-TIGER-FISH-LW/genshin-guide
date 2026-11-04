<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  /* [{ value: '5.4', label: '5.4' }, ...] */
  options: { type: Array, required: true },
})

const model = defineModel({ type: String, default: '' })

const strip = ref(null)

/* 选中项跑出可视区时拉回来。block:'nearest' 保证不会顺带把页面纵向滚走 */
async function revealActive() {
  await nextTick()
  const el = strip.value?.querySelector('[aria-current="true"]')
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

watch(() => model.value, revealActive, { immediate: true })
</script>

<template>
  <div
    ref="strip"
    class="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    <button
      v-for="opt in props.options"
      :key="opt.value"
      type="button"
      :aria-current="model === opt.value ? 'true' : undefined"
      class="h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      :class="
        model === opt.value
          ? 'border-ink bg-ink text-canvas'
          : 'border-line bg-transparent text-muted hover:bg-hover'
      "
      @click="model = opt.value"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

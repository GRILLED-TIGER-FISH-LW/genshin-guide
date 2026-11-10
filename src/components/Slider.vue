<script setup>
import { ref, useId, watch } from 'vue'

const props = defineProps({
  label: { type: String, default: '' },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  unit: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const model = defineModel({ type: Number, default: 0 })

const uid = useId()

const clamp = (n) => Math.min(props.max, Math.max(props.min, Number(n) || 0))

/* 数字框里显示什么由 text 说了算（绑 undefined 会把输入框清空，那就成了「打什么都看不见」）：
   · 拖拖动条 / 外部改值 → 回灌，但正在打字时不回灌，否则输到一半会被改掉
   · 自己在打字 → 原样显示，半截（空 / 只有一个减号）或超范围也先显示着
   · 失焦才归位 —— 输 9999 会显示成真正生效的 3840，打字期间不跳 */
const text = ref('')
const typing = ref(false)

watch(model, (v) => {
  if (!typing.value) text.value = String(v ?? '')
}, { immediate: true })

function onType(e) {
  const raw = e.target.value
  text.value = raw
  if (raw === '' || raw === '-') return
  const n = Number(raw)
  if (Number.isFinite(n)) model.value = clamp(n)
}

function onBlur() {
  typing.value = false
  text.value = String(model.value ?? '')
}
</script>

<template>
  <div class="grid grid-cols-1 gap-1.5">
    <label v-if="label" :for="uid" class="text-xs text-muted">{{ label }}</label>

    <div class="flex items-center gap-2">
      <input
        :id="uid"
        v-model.number="model"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        class="h-9 min-w-0 flex-1 accent-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />

      <span
        class="flex h-9 w-[72px] shrink-0 items-center gap-1 rounded-ctl border border-line-2 bg-surface px-1.5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent"
      >
        <input
          :value="text"
          type="number"
          :min="min"
          :max="max"
          :step="step"
          :disabled="disabled"
          class="min-w-0 flex-1 bg-transparent text-right text-xs text-ink outline-none"
          @input="onType"
          @focus="typing = true"
          @blur="onBlur"
        />
        <span v-if="unit" class="shrink-0 text-[10px] text-muted">{{ unit }}</span>
      </span>
    </div>
  </div>
</template>

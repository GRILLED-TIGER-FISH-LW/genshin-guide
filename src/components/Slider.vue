<script setup>
import { computed, ref, useId } from 'vue'

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

/* 数字框在编辑期间不回灌 —— 否则输 9999 会被立刻改成 3840，光标也跳 */
const editing = ref(false)

const clamp = (n) => Math.min(props.max, Math.max(props.min, n))

function onNumber(e) {
  const raw = e.target.value
  if (raw === '' || raw === '-') return
  const n = Number(raw)
  if (!Number.isFinite(n)) return
  model.value = clamp(n)
}

/* 失焦才把框里归位到真正生效的值 */
function endEdit(e) {
  editing.value = false
  e.target.value = model.value
}

const box = computed(() => (editing.value ? undefined : model.value))
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
        class="flex h-9 w-24 shrink-0 items-center gap-1 rounded-ctl border border-line-2 bg-surface px-2 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent"
      >
        <input
          :value="box"
          type="number"
          :min="min"
          :max="max"
          :step="step"
          :disabled="disabled"
          class="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none"
          @input="onNumber"
          @focus="editing = true"
          @blur="endEdit"
        />
        <span v-if="unit" class="shrink-0 text-xs text-muted">{{ unit }}</span>
      </span>
    </div>
  </div>
</template>

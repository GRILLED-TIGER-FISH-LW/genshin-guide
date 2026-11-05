<script setup>
import { useId } from 'vue'

/* 行内单选：圆点 + 文字，选中的那项同时变字色（不只靠颜色区分）。
   选项少、要一眼看全的时候用它；选项多或文字长，用 Dropdown。 */
defineProps({
  label: { type: String, default: '' },
  /* [{ value, label }, ...] */
  options: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
})

const model = defineModel({ default: '' })

const uid = useId()
</script>

<template>
  <div class="grid grid-cols-1 gap-1.5">
    <p v-if="label" :id="`${uid}-label`" class="text-xs text-muted">{{ label }}</p>

    <div
      class="flex flex-wrap items-center gap-x-4 gap-y-2"
      role="radiogroup"
      :aria-labelledby="label ? `${uid}-label` : undefined"
      :aria-label="label ? undefined : '选项'"
    >
      <label
        v-for="o in options"
        :key="o.value"
        class="flex cursor-pointer items-center gap-1.5 text-xs"
        :class="model === o.value ? 'font-medium text-ink' : 'text-muted'"
      >
        <input
          v-model="model"
          type="radio"
          :name="uid"
          :value="o.value"
          :disabled="disabled"
          class="size-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
        {{ o.label }}
      </label>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { solarIcon } from '../icons/solar.js'

const props = defineProps({
  name: { type: String, required: true },
  bold: { type: Boolean, default: false },
  size: { type: [Number, String], default: 20 },
})

const comp = computed(() => solarIcon(props.name, props.bold))

/* 图标名写错会静默空白，开发期直接报出来 */
if (import.meta.env.DEV && !comp.value) {
  console.warn('[SolarIcon] 没登记的图标名：' + props.name)
}
</script>

<template>
  <component v-if="comp" :is="comp" :size="size" />
</template>

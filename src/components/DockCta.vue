<script setup>
import Btn from './Btn.vue'

/* 工具页的底部主操作：悬浮在滚动区上方、水平居中。
   每个工具都长这样，所以留在共享层，各页面只给文案和点击。

   用 absolute 而不是旧版的 fixed：它挂在工具视图的根节点上（那层是 relative），
   视觉效果与 fixed 相同，但不会被祖先的 transform / filter 改掉包含块。

   约定：用了它的页面，滚动区要留 pb-24 给它让位。 */
defineProps({
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
defineEmits(['click'])
</script>

<template>
  <!-- pointer-events-none：这条横向条子必须让点击穿过去，只有按钮本身收事件 -->
  <div
    class="pointer-events-none absolute inset-x-0 bottom-0 z-10 grid place-items-center pb-[calc(1rem+env(safe-area-inset-bottom))]"
  >
    <Btn
      variant="primary"
      size="lg"
      class="pointer-events-auto shadow-float"
      :loading="loading"
      :disabled="disabled"
      @click="$emit('click')"
    >
      <slot />
    </Btn>
  </div>
</template>

<script setup>
import { ref } from 'vue'

/* 预览框：16:9 深底 + 右上角浮动工具栏 + 点空白处淡出。
   两个封面工具共用，所以留在共享层。
   · 默认插槽 = 画面（canvas 或 svg），自己铺满
   · #toolbar  = 右上角浮动按钮组
   描边留在外框：不占内容盒，16:9 才是精确的 16:9。 */
const toolbarOn = ref(true)
</script>

<template>
  <div
    class="mx-auto w-full max-w-[720px] overflow-hidden rounded-panel border border-line bg-[#121212]"
  >
    <div class="relative grid aspect-video cursor-pointer" @click="toolbarOn = !toolbarOn">
      <slot />

      <!-- 淡出后仍可用 Tab 聚焦，聚焦到里面就自动显形，键盘用户不会把它弄丢 -->
      <div
        v-if="$slots.toolbar"
        class="absolute right-2 top-2 flex gap-1.5 transition-opacity duration-200"
        :class="
          toolbarOn
            ? 'opacity-100'
            : 'pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100'
        "
      >
        <slot name="toolbar" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AppNav from './components/AppNav.vue'
import AppDrawer from './components/AppDrawer.vue'
import FrameLayer from './components/FrameLayer.vue'

const drawerOpen = ref(false)
</script>

<template>
  <div class="grid h-dvh grid-rows-[auto_minmax(0,1fr)] bg-canvas">
    <AppNav @open-menu="drawerOpen = true" />
    <AppDrawer v-model="drawerOpen" />

    <!-- 内容区：RouterView 只出首页；工具页的 iframe 由 FrameLayer 常驻托管，
         两者都绝对定位、同一格，互不挤压 -->
    <main class="relative min-h-0 overflow-hidden">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>

      <FrameLayer />
    </main>
  </div>
</template>

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

    <main class="relative min-h-0 overflow-hidden">
      <!-- KeepAlive：搬进来的工具视图必须常驻。
           它一被销毁，app.js 那个 IIFE 受模块缓存保护不会重跑，
           监听和首屏渲染就都没了。顺手也保住了首页的滚动位置。 -->
      <RouterView v-slot="{ Component }">
        <KeepAlive>
          <component :is="Component" />
        </KeepAlive>
      </RouterView>

      <FrameLayer />
    </main>
  </div>
</template>

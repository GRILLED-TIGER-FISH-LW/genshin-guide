<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TOOLS } from '../router.js'
import SolarIcon from './SolarIcon.vue'

const open = defineModel({ type: Boolean, default: false })

const route = useRoute()
const router = useRouter()

const isHome = computed(() => !route.meta?.tool)
const toolOf = computed(() => route.meta?.tool || '')
const subOf = computed(() => route.meta?.sub || '')

/* 带子工具的当前工具，打开抽屉时展开它的分组（el-menu 的 default-openeds） */
const openedKey = computed(() => {
  const t = TOOLS.find((x) => x.key === toolOf.value)
  return t?.subtools ? [t.key] : []
})

function close() {
  open.value = false
}

watch(() => route.fullPath, close)

function go(path) {
  router.push(path)
  close()
}
</script>

<template>
  <el-drawer
    v-model="open"
    direction="ltr"
    size="256px"
    title="工具导航"
    class="ah-drawer"
  >
    <!-- 切工具就重建菜单：default-openeds 才能跟着当前工具重新生效 -->
    <el-menu :key="toolOf || 'home'" :default-openeds="openedKey" class="ah-drawer__menu">
      <el-menu-item index="home" :aria-current="isHome ? 'page' : undefined" @click="go('/')">
        <SolarIcon name="solar:home" :bold="isHome" size="20" />
        <span class="min-w-0 truncate">首页</span>
      </el-menu-item>

      <template v-for="t in TOOLS" :key="t.key">
        <el-sub-menu v-if="t.subtools" :index="t.key">
          <template #title>
            <SolarIcon :name="t.icon" :bold="toolOf === t.key" size="20" />
            <span class="min-w-0 truncate">{{ t.label }}</span>
          </template>
          <el-menu-item
            v-for="s in t.subtools"
            :key="s.key"
            :index="`${t.key}/${s.key}`"
            :class="{ 'is-active': subOf === s.key && toolOf === t.key }"
            @click="go('/' + t.key + '/' + s.key)"
          >
            <span
              class="size-1 shrink-0 rounded-full"
              :class="subOf === s.key && toolOf === t.key ? 'bg-accent' : 'bg-line-3'"
              aria-hidden="true"
            />
            <span class="min-w-0 truncate">{{ s.label }}</span>
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item
          v-else
          :index="t.key"
          :class="{ 'is-active': toolOf === t.key }"
          @click="go('/' + t.key)"
        >
          <SolarIcon :name="t.icon" :bold="toolOf === t.key" size="20" />
          <span class="min-w-0 truncate">{{ t.label }}</span>
        </el-menu-item>
      </template>
    </el-menu>
  </el-drawer>
</template>

<style scoped>
/* el-drawer 的骨架（遮罩、焦点圈、过渡）由 EP 提供，这里只调本站尺寸 */
.ah-drawer {
  --el-drawer-padding-primary: 12px;
}

/* el-menu 默认右边框在抽屉里多余 */
.ah-drawer__menu {
  border-right: none;
}
</style>

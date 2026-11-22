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
    title="功能导航"
    aria-label="工具导航"
    class="ah-drawer"
  >
    <nav class="ah-drawer__nav" aria-label="工具菜单">
      <el-menu :key="toolOf || 'home'" :default-openeds="openedKey" class="ah-drawer__menu">
        <el-menu-item index="home" :aria-current="isHome ? 'page' : undefined" @click="go('/')">
          <span
            class="grid size-5 mr-2 shrink-0 place-items-center"
            :class="isHome ? 'text-accent-strong' : 'text-muted'"
            aria-hidden="true"
          >
            <SolarIcon name="solar:home" :bold="isHome" size="20" />
          </span>
          <span class="min-w-0 truncate">首页</span>
        </el-menu-item>

        <template v-for="t in TOOLS" :key="t.key">
          <el-sub-menu v-if="t.subtools" :index="t.key">
            <template #title>
              <span
                class="grid size-5 mr-2 shrink-0 place-items-center"
                :class="toolOf === t.key ? 'text-accent-strong' : 'text-muted'"
                aria-hidden="true"
              >
                <SolarIcon :name="t.icon" :bold="toolOf === t.key" size="20" />
              </span>
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
                class="size-1 mr-2 shrink-0 rounded-full"
                :class="subOf === s.key && toolOf === t.key ? 'bg-accent' : 'bg-line-2'"
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
            <span
              class="grid size-5 mr-2 shrink-0 place-items-center"
              :class="toolOf === t.key ? 'text-accent-strong' : 'text-muted'"
              aria-hidden="true"
            >
              <SolarIcon :name="t.icon" :bold="toolOf === t.key" size="20" />
            </span>
            <span class="min-w-0 truncate">{{ t.label }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </nav>
  </el-drawer>
</template>

<style scoped>
.ah-drawer {
  border-right: 1px solid var(--color-line);
  background-color: var(--color-canvas);
}

/* EP 的 header 自带 32px 下边距，和 body 的 20px 上内边距叠成 52px；
   去掉这 32px，标题到第一行菜单就只剩 EP 的 20px 一层 */
.ah-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
}

.ah-drawer__nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* 不加内边距：左右交给 EP 的 --el-drawer-padding-primary（20px），只留一层间距 */
  padding: 0;
}

.ah-drawer__menu {
  --el-menu-bg-color: transparent;
  --el-menu-text-color: var(--color-body);
  --el-menu-hover-bg-color: var(--color-hover);
  --el-menu-active-color: var(--color-accent-strong);
  border: 0;
  background: transparent;
}

.ah-drawer__menu :deep(.el-menu-item) {
  border-radius: var(--el-border-radius-base);
  color: var(--color-body);
}

.ah-drawer__menu :deep(.el-menu-item.is-active) {
  /* 选中态 = accent-soft 垫色 + accent 文字 + 左侧 2px 竖条（inset 阴影，不占位）。
     accent-soft 从 12% 提到 16%：再淡就看着像灰底，等于没选中。 */
  background-color: var(--color-accent-soft);
  color: var(--color-accent-strong);
  font-weight: 600;
  box-shadow: inset 2px 0 0 var(--color-accent);
}

.ah-drawer__menu :deep(.el-menu-item:focus-visible) {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}
</style>

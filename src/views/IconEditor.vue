<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Btn from '../components/Btn.vue'
import Dropdown from '../components/Dropdown.vue'
import Field from '../components/Field.vue'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import Seg from '../components/Seg.vue'
import SyncReport from '../components/SyncReport.vue'
import { useIconDict } from '../composables/useIconDict.js'

/* 图标字典编辑器 · 界面
 * -------------------------------------------------------------------------
 * 域逻辑全在 useIconDict.js，这里只管长得怎么样。
 *
 * 布局（相对旧版的主要改动）：
 *   · 操作按钮从「一行左右拖动」改成 flex-wrap 自动换行
 *   · 分类页签用 Seg（等宽分段控件），不再横向滚动
 *   · 信息行 + 「清空」独立成底部一行 —— 破坏性操作不跟常用操作挤在一起
 * ------------------------------------------------------------------------- */

const {
  loading,
  busy,
  tab,
  search,
  dirty,
  log,
  filtered,
  sorted,
  infoText,
  resolveUrl,
  starStyle,
  setOrder,
  setName,
  setStar,
  removeRow,
  clearTab,
  init,
  loadDict,
  parsePastedUrls,
  syncFromAmber,
  exportDict,
} = useIconDict()

const TABS = [
  { value: 'characters', label: '角色' },
  { value: 'artifacts', label: '圣遗物' },
  { value: 'weapons', label: '武器' },
  { value: 'monsters', label: '怪物' },
]
const LABELS = { characters: '角色', artifacts: '圣遗物', weapons: '武器', monsters: '怪物' }

const STAR_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}★` }))

const reportOpen = ref(false)
const confirmOpen = ref(false)
const pasteOpen = ref(false)
const pasteText = ref('')

const syncing = ref(false)
const fetching = ref(false)

/* 输入框的通用外观：工具栏档（36px），与外壳的控件同一套 */
const FIELD =
  'h-9 min-w-0 rounded-ctl border border-line-2 bg-surface text-xs text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/* 切分类就清掉搜索 —— 与旧版一致 */
watch(tab, () => {
  search.value = ''
})

const hasData = computed(() => sorted.value.length > 0)
const emptyIcon = computed(() => (hasData.value ? 'ui.search' : 'ui.inbox'))
const emptyTitle = computed(() =>
  hasData.value ? '没有找到匹配的条目' : '当前分类还没有条目',
)
const emptyHint = computed(() => (hasData.value ? '试试其他关键词' : '点上方按钮开始'))

async function onSync() {
  syncing.value = true
  try {
    const entry = await syncFromAmber()
    if (entry) reportOpen.value = true
  } finally {
    syncing.value = false
  }
}

async function onLoad() {
  fetching.value = true
  try {
    await loadDict()
  } finally {
    fetching.value = false
  }
}

async function onPasteConfirm() {
  const text = pasteText.value
  pasteText.value = ''
  await parsePastedUrls(text)
}

function openPaste() {
  pasteText.value = ''
  pasteOpen.value = true
}

onMounted(init)
</script>

<template>
  <div class="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]">
    <!-- ---------------- 头部：搜索 / 分类 / 操作 ---------------- -->
    <header class="grid shrink-0 gap-2 border-b border-line bg-canvas p-3">
      <div class="relative flex items-center">
        <input
          v-model="search"
          type="search"
          :class="[FIELD, 'w-full px-3 pr-9']"
          placeholder="搜索名字或 key…"
          aria-label="搜索名字或 key"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          v-if="search"
          type="button"
          class="absolute right-1 grid size-7 place-items-center rounded-ctl text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          aria-label="清除搜索"
          @click="search = ''"
        >
          <Icon name="ui.close" size="sm" />
        </button>
      </div>

      <Seg v-model="tab" :options="TABS" full />

      <div class="flex flex-wrap gap-2">
        <Btn size="sm" variant="primary" :loading="syncing" @click="onSync">
          <template #icon><Icon name="ui.import" size="sm" /></template>
          从 Amber 同步
        </Btn>

        <Btn size="sm" @click="reportOpen = true">
          <template #icon><Icon name="ui.file" size="sm" /></template>
          日志
        </Btn>

        <Btn size="sm" :disabled="syncing" @click="openPaste">
          <template #icon><Icon name="ui.plus" size="sm" /></template>
          粘贴 URL
        </Btn>

        <Btn size="sm" :loading="fetching" @click="onLoad">
          <template #icon><Icon name="ui.import" size="sm" /></template>
          载入
        </Btn>

        <Btn size="sm" :variant="dirty ? 'danger' : 'secondary'" @click="exportDict">
          <template #icon><Icon name="ui.export" size="sm" /></template>
          {{ dirty ? '未导出' : '导出' }}
        </Btn>
      </div>
    </header>

    <!-- ---------------- 列表（唯一滚动区） ---------------- -->
    <main class="grid min-h-0 content-start gap-2 overflow-y-auto overscroll-contain p-3">
      <p v-if="loading" class="py-12 text-center text-xs text-muted">正在载入…</p>

      <div
        v-else-if="!filtered.length"
        class="grid place-items-center gap-3 py-12 text-center"
      >
        <span class="grid size-8 place-items-center text-faint" aria-hidden="true">
          <Icon :name="emptyIcon" size="lg" />
        </span>
        <div class="grid gap-1">
          <p class="text-sm text-body">{{ emptyTitle }}</p>
          <p class="text-xs text-muted">{{ emptyHint }}</p>
        </div>
      </div>

      <div
        v-for="row in filtered"
        :key="row.key"
        class="rounded-panel border border-line bg-surface p-2"
      >
        <div class="flex items-center gap-2">
          <!-- 序号 -->
          <input
            type="number"
            :class="[FIELD, 'w-11 shrink-0 px-1 text-center font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none']"
            :value="row.order || ''"
            aria-label="序号"
            @change="setOrder(row, $event.target.value)"
          />

          <!-- 缩略图：星级径向渐变底；无星级（怪物）不加底色 -->
          <span
            class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-ctl"
            :style="starStyle(row)"
          >
            <img
              v-if="resolveUrl(tab, row)"
              :src="resolveUrl(tab, row)"
              alt=""
              loading="lazy"
              class="size-full object-contain"
              @error="$event.target.removeAttribute('src')"
            />
          </span>

          <!-- 名字 -->
          <input
            v-model="row.name"
            type="text"
            :class="[FIELD, 'flex-1 px-2']"
            placeholder="中文名"
            aria-label="中文名"
            @blur="setName(row, row.name)"
          />

          <!-- 星级（怪物没有） -->
          <Dropdown
            v-if="tab !== 'monsters'"
            class="w-[72px] shrink-0"
            :options="STAR_OPTIONS"
            :model-value="String(row.star ?? 5)"
            :label="`星级：${row.star ?? 5} 星`"
            @update:model-value="setStar(row, $event)"
          />

          <!-- 删除 -->
          <Btn size="sm" variant="danger" square aria-label="删除" @click="removeRow(row)">
            <template #icon><Icon name="ui.trash" size="sm" /></template>
          </Btn>
        </div>
      </div>
    </main>

    <!-- ---------------- 底部：信息行 + 破坏性操作 ---------------- -->
    <footer class="flex shrink-0 items-center gap-3 border-t border-line bg-canvas px-3 py-2">
      <p class="min-w-0 flex-1 truncate text-xs text-muted">{{ infoText }}</p>
      <Btn size="sm" variant="danger" :disabled="!sorted.length" @click="confirmOpen = true">
        <template #icon><Icon name="ui.trash" size="sm" /></template>
        清空
      </Btn>
    </footer>

    <!-- ---------------- 弹窗与浮层 ---------------- -->
    <Modal
      v-model="confirmOpen"
      title="清空当前分类"
      :message="`确定清空「${LABELS[tab]}」的全部 ${sorted.length} 条吗？这一步无法撤销。`"
      confirm-text="清空"
      danger
      @confirm="clearTab"
    />

    <Modal
      v-model="pasteOpen"
      title="粘贴图标链接"
      confirm-text="解析并添加"
      @confirm="onPasteConfirm"
    >
      <p class="text-xs leading-relaxed text-muted">
        每行一个完整 URL，程序自动提取图标名并查询 Amber 中文名。
      </p>
      <Field
        v-model="pasteText"
        type="textarea"
        :rows="6"
        data-autofocus
        placeholder="https://api.lunaris.moe/data/assets/avataricon/UI_AvatarIcon_SkirkNew.webp"
      />
    </Modal>

    <SyncReport v-model="reportOpen" :log="log" />
  </div>
</template>

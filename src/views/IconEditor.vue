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
 * 【角色页签：宽屏双栏 / 窄屏全屏子页】
 *   纯 CSS 断点实现，不用 JS 读窗口宽度：
 *     列表栏   md 以上常驻；窄屏只在「没选中」时显示
 *     详情栏   md 以上常驻；窄屏只在「选中了」时显示
 *   窄屏的返回按钮放在详情栏最外层，任何状态都能回列表。
 *
 * 【grid 必须声明列，一个都不能漏】
 *   没写 grid-cols-* 的 grid，隐式轨道是 auto —— 会被内容的 max-content 撑开。
 *   「flex-wrap 的按钮行」和「一整条不换行的 URL」都会把它撑破，
 *   结果是整页横向溢出、手机上得左右拖。
 *   所以本文件里**每个 grid 都写了列**：固定尺寸的写 place-items-center，
 *   装内容的写 grid-cols-1（= repeat(1, minmax(0,1fr))，那个 minmax(0,…)
 *   才真正把轨道锁在容器宽度内）。
 *
 * 【缩略图的两个部分别拆开】
 *   starStyle() 只往 style 塞 --star-color / --star-edge；
 *   真正画出渐变的是 <style scoped> 里的 .thumb；圆角是模板上的 rounded-ctl。
 * ------------------------------------------------------------------------- */

const {
  loading,
  tab,
  search,
  dirty,
  filter,
  log,
  filtered,
  sorted,
  infoText,
  counts,
  activeRow,
  activeKey,
  isVariant,
  missingCard,
  missingArt,
  slotSrc,
  starStyle,
  setOrder,
  setName,
  setStar,
  removeRow,
  clearTab,
  select,
  applyUrl,
  clearSlot,
  setSlotLocal,
  setBase,
  lookupName,
  init,
  loadDict,
  parsePastedUrls,
  syncFromAmber,
  exportDict,
  LABELS,
  FILTERS,
} = useIconDict()

const TABS = [
  { value: 'characters', label: '角色' },
  { value: 'artifacts', label: '圣遗物' },
  { value: 'weapons', label: '武器' },
  { value: 'monsters', label: '怪物' },
]
const STAR_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}★` }))

const FILTER_LABELS = { all: '全部', noCard: '缺名片', noArt: '缺立绘', variant: '变体' }

const reportOpen = ref(false)
const confirmOpen = ref(false)
const pasteOpen = ref(false)
const pasteText = ref('')
const syncing = ref(false)
const fetching = ref(false)

const FIELD =
  'h-9 min-w-0 rounded-ctl border border-line-2 bg-surface text-xs text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

const isCharTab = computed(() => tab.value === 'characters')

/* 切分类：清搜索、清筛选、清选中 —— 免得切过去还停在上一条的详情里 */
watch(tab, () => {
  search.value = ''
  filter.value = 'all'
  activeKey.value = ''
})

const hasData = computed(() => sorted.value.length > 0)
const emptyIcon = computed(() => (hasData.value ? 'ui.search' : 'ui.inbox'))
const emptyTitle = computed(() => (hasData.value ? '没有找到匹配的条目' : '当前分类还没有条目'))
const emptyHint = computed(() => (hasData.value ? '试试其他关键词或换个筛选' : '点上方按钮开始'))

const filterOptions = computed(() =>
  FILTERS.map((f) => ({
    value: f.value,
    label: `${FILTER_LABELS[f.value] ?? f.label} ${counts.value[f.value] ?? 0}`,
  })),
)

/* 三个槽位的说明写在一处，免得模板里到处散文字 */
const SLOT_META = [
  { slot: '', title: '头像', hint: '有 key 就走源地址，主源挂了自动换备用源；仓库图勾「用仓库图」。' },
  { slot: 'card', title: '名片', hint: '粘大图链接（NameCardPic），能认出 key 就只存 key。' },
  { slot: 'art', title: '立绘', hint: '没有自动源，永远手填链接；仓库图直接粘仓库路径。' },
]

/* 槽位的 URL 草稿：只对「当前选中的那条 + 那个槽位」有效，切行自动作废 */
const urlDraft = ref({ key: '', value: '' })
const draftOf = (slot) =>
  urlDraft.value.key === `${activeKey.value}|${slot}` ? urlDraft.value.value : ''
const setDraft = (slot, value) => {
  urlDraft.value = { key: `${activeKey.value}|${slot}`, value }
}

async function commitUrl(row, slot) {
  const value = draftOf(slot)
  setDraft(slot, '')
  if (!value) return

  const key = applyUrl(row, slot, value)
  /* 认出了 key 而这条还没名字 → 顺便反查中文名；查不到保持原样，不报错 */
  if (key && !(row.name || '').trim()) {
    const name = await lookupName(slot, key)
    if (name) setName(row, name)
  }
}

function onSelect(row) {
  urlDraft.value = { key: '', value: '' }
  select(row)
}

/* 缩略图备用源：主源挂了就用 data-alt 再试一次，只试一次。
   data-alt 用完即删，避免备用源也挂时来回弹。 */
function onThumbError(e) {
  const img = e.target
  const alt = img.dataset.alt
  if (!alt) {
    img.removeAttribute('src')
    return
  }
  delete img.dataset.alt
  img.src = alt
}

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
  <div class="grid h-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto]">
    <!-- ---------------- 头部：搜索 / 分类 / 筛选 / 操作 ---------------- -->
    <header class="grid shrink-0 grid-cols-1 gap-2 border-b border-line bg-canvas p-3">
      <div class="relative flex min-w-0 items-center">
        <span
          class="pointer-events-none absolute left-3 top-1/2 grid size-4 -translate-y-1/2 place-items-center text-muted"
          aria-hidden="true"
        >
          <Icon name="ui.search" size="sm" />
        </span>

        <input
          v-model="search"
          type="search"
          :class="[FIELD, 'w-full pl-9 pr-9']"
          placeholder="搜索名字或key…"
          aria-label="搜索名字或key"
          autocomplete="off"
          spellcheck="false"
        />

        <button
          v-if="search"
          type="button"
          class="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-ctl text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          aria-label="清除搜索"
          @click="search = ''"
        >
          <Icon name="ui.close" size="sm" />
        </button>
      </div>

      <Seg v-model="tab" :options="TABS" full />

      <Seg v-if="isCharTab" v-model="filter" :options="filterOptions" full />

      <div class="flex flex-wrap gap-2">
        <Btn size="sm" variant="primary" :loading="syncing" @click="onSync">
          <template #icon><Icon name="ui.reload" size="sm" /></template>
          从源匹配
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

    <!-- ---------------- 主体 ---------------- -->
    <main
      class="grid min-h-0 grid-cols-1 overflow-hidden overscroll-contain"
      :class="isCharTab ? 'md:grid-cols-[15rem_minmax(0,1fr)]' : ''"
    >
      <!-- 列表栏 -->
      <div
        class="grid min-h-0 grid-cols-1 content-start gap-2 overflow-y-auto p-3"
        :class="isCharTab && activeRow ? 'hidden md:grid' : ''"
      >
        <p v-if="loading" class="py-12 text-center text-xs text-muted">正在载入…</p>

        <div
          v-else-if="!filtered.length"
          class="grid grid-cols-1 place-items-center gap-3 py-12 text-center"
        >
          <span class="grid size-8 place-items-center text-faint" aria-hidden="true">
            <Icon :name="emptyIcon" size="lg" />
          </span>
          <div class="grid grid-cols-1 gap-1">
            <p class="text-sm text-body">{{ emptyTitle }}</p>
            <p class="text-xs text-muted">{{ emptyHint }}</p>
          </div>
        </div>

        <!-- 角色：紧凑行，点了进详情 -->
        <template v-else-if="isCharTab">
          <button
            v-for="row in filtered"
            :key="row.key"
            type="button"
            class="flex w-full min-w-0 items-center gap-2 rounded-panel border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            :class="
              row.key === activeKey
                ? 'border-line-3 bg-surface-2'
                : 'border-line bg-surface hover:bg-hover'
            "
            @click="onSelect(row)"
          >
            <span
              class="thumb grid size-9 shrink-0 place-items-center rounded-ctl"
              :style="starStyle(row)"
            >
              <img
                v-if="slotSrc(tab, row, '').src"
                :src="slotSrc(tab, row, '').src"
                :data-alt="slotSrc(tab, row, '').alt || undefined"
                alt=""
                loading="lazy"
                class="size-full object-contain"
                @error="onThumbError"
              />
            </span>

            <span class="grid min-w-0 flex-1 grid-cols-1 gap-0.5">
              <span class="truncate text-xs text-ink">{{ row.name || row.key }}</span>
              <span class="flex flex-wrap items-center gap-1 text-[10px] text-muted">
                <span>No.{{ row.order || 0 }}</span>
                <span v-if="row.star" class="text-gold">{{ row.star }}★</span>
                <span
                  v-if="isVariant(row)"
                  class="rounded-ctl bg-accent-soft px-1 text-accent-strong"
                >
                  变体
                </span>
                <span v-if="missingCard(row)" class="text-faint">缺名片</span>
                <span v-if="missingArt(row)" class="text-faint">缺立绘</span>
              </span>
            </span>
          </button>
        </template>

        <!-- 其它分类：沿用原来的就地编辑 -->
        <template v-else>
          <div
            v-for="row in filtered"
            :key="row.key"
            class="rounded-panel border border-line bg-surface p-2"
          >
            <div class="flex min-w-0 items-center gap-2">
              <input
                type="number"
                :class="[
                  FIELD,
                  'w-11 shrink-0 px-1 text-center font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                ]"
                :value="row.order || ''"
                aria-label="序号"
                @change="setOrder(row, $event.target.value)"
              />

              <span
                class="thumb grid size-9 shrink-0 place-items-center rounded-ctl"
                :style="starStyle(row)"
              >
                <img
                  v-if="slotSrc(tab, row, '').src"
                  :src="slotSrc(tab, row, '').src"
                  :data-alt="slotSrc(tab, row, '').alt || undefined"
                  alt=""
                  loading="lazy"
                  class="size-full object-contain"
                  @error="onThumbError"
                />
              </span>

              <input
                v-model="row.name"
                type="text"
                :class="[FIELD, 'flex-1 px-2']"
                placeholder="中文名"
                aria-label="中文名"
                @blur="setName(row, row.name)"
              />

              <span v-if="tab !== 'monsters'" class="w-[72px] shrink-0">
                <Dropdown
                  :options="STAR_OPTIONS"
                  :model-value="String(row.star ?? 5)"
                  :label="`星级：${row.star ?? 5} 星`"
                  @update:model-value="setStar(row, $event)"
                />
              </span>

              <Btn size="sm" variant="danger" square aria-label="删除" @click="removeRow(row)">
                <template #icon><Icon name="ui.trash" size="sm" /></template>
              </Btn>
            </div>
          </div>
        </template>
      </div>

      <!-- 详情栏（只有角色页签用） -->
      <div
        v-if="isCharTab"
        class="grid min-h-0 grid-cols-1 content-start gap-3 overflow-y-auto p-3"
        :class="activeRow ? '' : 'hidden md:grid'"
      >
        <template v-if="activeRow">
          <!-- 返回放最外层：窄屏任何状态都能回列表 -->
          <div class="flex min-w-0 items-center gap-2">
            <Btn size="sm" class="md:hidden" @click="activeKey = ''">
              <template #icon><Icon name="ui.arrowUp" size="sm" class="-rotate-90" /></template>
              返回
            </Btn>
            <p class="min-w-0 flex-1 truncate text-[10px] text-muted">{{ activeRow.key }}</p>
          </div>

          <!-- 身份行：序号 + 名字 + 星级 + 变体基名 -->
          <div class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-3">
            <div class="flex min-w-0 items-center gap-2">
              <input
                type="number"
                :class="[FIELD, 'w-16 shrink-0 px-1 text-center font-semibold']"
                :value="activeRow.order || ''"
                aria-label="序号"
                @change="setOrder(activeRow, $event.target.value)"
              />
              <input
                :value="activeRow.name"
                type="text"
                :class="[FIELD, 'min-w-0 flex-1 px-2']"
                placeholder="中文名"
                aria-label="中文名"
                @input="activeRow.name = $event.target.value"
                @blur="setName(activeRow, activeRow.name)"
              />
              <span class="w-[72px] shrink-0">
                <Dropdown
                  :options="STAR_OPTIONS"
                  :model-value="String(activeRow.star ?? 5)"
                  :label="`星级：${activeRow.star ?? 5} 星`"
                  @update:model-value="setStar(activeRow, $event)"
                />
              </span>
            </div>

            <label class="grid grid-cols-1 gap-1">
              <span class="text-[10px] text-muted">
                变体基名（留空 = 它就是主体；填了表示这条挂在谁下面）
              </span>
              <input
                :value="activeRow.base || ''"
                type="text"
                :class="[FIELD, 'w-full px-2']"
                placeholder="旅行者"
                @change="setBase(activeRow, $event.target.value)"
              />
            </label>
          </div>

          <!-- 三个槽位 -->
          <div
            v-for="meta in SLOT_META"
            :key="meta.slot || 'avatar'"
            class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-3"
          >
            <div class="flex min-w-0 items-center gap-2">
              <p class="min-w-0 flex-1 text-xs font-medium text-ink">{{ meta.title }}</p>

              <label
                v-if="meta.slot !== 'art'"
                class="flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] text-muted"
              >
                <input
                  type="checkbox"
                  class="size-3.5 shrink-0 accent-accent"
                  :checked="meta.slot ? !!activeRow[meta.slot]?.local : !!activeRow.local"
                  @change="setSlotLocal(activeRow, meta.slot, $event.target.checked)"
                />
                用仓库图
              </label>
            </div>

            <div class="flex min-w-0 items-start gap-2">
              <!-- 预览：头像带星级底，名片/立绘给一块定宽的画板 -->
              <span
                class="thumb grid shrink-0 place-items-center rounded-ctl border border-line-2"
                :class="meta.slot ? 'h-16 w-28' : 'size-12'"
                :style="meta.slot ? {} : starStyle(activeRow)"
              >
                <img
                  v-if="slotSrc(tab, activeRow, meta.slot).src"
                  :src="slotSrc(tab, activeRow, meta.slot).src"
                  :data-alt="slotSrc(tab, activeRow, meta.slot).alt || undefined"
                  alt=""
                  loading="lazy"
                  :class="meta.slot ? 'size-full object-cover' : 'size-full object-contain'"
                  @error="onThumbError"
                />
              </span>

              <!-- 地址输入 + 当前 key -->
              <div class="grid min-w-0 flex-1 grid-cols-1 gap-1">
                <input
                  :value="draftOf(meta.slot)"
                  type="url"
                  :class="[FIELD, 'w-full px-2']"
                  :placeholder="
                    meta.slot === 'art' ? '粘立绘完整链接，或仓库路径' : '粘链接自动识别 key'
                  "
                  :aria-label="`${meta.title} 链接`"
                  @input="setDraft(meta.slot, $event.target.value)"
                  @change="commitUrl(activeRow, meta.slot)"
                />

                <div class="flex min-w-0 flex-wrap items-center gap-2 text-[10px] text-muted">
                  <!-- 立绘那条 URL 很长：换行显示，别让它把整页顶宽 -->
                  <span
                    class="min-w-0"
                    :class="meta.slot === 'art' ? 'break-all' : 'truncate'"
                  >
                    {{
                      meta.slot
                        ? activeRow[meta.slot]?.key || activeRow[meta.slot]?.url || '未设置'
                        : activeRow.key
                    }}
                  </span>
                  <button
                    v-if="meta.slot ? activeRow[meta.slot] : activeRow.url || activeRow.local"
                    type="button"
                    class="shrink-0 rounded-ctl px-1 text-danger hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                    @click="clearSlot(activeRow, meta.slot)"
                  >
                    清空
                  </button>
                </div>
              </div>
            </div>

            <p class="text-[10px] leading-relaxed text-faint">{{ meta.hint }}</p>
          </div>

          <div class="flex justify-end">
            <Btn size="sm" variant="danger" @click="removeRow(activeRow)">
              <template #icon><Icon name="ui.trash" size="sm" /></template>
              删除这条
            </Btn>
          </div>
        </template>

        <div v-else class="grid grid-cols-1 place-items-center gap-2 py-16 text-center">
          <span class="grid size-8 place-items-center text-faint" aria-hidden="true">
            <Icon name="ui.inbox" size="lg" />
          </span>
          <p class="text-xs text-muted">左边选一个角色</p>
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
        每行一个完整 URL（也可以用仓库内路径），程序自动提取图标名并查询 Amber 中文名。
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

<style scoped>
/* 星级径向渐变底。
   starStyle() 只负责把 --star-color / --star-edge 塞进 style，
   真正画出渐变的是这条规则 —— 少了它，变量设了也白设。
   几何与 icon-loader.js 的 applyBackground 等价：canvas 是 r = 边长 × 0.707
   的两档径向渐变，而 CSS 的 radial-gradient(circle, …) 默认走 farthest-corner，
   正方形下正好也是 √2/2 × 边长。
   无星级（怪物）时两个变量都不存在，回落到 transparent = 不加底色。
   圆角不在这里写，在模板的 rounded-ctl 上。 */
.thumb {
  background: radial-gradient(
    circle,
    var(--star-color, transparent),
    var(--star-edge, transparent)
  );
  overflow: hidden;
}
</style>

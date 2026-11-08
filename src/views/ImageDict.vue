<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Btn from '../components/Btn.vue'
import Dropdown from '../components/Dropdown.vue'
import Field from '../components/Field.vue'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import Seg from '../components/Seg.vue'
import SyncReport from '../components/SyncReport.vue'
import { useImageDict } from '../composables/useImageDict.js'

/* 图片字典编辑器 · 界面
 * -------------------------------------------------------------------------
 * 域逻辑全在 useImageDict.js，这里只管长得怎么样。
 *
 * 【顶部只留一个「新增」入口】
 *   弹窗里一个输入框干两件事：填中文名 → 去源里查；粘链接 / 代号 →
 *   一行一个批量解析。四个分类都吃这一套。
 *
 * 【补齐不用人工踢】
 *   选中一行会自动补它缺的（名片最常见）；地址框停手 700ms 自动落；
 *   名字框失焦时补；同步末尾会把源里没有的角色也再试一次。
 *
 * 【槽位的「用备用源」勾】
 *   主源（lunaris）图不对时（夏洛蒂那种）勾上，或用备用源那一组的链接
 *   粘一遍（会自动勾上）。这一格从此走 config 里的备用源规则，
 *   字典里不写死链接。立绘没有源规则，所以没有这个勾。
 *
 * 【角色页签：宽屏双栏 / 窄屏全屏子页】纯 CSS 断点，不用 JS 读宽度。
 * 【grid 必须声明列】没写 grid-cols-* 的 grid，隐式轨道是 auto，
 *   会被一整条不换行的 URL 撑到左右拖。
 * 【图标名必须在 shared/ui-icons.js 里真实存在】取不到就渲染成空白（不报错）。
 *   ui 组现有：plus trash arrowUp arrowDown back check chevronUp chevronDown
 *             close export file guides import inbox reload reorder search textFont
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
  missingCard,
  missingArt,
  needFill,
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
  hydrate,
  hasAlt,
  slotAlt,
  setSlotAlt,
  addFromInput,
  init,
  loadDict,
  syncFromAmber,
  applyConflicts,
  exportDict,
  LABELS,
  FILTERS,
} = useImageDict()

const TABS = [
  { value: 'characters', label: '角色' },
  { value: 'artifacts', label: '圣遗物' },
  { value: 'weapons', label: '武器' },
  { value: 'monsters', label: '怪物' },
]
const STAR_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}★` }))
const SLOT_LABEL = { '': '头像', card: '名片', art: '立绘' }

const reportOpen = ref(false)
const confirmOpen = ref(false)
const addOpen = ref(false)
const addText = ref('')
const syncing = ref(false)
const fetching = ref(false)

/* 冲突弹窗：勾选 = 用源里的代号，不勾 = 保留我手填的 */
const conflictOpen = ref(false)
const conflicts = ref([])
const useSource = ref([])

const FIELD =
  'h-9 min-w-0 rounded-ctl border border-line-2 bg-surface text-xs text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

const isCharTab = computed(() => tab.value === 'characters')

watch(tab, () => {
  search.value = ''
  filter.value = 'all'
  activeKey.value = ''
})

const hasData = computed(() => sorted.value.length > 0)
const emptyIcon = computed(() => (hasData.value ? 'ui.search' : 'ui.inbox'))
const emptyTitle = computed(() => (hasData.value ? '没有找到匹配的条目' : '当前分类还没有条目'))
const emptyHint = computed(() => (hasData.value ? '试试其他关键词或换个筛选' : '点上面「新增」开始'))

const filterOptions = computed(() =>
  FILTERS.map((f) => ({ value: f.value, label: `${f.label} ${counts.value[f.value] ?? 0}` })),
)

const SLOT_META = [
  {
    slot: '',
    title: '头像',
    hint: '粘链接（或直接填代号）自动认代号。lunaris 的图不对时，粘 Amber 那组的链接会自动改成用备用源。',
  },
  {
    slot: 'card',
    title: '名片',
    hint: '粘名片大图链接只记代号。代号和头像不一样时（绮良良）会自己查源；图不对同样可以切备用源。',
  },
  {
    slot: 'art',
    title: '立绘',
    hint: '没有自动源，只手填。仓库里的图直接粘仓库路径，会自动转成站点绝对路径。',
  },
]

/* 槽位的地址草稿：只对「当前选中的那条 + 那个槽位」有效，切行自动作废 */
const urlDraft = ref({ key: '', value: '' })
const draftOf = (slot) =>
  urlDraft.value.key === `${activeKey.value}|${slot}` ? urlDraft.value.value : ''
const setDraft = (slot, value) => {
  urlDraft.value = { key: `${activeKey.value}|${slot}`, value }
}

/* 地址框：粘完 / 停手就自己落，不用再点别处去触发失焦 */
let urlTimer = 0
function onUrlInput(slot, value) {
  setDraft(slot, value)
  clearTimeout(urlTimer)
  urlTimer = setTimeout(() => {
    if (draftOf(slot)) commitUrl(activeRow.value, slot)
  }, 700)
}

/* 粘完地址：先落代号 / 标记，再拿代号去源里反查，把缺的字段补齐 */
async function commitUrl(row, slot) {
  clearTimeout(urlTimer)
  const value = draftOf(slot)
  setDraft(slot, '')
  if (!value || !row) return

  const code = applyUrl(row, slot, value)
  if (!code) return
  if (needFill(row)) await hydrate(row, slot)
}

function onSelect(row) {
  urlDraft.value = { key: '', value: '' }
  select(row)
}

/* 改完名字：这条还缺什么就顺手从源补上 */
async function commitName(row) {
  setName(row, row.name)
  if (tab.value === 'characters' && needFill(row)) await hydrate(row, 'name')
}

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
    const res = await syncFromAmber()
    if (!res) return
    if (res.conflicts.length) {
      conflicts.value = res.conflicts
      useSource.value = res.conflicts.map(() => false)
      conflictOpen.value = true
    } else {
      reportOpen.value = true
    }
  } finally {
    syncing.value = false
  }
}

function confirmConflicts() {
  const picked = conflicts.value.filter((_, i) => useSource.value[i])
  conflictOpen.value = false
  applyConflicts(picked)
  conflicts.value = []
}

function openAdd() {
  addText.value = ''
  addOpen.value = true
}

async function onAdd() {
  const text = addText.value
  addText.value = ''
  const ok = await addFromInput(text)
  if (ok) addOpen.value = false
}

async function onLoad() {
  fetching.value = true
  try {
    await loadDict()
  } finally {
    fetching.value = false
  }
}

onMounted(init)
</script>

<template>
  <div class="grid h-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto]">
    <!-- ---------------- 头部 ---------------- -->
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
          placeholder="搜索名字或代号…"
          aria-label="搜索名字或代号"
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

        <Btn size="sm" :disabled="syncing" @click="openAdd">
          <template #icon><Icon name="ui.plus" size="sm" /></template>
          新增
        </Btn>

        <Btn size="sm" @click="reportOpen = true">
          <template #icon><Icon name="ui.file" size="sm" /></template>
          日志
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
                <span v-if="slotAlt(row, '')" class="text-accent">备用源</span>
                <span v-if="missingCard(row)" class="text-faint">缺名片</span>
                <span v-if="missingArt(row)" class="text-faint">缺立绘</span>
              </span>
            </span>
          </button>
        </template>

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
          <div class="flex min-w-0 items-center gap-2">
            <Btn size="sm" class="md:hidden" @click="activeKey = ''">
              <template #icon><Icon name="ui.arrowUp" size="sm" class="-rotate-90" /></template>
              返回
            </Btn>
            <p class="min-w-0 flex-1 truncate text-[10px] text-muted">代号：{{ activeRow.key }}</p>
          </div>

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
                @blur="commitName(activeRow)"
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
                v-if="hasAlt(tab, meta.slot)"
                class="flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] text-muted"
              >
                <input
                  type="checkbox"
                  class="size-3.5 shrink-0 accent-accent"
                  :checked="slotAlt(activeRow, meta.slot)"
                  @change="setSlotAlt(activeRow, meta.slot, $event.target.checked)"
                />
                用备用源
              </label>
            </div>

            <div class="flex min-w-0 items-start gap-2">
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

              <div class="grid min-w-0 flex-1 grid-cols-1 gap-1">
                <input
                  :value="draftOf(meta.slot)"
                  type="url"
                  :class="[FIELD, 'w-full px-2']"
                  :placeholder="
                    meta.slot === 'art' ? '粘立绘链接，或仓库里的路径' : '粘链接，或直接填代号'
                  "
                  :aria-label="`${meta.title} 地址`"
                  @input="onUrlInput(meta.slot, $event.target.value)"
                  @change="commitUrl(activeRow, meta.slot)"
                />

                <div class="flex min-w-0 flex-wrap items-center gap-2 text-[10px] text-muted">
                  <span class="min-w-0" :class="meta.slot === 'art' ? 'break-all' : 'truncate'">
                    {{
                      meta.slot
                        ? activeRow[meta.slot]?.key || activeRow[meta.slot]?.url || '未设置'
                        : activeRow.key
                    }}
                  </span>
                  <button
                    v-if="meta.slot ? activeRow[meta.slot] : activeRow.url || activeRow.alt"
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

    <!-- ---------------- 底部 ---------------- -->
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

    <Modal v-model="addOpen" title="新增条目" confirm-text="加入" @confirm="onAdd">
      <p class="text-xs leading-relaxed text-muted">
        填中文名 → 去源里查（当前分类：{{ LABELS[tab] }}）；粘链接或代号 → 一行一个，
        自动认代号并补齐另一个。
      </p>
      <Field
        v-model="addText"
        type="textarea"
        :rows="5"
        data-autofocus
        label="名字 或 图标链接"
        placeholder="枫原万叶&#10;https://api.lunaris.moe/data/assets/avataricon/UI_AvatarIcon_Anastasya.webp&#10;Anastasya"
      />
    </Modal>

    <Modal
      v-model="conflictOpen"
      title="有代号和源对不上"
      :message="`共 ${conflicts.length} 项。勾选 = 用源里的代号，不勾 = 保留你手填的。`"
      confirm-text="应用选择"
      @confirm="confirmConflicts"
    >
      <div class="grid grid-cols-1 gap-2">
        <label
          v-for="(c, i) in conflicts"
          :key="`${c.rowKey}-${c.slot}`"
          class="flex min-w-0 cursor-pointer items-start gap-2 rounded-ctl border border-line-2 p-2"
        >
          <input v-model="useSource[i]" type="checkbox" class="mt-0.5 size-4 shrink-0 accent-accent" />
          <span class="grid min-w-0 flex-1 grid-cols-1 gap-0.5 text-[10px]">
            <span class="text-xs text-ink">
              {{ c.name || c.rowKey }} · {{ SLOT_LABEL[c.slot] }}
            </span>
            <span class="min-w-0 text-muted">
              我的：<b class="break-all font-normal text-body">{{ c.mine }}</b>
            </span>
            <span class="min-w-0 text-muted">
              源的：<b class="break-all font-normal text-body">{{ c.theirs }}</b>
            </span>
          </span>
        </label>
      </div>
    </Modal>

    <SyncReport v-model="reportOpen" :log="log" />
  </div>
</template>

<style scoped>
/* 星级径向渐变底。
   starStyle() 只负责把 --star-color / --star-edge 塞进 style，
   真正画出渐变的是这条规则。
   几何与 image-loader.js 的 applyBackground 等价：canvas 是 r = 边长 × 0.707
   的两档径向渐变，而 CSS 的 radial-gradient(circle, …) 默认走 farthest-corner，
   正方形下正好也是 √2/2 × 边长。
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

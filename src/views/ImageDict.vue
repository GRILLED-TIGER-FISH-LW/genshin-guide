<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  Delete,
  Document,
  Download,
  Plus,
  Refresh,
  Search,
  Upload,
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import SyncReport from '../components/SyncReport.vue'
import { useImageDict } from '../composables/useImageDict.js'

/* 图片字典编辑器 · 界面（全量走 Element Plus）
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
 * 【地址框显示的就是这一格现在的值】
 *   框里的内容 = 手填的地址优先，否则按代号拼出的源地址（刷新后照样在），
 *   缩略图永远跟着「已保存的值」走，不跟正在输入的草稿走 ——
 *   所以打字过程中图不会闪、也不会因为你还没改完就变。
 *   提交后如果代号变了（头像换代号 = 换身份），选中会跟着挪，不会弹回列表。
 *
 * 【槽位的「用备用源」勾】
 *   主源（lunaris）图不对时勾上，或把备用源那一组的链接粘一遍（会自动勾上）。
 *   立绘没有源规则，所以没有这个勾。
 *
 * 【角色页签：宽屏双栏 / 窄屏全屏子页】纯 CSS 断点，不用 JS 读宽度。
 * 【EP 的无对应物】列表行本身仍是原生 <button>（EP 没有「可选中行」），
 *   星级底纹、槽位缩略图是自造样式；其余（输入框 / 按钮 / 分段菜单 / 标签 /
 *   空态 / 弹窗 / 消息）全部 EP 默认。 */

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
  addCandidates,
  pickAddCandidate,
  removeRow,
  clearTab,
  select,
  reselect,
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
  identOf,
  LABELS,
  FILTERS,
} = useImageDict()

const TABS = [
  { value: 'characters', label: '角色' },
  { value: 'artifacts', label: '圣遗物' },
  { value: 'weapons', label: '武器' },
  { value: 'monsters', label: '怪物' },
]
const SLOT_LABEL = { '': '头像', card: '名片', art: '立绘' }

const reportOpen = ref(false)
const addOpen = ref(false)
const addText = ref('')
const syncing = ref(false)
const fetching = ref(false)

/* 冲突弹窗：勾选 = 用源里的代号，不勾 = 保留我手填的 */
const conflictOpen = ref(false)
const conflicts = ref([])
const useSource = ref([])

const isCharTab = computed(() => tab.value === 'characters')

/* 地址框的草稿：只对「当前选中的那条 + 那个槽位」有效，切行 / 切换页签自动作废 */
const draft = ref({ key: '', value: '' })

watch(tab, () => {
  search.value = ''
  filter.value = 'all'
  activeKey.value = ''
  draft.value = { key: '', value: '' }
})

const hasData = computed(() => sorted.value.length > 0)
const emptyTitle = computed(() => (hasData.value ? '没有找到匹配的条目' : '当前分类还没有条目'))
const emptyHint = computed(() => (hasData.value ? '试试其他关键词或换个筛选' : '点上面「新增」开始'))

const filterOptions = computed(() =>
  FILTERS.map((f) => ({ value: f.value, label: `${f.label} ${counts.value[f.value] ?? 0}` })),
)

/* 详情栏的槽位列：角色三个（头像 / 名片 / 立绘），其余只有头像 */
const AVATAR_META = {
  slot: '',
  title: '头像',
  hint: '粘链接（或直接填代号）自动认代号。lunaris 的图不对时，粘 Amber 那组的链接会自动改成用备用源。',
}
const SLOT_META = computed(() =>
  isCharTab.value
    ? [
        AVATAR_META,
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
    : [AVATAR_META],
)

/* 地址框：有草稿（正在打字）就显示草稿，否则显示这一格已保存的地址 ——
   slotSrc 是「按已保存的值算出来的真实地址」，所以刷新后框里照样有东西。 */
function textOf(slot) {
  const k = `${activeKey.value}|${slot}`
  if (draft.value.key === k) return draft.value.value
  return slotSrc(tab.value, activeRow.value, slot).src || ''
}

let urlTimer = 0
function onUrlInput(slot, value) {
  draft.value = { key: `${activeKey.value}|${slot}`, value }
  clearTimeout(urlTimer)
  urlTimer = setTimeout(() => commitUrl(activeRow.value, slot), 700)
}

/* 落一个地址：草稿 → 数据，然后（角色）顺手补齐缺的字段。
   提交完把草稿清掉，框里回落到「已保存的值」，所以不会变成一个空框。 */
async function commitUrl(row, slot) {
  clearTimeout(urlTimer)
  const k = `${activeKey.value}|${slot}`
  const typing = draft.value.key === k
  const value = typing ? draft.value.value : ''
  draft.value = { key: '', value: '' }
  if (!row || !typing) return
  /* 清空输入框不算删数据（要删请用右边那个「清空」或框里的 ×），
     否则手一滑整格就没了 */
  if (!value.trim()) return

  const code = applyUrl(row, slot, value)
  reselect(row)
  if (!code) return
  /* 只给角色反查补齐：怪物同一个代号常被好几条共用，反查会带回别的条目的名字 */
  if (tab.value === 'characters' && needFill(row)) {
    await hydrate(row, slot)
    reselect(row)
  }
}

function onSelect(row) {
  draft.value = { key: '', value: '' }
  select(row)
}

/* 改完名字：这条还缺什么就顺手从源补上 */
async function commitName(row) {
  setName(row, row.name)
  reselect(row)
  if (tab.value === 'characters' && needFill(row)) {
    await hydrate(row, 'name')
    reselect(row)
  }
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
  addCandidates.value = []
  addOpen.value = true
}

async function onAdd() {
  const text = addText.value
  addText.value = ''
  const ok = await addFromInput(text)
  if (ok) addOpen.value = false
}

/* 候选里挑一条：建行 + 关弹窗 */
function onPickCandidate(item) {
  pickAddCandidate(item)
  addOpen.value = false
}

async function onLoad() {
  fetching.value = true
  try {
    await loadDict()
  } finally {
    fetching.value = false
  }
}

/* 清空当前分类：EP 的确认框（原来是自造 Modal + confirmOpen） */
async function askClear() {
  try {
    await ElMessageBox.confirm(
      `确定清空「${LABELS[tab.value]}」的源条目吗？手填的会保留，这一步无法撤销。`,
      '清空当前分类',
      {
        type: 'warning',
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    )
    clearTab()
  } catch {
    /* 点了取消：什么都不做 */
  }
}

onMounted(init)
</script>

<template>
  <div class="grid h-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto]">
    <!-- ---------------- 头部 ---------------- -->
    <header class="grid shrink-0 grid-cols-1 gap-2 border-b border-line bg-canvas p-3">
      <el-input v-model="search" placeholder="搜索名字或代号" aria-label="搜索名字或代号" clearable>
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-segmented v-model="tab" :options="TABS" block />

      <el-segmented v-if="isCharTab" v-model="filter" :options="filterOptions" block />

      <div class="grid grid-cols-6 gap-2">
        <el-button type="primary" class="col-span-3" :loading="syncing" @click="onSync">
          <template #icon><el-icon><Refresh /></el-icon></template>
          从源匹配
        </el-button>

        <el-button class="col-span-3" :disabled="syncing" @click="openAdd">
          <template #icon><el-icon><Plus /></el-icon></template>
          新增
        </el-button>

        <el-button class="col-span-2" @click="reportOpen = true">
          <template #icon><el-icon><Document /></el-icon></template>
          日志
        </el-button>

        <el-button class="col-span-2" :loading="fetching" @click="onLoad">
          <template #icon><el-icon><Upload /></el-icon></template>
          载入
        </el-button>

        <el-button class="col-span-2" :type="dirty ? 'danger' : 'default'" @click="exportDict">
          <template #icon><el-icon><Download /></el-icon></template>
          {{ dirty ? '未导出' : '导出' }}
        </el-button>
      </div>
    </header>

    <!-- ---------------- 主体 ---------------- -->
    <!-- 四个页签共用一套「左边列表 + 右边详情」：点左边一行，在右边编辑 -->
    <main class="grid min-h-0 grid-cols-1 overflow-hidden overscroll-contain md:grid-cols-[15rem_minmax(0,1fr)]">
      <!-- 列表栏 -->
      <div
        v-loading="loading"
        class="grid min-h-0 grid-cols-1 content-start gap-2 overflow-y-auto p-3"
        :class="activeRow ? 'hidden md:grid' : ''"
      >
        <el-empty v-if="!loading && !filtered.length">
          <template #description>
            <div class="grid grid-cols-1 gap-1">
              <el-text size="small" class="text-body">{{ emptyTitle }}</el-text>
              <el-text size="small" class="ah-text-muted">{{ emptyHint }}</el-text>
            </div>
          </template>
        </el-empty>

        <button
          v-for="row in filtered"
          :key="identOf(tab, row)"
          type="button"
          class="flex w-full min-w-0 items-center gap-2 rounded-panel border p-2 text-left"
          :class="
            identOf(tab, row) === activeKey
              ? 'border-line-2 bg-surface-2'
              : 'border-line bg-surface hover:bg-hover'
          "
          @click="onSelect(row)"
        >
          <span class="thumb grid size-9 shrink-0 place-items-center rounded-ctl" :style="starStyle(row)">
            <el-image
              v-if="slotSrc(tab, row, '').src"
              :src="slotSrc(tab, row, '').src"
              fit="contain"
              class="size-full"
              :preview-src-list="[slotSrc(tab, row, '').src]"
              :preview-teleported="true"
              hide-on-click-modal
              @click.stop
            >
              <template #error>
                <span class="grid size-full place-items-center text-[10px] text-faint">无图</span>
              </template>
            </el-image>
          </span>

          <span class="grid min-w-0 flex-1 grid-cols-1 gap-0.5">
            <el-text size="small" truncated class="text-ink">{{ row.name || row.key }}</el-text>
            <span class="flex flex-wrap items-center gap-1">
              <el-text size="small" class="ah-text-muted">No.{{ row.order || 0 }}</el-text>
              <el-text v-if="row.star" size="small" class="text-gold">{{ row.star }}★</el-text>
              <el-tag v-if="slotAlt(row, '')" size="small" type="warning" effect="plain">备用源</el-tag>
              <el-tag v-if="isCharTab && missingCard(row)" size="small" type="info" effect="plain">
                缺名片
              </el-tag>
              <el-tag v-if="isCharTab && missingArt(row)" size="small" type="info" effect="plain">
                缺立绘
              </el-tag>
            </span>
          </span>
        </button>
      </div>

      <!-- 详情栏：四个页签共用 -->
      <div
        class="grid min-h-0 grid-cols-1 content-start gap-3 overflow-y-auto p-3"
        :class="activeRow ? '' : 'hidden md:grid'"
      >
        <template v-if="activeRow">
          <div class="flex min-w-0 items-center gap-2">
            <el-button class="md:hidden" size="small" @click="activeKey = ''">
              <template #icon><el-icon><ArrowLeft /></el-icon></template>
              返回
            </el-button>
            <el-text size="small" truncated class="min-w-0 flex-1 ah-text-muted">
              代号：{{ activeRow.key || '（空）' }}
            </el-text>
          </div>

          <div class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-3">
            <div class="flex min-w-0 items-center gap-2">
              <el-input-number
                :model-value="activeRow.order || 0"
                :min="0"
                size="small"
                controls-position="right"
                style="width: 112px"
                aria-label="序号"
                @change="setOrder(activeRow, $event)"
              />
              <el-input
                :model-value="activeRow.name"
                class="min-w-0 flex-1"
                size="small"
                placeholder="中文名"
                aria-label="中文名"
                @input="activeRow.name = $event"
                @blur="commitName(activeRow)"
              />
            </div>

            <div v-if="tab !== 'monsters'" class="flex min-w-0 items-center gap-2">
              <el-text size="small" class="ah-text-muted shrink-0">星级</el-text>
              <el-input-number
                :model-value="activeRow.star ?? 5"
                :min="1"
                :max="5"
                size="small"
                controls-position="right"
                style="width: 88px"
                aria-label="星级"
                @change="setStar(activeRow, $event)"
              />
              <el-text size="small" class="ah-text-muted shrink-0">★</el-text>
            </div>
          </div>

          <!-- 三个槽位 -->
          <div
            v-for="meta in SLOT_META"
            :key="meta.slot || 'avatar'"
            class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-3"
          >
            <div class="flex min-w-0 items-center gap-2">
              <el-text class="min-w-0 flex-1 font-medium text-ink">{{ meta.title }}</el-text>

              <el-checkbox
                v-if="hasAlt(tab, meta.slot)"
                :model-value="slotAlt(activeRow, meta.slot)"
                size="small"
                @change="setSlotAlt(activeRow, meta.slot, $event)"
              >
                用备用源
              </el-checkbox>
            </div>

            <div class="flex min-w-0 items-start gap-2">
              <span
                class="thumb grid shrink-0 place-items-center rounded-ctl border border-line-2"
                :class="meta.slot ? 'h-16 w-28' : 'size-12'"
                :style="meta.slot ? {} : starStyle(activeRow)"
              >
                <el-image
                  v-if="slotSrc(tab, activeRow, meta.slot).src"
                  :src="slotSrc(tab, activeRow, meta.slot).src"
                  :fit="meta.slot ? 'cover' : 'contain'"
                  class="size-full"
                  :preview-src-list="[slotSrc(tab, activeRow, meta.slot).src]"
                  :preview-teleported="true"
                  hide-on-click-modal
                >
                  <template #error>
                    <span class="grid size-full place-items-center text-[10px] text-faint">无图</span>
                  </template>
                </el-image>
              </span>

              <div class="grid min-w-0 flex-1 grid-cols-1 gap-1">
                <el-input
                  :model-value="textOf(meta.slot)"
                  type="url"
                  size="small"
                  clearable
                  :placeholder="meta.slot === 'art' ? '粘立绘链接，或仓库里的路径' : '粘链接，或直接填代号'"
                  :aria-label="`${meta.title} 地址`"
                  @input="onUrlInput(meta.slot, $event)"
                  @change="commitUrl(activeRow, meta.slot)"
                  @clear="clearSlot(activeRow, meta.slot)"
                />

                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <el-text
                    size="small"
                    class="min-w-0 ah-text-muted"
                    :class="meta.slot === 'art' ? 'break-all' : 'truncated'"
                  >
                    {{
                      meta.slot
                        ? activeRow[meta.slot]?.key || activeRow[meta.slot]?.url || '未设置'
                        : activeRow.key || '未设置'
                    }}
                  </el-text>
                  <el-button
                    v-if="meta.slot ? activeRow[meta.slot] : activeRow.url || activeRow.alt"
                    link
                    type="danger"
                    size="small"
                    @click="clearSlot(activeRow, meta.slot)"
                  >
                    清空
                  </el-button>
                </div>
              </div>
            </div>

            <el-text size="small" class="ah-text-muted leading-relaxed">{{ meta.hint }}</el-text>
          </div>

          <div class="flex justify-end">
            <el-button type="danger" plain size="small" @click="removeRow(activeRow)">
              <template #icon><el-icon><Delete /></el-icon></template>
              删除这条
            </el-button>
          </div>
        </template>

        <el-empty v-else description="左边选一条" />
      </div>
    </main>

    <!-- ---------------- 底部 ---------------- -->
    <footer class="flex shrink-0 items-center gap-3 border-t border-line bg-canvas px-3 py-2">
      <el-text size="small" truncated class="min-w-0 flex-1 ah-text-muted">{{ infoText }}</el-text>
      <el-button type="danger" plain size="small" :disabled="!sorted.length" @click="askClear">
        <template #icon><el-icon><Delete /></el-icon></template>
        清空
      </el-button>
    </footer>

    <!-- ---------------- 弹窗与浮层 ---------------- -->
    <el-dialog v-model="addOpen" title="新增条目" width="92%" align-center>
      <div class="grid grid-cols-1 gap-2">
        <el-text size="small" class="ah-text-muted leading-relaxed">
          填中文名 → 去源里查（当前分类：{{ LABELS[tab] }}）；粘链接或代号 → 一行一个，自动认代号并补齐另一个。
        </el-text>

        <el-input
          v-model="addText"
          type="textarea"
          :rows="5"
          placeholder="枫原万叶&#10;https://api.lunaris.moe/data/assets/avataricon/UI_AvatarIcon_Anastasya.webp&#10;Anastasya&#10;也可以填 ID（如 26310601）或代号（如 Chimera_OwlPangolin_02）"
        />

        <!-- 同代号命中多条（一张图被好几条共用）→ 界面挑一条 -->
        <div v-if="addCandidates.length" class="grid grid-cols-1 gap-2 border-t border-line pt-2">
          <el-text size="small" class="ah-text-muted">
            这个代号在源里有 {{ addCandidates.length }} 条，选一条：
          </el-text>
          <div class="flex flex-wrap gap-1">
            <el-button
              v-for="(c, i) in addCandidates"
              :key="i"
              size="small"
              @click="onPickCandidate(c)"
            >
              {{ c.name }}
            </el-button>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="addOpen = false">取消</el-button>
          <el-button type="primary" @click="onAdd">加入</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="conflictOpen" title="有代号和源对不上" width="92%" align-center>
      <div class="grid grid-cols-1 gap-2">
        <el-text size="small" class="ah-text-muted">
          共 {{ conflicts.length }} 项。勾选 = 用源里的代号，不勾 = 保留你手填的。
        </el-text>

        <div
          v-for="(c, i) in conflicts"
          :key="`${c.rowKey}-${c.slot}`"
          class="flex min-w-0 items-start gap-2 rounded-ctl border border-line-2 p-2"
        >
          <el-checkbox v-model="useSource[i]" />
          <span class="grid min-w-0 flex-1 grid-cols-1 gap-0.5">
            <el-text size="small" class="text-ink">{{ c.name || c.rowKey }} · {{ SLOT_LABEL[c.slot] }}</el-text>
            <el-text size="small" truncated class="ah-text-muted">我的：{{ c.mine }}</el-text>
            <el-text size="small" truncated class="ah-text-muted">源的：{{ c.theirs }}</el-text>
          </span>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="conflictOpen = false">取消</el-button>
          <el-button type="primary" @click="confirmConflicts">应用选择</el-button>
        </div>
      </template>
    </el-dialog>

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

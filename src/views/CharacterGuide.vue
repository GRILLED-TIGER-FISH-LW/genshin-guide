<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Btn from '../components/Btn.vue'
import Field from '../components/Field.vue'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import PreviewFrame from '../components/PreviewFrame.vue'
import Slider from '../components/Slider.vue'
import { loadUiIcons, matchIcon } from '../composables/useIconLib.js'
import { useToast } from '../composables/useToast.js'
import { loadImageMeta } from '../lib/assets.js'
import {
  elementColors, PANEL_PRIMARY_KEYS, PANEL_PRIMARY_LABELS,
  TEAM_MAX, WEAPON_LABELS, WEAPON_MAX, WEAPON_ORDER,
} from '../lib/guideConsts.js'
import * as guide from '../lib/guideChart.js'
import { clearDraft, fetchRepoSave, loadDraft, normalizeGuide, rematchMissing, saveDraft } from '../lib/guideStore.js'

/* 尺寸与旧版对齐：缩略图一律 40px（旧版 --thumb-size，正好是规范里的 h-10），
   备选缩略图 32px（旧版 .alt-row .thumb）；控件高度交给 Btn / Field 自己管。
   颜色属性的 transition 全局禁用（见 AGENTS 禁用清单），要过渡只用 shadow。
   列表行里不给 Field 传 label（那样会多出一行标签、和缩略图对不齐），
   改成 aria-label + placeholder —— Field 会把 $attrs 落到 input 上。 */

/* 整份状态就一个对象：字段名与旧版一图流逐字一致 */
const s = reactive(guide.fresh())
const toast = useToast()

/* 绘制引擎要的两组路径数据（词条的花杯冠、配队的加号）在构建期模块里没有，
   运行时取一次；取不到就少画那几个小图标，卡片其余部分照画 */
const uiIcons = ref({})
const svg = computed(() => guide.buildGuideSVG(s, uiIcons.value))
const PLACEHOLDER = guide.placeholder()

const PRIMARY_OPTIONS = PANEL_PRIMARY_KEYS.map((key) => ({ value: key, label: PANEL_PRIMARY_LABELS[key] }))
const isTheme = (color) => s.theme.toLowerCase() === color.toLowerCase()

/* 缩略图外壳：40px 见方、圆角、衬底、焦点环；里面的图一律 object-cover ——
   非正方形的图按短边铺满裁切，不留空白 */
const THUMB = 'grid size-10 shrink-0 place-items-center overflow-hidden rounded-ctl border border-line bg-thumb focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/* =========================================================================
 * 分区：预览常驻上方，下面一次只显示一个区块
 * ========================================================================= */
const SECTIONS = [
  { key: 'style', label: '外观样式' },
  { key: 'portrait', label: '立绘' },
  { key: 'weapon', label: '武器' },
  { key: 'artifact', label: '圣遗物' },
  { key: 'talent', label: '天赋' },
  { key: 'stat', label: '词条' },
  { key: 'panel', label: '面板' },
  { key: 'constellation', label: '命座' },
  { key: 'team', label: '配队' },
  { key: 'save', label: '存档' },
]
const tab = ref('style')
const contentEl = ref(null)

/* 换区回到顶部，跟旧版一致 */
watch(tab, () => contentEl.value?.scrollTo({ top: 0 }))

/* =========================================================================
 * 草稿：自动存本机，下次打开接着上次
 * ========================================================================= */
const saveState = ref('')
let saveTimer = 0

function touchDraft() {
  saveState.value = '保存中…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    saveState.value = (await saveDraft(s)) ? '已保存' : '保存失败'
  }, 600)
}

onMounted(async () => {
  try {
    uiIcons.value = await loadUiIcons()
  } catch {
    /* 没图标也能用 */
  }

  const draft = await loadDraft()
  if (draft) {
    Object.assign(s, normalizeGuide(draft))
    saveState.value = '已恢复上次的草稿'
  }

  /* 挂在读取之后：恢复草稿这一步不该再触发一次保存 */
  watch(s, touchDraft, { deep: true })
})

/* =========================================================================
 * 存档：在线存档 + 清空全部
 * ========================================================================= */
const confirmBox = ref(false)
const confirmKind = ref('repo')

const confirmTitle = computed(() => (confirmKind.value === 'clear' ? '清空全部数据' : '载入在线存档'))
const confirmText = computed(() => (confirmKind.value === 'clear' ? '清空' : '载入'))
const confirmMessage = computed(() => (confirmKind.value === 'clear'
  ? '确定清空所有配置与图片吗？此操作不可撤销。'
  : `是否载入「${s.charName}」的存档？当前编辑内容会被覆盖。`))

function askRepoSave() {
  if (!s.charName.trim()) return toast.error('请先填角色名')
  confirmKind.value = 'repo'
  confirmBox.value = true
}

function askClear() {
  confirmKind.value = 'clear'
  confirmBox.value = true
}

async function loadRepo() {
  saveState.value = '正在读存档…'
  const res = await fetchRepoSave(s.charName)
  if (res.error) {
    saveState.value = ''
    return toast.error(res.error)
  }

  Object.assign(s, normalizeGuide(res.data))
  saveState.value = '正在补齐图标…'
  await rematchMissing(s)
  saveState.value = `已载入存档 ${res.file}`
}

async function clearAll() {
  const author = s.author
  Object.assign(s, normalizeGuide({ author }))
  await clearDraft()
  saveState.value = '已清空'
}

const runConfirm = () => (confirmKind.value === 'clear' ? clearAll() : loadRepo())

/* =========================================================================
 * 大图槽：立绘 / 元素图 / 大背景
 * ========================================================================= */
const IMG_SLOTS = [
  { key: 'charImg', label: '立绘' },
  { key: 'nameBgImg', label: '元素图' },
  { key: 'bgImg', label: '大背景' },
]

/* 隐藏的 file input 按 key 存一份，点缩略图 / 按钮时由它触发 */
const fileInputs = {}
const pickFile = (key) => fileInputs[key]?.click()

const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

/* 取文件 → dataURL；没选文件回 ''。顺手清空 input，同一个文件才能再选一次 */
async function fileToDataURL(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  return file ? readAsDataURL(file) : ''
}

async function onSlotFile(key, e) {
  const url = await fileToDataURL(e)
  if (!url) return
  s[key] = url
  s[key + 'Meta'] = await loadImageMeta(url)
  s[key + 'Deleted'] = false
  s[key + 'Manual'] = true
}

function clearImg(key) {
  s[key] = ''
  s[key + 'Deleted'] = true
}

/* =========================================================================
 * 武器：毕业 / 可选 / 新手，组内最多 4 个，上移下移可以跨组
 * ========================================================================= */
const canMoveWeapon = (type, i, dir) => {
  const list = s.weaponData[type]
  const target = i + dir
  if (target >= 0 && target < list.length) return true
  const adj = WEAPON_ORDER[WEAPON_ORDER.indexOf(type) + dir]
  return !!adj && s.weaponData[adj].length < WEAPON_MAX
}

function addWeapon(type) {
  if (s.weaponData[type].length >= WEAPON_MAX) {
    return toast.error(`「${WEAPON_LABELS[type]}」区最多 ${WEAPON_MAX} 个`)
  }
  s.weaponData[type].push({ name: '', img: '', imgManual: false })
}

const removeWeapon = (type, i) => s.weaponData[type].splice(i, 1)

function moveWeapon(type, i, dir) {
  const list = s.weaponData[type]
  const target = i + dir
  if (target >= 0 && target < list.length) {
    ;[list[i], list[target]] = [list[target], list[i]]
    return
  }

  const adj = WEAPON_ORDER[WEAPON_ORDER.indexOf(type) + dir]
  if (!adj) return
  if (s.weaponData[adj].length >= WEAPON_MAX) {
    return toast.error(`「${WEAPON_LABELS[adj]}」区已满 ${WEAPON_MAX} 个`)
  }
  const [item] = list.splice(i, 1)
  if (dir === 1) s.weaponData[adj].unshift(item)
  else s.weaponData[adj].push(item)
}

/* 名字失焦时去字典取图；取不到就退回灰底占位，不报错 */
async function matchWeapon(type, i) {
  const cell = s.weaponData[type][i]
  cell.img = await matchIcon('weapons', cell.name)
  cell.imgManual = false
}

async function onWeaponFile(type, i, e) {
  const url = await fileToDataURL(e)
  if (!url) return
  const cell = s.weaponData[type][i]
  cell.img = url
  cell.imgManual = true
}

/* =========================================================================
 * 圣遗物：整套（一个槽）与散搭（两个槽）
 * ========================================================================= */
const moveItem = (arr, i, dir) => {
  const to = i + dir
  if (to < 0 || to >= arr.length) return
  ;[arr[i], arr[to]] = [arr[to], arr[i]]
}

const addArtifact = (type) => s.artifactData.push(type === 'double'
  ? { type, name1: '', name2: '', displayText: '', img1: '', img1Manual: false, img2: '', img2Manual: false }
  : { type, name: '', img: '', imgManual: false })

const removeArtifact = (i) => s.artifactData.splice(i, 1)
const moveArtifact = (i, dir) => moveItem(s.artifactData, i, dir)

async function matchArtifact(i) {
  const cell = s.artifactData[i]
  cell.img = await matchIcon('artifacts', cell.name)
  cell.imgManual = false
}

async function matchArtifactPart(i, n) {
  const cell = s.artifactData[i]
  cell[`img${n}`] = await matchIcon('artifacts', cell[`name${n}`])
  cell[`img${n}Manual`] = false
}

async function onArtifactFile(i, imgKey, e) {
  const url = await fileToDataURL(e)
  if (!url) return
  const cell = s.artifactData[i]
  cell[imgKey] = url
  cell[imgKey + 'Manual'] = true
}

/* =========================================================================
 * 配队：每队 4 格，第 1 格是卡片主角（编辑器不碰），2~4 号位可编辑 + 备选
 * ========================================================================= */
function addTeam() {
  if (s.teamData.length >= TEAM_MAX) return toast.error(`最多 ${TEAM_MAX} 支队伍`)
  s.teamData.push(guide.makeTeam())
}

const removeTeam = (ti) => s.teamData.splice(ti, 1)
const moveTeam = (ti, dir) => moveItem(s.teamData, ti, dir)

/* 2~4 号位之间换位，不碰第 1 格 */
function moveTeamChar(ti, ci, dir) {
  const to = ci + dir
  if (to < 1 || to > 3) return
  const chars = s.teamData[ti].chars
  ;[chars[ci], chars[to]] = [chars[to], chars[ci]]
}

const moveAlt = (ti, ci, ai, dir) => moveItem(s.teamData[ti].chars[ci].alts, ai, dir)

function addAlt(ti, ci) {
  const alts = s.teamData[ti].chars[ci].alts
  if (alts.length >= 4) return toast.error('备选最多 4 个')
  alts.push({ name: '', img: '', imgManual: false })
}

const removeAlt = (ti, ci, ai) => s.teamData[ti].chars[ci].alts.splice(ai, 1)

/* 角色名直接问字典 —— 名字里带「·冰」这种后缀也认（loader 会先精确匹配） */
async function matchTeamChar(ti, ci) {
  const cell = s.teamData[ti].chars[ci]
  cell.img = await matchIcon('characters', cell.name)
  cell.imgManual = false
}

async function matchAlt(ti, ci, ai) {
  const cell = s.teamData[ti].chars[ci].alts[ai]
  cell.img = await matchIcon('characters', cell.name)
  cell.imgManual = false
}

async function onTeamCharFile(ti, ci, e) {
  const url = await fileToDataURL(e)
  if (!url) return
  const cell = s.teamData[ti].chars[ci]
  cell.img = url
  cell.imgManual = true
}

async function onAltFile(ti, ci, ai, e) {
  const url = await fileToDataURL(e)
  if (!url) return
  const cell = s.teamData[ti].chars[ci].alts[ai]
  cell.img = url
  cell.imgManual = true
}

async function onTeamCoreFile(e) {
  const url = await fileToDataURL(e)
  if (!url) return
  s.teamCoreImg = url
  s.teamCoreImgManual = true
}

function clearTeamCore() {
  s.teamCoreImg = ''
  s.teamCoreImgManual = false
}
</script>

<template>
  <div class="relative grid h-full min-h-0 grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)]">
    <div class="grid grid-cols-1 border-b border-line bg-canvas p-3">
      <PreviewFrame>
        <!-- 预览就是导出用的同一段 SVG，整段塞进来 -->
        <div class="grid size-full [&>svg]:size-full" v-html="svg" />
      </PreviewFrame>
    </div>

    <!-- 换区按钮：筛选条那条尺寸线（窄屏 h-10、宽屏 h-9） -->
    <div class="flex gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-2" role="group" aria-label="编辑区域切换">
      <button
        v-for="sec in SECTIONS"
        :key="sec.key"
        type="button"
        class="h-10 shrink-0 rounded-ctl px-3 text-xs transition-shadow duration-150 sm:h-9"
        :class="tab === sec.key ? 'bg-sunken font-medium text-ink' : 'text-muted hover:bg-hover'"
        :aria-pressed="tab === sec.key"
        @click="tab = sec.key"
      >
        {{ sec.label }}
      </button>
    </div>

    <main ref="contentEl" class="grid min-h-0 grid-cols-1 content-start gap-3 overflow-y-auto p-3 pb-6">
      <section v-show="tab === 'style'" class="grid grid-cols-1 gap-3">
        <div class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
          <h2 class="text-xs font-medium text-muted">文字</h2>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field v-model="s.charName" label="角色名称" placeholder="如：芙宁娜" />
            <Field v-model="s.version" label="适用版本" placeholder="如：5.4" />
            <Field v-model="s.date" label="制作日期" placeholder="如：2026-11-07" />
            <Field v-model="s.author" label="攻略作者" />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
          <h2 class="text-xs font-medium text-muted">元素配色</h2>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="[name, color] in elementColors"
              :key="color"
              type="button"
              class="flex h-10 items-center justify-center gap-1.5 rounded-ctl border text-xs transition-shadow duration-150"
              :class="isTheme(color) ? 'border-ink bg-surface text-ink' : 'border-line text-muted hover:bg-hover'"
              :aria-pressed="isTheme(color)"
              @click="s.theme = color"
            >
              <span class="size-3 shrink-0 rounded-full" :style="{ backgroundColor: color }" aria-hidden="true" />
              {{ name }}
            </button>
          </div>
        </div>
      </section>

      <section v-show="tab === 'portrait'" class="grid grid-cols-1 gap-3">
        <div class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
          <h2 class="text-xs font-medium text-muted">素材</h2>

          <template v-for="slot in IMG_SLOTS" :key="slot.key">
            <div class="flex items-center gap-2">
              <!-- 整行是一个按钮：缩略图 + 说明文字，点哪都能上传 -->
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 rounded-ctl p-1 text-left transition-shadow duration-150 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                @click="pickFile(slot.key)"
              >
                <span :class="THUMB">
                  <img v-if="s[slot.key]" :src="s[slot.key]" alt="" class="size-full object-cover" />
                </span>
                <span class="min-w-0">
                  <span class="block text-xs font-medium text-ink">{{ slot.label }}</span>
                  <span class="block text-xs text-muted">{{ s[slot.key] ? '点击更换' : '点击上传' }}</span>
                </span>
              </button>
              <Btn
                v-if="s[slot.key]"
                size="sm"
                square
                variant="danger"
                :aria-label="`删除${slot.label}`"
                @click="clearImg(slot.key)"
              >
                <Icon name="ui.trash" />
              </Btn>
            </div>

            <!-- 立绘偏移：紧跟立绘那一行 -->
            <Slider
              v-if="slot.key === 'charImg' && s.charImg"
              v-model="s.imgX"
              label="立绘左右偏移"
              :min="-400"
              :max="400"
              unit="px"
            />

            <input
              :ref="(el) => (fileInputs[slot.key] = el)"
              type="file"
              accept="image/*"
              class="sr-only"
              tabindex="-1"
              aria-hidden="true"
              @change="onSlotFile(slot.key, $event)"
            />
          </template>
        </div>
      </section>

      <section v-show="tab === 'weapon'" class="grid grid-cols-1 gap-3">
        <div
          v-for="type in WEAPON_ORDER"
          :key="type"
          class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2"
        >
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xs font-medium text-muted">{{ WEAPON_LABELS[type] }}武器（{{ s.weaponData[type].length }}/{{ WEAPON_MAX }}）</h2>
            <Btn size="sm" @click="addWeapon(type)">添加</Btn>
          </div>
          <p v-if="!s.weaponData[type].length" class="text-xs text-faint">暂无配置</p>

          <div v-for="(w, i) in s.weaponData[type]" :key="i" class="flex items-center gap-2">
            <button
              type="button"
              :class="THUMB"
              :aria-label="`上传第 ${i + 1} 个武器的图标`"
              @click="pickFile(`w:${type}:${i}`)"
            >
              <img :src="w.img || PLACEHOLDER" alt="" class="size-full object-cover" />
            </button>
            <Field
              v-model="w.name"
              label=""
              :aria-label="`第 ${i + 1} 个武器名`"
              placeholder="武器名"
              class="min-w-0 flex-1"
              @blur="matchWeapon(type, i)"
            />
            <div class="flex shrink-0 gap-1">
              <Btn size="sm" square aria-label="上移" :disabled="!canMoveWeapon(type, i, -1)" @click="moveWeapon(type, i, -1)">
                <Icon name="ui.arrowUp" />
              </Btn>
              <Btn size="sm" square aria-label="下移" :disabled="!canMoveWeapon(type, i, 1)" @click="moveWeapon(type, i, 1)">
                <Icon name="ui.arrowDown" />
              </Btn>
              <Btn size="sm" square variant="danger" aria-label="删除武器" @click="removeWeapon(type, i)">
                <Icon name="ui.trash" />
              </Btn>
            </div>
            <input
              :ref="(el) => (fileInputs[`w:${type}:${i}`] = el)"
              type="file"
              accept="image/*"
              class="sr-only"
              tabindex="-1"
              aria-hidden="true"
              @change="onWeaponFile(type, i, $event)"
            />
          </div>
        </div>
      </section>

      <section v-show="tab === 'artifact'" class="grid grid-cols-1 gap-3">
        <div class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xs font-medium text-muted">圣遗物推荐（{{ s.artifactData.length }}）</h2>
            <div class="flex gap-2">
              <Btn size="sm" @click="addArtifact('single')">整套</Btn>
              <Btn size="sm" @click="addArtifact('double')">散搭</Btn>
            </div>
          </div>
          <p v-if="!s.artifactData.length" class="text-xs text-faint">暂无配置</p>

          <div v-for="(a, i) in s.artifactData" :key="i" class="grid grid-cols-1 gap-2">
            <!-- 散搭：一行显示文本 + 两行「图标 + 名字」，操作按钮跟显示文本同一行 -->
            <template v-if="a.type === 'double'">
              <div class="flex items-center gap-2">
                <Field
                  v-model="a.displayText"
                  label=""
                  aria-label="卡片显示文本"
                  placeholder="卡片显示文本（留空显示两个名字）"
                  class="min-w-0 flex-1"
                />
                <div class="flex shrink-0 gap-1">
                  <Btn size="sm" square aria-label="上移" :disabled="i === 0" @click="moveArtifact(i, -1)">
                    <Icon name="ui.arrowUp" />
                  </Btn>
                  <Btn size="sm" square aria-label="下移" :disabled="i === s.artifactData.length - 1" @click="moveArtifact(i, 1)">
                    <Icon name="ui.arrowDown" />
                  </Btn>
                  <Btn size="sm" square variant="danger" aria-label="删除散搭圣遗物" @click="removeArtifact(i)">
                    <Icon name="ui.trash" />
                  </Btn>
                </div>
              </div>
              <div v-for="n in 2" :key="n" class="flex items-center gap-2">
                <button
                  type="button"
                  :class="THUMB"
                  :aria-label="`上传散搭第 ${n} 个圣遗物的图标`"
                  @click="pickFile(`a:${i}:${n}`)"
                >
                  <img :src="a[`img${n}`] || PLACEHOLDER" alt="" class="size-full object-cover" />
                </button>
                <Field
                  v-model="a[`name${n}`]"
                  label=""
                  :aria-label="`散搭第 ${n} 个圣遗物名`"
                  :placeholder="`圣遗物名 ${n}`"
                  class="min-w-0 flex-1"
                  @blur="matchArtifactPart(i, n)"
                />
                <input
                  :ref="(el) => (fileInputs[`a:${i}:${n}`] = el)"
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  tabindex="-1"
                  aria-hidden="true"
                  @change="onArtifactFile(i, `img${n}`, $event)"
                />
              </div>
            </template>

            <!-- 整套：和武器一行一个样 -->
            <div v-else class="flex items-center gap-2">
              <button
                type="button"
                :class="THUMB"
                :aria-label="`上传第 ${i + 1} 个圣遗物的图标`"
                @click="pickFile(`a:${i}`)"
              >
                <img :src="a.img || PLACEHOLDER" alt="" class="size-full object-cover" />
              </button>
              <Field
                v-model="a.name"
                label=""
                :aria-label="`第 ${i + 1} 个圣遗物名`"
                placeholder="圣遗物名"
                class="min-w-0 flex-1"
                @blur="matchArtifact(i)"
              />
              <div class="flex shrink-0 gap-1">
                <Btn size="sm" square aria-label="上移" :disabled="i === 0" @click="moveArtifact(i, -1)">
                  <Icon name="ui.arrowUp" />
                </Btn>
                <Btn size="sm" square aria-label="下移" :disabled="i === s.artifactData.length - 1" @click="moveArtifact(i, 1)">
                  <Icon name="ui.arrowDown" />
                </Btn>
                <Btn size="sm" square variant="danger" aria-label="删除圣遗物" @click="removeArtifact(i)">
                  <Icon name="ui.trash" />
                </Btn>
              </div>
              <input
                :ref="(el) => (fileInputs[`a:${i}`] = el)"
                type="file"
                accept="image/*"
                class="sr-only"
                tabindex="-1"
                aria-hidden="true"
                @change="onArtifactFile(i, 'img', $event)"
              />
            </div>
          </div>
        </div>
      </section>

      <section v-show="tab === 'talent'" class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
        <h2 class="text-xs font-medium text-muted">天赋加点</h2>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field v-model="s.talentA" label="普通攻击" placeholder="如：10" />
          <Field v-model="s.talentE" label="元素战技" placeholder="如：9" />
          <Field v-model="s.talentQ" label="元素爆发" placeholder="如：10" />
        </div>
      </section>

      <section v-show="tab === 'stat'" class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
        <h2 class="text-xs font-medium text-muted">词条推荐</h2>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field v-model="s.sandMain" label="时之沙" placeholder="如：元素精通" />
          <Field v-model="s.gobMain" label="空之杯" placeholder="如：火元素伤害加成" />
          <Field v-model="s.cirMain" label="理之冠" placeholder="如：暴击率" />
        </div>
        <Field v-model="s.subStats" label="副词条优先顺序" placeholder="如：暴击率 > 暴击伤害 > 元素精通" />
      </section>

      <section v-show="tab === 'panel'" class="grid grid-cols-1 gap-3">
        <div class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
          <h2 class="text-xs font-medium text-muted">主属性</h2>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="opt in PRIMARY_OPTIONS"
              :key="opt.value"
              type="button"
              class="h-10 rounded-ctl border text-xs transition-shadow duration-150"
              :class="s.panel.primaryKey === opt.value ? 'border-ink bg-surface text-ink' : 'border-line text-muted hover:bg-hover'"
              :aria-pressed="s.panel.primaryKey === opt.value"
              @click="s.panel.primaryKey = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <Field v-model="s.panel.primaryValue" label="主属性数值" placeholder="留空显示「任意」" />
        </div>

        <div class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
          <h2 class="text-xs font-medium text-muted">副属性</h2>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field v-model="s.panel.cr" label="暴击率" placeholder="留空显示「任意」" />
            <Field v-model="s.panel.cd" label="暴击伤害" placeholder="留空显示「任意」" />
            <Field v-model="s.panel.em" label="元素精通" placeholder="留空显示「任意」" />
            <Field v-model="s.panel.er" label="充能效率" placeholder="留空显示「任意」" />
          </div>
        </div>
      </section>

      <section v-show="tab === 'constellation'" class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
        <h2 class="text-xs font-medium text-muted">核心命座</h2>
        <div v-for="(c, i) in s.constellationData" :key="i" class="flex items-center gap-2">
          <!-- 圆圈数字：36px（规范里的紧凑档），跟 40px 的输入框居中对齐；点亮填元素色 -->
          <button
            type="button"
            class="grid size-9 shrink-0 place-items-center rounded-full border text-xs font-medium transition-shadow duration-150"
            :class="c.active ? 'border-transparent text-white' : 'border-line text-muted hover:bg-hover'"
            :style="c.active ? { backgroundColor: s.theme } : {}"
            :aria-pressed="c.active"
            :aria-label="`第 ${i + 1} 命`"
            @click="c.active = !c.active"
          >
            {{ i + 1 }}
          </button>
          <Field
            v-model="c.desc"
            label=""
            :aria-label="`第 ${i + 1} 命核心效果描述`"
            :placeholder="`${i + 1} 命核心效果描述`"
            class="min-w-0 flex-1"
          />
        </div>
      </section>

      <section v-show="tab === 'team'" class="grid grid-cols-1 gap-3">
        <div class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
          <div class="flex items-center gap-2">
            <button
              type="button"
              :class="THUMB"
              aria-label="上传 1 号位头像"
              @click="pickFile('teamCore')"
            >
              <img v-if="s.teamCoreImg" :src="s.teamCoreImg" alt="" class="size-full object-cover" />
            </button>
            <button
              type="button"
              class="min-w-0 flex-1 rounded-ctl p-1 text-left transition-shadow duration-150 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              @click="pickFile('teamCore')"
            >
              <span class="block text-xs font-medium text-ink">1 号位头像</span>
              <span class="block text-xs text-muted">{{ s.teamCoreImg ? '点击更换' : '留空就用角色自己的头像' }}</span>
            </button>
            <Btn
              v-if="s.teamCoreImg"
              size="sm"
              square
              variant="danger"
              aria-label="删除 1 号位头像"
              @click="clearTeamCore"
            >
              <Icon name="ui.trash" />
            </Btn>
            <input
              :ref="(el) => (fileInputs.teamCore = el)"
              type="file"
              accept="image/*"
              class="sr-only"
              tabindex="-1"
              aria-hidden="true"
              @change="onTeamCoreFile"
            />
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 px-1">
          <h2 class="text-xs font-medium text-muted">配队（{{ s.teamData.length }}/{{ TEAM_MAX }}）</h2>
          <Btn size="sm" @click="addTeam">添加队伍</Btn>
        </div>
        <p v-if="!s.teamData.length" class="px-1 text-xs text-faint">暂未添加配队</p>

        <div
          v-for="(team, ti) in s.teamData"
          :key="ti"
          class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2"
        >
          <div class="flex items-center gap-2">
            <span class="min-w-0 flex-1 text-xs font-medium text-ink">队伍 {{ ti + 1 }}</span>
            <div class="flex shrink-0 gap-1">
              <Btn size="sm" square aria-label="上移" :disabled="ti === 0" @click="moveTeam(ti, -1)">
                <Icon name="ui.arrowUp" />
              </Btn>
              <Btn size="sm" square aria-label="下移" :disabled="ti === s.teamData.length - 1" @click="moveTeam(ti, 1)">
                <Icon name="ui.arrowDown" />
              </Btn>
              <Btn size="sm" square variant="danger" aria-label="删除队伍" @click="removeTeam(ti)">
                <Icon name="ui.trash" />
              </Btn>
            </div>
          </div>

          <Field v-model="team.name" label="" aria-label="队伍名称" placeholder="队伍名称（如：蒸发队）" />

          <div v-for="ci in 3" :key="ci" class="grid grid-cols-1 gap-2 border-t border-line pt-2">
            <div class="flex items-center gap-2">
              <button
                type="button"
                :class="THUMB"
                :aria-label="`上传 ${ci + 1} 号位角色头像`"
                @click="pickFile(`t:${ti}:${ci}`)"
              >
                <img :src="team.chars[ci].img || PLACEHOLDER" alt="" class="size-full object-cover" />
              </button>
              <Field
                v-model="team.chars[ci].name"
                label=""
                :aria-label="`${ci + 1} 号位角色名`"
                :placeholder="`${ci + 1} 号位角色名`"
                class="min-w-0 flex-1"
                @blur="matchTeamChar(ti, ci)"
              />
              <div class="flex shrink-0 gap-1">
                <Btn size="sm" square aria-label="上移" :disabled="ci === 1" @click="moveTeamChar(ti, ci, -1)">
                  <Icon name="ui.arrowUp" />
                </Btn>
                <Btn size="sm" square aria-label="下移" :disabled="ci === 3" @click="moveTeamChar(ti, ci, 1)">
                  <Icon name="ui.arrowDown" />
                </Btn>
              </div>
              <input
                :ref="(el) => (fileInputs[`t:${ti}:${ci}`] = el)"
                type="file"
                accept="image/*"
                class="sr-only"
                tabindex="-1"
                aria-hidden="true"
                @change="onTeamCharFile(ti, ci, $event)"
              />
            </div>

            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted">备选（{{ team.chars[ci].alts.length }}/4）</span>
              <Btn size="sm" @click="addAlt(ti, ci)">添加</Btn>
            </div>

            <div v-for="(alt, ai) in team.chars[ci].alts" :key="ai" class="flex items-center gap-2">
              <button
                type="button"
                class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-ctl border border-line bg-thumb focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                :aria-label="`上传 ${ci + 1} 号位第 ${ai + 1} 个备选的头像`"
                @click="pickFile(`ta:${ti}:${ci}:${ai}`)"
              >
                <img :src="alt.img || PLACEHOLDER" alt="" class="size-full object-cover" />
              </button>
              <Field
                v-model="alt.name"
                label=""
                :aria-label="`${ci + 1} 号位第 ${ai + 1} 个备选角色名`"
                placeholder="备选角色名"
                class="min-w-0 flex-1"
                @blur="matchAlt(ti, ci, ai)"
              />
              <div class="flex shrink-0 gap-1">
                <Btn size="sm" square aria-label="上移" :disabled="ai === 0" @click="moveAlt(ti, ci, ai, -1)">
                  <Icon name="ui.arrowUp" />
                </Btn>
                <Btn size="sm" square aria-label="下移" :disabled="ai === team.chars[ci].alts.length - 1" @click="moveAlt(ti, ci, ai, 1)">
                  <Icon name="ui.arrowDown" />
                </Btn>
                <Btn size="sm" square variant="danger" aria-label="删除备选" @click="removeAlt(ti, ci, ai)">
                  <Icon name="ui.trash" />
                </Btn>
              </div>
              <input
                :ref="(el) => (fileInputs[`ta:${ti}:${ci}:${ai}`] = el)"
                type="file"
                accept="image/*"
                class="sr-only"
                tabindex="-1"
                aria-hidden="true"
                @change="onAltFile(ti, ci, ai, $event)"
              />
            </div>

            <Field
              v-if="!team.chars[ci].alts.length"
              v-model="team.chars[ci].emptyAltText"
              label=""
              :aria-label="`${ci + 1} 号位无备选时显示的文字`"
              placeholder="无备选时显示的文字（默认：暂无备选）"
            />
          </div>
        </div>
      </section>

      <section v-show="tab === 'save'" class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2">
        <h2 class="text-xs font-medium text-muted">存档</h2>
        <p class="text-xs text-faint">草稿自动存在本机浏览器里，下次打开会接着上次。</p>
        <p class="text-xs text-accent-strong" aria-live="polite">{{ saveState }}</p>
        <div class="flex flex-wrap gap-2">
          <Btn @click="askRepoSave">载入在线存档</Btn>
          <Btn variant="danger" @click="askClear">清空全部数据</Btn>
        </div>
        <p class="text-xs text-faint">
          在线存档按角色名去找（编号取自图片字典），当前仓库里只有芙宁娜、爱可菲、丝柯克、瓦列里、米提亚五份。
        </p>
      </section>
    </main>

    <Modal
      v-model="confirmBox"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-text="confirmText"
      :danger="confirmKind === 'clear'"
      @confirm="runConfirm"
    />
  </div>
</template>

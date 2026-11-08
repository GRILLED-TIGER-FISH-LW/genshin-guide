<script setup>
import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue'
import { ICONS } from 'virtual:gg-icons'
import Btn from '../components/Btn.vue'
import DockCta from '../components/DockCta.vue'
import Dropdown from '../components/Dropdown.vue'
import Field from '../components/Field.vue'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import PreviewFrame from '../components/PreviewFrame.vue'
import Slider from '../components/Slider.vue'
import { loadUiIcons, matchIcon } from '../composables/useIconLib.js'
import { useToast } from '../composables/useToast.js'
import { download, loadImageMeta, svgToPng, urlToDataURL } from '../lib/assets.js'
import * as fonts from '../lib/fonts.js'
import {
  elementColors, PANEL_PRIMARY_KEYS, PANEL_PRIMARY_LABELS, SVG_H, SVG_W,
  TEAM_MAX, WEAPON_LABELS, WEAPON_MAX, WEAPON_ORDER,
} from '../lib/guideConsts.js'
import * as guide from '../lib/guideChart.js'
import { clearDraft, fetchRepoSave, loadDraft, normalizeGuide, rematchMissing, saveDraft } from '../lib/guideStore.js'

/* 编辑区按旧版一图流的骨架；控件走通用件。
   两个和观感有关的坑，都记在这儿免得以后再踩：
   · danger 档的底色 #f8e9e7 贴在卡片底 #faf9f5 上对比只有 1.02:1，等于看不见 ——
     删除按钮一律补一条 border-danger/30（旧版也是靠那 1px 红边框区分）
   · 预览框右上角那颗「清空」用 Btn 的 float-danger 档（浮层外观 + 危险色），
     别再拿 ! 去染档位颜色 */

const s = reactive(guide.fresh())
const toast = useToast()

const uiIcons = ref({})
const svg = computed(() => guide.buildGuideSVG(s, uiIcons.value))
const PLACEHOLDER = guide.placeholder()

const PRIMARY_OPTIONS = PANEL_PRIMARY_KEYS.map((key) => ({ value: key, label: PANEL_PRIMARY_LABELS[key] }))
const isTheme = (color) => s.theme.toLowerCase() === color.toLowerCase()

/* 元素图标是 1024 视框，Icon.vue 外框写死 24 视框会把它放大 43 倍画出画面外 */
const elementIcon = (key) => `<svg viewBox="0 0 1024 1024" class="size-4 shrink-0 [&_path]:fill-current" aria-hidden="true">${ICONS[`element.${key}`] || ''}</svg>`

const THUMB = 'grid size-10 shrink-0 place-items-center overflow-hidden rounded-ctl border border-line bg-thumb focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'
const THUMB_SM = 'grid size-8 shrink-0 place-items-center overflow-hidden rounded-ctl border border-line bg-thumb focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'
const PANEL = 'grid gap-2 rounded-panel border border-line bg-surface p-2'
const CARD = 'grid gap-2 rounded-ctl border border-line-2 p-2'
const HEAD = 'flex items-center justify-between gap-2'
const DEL = 'border border-danger/30'

/* =========================================================================
 * 分区
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
]
const tab = ref('style')
const contentEl = ref(null)

watch(tab, () => contentEl.value?.scrollTo({ top: 0 }))

const collapsed = reactive({})
const isCollapsed = (key) => !!collapsed[key]
const toggleCollapse = (key) => { collapsed[key] = !collapsed[key] }

/* =========================================================================
 * 字体
 * ========================================================================= */
const fontList = ref([])
const fontFile = ref('')
const fontStatus = ref('') /* '' | 'loading' | 'error' */

const fontOptions = computed(() => [
  { value: '', label: '默认系统字体' },
  ...fontList.value.map((f) => ({ value: f.file, label: f.name })),
])

const fontLabel = computed(() => {
  if (fontStatus.value === 'loading') return '正在加载…'
  if (fontStatus.value === 'error') return '字体加载失败，重新选一个即可'
  return s.fontName ? `当前：${s.fontName}` : '默认系统字体'
})

async function onFontChange(file) {
  if (!file) {
    fonts.dropFont()
    s.fontData = ''
    s.fontName = ''
    s.fontFileName = ''
    fontStatus.value = ''
    return
  }

  const item = fontList.value.find((f) => f.file === file)
  if (!item) return

  fontStatus.value = 'loading'
  try {
    const data = await fonts.fetchFontData(file)
    if (!(await fonts.installFont({ name: item.name, data }))) throw new Error('字体解析失败')
    s.fontData = data
    s.fontName = item.name
    s.fontFileName = file
    fontStatus.value = ''
  } catch (err) {
    fonts.dropFont()
    s.fontData = ''
    s.fontName = ''
    s.fontFileName = ''
    fontStatus.value = 'error'
    toast.error(`字体加载失败：${err.message}`)
  }
}

async function applyFontFromState() {
  fonts.dropFont()
  if (s.fontName && s.fontData) {
    if (await fonts.installFont({ name: s.fontName, data: s.fontData })) return
    s.fontData = ''
    s.fontName = ''
    s.fontFileName = ''
    return
  }
  if (s.fontFileName && fontList.value.length) fontFile.value = s.fontFileName
}

/* =========================================================================
 * 草稿
 * ========================================================================= */
const saveState = ref('')
let saveTimer = 0

function touchDraft() {
  saveState.value = '保存中…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    saveState.value = (await saveDraft({ ...toRaw(s), fontData: '' })) ? '已保存' : '保存失败'
  }, 600)
}

onMounted(async () => {
  try {
    uiIcons.value = await loadUiIcons()
  } catch {
    /* 没图标也能用 */
  }
  try {
    fontList.value = await fonts.fetchFontList()
  } catch {
    /* 清单读不到就没有可选字体，不影响其他 */
  }

  const draft = await loadDraft()
  if (draft) {
    Object.assign(s, normalizeGuide(draft))
    saveState.value = '已恢复上次的草稿'
  }

  watch(s, touchDraft, { deep: true })
  watch(fontFile, onFontChange)
  await applyFontFromState()
})

/* =========================================================================
 * 存档 / 配置 / 导出
 * ========================================================================= */
const confirmBox = ref(false)
const confirmKind = ref('repo')
const importInput = ref(null)
const previewHost = ref(null)
const exporting = ref(false)

/* 导出按 3 倍：1280×720 的卡片出 3840×2160，和封面工具出图同尺寸 */
const PNG_SCALE = 3

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
  await applyFontFromState()
}

async function clearAll() {
  const author = s.author
  Object.assign(s, normalizeGuide({ author }))
  await clearDraft()
  fonts.dropFont()
  fontFile.value = ''
  saveState.value = '已清空'
}

const runConfirm = () => (confirmKind.value === 'clear' ? clearAll() : loadRepo())

const dayStamp = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function exportConfig() {
  const text = JSON.stringify({ ...toRaw(s), fontData: '' }, null, 2)
  download(new Blob([text], { type: 'application/json' }), `${s.charName.trim() || '角色'}_${dayStamp()}.json`)
  toast.success('配置已导出')
}

async function importConfig(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    Object.assign(s, normalizeGuide(JSON.parse(await file.text())))
    await applyFontFromState()
    toast.success('配置已导入')
  } catch {
    toast.error('这个文件不是本工具的配置')
  }
}

/* 导出 PNG：和视频封面同一条链 —— 先把图烘成 data URL（外站图不烘会污染 canvas，
   toBlob 直接抛错），字体内嵌，再把 SVG 当独立文档画进 canvas */
async function exportPng() {
  if (exporting.value) return
  const host = previewHost.value?.querySelector('svg')
  if (!host) return toast.error('预览还没准备好')

  exporting.value = true
  try {
    await document.fonts?.ready

    const clone = host.cloneNode(true)
    clone.setAttribute('width', SVG_W * PNG_SCALE)
    clone.setAttribute('height', SVG_H * PNG_SCALE)

    /* 导出的 SVG 是独立文档，摸不到页面的 document.fonts，字体要内嵌进去 */
    if (s.fontName && s.fontData) {
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      style.textContent = fonts.fontFaceCss(s.fontName, s.fontData)
      clone.querySelector('defs')?.prepend(style)
    }

    for (const img of clone.querySelectorAll('image')) {
      const href = img.getAttribute('href')
      if (href && !/^data:/i.test(href)) img.setAttribute('href', await urlToDataURL(href))
    }

    const blob = await svgToPng(clone, SVG_W * PNG_SCALE, SVG_H * PNG_SCALE)
    if (!blob) throw new Error('画布导出失败')

    const name = (s.charName.trim() || '角色卡').replace(/[\\/:*?"<>|]/g, '_')
    download(blob, `${name}_${dayStamp()}.png`)
    toast.success('图片已导出')
  } catch (err) {
    toast.error(`导出失败：${err.message}`)
  } finally {
    exporting.value = false
  }
}

/* =========================================================================
 * 大图槽
 * ========================================================================= */
const IMG_SLOTS = [
  { key: 'charImg', label: '立绘', hint: '点击图片上传' },
  { key: 'nameBgImg', label: '元素图', hint: '点击图片上传' },
  { key: 'bgImg', label: '大背景', hint: '留空为深色底' },
]

const fileInputs = {}
const pickFile = (key) => fileInputs[key]?.click()

const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

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
 * 武器
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
  collapsed[`weapon_${type}`] = false
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
 * 圣遗物
 * ========================================================================= */
const moveItem = (arr, i, dir) => {
  const to = i + dir
  if (to < 0 || to >= arr.length) return
  ;[arr[i], arr[to]] = [arr[to], arr[i]]
}

function addArtifact(type) {
  s.artifactData.push(type === 'double'
    ? { type, name1: '', name2: '', displayText: '', img1: '', img1Manual: false, img2: '', img2Manual: false }
    : { type, name: '', img: '', imgManual: false })
  collapsed.artifact_section = false
}

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
 * 配队
 * ========================================================================= */
function addTeam() {
  if (s.teamData.length >= TEAM_MAX) return toast.error(`最多 ${TEAM_MAX} 支队伍`)
  s.teamData.push(guide.makeTeam())
}

const removeTeam = (ti) => s.teamData.splice(ti, 1)
const moveTeam = (ti, dir) => moveItem(s.teamData, ti, dir)

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
  collapsed[`team_${ti}_char_${ci}`] = false
}

const removeAlt = (ti, ci, ai) => s.teamData[ti].chars[ci].alts.splice(ai, 1)

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
        <!-- 导出时要从这层里取那份 SVG -->
        <div ref="previewHost" class="grid size-full [&>svg]:size-full" v-html="svg" />

        <template #toolbar>
          <Btn variant="float" square aria-label="导出配置" @click="exportConfig">
            <template #icon><Icon name="ui.export" size="sm" /></template>
          </Btn>
          <Btn variant="float" square aria-label="导入配置" @click="importInput?.click()">
            <template #icon><Icon name="ui.import" size="sm" /></template>
          </Btn>
          <Btn
            variant="float-danger"
            square
            aria-label="清空全部数据"
            @click="askClear"
          >
            <template #icon><Icon name="ui.trash" size="sm" /></template>
          </Btn>
          <input
            ref="importInput"
            type="file"
            accept=".json,application/json"
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            @change="importConfig"
          />
        </template>
      </PreviewFrame>
    </div>

    <div
      class="flex gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="编辑区域切换"
    >
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

    <main ref="contentEl" class="grid min-h-0 grid-cols-1 content-start gap-3 overflow-y-auto p-3 pb-24">
      <!-- ① 外观样式 -->
      <section v-show="tab === 'style'" class="grid grid-cols-1 gap-3">
        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">文字</h2>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field v-model="s.charName" label="角色名称" placeholder="如：芙宁娜" />
            <Field v-model="s.version" label="适用版本" placeholder="如：5.4" />
            <Field v-model="s.date" label="制作日期" placeholder="如：2026-11-07" />
            <Field v-model="s.author" label="攻略作者" />
          </div>
        </div>

        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">元素配色</h2>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="[name, color, iconKey] in elementColors"
              :key="color"
              type="button"
              class="flex h-10 items-center justify-center gap-1.5 rounded-ctl border text-xs transition-shadow duration-150"
              :class="isTheme(color) ? 'border-ink bg-surface text-ink' : 'border-line text-muted hover:bg-hover'"
              :aria-pressed="isTheme(color)"
              @click="s.theme = color"
            >
              <span :style="{ color }" v-html="elementIcon(iconKey)" />
              {{ name }}
            </button>
          </div>
        </div>

        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">字体</h2>
          <div class="flex items-center gap-2">
            <p class="min-w-0 flex-1 truncate text-xs text-muted">{{ fontLabel }}</p>
            <div class="w-32 shrink-0">
              <Dropdown v-model="fontFile" :options="fontOptions" label="选择字体" placeholder="选择字体" />
            </div>
          </div>
        </div>

        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">在线存档</h2>
          <p class="text-xs text-faint">草稿自动存在本机浏览器里，下次打开会接着上次。</p>
          <p class="text-xs text-accent-strong" aria-live="polite">{{ saveState }}</p>
          <div class="flex flex-wrap gap-2">
            <Btn @click="askRepoSave">载入在线存档</Btn>
          </div>
          <p class="text-xs text-faint">
            按角色名去找（编号取自图片字典），当前仓库里只有芙宁娜、爱可菲、丝柯克、瓦列里、米提亚五份。
          </p>
        </div>
      </section>

      <!-- ② 立绘区 -->
      <section v-show="tab === 'portrait'" class="grid grid-cols-1 gap-3">
        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">素材</h2>

          <template v-for="slot in IMG_SLOTS" :key="slot.key">
            <div class="flex items-center gap-2">
              <button
                type="button"
                :class="THUMB"
                :aria-label="`上传${slot.label}`"
                @click="pickFile(slot.key)"
              >
                <img v-if="s[slot.key]" :src="s[slot.key]" alt="" class="size-full object-cover" />
              </button>
              <div class="min-w-0 flex-1">
                <div class="text-xs font-medium text-ink">{{ slot.label }}</div>
                <div class="truncate text-xs text-muted">{{ s[slot.key] ? '已载入，点图更换' : slot.hint }}</div>
              </div>
              <Btn
                v-if="s[slot.key]"
                size="sm"
                variant="danger"
                square
                :class="DEL"
                :aria-label="`删除${slot.label}`"
                @click="clearImg(slot.key)"
              >
                <template #icon><Icon name="ui.trash" size="sm" /></template>
              </Btn>
              <input
                :ref="(el) => (fileInputs[slot.key] = el)"
                type="file"
                accept="image/*"
                class="sr-only"
                tabindex="-1"
                aria-hidden="true"
                @change="onSlotFile(slot.key, $event)"
              />
            </div>

            <Slider
              v-if="slot.key === 'charImg' && s.charImg"
              v-model="s.imgX"
              label="立绘左右偏移"
              :min="-400"
              :max="400"
              unit="px"
            />
          </template>
        </div>
      </section>

      <!-- ③ 武器区 -->
      <section v-show="tab === 'weapon'" class="grid grid-cols-1 gap-3">
        <div v-for="type in WEAPON_ORDER" :key="type" :class="PANEL">
          <div :class="HEAD">
            <h2 class="text-xs font-medium text-muted">{{ WEAPON_LABELS[type] }}武器（{{ s.weaponData[type].length }}/{{ WEAPON_MAX }}）</h2>
            <div class="flex shrink-0 gap-1">
              <Btn size="sm" @click="addWeapon(type)">添加</Btn>
              <Btn size="sm" :aria-expanded="!isCollapsed(`weapon_${type}`)" @click="toggleCollapse(`weapon_${type}`)">
                {{ isCollapsed(`weapon_${type}`) ? '展开' : '收起' }}
                <Icon :name="isCollapsed(`weapon_${type}`) ? 'ui.chevronDown' : 'ui.chevronUp'" size="sm" bold />
              </Btn>
            </div>
          </div>

          <div v-show="!isCollapsed(`weapon_${type}`)" class="grid grid-cols-1 gap-2">
            <p v-if="!s.weaponData[type].length" class="text-xs text-faint">暂无配置</p>

            <div v-for="(w, i) in s.weaponData[type]" :key="i" :class="CARD">
              <div :class="HEAD">
                <span class="text-xs font-medium text-ink">#{{ i + 1 }}</span>
                <div class="flex shrink-0 gap-1">
                  <Btn size="sm" square aria-label="上移" :disabled="!canMoveWeapon(type, i, -1)" @click="moveWeapon(type, i, -1)">
                    <template #icon><Icon name="ui.arrowUp" size="sm" /></template>
                  </Btn>
                  <Btn size="sm" square aria-label="下移" :disabled="!canMoveWeapon(type, i, 1)" @click="moveWeapon(type, i, 1)">
                    <template #icon><Icon name="ui.arrowDown" size="sm" /></template>
                  </Btn>
                  <Btn size="sm" variant="danger" square :class="DEL" aria-label="删除武器" @click="removeWeapon(type, i)">
                    <template #icon><Icon name="ui.trash" size="sm" /></template>
                  </Btn>
                </div>
              </div>

              <div class="flex items-center gap-2">
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
        </div>
      </section>

      <!-- ④ 圣遗物区 -->
      <section v-show="tab === 'artifact'" class="grid grid-cols-1 gap-3">
        <div :class="PANEL">
          <div :class="HEAD">
            <h2 class="text-xs font-medium text-muted">圣遗物推荐（{{ s.artifactData.length }}）</h2>
            <div class="flex shrink-0 gap-1">
              <Btn size="sm" @click="addArtifact('single')">整套</Btn>
              <Btn size="sm" @click="addArtifact('double')">散搭</Btn>
              <Btn size="sm" :aria-expanded="!isCollapsed('artifact_section')" @click="toggleCollapse('artifact_section')">
                {{ isCollapsed('artifact_section') ? '展开' : '收起' }}
                <Icon :name="isCollapsed('artifact_section') ? 'ui.chevronDown' : 'ui.chevronUp'" size="sm" bold />
              </Btn>
            </div>
          </div>

          <div v-show="!isCollapsed('artifact_section')" class="grid grid-cols-1 gap-2">
            <p v-if="!s.artifactData.length" class="text-xs text-faint">暂无配置</p>

            <div v-for="(a, i) in s.artifactData" :key="i" :class="CARD">
              <div :class="HEAD">
                <span class="text-xs font-medium" :class="a.type === 'double' ? 'text-accent-strong' : 'text-ink'">
                  {{ a.type === 'double' ? '散搭' : '整套' }} #{{ i + 1 }}
                </span>
                <div class="flex shrink-0 gap-1">
                  <Btn size="sm" square aria-label="上移" :disabled="i === 0" @click="moveArtifact(i, -1)">
                    <template #icon><Icon name="ui.arrowUp" size="sm" /></template>
                  </Btn>
                  <Btn size="sm" square aria-label="下移" :disabled="i === s.artifactData.length - 1" @click="moveArtifact(i, 1)">
                    <template #icon><Icon name="ui.arrowDown" size="sm" /></template>
                  </Btn>
                  <Btn size="sm" variant="danger" square :class="DEL" aria-label="删除圣遗物" @click="removeArtifact(i)">
                    <template #icon><Icon name="ui.trash" size="sm" /></template>
                  </Btn>
                </div>
              </div>

              <template v-if="a.type === 'double'">
                <Field
                  v-model="a.displayText"
                  label=""
                  aria-label="卡片显示文本"
                  placeholder="卡片显示文本（留空则显示两个名字）"
                />
                <div class="flex flex-wrap gap-2">
                  <div v-for="n in 2" :key="n" class="flex min-w-[140px] flex-1 items-center gap-2">
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
                </div>
              </template>

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
        </div>
      </section>

      <!-- ⑤ 天赋区 -->
      <section v-show="tab === 'talent'" class="grid grid-cols-1 gap-3">
        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">天赋加点优先级</h2>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field v-model="s.talentA" label="普通攻击" placeholder="如：10" />
            <Field v-model="s.talentE" label="元素战技" placeholder="如：9" />
            <Field v-model="s.talentQ" label="元素爆发" placeholder="如：10" />
          </div>
        </div>
      </section>

      <!-- ⑥ 词条区 -->
      <section v-show="tab === 'stat'" class="grid grid-cols-1 gap-3">
        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">主副词条推荐</h2>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field v-model="s.sandMain" label="时之沙" placeholder="如：元素精通" />
            <Field v-model="s.gobMain" label="空之杯" placeholder="如：火元素伤害加成" />
            <Field v-model="s.cirMain" label="理之冠" placeholder="如：暴击率" />
          </div>
          <Field v-model="s.subStats" label="副词条优先顺序" placeholder="如：暴击率 > 暴击伤害 > 元素精通" />
        </div>
      </section>

      <!-- ⑦ 面板区 -->
      <section v-show="tab === 'panel'" class="grid grid-cols-1 gap-3">
        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">主属性（三选一）</h2>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in PRIMARY_OPTIONS"
              :key="opt.value"
              type="button"
              class="h-10 flex-1 rounded-ctl border text-xs transition-shadow duration-150"
              :class="s.panel.primaryKey === opt.value ? 'border-ink bg-surface text-ink' : 'border-line text-muted hover:bg-hover'"
              :aria-pressed="s.panel.primaryKey === opt.value"
              @click="s.panel.primaryKey = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <Field v-model="s.panel.primaryValue" label="数值" placeholder="留空显示「任意」" />
        </div>

        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">副属性面板</h2>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field v-model="s.panel.cr" label="暴击率" placeholder="留空显示「任意」" />
            <Field v-model="s.panel.cd" label="暴击伤害" placeholder="留空显示「任意」" />
            <Field v-model="s.panel.em" label="元素精通" placeholder="留空显示「任意」" />
            <Field v-model="s.panel.er" label="充能效率" placeholder="留空显示「任意」" />
          </div>
        </div>
      </section>

      <!-- ⑧ 命座区 -->
      <section v-show="tab === 'constellation'" class="grid grid-cols-1 gap-3">
        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">核心命座说明（点击圆圈点亮）</h2>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div v-for="(c, i) in s.constellationData" :key="i" class="flex items-center gap-2">
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
          </div>
        </div>
      </section>

      <!-- ⑨ 配队区 -->
      <section v-show="tab === 'team'" class="grid grid-cols-1 gap-3">
        <div :class="PANEL">
          <h2 class="text-xs font-medium text-muted">1 号位主角色头像</h2>
          <div class="flex items-center gap-2">
            <button type="button" :class="THUMB" aria-label="上传 1 号位头像" @click="pickFile('teamCore')">
              <img v-if="s.teamCoreImg" :src="s.teamCoreImg" alt="" class="size-full object-cover" />
            </button>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-medium text-ink">1 号位头像</div>
              <div class="truncate text-xs text-muted">{{ s.teamCoreImg ? '已载入，点图更换' : '留空就用角色自己的头像' }}</div>
            </div>
            <Btn v-if="s.teamCoreImg" size="sm" variant="danger" square :class="DEL" aria-label="删除 1 号位头像" @click="clearTeamCore">
              <template #icon><Icon name="ui.trash" size="sm" /></template>
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

        <div v-for="(team, ti) in s.teamData" :key="ti" :class="PANEL">
          <div :class="HEAD">
            <span class="text-xs font-medium text-muted">队伍 {{ ti + 1 }}</span>
            <div class="flex shrink-0 gap-1">
              <Btn size="sm" square aria-label="上移" :disabled="ti === 0" @click="moveTeam(ti, -1)">
                <template #icon><Icon name="ui.arrowUp" size="sm" /></template>
              </Btn>
              <Btn size="sm" square aria-label="下移" :disabled="ti === s.teamData.length - 1" @click="moveTeam(ti, 1)">
                <template #icon><Icon name="ui.arrowDown" size="sm" /></template>
              </Btn>
              <Btn size="sm" :aria-expanded="!isCollapsed(`team_${ti}`)" @click="toggleCollapse(`team_${ti}`)">
                {{ isCollapsed(`team_${ti}`) ? '展开' : '收起' }}
                <Icon :name="isCollapsed(`team_${ti}`) ? 'ui.chevronDown' : 'ui.chevronUp'" size="sm" bold />
              </Btn>
              <Btn size="sm" variant="danger" square :class="DEL" aria-label="删除队伍" @click="removeTeam(ti)">
                <template #icon><Icon name="ui.trash" size="sm" /></template>
              </Btn>
            </div>
          </div>

          <div v-show="!isCollapsed(`team_${ti}`)" class="grid grid-cols-1 gap-2">
            <Field v-model="team.name" label="" aria-label="队伍名称" placeholder="队伍名称（如：蒸发队）" />

            <div v-for="ci in 3" :key="ci" :class="CARD">
              <div :class="HEAD">
                <span class="text-xs font-medium text-accent-strong">{{ ci + 1 }} 号位主角色</span>
                <div class="flex shrink-0 gap-1">
                  <Btn size="sm" square aria-label="上移" :disabled="ci === 1" @click="moveTeamChar(ti, ci, -1)">
                    <template #icon><Icon name="ui.arrowUp" size="sm" /></template>
                  </Btn>
                  <Btn size="sm" square aria-label="下移" :disabled="ci === 3" @click="moveTeamChar(ti, ci, 1)">
                    <template #icon><Icon name="ui.arrowDown" size="sm" /></template>
                  </Btn>
                  <Btn size="sm" :aria-expanded="!isCollapsed(`team_${ti}_char_${ci}`)" @click="toggleCollapse(`team_${ti}_char_${ci}`)">
                    {{ isCollapsed(`team_${ti}_char_${ci}`) ? '展开' : '收起' }}
                    <Icon :name="isCollapsed(`team_${ti}_char_${ci}`) ? 'ui.chevronDown' : 'ui.chevronUp'" size="sm" bold />
                  </Btn>
                </div>
              </div>

              <div v-show="!isCollapsed(`team_${ti}_char_${ci}`)" class="grid grid-cols-1 gap-2">
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

                <div class="grid grid-cols-1 gap-2 border-l border-line-2 pl-3">
                  <div :class="HEAD">
                    <span class="text-xs text-muted">备选角色（{{ team.chars[ci].alts.length }}/4）</span>
                    <Btn size="sm" @click="addAlt(ti, ci)">添加</Btn>
                  </div>

                  <div v-for="(alt, ai) in team.chars[ci].alts" :key="ai" class="flex items-center gap-2">
                    <button
                      type="button"
                      :class="THUMB_SM"
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
                        <template #icon><Icon name="ui.arrowUp" size="sm" /></template>
                      </Btn>
                      <Btn size="sm" square aria-label="下移" :disabled="ai === team.chars[ci].alts.length - 1" @click="moveAlt(ti, ci, ai, 1)">
                        <template #icon><Icon name="ui.arrowDown" size="sm" /></template>
                      </Btn>
                      <Btn size="sm" variant="danger" square :class="DEL" aria-label="删除备选" @click="removeAlt(ti, ci, ai)">
                        <template #icon><Icon name="ui.trash" size="sm" /></template>
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
            </div>
          </div>
        </div>
      </section>
    </main>

    <DockCta :loading="exporting" @click="exportPng">导出图片</DockCta>

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

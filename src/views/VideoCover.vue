<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import Btn from '../components/Btn.vue'
import DockCta from '../components/DockCta.vue'
import Dropdown from '../components/Dropdown.vue'
import Field from '../components/Field.vue'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import PreviewFrame from '../components/PreviewFrame.vue'
import Radios from '../components/Radios.vue'
import Seg from '../components/Seg.vue'
import Slider from '../components/Slider.vue'
import { useToast } from '../composables/useToast.js'
import * as fonts from '../lib/fonts.js'
import * as cover from '../lib/videoCover.js'

const { W, H, LOGO } = cover
const toast = useToast()

/* 整份状态就一个对象：存档、导入导出、旧配置兼容都靠它字段名与旧版一致 */
const s = reactive(cover.fresh())
const dicts = reactive({ orders: {}, art: {}, namecards: {}, logos: [] })

const svgEl = ref(null)
const bgImg = ref(null)

/* 模糊/亮度滑杆带动 3840×2160 的模糊运算，预览等 80ms 再跟 */
const heavy = ref({ blur: s.midBlur, brightness: s.midBrightness })
let heavyTimer = 0

watch(
  () => [s.midBlur, s.midBrightness],
  () => {
    clearTimeout(heavyTimer)
    heavyTimer = setTimeout(() => {
      heavy.value = { blur: s.midBlur, brightness: s.midBrightness }
    }, 80)
  },
)

const strip = computed(() =>
  bgImg.value ? cover.blurStrip(bgImg.value, heavy.value.blur, heavy.value.brightness) : '',
)

/* 换背景图 / 换配置都要重新读一次图，几何全靠它的原始宽高 */
async function reloadBg() {
  cover.resetBlurCache()
  bgImg.value = s.bg ? await cover.loadImage(s.bg) : null
}

/* ------------------------------------------------------------------ 几何 */

const viewBox = `0 0 ${W} ${H}`
const font = computed(() => cover.fontFamily(s.fontName))
const cap = computed(() => cover.capsule(s))
const capText = computed(() => cover.capsuleText(s))
const guides = computed(() => cover.guideLines(s))
const sig = computed(() => cover.signature(s))

const placed = computed(() =>
  cover.collectFloats(s).map((o) => {
    const geo = cover.floatGeom(o)
    return { ...o, geo, radius: cover.floatRadius(o, geo) }
  }),
)
const lower = computed(() => placed.value.filter((f) => f.underMiddle))
const upper = computed(() => placed.value.filter((f) => !f.underMiddle))

const mainPlaced = computed(() =>
  cover.mainLines(s).map((text, i) => ({ text, y: s.mainY + i * s.mainLineGap })),
)

const subPlaced = computed(() => {
  const arr = cover.subLines(s)
  return arr.map((line, i) => ({ ...line, y: cover.subY(s, arr.length, i) }))
})

/* ------------------------------------------------------------------ 模式 */

const mode = computed({
  get: () => s.guideType,
  set: (value) => {
    if (value === s.guideType) return
    pendingMode.value = value
    askMode.value = true
  },
})

const askMode = ref(false)
const pendingMode = ref('')
const modeLabels = cover.MODE_SUB_LABELS

const modeMessage = computed(() => {
  const lost = cover.lostOnSwitch(s)
  const tail = lost.length ? ` 同时会清空：${lost.join('、')}。` : ''
  return `切换到「${cover.MODE_LABEL[pendingMode.value] ?? pendingMode.value}」后，主标题、副标题、胶囊标签会按新模式重置。${tail}`
})

async function confirmMode() {
  askMode.value = false
  if (!pendingMode.value) return
  cover.applyMode(s, pendingMode.value)
  pendingMode.value = ''
  await reloadBg()
}

/* 副标题两行的标签随模式变；角色模式下第一行是自动编号，只读 */
const sub1Label = computed(() => (modeLabels[s.guideType] ?? modeLabels.custom).sub1)
const sub2Label = computed(() => (modeLabels[s.guideType] ?? modeLabels.custom).sub2)
const sub1Readonly = computed(() => s.guideType === 'character')

/* ------------------------------------------------------------------ 背景图 */

const bgLabel = computed(() => (s.bg ? '已载入背景图（点击更换）' : '点击上传背景图'))

async function pickBg(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    s.bg = await readAsDataURL(file)
  } catch (err) {
    toast.error(err.message)
    return
  }
  await reloadBg()
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

/* ------------------------------------------------------------------ 名字匹配 */

/* 角色模式：第二行填角色名 → 自动补编号、立绘、名片图 */
async function matchCharacter() {
  const name = s.sub2.trim()
  s.sub2 = name

  if (!name) {
    s.sub1 = ''
    s.characterArt = null
    s.bg = ''
    await reloadBg()
    return
  }

  s.sub1 = cover.characterNo(dicts, name)

  const art = cover.artOf(dicts, name)
  if (art) {
    const img = await cover.loadImage(art)
    s.characterArt = img ? { url: art, w: img.width, h: img.height } : null
    if (!img) toast.error(`立绘加载失败：${art}`)
  } else {
    s.characterArt = null
  }

  s.bg = cover.namecardOf(dicts, name)
  await reloadBg()
}

/* Boss 模式：第一行填 Boss 名 → 自动补怪物图标 */
async function matchBoss() {
  const name = s.sub1.trim()
  s.sub1 = name

  if (!name) {
    s.bossAvatar = null
    return
  }

  try {
    const url = await cover.findMonsterIcon(name)
    if (!url) {
      s.bossAvatar = null
      toast.error(`未找到「${name}」的怪物图标`)
      return
    }
    const img = await cover.loadImage(url)
    if (!img) throw new Error('图标解码失败')
    s.bossAvatar = { url, w: img.width, h: img.height }
  } catch (err) {
    s.bossAvatar = null
    toast.error(`图标加载失败：${err.message}`)
  }
}

/* ------------------------------------------------------------------ 浮动素材 */

const floatInput = ref(null)
const replacingId = ref('')

function addFloat() {
  replacingId.value = ''
  floatInput.value?.click()
}

function replaceFloat(id) {
  replacingId.value = id
  floatInput.value?.click()
}

async function onFloatFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return

  let url
  let img
  try {
    url = await readAsDataURL(file)
    img = await cover.loadImage(url)
    if (!img) throw new Error('图片无法解析')
  } catch (err) {
    toast.error(err.message)
    return
  }

  const id = replacingId.value
  const target = id && s.floatImg.find((o) => o.id === id)
  if (target) {
    target.url = url
    target.w = img.width
    target.h = img.height
  } else {
    s.floatImg.push({
      id: 'f_' + Date.now(),
      url,
      w: img.width,
      h: img.height,
      x: W * 0.75,
      scale: 1,
      rounded: 0,
      underMiddle: true,
    })
  }
  replacingId.value = ''
}

function moveFloat(i, dir) {
  const j = i + dir
  if (j < 0 || j >= s.floatImg.length) return
  const arr = s.floatImg
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

/* ------------------------------------------------------------------ 字体 */

const fontList = ref([])
const fontFile = ref('')
const loaded = ref('')
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

watch(fontFile, async (file) => {
  if (file === loaded.value) return

  if (!file) {
    fonts.dropFont()
    loaded.value = ''
    s.fontData = ''
    s.fontName = ''
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
    loaded.value = file
    fontStatus.value = ''
  } catch (err) {
    fonts.dropFont()
    loaded.value = ''
    s.fontData = ''
    s.fontName = ''
    fontStatus.value = 'error'
    toast.error(`字体 [${item.name}] 加载失败：${err.message}`)
  }
})

/* ------------------------------------------------------------------ Logo */

const logoFile = computed({
  get: () => cover.logoFileOf(s.capLogo),
  set: (file) => {
    s.capLogo = file ? cover.logoUrl(file) : ''
  },
})

const logoOptions = computed(() => dicts.logos.map((l) => ({ value: l.file, label: l.name })))

/* ------------------------------------------------------------------ 导出 / 配置 */

const exporting = ref(false)
const embedFont = ref(false)
const importInput = ref(null)

const embedFontCss = computed(() => fonts.fontFaceCss(s.fontName, s.fontData))

async function exportPng() {
  const svg = svgEl.value
  if (!svg || exporting.value) return
  exporting.value = true

  try {
    await document.fonts?.ready
    /* 导出的 SVG 是独立文档，摸不到页面的 document.fonts，字体必须内嵌。
       只在导出的这一瞬间挂上，预览里就不必把同一份字体再解析一遍。 */
    if (s.fontName && s.fontData) {
      embedFont.value = true
      await nextTick()
      await document.fonts?.ready
    }

    const blob = await cover.svgToPng(svg)
    if (!blob) throw new Error('画布导出失败')
    cover.download(blob, cover.pngName(s))
    toast.success('导出成功')
  } catch (err) {
    toast.error(`导出失败：${err.message}`)
  } finally {
    embedFont.value = false
    exporting.value = false
  }
}

function exportJson() {
  const { text, filename } = cover.exportConfig(s)
  cover.download(new Blob([text], { type: 'application/json' }), filename)
}

async function importJson(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return

  try {
    const raw = JSON.parse(await file.text())
    Object.assign(s, cover.normalizeImported(raw, s))

    if (s.fontFileName) fontFile.value = s.fontFileName
    if (s.fontName && s.fontData) {
      if (!(await fonts.installFont({ name: s.fontName, data: s.fontData }))) {
        s.fontData = ''
        s.fontName = ''
      } else {
        loaded.value = s.fontFileName
      }
    }

    if (!s.capLogo && dicts.logos.length) s.capLogo = cover.logoUrl(dicts.logos[0].file)
    await reloadBg()
    toast.success('配置导入成功')
  } catch (err) {
    toast.error(`导入失败：${err.message}`)
  }
}

/* ------------------------------------------------------------------ 清空 */

const askClear = ref(false)

async function clearAll() {
  askClear.value = false
  Object.assign(s, cover.fresh())
  fonts.dropFont()
  fontFile.value = ''
  loaded.value = ''
  fontStatus.value = ''
  pendingMode.value = ''
  if (dicts.logos.length) s.capLogo = cover.logoUrl(dicts.logos[0].file)
  await reloadBg()
  await cover.clearSaved()
}

/* ------------------------------------------------------------------ 启动 */

watch(s, () => cover.save(s), { deep: true })

onMounted(async () => {
  Object.assign(dicts, await cover.loadData())

  try {
    fontList.value = await fonts.fetchFontList()
  } catch (err) {
    toast.error(err.message)
  }

  const saved = await cover.loadSaved()
  if (saved) Object.assign(s, saved)

  if (!s.capLogo && dicts.logos.length) s.capLogo = cover.logoUrl(dicts.logos[0].file)

  if (s.fontFileName && s.fontData) {
    if (await fonts.installFont({ name: s.fontName, data: s.fontData })) {
      loaded.value = s.fontFileName
      fontFile.value = s.fontFileName
    } else {
      s.fontData = ''
      s.fontName = ''
    }
  }

  /* 角色 / Boss 模式的主标题与标签是模式自带的，与旧版一致 */
  if (s.guideType === 'character' || s.guideType === 'boss') {
    s.mainText = cover.MODE_MAIN_TEXTS[s.guideType]
    s.capText = cover.MODE_CAP_TEXT[s.guideType]
  }

  await reloadBg()
})
</script>

<template>
  <div class="relative grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)]">
    <div class="grid grid-cols-1 border-b border-line bg-canvas p-3">
      <PreviewFrame>
        <svg
          ref="svgEl"
          :viewBox="viewBox"
          class="block size-full"
          :font-family="font"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <!-- 导出的 SVG 是独立文档，字体只能内嵌；预览时这段不存在 -->
            <style v-if="embedFont" v-text="embedFontCss" />

            <linearGradient id="midMask" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#fff" />
              <stop offset="40%" stop-color="#fff" />
              <stop offset="60%" stop-color="#000" />
              <stop offset="100%" stop-color="#000" />
            </linearGradient>
            <mask id="midMaskUse">
              <rect x="0" y="0" :width="W" :height="H" fill="url(#midMask)" />
            </mask>

            <clipPath v-if="s.capLogo" id="logoClip">
              <rect
                :x="cap.logoX"
                :y="cap.logoY"
                :width="LOGO.size"
                :height="LOGO.size"
                :rx="LOGO.radius"
                :ry="LOGO.radius"
              />
            </clipPath>

            <filter id="capShadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow
                :dx="cap.r * 0.18"
                :dy="cap.r * 0.18"
                stdDeviation="0"
                flood-color="#000000"
                flood-opacity="0.5"
              />
            </filter>

            <!-- 胶囊文字挖背景时，亮度靠 feComponentTransfer 调 -->
            <filter
              v-if="capText.pattern && capText.k !== 1"
              id="capBrightFilter"
              x="0"
              y="0"
              width="100%"
              height="100%"
            >
              <feComponentTransfer>
                <feFuncR type="linear" :slope="capText.k" />
                <feFuncG type="linear" :slope="capText.k" />
                <feFuncB type="linear" :slope="capText.k" />
              </feComponentTransfer>
            </filter>

            <pattern
              v-if="capText.pattern"
              id="capTextPattern"
              patternUnits="userSpaceOnUse"
              x="0"
              y="0"
              :width="W"
              :height="H"
            >
              <image
                :href="s.bg"
                x="0"
                y="0"
                :width="W"
                :height="H"
                preserveAspectRatio="xMidYMid slice"
                :filter="capText.k !== 1 ? 'url(#capBrightFilter)' : undefined"
              />
            </pattern>

            <clipPath v-for="f in placed" :key="f.id" :id="`fclip-${f.id}`">
              <rect
                :x="f.geo.x"
                :y="f.geo.y"
                :width="f.geo.w"
                :height="f.geo.h"
                :rx="f.radius"
                :ry="f.radius"
              />
            </clipPath>
          </defs>

          <!-- 背景 -->
          <image
            v-if="s.bg"
            :href="s.bg"
            x="0"
            y="0"
            :width="W"
            :height="H"
            preserveAspectRatio="xMidYMid slice"
          />
          <rect v-else :width="W" :height="H" fill="#1c1c22" />

          <!-- 中层以下 -->
          <image
            v-for="f in lower"
            :key="f.id"
            :data-float-id="f.id"
            :href="f.url"
            :x="f.geo.x"
            :y="f.geo.y"
            :width="f.geo.w"
            :height="f.geo.h"
            preserveAspectRatio="xMidYMid meet"
            :clip-path="`url(#fclip-${f.id})`"
          />

          <!-- 模糊条：右半张盖住，供文字压在上面 -->
          <g v-if="strip" mask="url(#midMaskUse)">
            <image
              :href="strip"
              x="0"
              y="0"
              :width="W"
              :height="H"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>

          <!-- 中层以上 -->
          <image
            v-for="f in upper"
            :key="f.id"
            :data-float-id="f.id"
            :href="f.url"
            :x="f.geo.x"
            :y="f.geo.y"
            :width="f.geo.w"
            :height="f.geo.h"
            preserveAspectRatio="xMidYMid meet"
            :clip-path="`url(#fclip-${f.id})`"
          />

          <!-- 胶囊标签 -->
          <g filter="url(#capShadow)">
            <path :d="cap.path" fill="#ffffff" />
            <image
              v-if="s.capLogo"
              :href="s.capLogo"
              :x="cap.logoX"
              :y="cap.logoY"
              :width="LOGO.size"
              :height="LOGO.size"
              preserveAspectRatio="xMidYMid slice"
              clip-path="url(#logoClip)"
            />
            <text
              :x="cap.textRightX"
              :y="cap.textBaseline"
              :font-size="s.capFontSize"
              :fill="capText.fill"
              text-anchor="end"
            >
              {{ s.capText }}
            </text>
          </g>

          <!-- 主标题 -->
          <g>
            <template v-for="(line, i) in mainPlaced" :key="i">
              <text
                :x="s.mainX + 12"
                :y="line.y + 12"
                :font-size="s.mainSize"
                fill="#000000"
                opacity="0.5"
              >
                {{ line.text }}
              </text>
              <text :x="s.mainX" :y="line.y" :font-size="s.mainSize" :fill="s.mainColor">
                {{ line.text }}
              </text>
            </template>
          </g>

          <!-- 副标题 -->
          <g>
            <template v-for="line in subPlaced" :key="line.key">
              <text
                :x="s.subX + 12"
                :y="line.y + 12"
                :font-size="line.size"
                fill="#000000"
                opacity="0.5"
              >
                {{ line.text }}
              </text>
              <text :x="s.subX" :y="line.y" :font-size="line.size" :fill="s.subColor">
                {{ line.text }}
              </text>
            </template>
          </g>

          <!-- 签名栏 -->
          <g>
            <text
              :x="sig.leftX + 12"
              :y="sig.baseline + 12"
              :font-size="s.sigSize"
              fill="#000000"
              opacity="0.5"
            >
              {{ sig.left }}
            </text>
            <text :x="sig.leftX" :y="sig.baseline" :font-size="s.sigSize" :fill="s.sigColor">
              {{ sig.left }}
            </text>

            <text
              :x="sig.starX + 12"
              :y="sig.baseline + 12"
              :font-size="sig.starSize"
              fill="#000000"
              opacity="0.5"
              text-anchor="middle"
            >
              {{ sig.star }}
            </text>
            <text
              :x="sig.starX"
              :y="sig.baseline"
              :font-size="sig.starSize"
              :fill="s.sigColor"
              text-anchor="middle"
            >
              {{ sig.star }}
            </text>

            <text
              :x="sig.rightX + 12"
              :y="sig.baseline + 12"
              :font-size="s.sigSize"
              fill="#000000"
              opacity="0.5"
            >
              {{ sig.right }}
            </text>
            <text :x="sig.rightX" :y="sig.baseline" :font-size="s.sigSize" :fill="s.sigColor">
              {{ sig.right }}
            </text>
          </g>

          <!-- 安全区参考线 -->
          <g v-if="guides.length" pointer-events="none">
            <line
              v-for="x in guides"
              :key="x"
              :x1="x"
              y1="0"
              :x2="x"
              :y2="H"
              stroke="#888888"
              stroke-width="2"
              stroke-dasharray="12 12"
              opacity="0.5"
              vector-effect="non-scaling-stroke"
            />
          </g>
        </svg>

        <template #toolbar>
          <!-- 底下是什么颜色不知道，所以用 float 变体；危险靠图标变红 -->
          <Btn
            variant="float"
            size="md"
            square
            :aria-pressed="s.showGuides"
            aria-label="参考线"
            title="参考线"
            @click.stop="s.showGuides = !s.showGuides"
          >
            <template #icon><Icon name="ui.guides" /></template>
          </Btn>

          <Btn
            variant="float"
            size="md"
            square
            aria-label="导出配置"
            title="导出配置"
            @click.stop="exportJson"
          >
            <template #icon><Icon name="ui.export" /></template>
          </Btn>

          <Btn
            variant="float"
            size="md"
            square
            aria-label="导入配置"
            title="导入配置"
            @click.stop="importInput?.click()"
          >
            <template #icon><Icon name="ui.import" /></template>
          </Btn>

          <Btn
            variant="float"
            size="md"
            square
            aria-label="清空"
            title="清空"
            @click.stop="askClear = true"
          >
            <template #icon><Icon name="ui.trash" class="text-danger" /></template>
          </Btn>

          <input
            ref="importInput"
            type="file"
            accept=".json,application/json"
            class="sr-only"
            @change="importJson"
          />
        </template>
      </PreviewFrame>
    </div>

    <main class="grid min-h-0 grid-cols-1 content-start gap-4 overflow-y-auto p-3 pb-24">
      <!-- ① 攻略模式 -->
      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">攻略模式</h2>
        <Seg v-model="mode" :options="cover.MODE_OPTIONS" full />

        <div
          v-if="s.guideType === 'character'"
          class="rounded-panel border border-line bg-surface p-3"
        >
          <Slider v-model="s.characterX" label="立绘 X 位置" :min="0" :max="W" unit="px" />
        </div>

        <div v-if="s.guideType === 'custom'" class="rounded-panel border border-line bg-surface p-3">
          <div class="mb-3 flex items-center justify-between gap-2">
            <span class="text-xs text-muted">浮动素材</span>
            <Btn variant="secondary" size="sm" square aria-label="添加浮动素材" @click="addFloat">
              <template #icon><Icon name="ui.plus" /></template>
            </Btn>
          </div>

          <p v-if="!s.floatImg.length" class="py-4 text-center text-xs text-muted">
            还没有浮动素材，点右上角加号添加
          </p>

          <div v-else class="grid grid-cols-1 gap-2">
            <div
              v-for="(f, i) in s.floatImg"
              :key="f.id"
              class="grid grid-cols-1 gap-3 rounded-ctl border border-line-2 bg-canvas p-3"
            >
              <div class="flex items-center gap-2">
                <img
                  :src="f.url"
                  alt=""
                  class="size-9 shrink-0 cursor-pointer rounded-ctl border border-line-2 object-cover"
                  title="点击更换图片"
                  @click="replaceFloat(f.id)"
                />
                <span class="min-w-0 flex-1 truncate text-xs text-muted">{{ f.w }}×{{ f.h }}</span>

                <Btn
                  variant="secondary"
                  size="sm"
                  square
                  aria-label="上移"
                  :disabled="i === 0"
                  @click="moveFloat(i, -1)"
                >
                  <template #icon><Icon name="ui.arrowUp" /></template>
                </Btn>
                <Btn
                  variant="secondary"
                  size="sm"
                  square
                  aria-label="下移"
                  :disabled="i === s.floatImg.length - 1"
                  @click="moveFloat(i, 1)"
                >
                  <template #icon><Icon name="ui.arrowDown" /></template>
                </Btn>
                <Btn
                  variant="secondary"
                  size="sm"
                  square
                  aria-label="删除"
                  @click="s.floatImg.splice(i, 1)"
                >
                  <template #icon><Icon name="ui.trash" class="text-danger" /></template>
                </Btn>
              </div>

              <Slider v-model="f.x" label="X 位置" :min="0" :max="W" unit="px" />
              <Slider
                :model-value="Math.round(f.scale * 100)"
                label="缩放"
                :min="10"
                :max="200"
                unit="%"
                @update:model-value="f.scale = $event / 100"
              />
              <Slider v-model="f.rounded" label="圆角" :min="0" :max="100" unit="%" />

              <label class="flex cursor-pointer items-center gap-2 text-xs text-muted">
                <input
                  v-model="f.underMiddle"
                  type="checkbox"
                  class="size-4 shrink-0 accent-accent"
                />
                置于中层背景下方
              </label>
            </div>
          </div>

          <input
            ref="floatInput"
            type="file"
            accept="image/*"
            class="sr-only"
            @change="onFloatFile"
          />
        </div>
      </section>

      <!-- ② 画布背景 -->
      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">画布背景</h2>
        <div class="grid grid-cols-1 gap-3 rounded-panel border border-line bg-surface p-3">
          <label
            class="grid min-h-9 cursor-pointer grid-cols-[auto_1fr] items-center gap-3 rounded-ctl focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent"
          >
            <img
              v-if="s.bg"
              :src="s.bg"
              alt=""
              class="size-9 rounded-ctl border border-line-2 object-cover"
            />
            <span
              v-else
              class="size-9 rounded-ctl border border-dashed border-line-2 bg-canvas"
              aria-hidden="true"
            ></span>

            <span class="min-w-0 truncate text-xs" :class="s.bg ? 'text-body' : 'text-muted'">
              {{ bgLabel }}
            </span>

            <input type="file" accept="image/*" class="sr-only" @change="pickBg" />
          </label>

          <Slider v-model="s.midBrightness" label="背景亮度" :min="-100" :max="100" unit="%" />
          <Slider v-model="s.midBlur" label="背景模糊" :min="0" :max="100" unit="%" />
        </div>
      </section>

      <!-- ③ 主标题（自定义模式才有） -->
      <section v-if="s.guideType === 'custom'" class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">主标题</h2>
        <div class="rounded-panel border border-line bg-surface p-3">
          <Field
            v-model="s.mainText"
            type="textarea"
            :rows="2"
            placeholder="输入主标题（支持回车两行）"
          />
        </div>
      </section>

      <!-- ④ 副标题 -->
      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">副标题</h2>
        <div class="grid grid-cols-1 gap-3 rounded-panel border border-line bg-surface p-3">
          <Field
            v-model="s.sub1"
            :label="sub1Label"
            :placeholder="sub1Readonly ? '自动生成' : '第一行文字'"
            :readonly="sub1Readonly"
            @blur="s.guideType === 'boss' && matchBoss()"
          />

          <Radios
            v-if="s.guideType === 'custom'"
            :model-value="String(s.sub1Size)"
            label="第一行字号"
            :options="cover.SUB_SIZE_OPTIONS"
            @update:model-value="s.sub1Size = Number($event)"
          />

          <Field
            v-model="s.sub2"
            :label="sub2Label"
            placeholder="第二行文字"
            @blur="s.guideType === 'character' && matchCharacter()"
          />

          <Radios
            v-if="s.guideType === 'custom'"
            :model-value="String(s.sub2Size)"
            label="第二行字号"
            :options="cover.SUB_SIZE_OPTIONS"
            @update:model-value="s.sub2Size = Number($event)"
          />
        </div>
      </section>

      <!-- ⑤ 胶囊标签 -->
      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">胶囊标签</h2>
        <div class="grid grid-cols-1 gap-3 rounded-panel border border-line bg-surface p-3">
          <Field
            v-if="s.guideType === 'custom'"
            v-model="s.capText"
            label="标签文字"
            placeholder="如：攻略 / 速刷"
          />
          <Slider v-model="s.capTextBrightness" label="文字亮度" :min="0" :max="200" unit="%" />
        </div>
      </section>

      <!-- ⑥ 字体 -->
      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">字体（仅作用于导出图片）</h2>
        <div class="flex items-center gap-2.5 rounded-panel border border-line bg-surface p-3">
          <span class="grid size-5 shrink-0 place-items-center text-muted" aria-hidden="true">
            <Icon name="ui.textFont" size="sm" />
          </span>
          <p class="min-w-0 flex-1 truncate text-xs text-muted">{{ fontLabel }}</p>
          <div class="w-32 shrink-0">
            <Dropdown
              v-model="fontFile"
              :options="fontOptions"
              label="选择字体"
              placeholder="选择字体"
            />
          </div>
        </div>
      </section>

      <!-- ⑦ 游戏 Logo -->
      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">游戏 Logo</h2>
        <div class="flex items-center gap-3 rounded-panel border border-line bg-surface p-3">
          <img
            v-if="s.capLogo"
            :src="s.capLogo"
            alt=""
            class="size-9 shrink-0 rounded-ctl border border-line-2 object-cover"
          />
          <span
            v-else
            class="size-9 shrink-0 rounded-ctl border border-dashed border-line-2 bg-canvas"
            aria-hidden="true"
          ></span>
          <!-- ml-auto：推开到右边；宽度只到装得下一个名字 -->
          <div class="ml-auto w-32 shrink-0">
            <Dropdown
              v-model="logoFile"
              :options="logoOptions"
              label="游戏 Logo"
              placeholder="选择 Logo"
            />
          </div>
        </div>
      </section>
    </main>

    <DockCta :loading="exporting" @click="exportPng">导出图片</DockCta>

    <Modal
      v-model="askMode"
      title="切换攻略模式"
      :message="modeMessage"
      @confirm="confirmMode"
      @cancel="pendingMode = ''"
    />

    <Modal
      v-model="askClear"
      title="清空配置"
      message="确定清空视频封面所有配置吗？"
      danger
      @confirm="clearAll"
    />
  </div>
</template>

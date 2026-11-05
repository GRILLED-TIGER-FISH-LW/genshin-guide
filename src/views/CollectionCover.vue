<script setup>
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import Btn from '../components/Btn.vue'
import DockCta from '../components/DockCta.vue'
import Dropdown from '../components/Dropdown.vue'
import Field from '../components/Field.vue'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import PreviewFrame from '../components/PreviewFrame.vue'
import { useToast } from '../composables/useToast.js'
import * as cover from '../lib/collectionCover.js'

const toast = useToast()

const cv = ref(null)
const title = ref('')
const subtitle = ref('')
const bg = ref('')
const fontList = ref([])

/* fontFile 是「选了哪个」，loaded 是「装进 document.fonts 的是哪个」。
   两者分开，才不用把状态塞进 DOM 里再读回来。 */
const fontFile = ref('')
const loaded = ref('')
const fontData = ref('')
const fontStatus = ref('') /* '' | 'loading' | 'error' */

const askClear = ref(false)
const exporting = ref(false)

let bgImg = null

const fontItem = computed(() => fontList.value.find((f) => f.file === loaded.value) || null)

const fontLabel = computed(() => {
  if (fontStatus.value === 'loading') return '正在加载…'
  if (fontStatus.value === 'error') return '字体加载失败，重新选一个即可'
  return fontItem.value ? `当前：${fontItem.value.name}` : '默认系统字体'
})

const fontOptions = computed(() => [
  { value: '', label: '默认系统字体' },
  ...fontList.value.map((f) => ({ value: f.file, label: f.name })),
])

/* 快速输入时丢弃过期的那一次绘制 */
let seq = 0

async function render() {
  const el = cv.value
  if (!el) return
  const my = ++seq
  /* 字体还在解析时 document.fonts 没就绪，画出来会是回退字体 */
  try {
    await document.fonts?.ready
  } catch {
    /* 老浏览器没有 fonts.ready，直接画 */
  }
  if (my !== seq) return

  cover.drawCover(el, {
    bgImg,
    key: bg.value,
    title: title.value,
    subtitle: subtitle.value,
    fontName: fontItem.value?.name ?? '',
  })
}

function persist() {
  cover.save({
    bg: bg.value,
    title: title.value,
    subtitle: subtitle.value,
    fontFileName: loaded.value,
    fontName: fontItem.value?.name ?? '',
    fontData: fontData.value,
  })
}

/* ------------------------------------------------------------------ 背景图 */

async function pickBg(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return

  let data
  try {
    data = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('读取图片失败'))
      reader.readAsDataURL(file)
    })
  } catch (err) {
    toast.error(err.message)
    return
  }

  bg.value = data
  bgImg = await cover.loadImage(data)
  if (!bgImg) toast.error('图片无法解析，换一张试试')
  await render()
  persist()
}

/* ------------------------------------------------------------------ 字体 */

watch(fontFile, async (file) => {
  if (file === loaded.value) return

  if (!file) {
    cover.dropFont()
    loaded.value = ''
    fontData.value = ''
    fontStatus.value = ''
    await render()
    persist()
    return
  }

  const item = fontList.value.find((f) => f.file === file)
  if (!item) return

  fontStatus.value = 'loading'
  try {
    const data = await cover.fetchFontData(file)
    if (!(await cover.installFont({ name: item.name, data }))) throw new Error('字体解析失败')
    fontData.value = data
    loaded.value = file
    fontStatus.value = ''
  } catch (err) {
    cover.dropFont()
    loaded.value = ''
    fontData.value = ''
    fontStatus.value = 'error'
    toast.error(`字体 [${item.name}] 加载失败：${err.message}`)
  }

  await render()
  persist()
})

/* ------------------------------------------------------------------ 导出 */

async function exportPng() {
  const el = cv.value
  if (!el || exporting.value) return
  exporting.value = true

  try {
    await render()
    const blob = await cover.toPng(el)
    if (!blob) throw new Error('画布导出失败')
    if (blob.size > 5 * 1024 * 1024) throw new Error('图片超过 5MB，请降低分辨率')

    cover.download(blob, cover.pngName(title.value))
    toast.success('导出成功')
  } catch (err) {
    toast.error(`导出失败：${err.message}`)
  } finally {
    exporting.value = false
  }
}

/* ------------------------------------------------------------------ 清空 */

async function clearAll() {
  askClear.value = false
  title.value = ''
  subtitle.value = ''
  bg.value = ''
  bgImg = null
  fontFile.value = ''
  loaded.value = ''
  fontData.value = ''
  fontStatus.value = ''
  cover.resetBgCache()
  cover.dropFont()
  await render()
  persist()
}

/* ------------------------------------------------------------------ 启动 */

watch([title, subtitle, loaded], render)

onMounted(async () => {
  try {
    fontList.value = await cover.fetchFontList()
  } catch (err) {
    toast.error(err.message)
  }

  const saved = await cover.loadSaved()
  if (saved) {
    title.value = saved.title ?? ''
    subtitle.value = saved.subtitle ?? ''
    bg.value = saved.bg ?? ''
    fontData.value = saved.fontData ?? ''

    if (bg.value) bgImg = await cover.loadImage(bg.value)
    if (saved.fontFileName && fontData.value) {
      const item = fontList.value.find((f) => f.file === saved.fontFileName)
      /* 装得上就沿用，装不上就当默认字体，不打扰用户 */
      if (item && (await cover.installFont({ name: item.name, data: fontData.value }))) {
        loaded.value = saved.fontFileName
        fontFile.value = saved.fontFileName
      } else {
        fontData.value = ''
      }
    }
  }

  await render()
})

/* KeepAlive 会保留实例，但切回来时补一次绘制最稳 */
onActivated(render)
</script>

<template>
  <div class="relative grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)]">
    <!-- 预览固定在顶部，只有表单区滚动 -->
    <div class="grid grid-cols-1 border-b border-line bg-canvas p-3">
      <PreviewFrame>
        <canvas ref="cv" class="block size-full" />

        <p
          v-if="!bg"
          class="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-white/50"
        >
          还没上传背景图，先在下面选一张
        </p>

        <template #toolbar>
          <Btn
            variant="danger"
            size="md"
            square
            aria-label="清空合集封面"
            title="清空"
            @click.stop="askClear = true"
          >
            <template #icon><Icon name="ui.trash" /></template>
          </Btn>
        </template>
      </PreviewFrame>
    </div>

    <!-- pb-24 给悬浮导出按钮让位，否则最后一段会被压在下面 -->
    <main class="grid min-h-0 grid-cols-1 content-start gap-4 overflow-y-auto p-3 pb-24">
      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">画布</h2>
        <div class="rounded-panel border border-line bg-surface p-3">
          <label
            class="grid min-h-9 cursor-pointer grid-cols-[auto_1fr] items-center gap-3 rounded-ctl focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent"
          >
            <img
              v-if="bg"
              :src="bg"
              alt=""
              class="size-9 rounded-ctl border border-line-2 object-cover"
            />
            <span
              v-else
              class="size-9 rounded-ctl border border-dashed border-line-2 bg-canvas"
              aria-hidden="true"
            ></span>

            <span class="min-w-0 truncate text-xs" :class="bg ? 'text-body' : 'text-muted'">
              {{ bg ? '已载入背景图（点击更换）' : '点击上传背景图' }}
            </span>

            <input type="file" accept="image/*" class="sr-only" @change="pickBg" />
          </label>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">文字内容</h2>
        <div class="grid grid-cols-1 gap-3 rounded-panel border border-line bg-surface p-3">
          <Field
            v-model="title"
            type="textarea"
            :rows="2"
            label="主标题"
            placeholder="输入合集主标题"
          />
          <Field
            v-model="subtitle"
            type="textarea"
            :rows="2"
            label="副标题"
            placeholder="输入合集副标题"
          />
        </div>
      </section>

      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">字体（仅作用于导出图片）</h2>
        <div class="flex items-center gap-2.5 rounded-panel border border-line bg-surface p-3">
          <span class="grid size-5 shrink-0 place-items-center text-muted" aria-hidden="true">
            <Icon name="ui.textFont" size="sm" />
          </span>
          <p class="min-w-0 flex-1 truncate text-xs text-muted">{{ fontLabel }}</p>
          <!-- Dropdown 根节点自带 w-full，宽度只能由外面这层容器定 -->
          <div class="w-40 shrink-0">
            <Dropdown
              v-model="fontFile"
              :options="fontOptions"
              label="选择字体"
              placeholder="选择字体"
            />
          </div>
        </div>
      </section>
    </main>

    <!-- 悬浮导出：位置/尺寸全在 DockCta 里，这里只给文案和动作 -->
    <DockCta :loading="exporting" @click="exportPng">导出图片</DockCta>

    <Modal
      v-model="askClear"
      title="清空配置"
      message="确定清空合集封面吗？"
      danger
      @confirm="clearAll"
    />
  </div>
</template>

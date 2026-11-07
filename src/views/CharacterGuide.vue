<script setup>
import { computed, reactive } from 'vue'
import Btn from '../components/Btn.vue'
import Field from '../components/Field.vue'
import PreviewFrame from '../components/PreviewFrame.vue'
import Slider from '../components/Slider.vue'
import { elementColors } from '../lib/guideConsts.js'
import * as guide from '../lib/guideChart.js'

/* 整份状态就一个对象：字段名与旧版一图流逐字一致，旧草稿、旧配置 JSON 都能读进来 */
const s = reactive(guide.fresh())

const svg = computed(() => guide.buildGuideSVG(s))

const isTheme = (color) => s.theme.toLowerCase() === color.toLowerCase()

/* 三个图片槽位。state 字段名 / Meta / Deleted / Manual 全是旧版原样：
   Deleted 与 Manual 记的是「用户手动换过图、手动删过图」，将来自动匹配素材时
   靠它们避免把用户的选择盖掉 —— 别删。 */
const IMG_SLOTS = [
  { key: 'charImg', label: '立绘' },
  { key: 'nameBgImg', label: '元素图' },
  { key: 'bgImg', label: '大背景' },
]
const fileInputs = reactive({})

const pickFile = (key) => fileInputs[key]?.click()

async function onFile(key, e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return

  const dataURL = await readAsDataURL(file)
  s[key] = dataURL
  /* 尺寸一并存下来：绘制那边靠它算等比缩放 */
  s[key + 'Meta'] = await measureImage(dataURL)
  s[key + 'Deleted'] = false
  s[key + 'Manual'] = true
}

function clearImg(key) {
  s[key] = ''
  s[key + 'Deleted'] = true
}

const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

/* 尺寸拿不到就退回 0，绘制那边会按左栏宽度摆 */
const measureImage = (src) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
  img.onerror = () => resolve({ w: 0, h: 0 })
  img.src = src
})
</script>

<template>
  <div class="relative grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)]">
    <div class="grid grid-cols-1 border-b border-line bg-canvas p-3">
      <PreviewFrame>
        <!-- 预览就是导出用的同一段 SVG，整段塞进来 -->
        <div class="grid size-full [&>svg]:size-full" v-html="svg" />
      </PreviewFrame>
    </div>

    <main class="grid min-h-0 grid-cols-1 content-start gap-4 overflow-y-auto p-3 pb-24">
      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">文字</h2>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field v-model="s.charName" label="角色名称" placeholder="如：芙宁娜" />
          <Field v-model="s.version" label="适用版本" placeholder="如：5.4" />
          <Field v-model="s.date" label="制作日期" placeholder="如：2026-11-07" />
          <Field v-model="s.author" label="攻略作者" />
        </div>
      </section>

      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">元素配色</h2>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="[name, color] in elementColors"
            :key="color"
            type="button"
            class="flex h-9 items-center justify-center gap-1.5 rounded-ctl border text-xs transition-colors"
            :class="isTheme(color) ? 'border-ink bg-surface text-ink' : 'border-line text-muted hover:bg-hover'"
            :aria-pressed="isTheme(color)"
            @click="s.theme = color"
          >
            <span class="size-3 shrink-0 rounded-full" :style="{ backgroundColor: color }" aria-hidden="true" />
            {{ name }}
          </button>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">素材</h2>
        <div
          v-for="slot in IMG_SLOTS"
          :key="slot.key"
          class="flex items-center gap-3 rounded-panel border border-line bg-surface p-3"
        >
          <div class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-ctl border border-line bg-thumb">
            <img v-if="s[slot.key]" :src="s[slot.key]" alt="" class="size-full object-contain" />
          </div>
          <div class="grid min-w-0 flex-1 grid-cols-1 gap-2">
            <span class="text-xs font-medium text-ink">{{ slot.label }}</span>
            <div class="flex gap-2">
              <Btn @click="pickFile(slot.key)">{{ s[slot.key] ? '更换' : '上传' }}{{ slot.label }}</Btn>
              <Btn v-if="s[slot.key]" variant="danger" @click="clearImg(slot.key)">删除</Btn>
            </div>
          </div>
          <input
            :ref="(el) => (fileInputs[slot.key] = el)"
            type="file"
            accept="image/*"
            class="sr-only"
            :aria-label="'上传' + slot.label"
            @change="onFile(slot.key, $event)"
          />
        </div>
      </section>

      <section v-if="s.charImg" class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">立绘位置</h2>
        <Slider v-model="s.imgX" label="左右偏移" :min="-400" :max="400" unit="px" />
      </section>
    </main>
  </div>
</template>

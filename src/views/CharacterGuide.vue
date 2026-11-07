<script setup>
import { computed, reactive } from 'vue'
import Btn from '../components/Btn.vue'
import Field from '../components/Field.vue'
import Icon from '../components/Icon.vue'
import PreviewFrame from '../components/PreviewFrame.vue'
import Slider from '../components/Slider.vue'
import { useToast } from '../composables/useToast.js'
import { matchIcon } from '../composables/useIconLib.js'
import { elementColors, WEAPON_LABELS, WEAPON_MAX, WEAPON_ORDER } from '../lib/guideConsts.js'
import * as guide from '../lib/guideChart.js'

/* 整份状态就一个对象：字段名与旧版一图流逐字一致，旧草稿、旧配置 JSON 都能读进来 */
const s = reactive(guide.fresh())
const toast = useToast()

const svg = computed(() => guide.buildGuideSVG(s))
const PLACEHOLDER = guide.placeholder()

const isTheme = (color) => s.theme.toLowerCase() === color.toLowerCase()

/* =========================================================================
 * 大图槽：立绘 / 元素图 / 大背景
 * -------------------------------------------------------------------------
 * state 字段名 / Meta / Deleted / Manual 全是旧版原样：Deleted 与 Manual 记的是
 * 「用户手动换过图、手动删过图」，将来自动匹配素材时靠它们避免盖掉用户的选择。
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

/* 尺寸拿不到就退回 0，绘制那边会按左栏宽度摆 */
const measureImage = (src) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
  img.onerror = () => resolve({ w: 0, h: 0 })
  img.src = src
})

async function onSlotFile(key, e) {
  const url = await fileToDataURL(e)
  if (!url) return
  s[key] = url
  s[key + 'Meta'] = await measureImage(url)
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
            tabindex="-1"
            aria-hidden="true"
            @change="onSlotFile(slot.key, $event)"
          />
        </div>
        <Slider v-if="s.charImg" v-model="s.imgX" label="立绘左右偏移" :min="-400" :max="400" unit="px" />
      </section>

      <section class="grid grid-cols-1 gap-2">
        <h2 class="px-1 text-xs font-medium text-muted">武器推荐</h2>

        <div v-for="type in WEAPON_ORDER" :key="type" class="grid grid-cols-1 gap-2">
          <div class="flex items-center justify-between gap-2 px-1">
            <h3 class="text-xs text-body">{{ WEAPON_LABELS[type] }}（{{ s.weaponData[type].length }}/{{ WEAPON_MAX }}）</h3>
            <Btn size="sm" @click="addWeapon(type)">添加</Btn>
          </div>
          <p v-if="!s.weaponData[type].length" class="px-1 text-xs text-faint">暂无配置</p>

          <div
            v-for="(w, i) in s.weaponData[type]"
            :key="i"
            class="flex items-center gap-2 rounded-panel border border-line bg-surface p-2"
          >
            <button
              type="button"
              class="size-14 shrink-0 overflow-hidden rounded-ctl border border-line bg-thumb"
              :aria-label="`上传第 ${i + 1} 个武器的图标`"
              @click="pickFile(`w:${type}:${i}`)"
            >
              <img :src="w.img || PLACEHOLDER" alt="" class="size-full object-contain" />
            </button>
            <Field
              v-model="w.name"
              label="武器名"
              placeholder="如：静水流涌之辉"
              class="min-w-0 flex-1"
              @blur="matchWeapon(type, i)"
            />
            <div class="flex shrink-0 flex-col gap-1">
              <Btn size="sm" square aria-label="上移" :disabled="!canMoveWeapon(type, i, -1)" @click="moveWeapon(type, i, -1)">
                <Icon name="ui.arrowUp" />
              </Btn>
              <Btn size="sm" square aria-label="下移" :disabled="!canMoveWeapon(type, i, 1)" @click="moveWeapon(type, i, 1)">
                <Icon name="ui.arrowDown" />
              </Btn>
            </div>
            <Btn size="sm" square variant="danger" aria-label="删除武器" @click="removeWeapon(type, i)">
              <Icon name="ui.trash" />
            </Btn>
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

      <section class="grid grid-cols-1 gap-2">
        <div class="flex items-center justify-between gap-2 px-1">
          <h2 class="text-xs font-medium text-muted">圣遗物推荐（{{ s.artifactData.length }}）</h2>
          <div class="flex gap-2">
            <Btn size="sm" @click="addArtifact('single')">整套</Btn>
            <Btn size="sm" @click="addArtifact('double')">散搭</Btn>
          </div>
        </div>
        <p v-if="!s.artifactData.length" class="px-1 text-xs text-faint">暂无配置</p>

        <div
          v-for="(a, i) in s.artifactData"
          :key="i"
          class="grid grid-cols-1 gap-2 rounded-panel border border-line bg-surface p-2"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-ink">{{ a.type === 'double' ? '散搭' : '整套' }} #{{ i + 1 }}</span>
            <div class="flex gap-1">
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
          </div>

          <template v-if="a.type === 'double'">
            <Field v-model="a.displayText" label="卡片显示文本" placeholder="留空则显示两个名字" />
            <div v-for="n in 2" :key="n" class="flex items-center gap-2">
              <button
                type="button"
                class="size-14 shrink-0 overflow-hidden rounded-ctl border border-line bg-thumb"
                :aria-label="`上传散搭第 ${n} 个圣遗物的图标`"
                @click="pickFile(`a:${i}:${n}`)"
              >
                <img :src="a[`img${n}`] || PLACEHOLDER" alt="" class="size-full object-contain" />
              </button>
              <Field
                v-model="a[`name${n}`]"
                label="圣遗物名"
                placeholder="如：深廊终曲的秘仪"
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

          <div v-else class="flex items-center gap-2">
            <button
              type="button"
              class="size-14 shrink-0 overflow-hidden rounded-ctl border border-line bg-thumb"
              :aria-label="`上传第 ${i + 1} 个圣遗物的图标`"
              @click="pickFile(`a:${i}`)"
            >
              <img :src="a.img || PLACEHOLDER" alt="" class="size-full object-contain" />
            </button>
            <Field
              v-model="a.name"
              label="圣遗物名"
              placeholder="如：深廊终曲的秘仪"
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
      </section>
    </main>
  </div>
</template>

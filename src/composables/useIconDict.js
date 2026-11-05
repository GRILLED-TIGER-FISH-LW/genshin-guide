import { computed, reactive, ref } from 'vue'
import { STAR_COLORS } from 'virtual:gg-icon-lib'
import { useToast } from './useToast.js'
import { loadGlobalScript } from './useData.js'

/* =========================================================================
 * 图标字典 · 域逻辑
 * -------------------------------------------------------------------------
 * 从 tools/icon-editor/app.js 搬过来，行为逐条对齐。界面全部在
 * views/IconEditor.vue，这里只管数据。
 *
 * 注意：这不是「字典」本身。字典是 shared/gi-icons/icon-dict.js，
 * 这个文件只是那一个编辑器页面的逻辑（载入 / 合并 / 序列化 / 颜色）。
 *
 * 【绝不能动的东西】
 *   · STORAGE_KEY 与存储结构（换了键 = 用户草稿全丢）
 *   · 导出 icon-dict.js 的逐字格式（它是被两个仓库读的文件）
 *   · 行结构 { key, name, order, star?, local?, url? }
 *   · 星级底色 + 径向渐变：必须与 shared/gi-icons/icon-loader.js 的
 *     applyBackground 一致，否则缩略图底色和已烘焙的图片对不上
 *
 * 【相对旧版的三处有意修改】
 *   1. 「载入」之后 dirty = false（数据刚从仓库来、本来就是干净的）
 *   2. 状态条拆开：条数/筛选是常驻信息行，操作结果走 toast
 *   3. 同步的排除规则分两档（见下），并新增「强制本地条目」
 *
 * 【同步时三类规则，别混】
 *   硬（transformAmber 里把 key 记进 skipped）：
 *       武器 id 非五位数 · 怪物 28 开头 · 官方旅行者男女图
 *       → 不仅不加，还会把本地同名条目一并清掉
 *   软（只 return、不记 skipped）：角色白名单
 *       → 只「不加」。白名单是人手维护的，漏一行不该删本地数据
 *   强制（FORCED_LOCAL）：无论如何都要存在
 *       → 本地没有就补上；本地已有就保持原样，不覆盖你的改动
 *
 *   还要记住合并规则第 3 条：API 没返回的旧条目一律保留（已下架 / 手工新增）。
 *   硬排除是唯一的例外，因为它表达的是「这类东西我们不要」。
 *
 * 【星级底色的前提】
 *   非怪物分类的条目都必须带 star —— 没有 star 就没有底色。
 *   API 来的条目 star 取自 rank；自己写的条目（如 FORCED_LOCAL）要手动写。
 * ========================================================================= */

const STORAGE_KEY = 'icon_dict_editor_v4'
const LOG_KEY = 'genshin_icon_editor_sync_log_v1'
const MAX_LOG = 10
const DICT_SRC = 'shared/gi-icons/icon-dict.js'
const CHARS_SRC = 'shared/data/characters.txt'

const DEFAULT_CONFIG = {
  characters: { prefix: 'https://api.lunaris.moe/data/assets/avataricon/', ext: '.webp' },
  artifacts: { prefix: 'https://api.lunaris.moe/data/assets/artifacts/', ext: '.webp' },
  weapons: { prefix: 'https://api.lunaris.moe/data/assets/weaponicon/', ext: '.webp' },
  monsters: { prefix: 'https://api.lunaris.moe/data/assets/monstericon/', ext: '.png' },
}

const AMBER_ENDPOINTS = {
  characters: 'https://gi.yatta.moe/api/v2/CHS/avatar',
  weapons: 'https://gi.yatta.moe/api/v2/CHS/weapon',
  artifacts: 'https://gi.yatta.moe/api/v2/CHS/reliquary',
  monsters: 'https://gi.yatta.moe/api/v2/CHS/monster',
}

const TYPES = ['characters', 'artifacts', 'weapons', 'monsters']
const LABELS = { characters: '角色', artifacts: '圣遗物', weapons: '武器', monsters: '怪物' }

/* 官方把旅行者拆成男女两张官方图，我们要的是仓库里那张自制的。
   key 是文件名（带扩展名），local: true 时 resolveUrl 会去 shared/gi-icons/ 取。
   图片目录以后若搬家，只改 resolveUrl 里那一处前缀。 */
const OFFICIAL_TRAVELER_RE = /^UI_AvatarIcon_Player(Boy|Girl)/i

/* 同步时必须存在的本地条目。本地已有同 key 的条目就保持原样，不覆盖你的改动。
   star 必须写：没有它就没有星级底色（非怪物分类都该有）。 */
const FORCED_LOCAL = {
  characters: [
    { key: 'UI_AvatarIcon_Traveler.webp', name: '旅行者', order: 1, star: 5, local: true },
  ],
}

/* =========================================================================
 * 颜色：与 shared/gi-icons/icon-loader.js 里的 darken() 逐式相同
 * -------------------------------------------------------------------------
 * 为什么是「抄一份」而不是 import：loader 只把 applyBackground 挂出来了，
 * darken / hexToHsl / hslToHex 都在闭包里。但这段必须是同一个算法 ——
 * 缩略图的边缘色和已烘焙的图片对不上，一眼就能看出来。
 *   底色表来自 virtual:gg-icon-lib（构建期读 loader，单一真源）
 *   渐变的几何两边也等价：canvas 是 r = size × 0.707、两档颜色；
 *   CSS 的 radial-gradient(circle, …) 默认 farthest-corner，正方形下正好 √2/2 × 边长。
 * ========================================================================= */

function hexToHsl(hex) {
  const num = parseInt(String(hex).replace('#', ''), 16)
  const r = ((num >> 16) & 0xff) / 255
  const g = ((num >> 8) & 0xff) / 255
  const b = (num & 0xff) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const toHex = (v) =>
    Math.max(0, Math.min(255, Math.round((v + m) * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/* 保持色相与饱和度，亮度 × (1 - percent)。缩略图边缘固定传 0.5 */
function darkenHex(hex, percent) {
  if (!hex || typeof hex !== 'string' || hex.length !== 7) return '#333333'
  const [h, s, l] = hexToHsl(hex)
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return '#333333'
  return hslToHex(h, s, Math.max(0, l * (1 - percent)))
}

/* =========================================================================
 * 序列化：导出 icon-dict.js 的逐字格式
 * ========================================================================= */

function escJs(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
}

function serializeDict(config, data) {
  const lines = ['window.ICON_DICT = {', '  config: {']

  TYPES.forEach((type, ti) => {
    const cfg = config[type] || DEFAULT_CONFIG[type]
    const tail = ti < TYPES.length - 1 ? ',' : ''
    lines.push(
      `    ${type}: { prefix: "${escJs(cfg.prefix)}", ext: "${escJs(cfg.ext || '')}" }${tail}`,
    )
  })
  lines.push('  },')

  TYPES.forEach((type, ti) => {
    lines.push('', `  /* ============ ${LABELS[type]} ============ */`, `  ${type}: {`)

    const list = data[type]
      .filter((it) => it.key)
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    if (!list.length) lines.push('    // 暂无条目')

    list.forEach((item, i) => {
      const parts = [`name: "${escJs(item.name)}"`]
      if (item.star != null) parts.push(`star: ${item.star}`)
      parts.push(`order: ${item.order || 0}`)
      if (item.local) parts.push('local: true')
      if (item.url) parts.push(`url: "${escJs(item.url)}"`)
      const tail = i < list.length - 1 ? ',' : ''
      lines.push(`    "${escJs(item.key)}": { ${parts.join(', ')} }${tail}`)
    })

    lines.push(`  }${ti < TYPES.length - 1 ? ',' : ''}`)
  })

  lines.push('};', '')
  return lines.join('\n')
}

/* 字典对象 → 行数组。字段顺序与旧版一致 */
function dictToRows(dict, type) {
  const obj = dict[type] || {}
  return Object.keys(obj).map((k) => {
    const item = obj[k] || {}
    const row = { key: k, name: item.name || '', order: item.order || 0 }
    if (item.star != null) row.star = item.star
    if (item.local) row.local = true
    if (item.url) row.url = item.url
    return row
  })
}

function readLog() {
  try {
    const arr = JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/* ========================================================================= */

export function useIconDict() {
  const toast = useToast()

  const loading = ref(true)
  const busy = ref('')
  const tab = ref('characters')
  const search = ref('')
  const dirty = ref(false)

  const config = reactive(structuredClone(DEFAULT_CONFIG))
  const data = reactive({ characters: [], artifacts: [], weapons: [], monsters: [] })
  const log = ref(readLog())

  /* characters.txt 的两张表 */
  const orderToName = {}
  const nameToOrder = {}
  /* Amber 的 id → 中文名，粘贴 URL 时用 */
  const amberNames = {}

  /* ---------------- 存储 ---------------- */

  function writeLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, config, dirty: dirty.value }))
    } catch {
      /* 无痕模式写不进去，忽略 */
    }
  }

  function markDirty() {
    dirty.value = true
    writeLocal()
  }

  function readLocal() {
    let parsed = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    if (!parsed || typeof parsed !== 'object') return

    /* 老数据没有 dirty 字段 → 视为「未导出」，提醒先导一次 */
    dirty.value = parsed.dirty !== false

    if (parsed.config && typeof parsed.config === 'object') {
      TYPES.forEach((t) => {
        const cfg = parsed.config[t]
        if (!cfg || typeof cfg !== 'object') return
        config[t] = {
          prefix: typeof cfg.prefix === 'string' ? cfg.prefix : DEFAULT_CONFIG[t].prefix,
          ext: typeof cfg.ext === 'string' ? cfg.ext : DEFAULT_CONFIG[t].ext,
        }
      })
    }

    if (parsed.data && typeof parsed.data === 'object') {
      TYPES.forEach((t) => {
        data[t] = Array.isArray(parsed.data[t]) ? parsed.data[t] : []
      })
    }
  }

  function saveLog() {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(log.value))
    } catch {
      /* 日志只是便利功能，写不进去就只留在内存里 */
    }
  }

  /* ---------------- 资源 ---------------- */

  async function loadCharOrder() {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${CHARS_SRC}?t=${Date.now()}`)
      if (!res.ok) return
      const text = await res.text()
      for (const k of Object.keys(orderToName)) delete orderToName[k]
      for (const k of Object.keys(nameToOrder)) delete nameToOrder[k]

      text.split(/\r?\n/).forEach((raw) => {
        const line = raw.trim()
        if (!line || line.startsWith('#')) return
        const parts = line.split(/[\s,，\t]+/)
        if (parts.length < 2) return
        const order = parseInt(parts[0], 10)
        const name = parts.slice(1).join(' ').trim()
        if (order && name) {
          orderToName[order] = name
          nameToOrder[name] = order
        }
      })
    } catch (e) {
      toast.error('角色白名单加载失败：' + e.message)
    }
  }

  /* loadGlobalScript 里有短路：window[名字] 已存在就直接返回。
     要真正重新拉一份，必须先删掉它，并给 src 加时间戳绕开它内部的按 src 缓存。 */
  async function fetchDict() {
    delete window.ICON_DICT
    return loadGlobalScript(`${DICT_SRC}?t=${Date.now()}`, 'ICON_DICT')
  }

  function applyDictConfig(dict) {
    if (!dict.config || typeof dict.config !== 'object') return
    TYPES.forEach((t) => {
      const cfg = dict.config[t]
      if (!cfg || typeof cfg !== 'object') return
      config[t] = {
        prefix: typeof cfg.prefix === 'string' ? cfg.prefix : DEFAULT_CONFIG[t].prefix,
        ext: typeof cfg.ext === 'string' ? cfg.ext : DEFAULT_CONFIG[t].ext,
      }
    })
  }

  async function loadDict() {
    busy.value = '正在从仓库载入…'
    try {
      const dict = (await fetchDict()) || {}
      applyDictConfig(dict)
      TYPES.forEach((t) => {
        data[t] = dictToRows(dict, t)
      })

      /* 有意与旧版不同：数据刚从仓库来，本来就是干净的，不该报「未导出」 */
      dirty.value = false
      writeLocal()
      toast.success('已从仓库载入')
    } catch (e) {
      toast.error('载入失败：' + e.message)
    } finally {
      busy.value = ''
    }
  }

  /* ---------------- 派生 ---------------- */

  const sorted = computed(() =>
    data[tab.value].slice().sort((a, b) => (a.order || 99999999) - (b.order || 99999999)),
  )

  const keyword = computed(() => search.value.trim().toLowerCase())

  const filtered = computed(() => {
    if (!keyword.value) return sorted.value
    return sorted.value.filter(
      (row) =>
        (row.name || '').toLowerCase().includes(keyword.value) ||
        (row.key || '').toLowerCase().includes(keyword.value),
    )
  })

  const infoText = computed(() => {
    if (busy.value) return busy.value
    if (keyword.value) return `已筛选 ${filtered.value.length} / 共 ${sorted.value.length} 条`
    return `共 ${sorted.value.length} 条 · 自动保存`
  })

  /* ---------------- 行的读写 ---------------- */

  function resolveUrl(type, row) {
    if (!row || !row.key) return ''
    if (row.local) return `${import.meta.env.BASE_URL}shared/gi-icons/${row.key}`
    if (row.url) return row.url
    if (/^https?:\/\//i.test(row.key)) return row.key
    const cfg = config[type] || {}
    return cfg.prefix ? cfg.prefix + row.key + (cfg.ext || '') : ''
  }

  /* 缩略图底：星级径向渐变。
     底色表来自 loader（单一真源），边缘色用同一套 darken 算法。
     无星级（怪物）返回空对象 —— 与 applyBackground 的 star == null 分支一致：不加底色。
     所以非怪物条目必须带 star，自己写的条目也一样。 */
  function starStyle(row) {
    if (row.star == null) return {}
    const base = STAR_COLORS[row.star] || '#939393'
    return { '--star-color': base, '--star-edge': darkenHex(base, 0.5) }
  }

  function findOrderByName(name, exclude) {
    if (!name) return 0
    const hit = data.characters.find((r) => r !== exclude && r.name === name && r.order)
    return hit ? hit.order : nameToOrder[name] || 0
  }

  function findNameByOrder(order, exclude) {
    if (!order) return ''
    const hit = data.characters.find((r) => r !== exclude && r.order === order && r.name)
    return hit ? hit.name : orderToName[order] || ''
  }

  /* 序号 ↔ 角色名 双向联动（只在角色页签） */
  function setOrder(row, value) {
    const v = String(value ?? '').trim()
    const next = v === '' ? 0 : parseInt(v, 10) || 0

    if (tab.value === 'characters') {
      const name = (row.name || '').trim()
      if (name) {
        row.order = findOrderByName(name, row) || next
      } else {
        row.order = next
        if (next > 0) row.name = findNameByOrder(next, row) || row.name
      }
    } else {
      row.order = next
    }

    markDirty() /* 序号变了要重排 */
  }

  function setName(row, value) {
    row.name = String(value ?? '').trim()
    if (tab.value === 'characters') {
      const next = row.name ? findOrderByName(row.name, row) || row.order || 0 : 0
      if (next !== row.order) row.order = next
    }
    markDirty()
  }

  function setStar(row, value) {
    row.star = Number(value)
    markDirty()
  }

  function removeRow(row) {
    const idx = data[tab.value].indexOf(row)
    if (idx >= 0) data[tab.value].splice(idx, 1)
    markDirty()
    toast.success('已删除')
  }

  function clearTab() {
    data[tab.value] = []
    markDirty()
    toast.success(`已清空「${LABELS[tab.value]}」`)
  }

  /* ---------------- Amber ---------------- */

  async function fetchAmber(type) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(AMBER_ENDPOINTS[type], { signal: controller.signal })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const json = await res.json()
      return (json.data && json.data.items) || json.data || json
    } finally {
      clearTimeout(timer)
    }
  }

  /* 返回 { kept, skipped }：
     kept    = 要收进来的条目
     skipped = 被「硬规则」明确排除的 key。同步时会连带把本地同名条目清掉，
               因为硬规则表达的是「这类东西我们不要」，而不是「这次没拉到」。
     只看这个函数的话，四条规则是：
       · 角色：官方旅行者男女图 → 硬排除
               characters.txt 白名单 → 软排除（只不加，不删本地）
       · 武器：id 必须是五位数（10000–99999）→ 硬排除
               /weapon 接口还会返回武器素材/突破材料，那些 id 是四/六位数
       · 圣遗物：无额外规则
       · 怪物：28 开头是野生生物（动物）→ 硬排除 */
  function transformAmber(type, items) {
    const kept = {}
    const skipped = new Set()

    Object.keys(items).forEach((id) => {
      const item = items[id]
      if (!item || !item.icon || !item.name) return

      let order = 0
      let star = null

      if (type === 'characters') {
        /* 顺序要紧：先判官方旅行者，再判白名单 ——
           否则它会被白名单提前 return 掉，就轮不到登记 skip 了 */
        if (OFFICIAL_TRAVELER_RE.test(item.icon)) {
          skipped.add(item.icon)
          return
        }
        if (!nameToOrder[item.name]) return /* 软排除：只不加 */
        order = nameToOrder[item.name]
        star = item.rank || 5
      } else if (type === 'weapons') {
        order = item.id || 0
        star = item.rank || 5
        if (order < 10000 || order >= 100000) {
          skipped.add(item.icon)
          return
        }
      } else if (type === 'artifacts') {
        order = item.id || 0
        star =
          Array.isArray(item.levelList) && item.levelList.length
            ? Math.max.apply(null, item.levelList)
            : 5
      } else {
        if (String(item.id || '').startsWith('28')) {
          skipped.add(item.icon)
          return
        }
        order = item.id || 0
      }

      kept[item.icon] = { name: item.name, star, order }
    })

    return { kept, skipped }
  }

  /* id → 中文名（粘贴 URL 时补名字用） */
  async function ensureAmberNames(type) {
    if (amberNames[type]) return amberNames[type]
    const items = await fetchAmber(type)
    const table = {}
    Object.keys(items).forEach((k) => {
      const item = items[k]
      if (!item || !item.name) return
      const id = String(item.icon || '')
        .replace(/^UI_[A-Za-z]+_/i, '')
        .toLowerCase()
      if (id) table[id] = item.name
      if (item.id != null) table[String(item.id)] = item.name
    })
    amberNames[type] = table
    return table
  }

  /* ---------------- 粘贴 URL ---------------- */

  function extractKey(input) {
    let s = String(input || '').trim()
    if (!s) return ''
    if (/^https?:\/\//i.test(s)) s = s.split('/').pop().split('?')[0]
    return s.replace(/\.[^.]+$/, '')
  }

  async function parsePastedUrls(text) {
    const urls = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^https?:\/\//i.test(l))

    if (!urls.length) {
      toast.error('未识别到有效链接')
      return
    }

    const type = tab.value
    const cfg = config[type] || { prefix: '', ext: '' }
    const list = data[type]
    const byKey = {}
    list.forEach((row) => {
      if (row.key) byKey[row.key] = row
    })

    const created = []
    urls.forEach((url) => {
      const key = extractKey(url)
      if (!key) return
      /* URL 恰好等于「前缀 + key + 后缀」→ 走默认拼接规则，不写 url 字段 */
      const isConfig = cfg.prefix && url === cfg.prefix + key + (cfg.ext || '')
      const existing = byKey[key]
      if (existing) {
        if (isConfig) delete existing.url
        else existing.url = url
      } else {
        const row = { key, name: '', order: 0, star: type === 'monsters' ? null : 5 }
        if (!isConfig) row.url = url
        list.push(row)
        byKey[key] = row
        created.push(row)
      }
    })

    markDirty()

    if (created.length) {
      busy.value = '正在查询中文名…'
      let table = {}
      try {
        table = await ensureAmberNames(type)
      } catch {
        /* 查不到就留空名字，不阻断流程 */
      }
      let changed = false
      created.forEach((row) => {
        const normalized = row.key.toLowerCase().replace(/^ui_[a-z]+_/i, '')
        const name = table[normalized] || table[row.key.toLowerCase()] || ''
        if (name && name !== row.name) {
          row.name = name
          changed = true
        }
      })
      if (changed) markDirty()
      busy.value = ''
    }

    toast.success('解析完成')
  }

  /* ---------------- 同步（合并规则 v5） ---------------- */

  /* 自定义条目 = 带 local 或 url 的行，按 key 与 name 双登记。
     1. 自定义先落位，name/star/order/local/url 全保留
        · 另外把 FORCED_LOCAL 里、本地还没有的条目也按自定义补上
     2. API 条目：key 命中自定义 → 跳过；name 命中自定义 → 跳过；
        都没命中 → 以 API 为准（手打错的名字在这里被修正）
     3. 剩余旧条目按 key 判重保留：key 未出现 = API 下架或手工新增，保留
        · 例外：被硬规则排除的（excluded）不保留，直接丢掉 */
  async function syncFromAmber() {
    const before = JSON.parse(JSON.stringify(data))

    const customByKey = {}
    const customByName = {}
    TYPES.forEach((t) => {
      customByKey[t] = {}
      customByName[t] = {}

      ;(data[t] || []).forEach((row) => {
        if (!row.local && !row.url) return
        if (row.key) customByKey[t][row.key] = row
        if (row.name) customByName[t][row.name] = row
      })

      /* 强制条目：本地已有同 key 就保持你的版本，没有才补 */
      ;(FORCED_LOCAL[t] || []).forEach((row) => {
        if (row.key && customByKey[t][row.key]) return
        if (row.key) customByKey[t][row.key] = row
        if (row.name) customByName[t][row.name] = row
      })
    })

    const amber = {}
    const excluded = {}
    for (const type of TYPES) {
      busy.value = '正在拉取' + LABELS[type] + '…'
      try {
        const picked = transformAmber(type, await fetchAmber(type))
        amber[type] = picked.kept
        excluded[type] = picked.skipped
      } catch (e) {
        busy.value = ''
        toast.error(`同步失败：${LABELS[type]} - ${e.message}`)
        return null
      }
    }

    busy.value = '正在合并数据…'

    TYPES.forEach((type) => {
      const merged = {}
      const byKey = customByKey[type] || {}
      const byName = customByName[type] || {}

      Object.keys(byKey).forEach((key) => {
        const row = byKey[key]
        merged[key] = {
          name: row.name,
          star: row.star,
          order: row.order,
          local: row.local,
          url: row.url,
        }
      })

      Object.keys(amber[type] || {}).forEach((key) => {
        const item = amber[type][key]
        if (byKey[key] || (item.name && byName[item.name])) return
        merged[key] = item
      })

      ;(data[type] || []).forEach((row) => {
        if (!row.key || merged[row.key]) return
        if (excluded[type].has(row.key)) return /* 硬排除：本地旧条目也一起清掉 */
        merged[row.key] = {
          name: row.name,
          star: row.star,
          order: row.order,
          local: row.local,
          url: row.url,
        }
      })

      data[type] = Object.keys(merged).map((k) => {
        const r = merged[k]
        const out = { key: k, name: r.name || '', order: r.order || 0 }
        if (r.star != null) out.star = r.star
        if (r.local) out.local = true
        if (r.url) out.url = r.url
        return out
      })
    })

    markDirty()
    busy.value = ''

    const entry = { at: Date.now(), first: !before.characters.length, kinds: diffTypes(before, data) }
    log.value = [entry, ...log.value].slice(0, MAX_LOG)
    saveLog()
    return entry
  }

  /* 同步前后比对。同步是唯一会整表变动的操作，报告只在这一处产生。
     旧版是「盯状态条文字 + 嗅 localStorage」从外面猜，现在直接算。 */
  function diffTypes(beforeData, afterData) {
    const cut = (arr, n) => (arr.length > n ? arr.slice(0, n) : arr)
    const MAX = 30

    const out = {}
    TYPES.forEach((type) => {
      const before = beforeData[type] || []
      const after = afterData[type] || []
      const seen = new Map(before.map((r) => [r.key, r]))

      const added = []
      const renamed = []
      after.forEach((row) => {
        const old = seen.get(row.key)
        if (!old) added.push({ key: row.key, name: row.name || '' })
        else if ((old.name || '') !== (row.name || ''))
          renamed.push({ key: row.key, from: old.name || '', to: row.name || '' })
        seen.delete(row.key)
      })

      const gone = [...seen.values()].map((r) => ({ key: r.key, name: r.name || '' }))

      out[type] = {
        from: before.length,
        to: after.length,
        added: cut(added, MAX),
        addedMore: Math.max(0, added.length - MAX),
        renamed: cut(renamed, MAX),
        renamedMore: Math.max(0, renamed.length - MAX),
        gone: cut(gone, MAX),
        goneMore: Math.max(0, gone.length - MAX),
      }
    })
    return out
  }

  /* ---------------- 导出 ---------------- */

  function exportDict() {
    const text = serializeDict(config, data)
    const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'icon-dict.js'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)

    dirty.value = false
    writeLocal()
    toast.success('已导出 icon-dict.js')
  }

  /* ---------------- 启动 ---------------- */

  async function init() {
    loading.value = true
    await loadCharOrder()
    readLocal()
    loading.value = false
  }

  return {
    /* 状态 */
    loading,
    busy,
    tab,
    search,
    dirty,
    config,
    data,
    log,
    /* 派生 */
    filtered,
    sorted,
    infoText,
    /* 行操作 */
    resolveUrl,
    starStyle,
    setOrder,
    setName,
    setStar,
    removeRow,
    clearTab,
    /* 业务 */
    init,
    loadDict,
    parsePastedUrls,
    syncFromAmber,
    exportDict,
  }
}

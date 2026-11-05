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
   star 一定要写：没有 star 就没有星级底色（和怪物一样不加底色），
   缩略图会变成一块没有渐变的白底。 */
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
     「想要底色就一定要给 star」，这是这个函数和 FORCED_LOCAL 那条注释的同一件事。 */
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
    return hit ? hit.name : orderToName[order] ||

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
 * 注意：这不是「字典」本身。字典是 shared/gi-icons/icon-dict.js。
 *
 * 【绝不能动的东西】
 *   · STORAGE_KEY 与存储结构（换了键 = 用户草稿全丢）
 *   · 导出 icon-dict.js 的逐字格式（它是被两个仓库读的文件）
 *   · 星级底色 + 径向渐变：必须与 shared/gi-icons/icon-loader.js 的
 *     applyBackground 一致，否则缩略图底色和已烘焙的图片对不上
 *
 * 【行结构】{ key, name, order, star?, local?, url?, lock?, card?, art? }
 *   key/name/order/star/local/url   头像（原有，格式不动）
 *   lock    true = 这条我手填过，同步整条跳过
 *   card    { key, url, local }  名片大图
 *   art     { key, url, local }  立绘（没有自动源，只手填）
 *   没有 base / 变体：「旅行者」和「旅行者·冰」是两条独立角色，只是序号相同
 *
 * 【只有这三条算「我手填过」】local / url / lock —— 整条不参与更新。
 *   card / art 是普通字段，会跟着源走；但你手粘的完整链接会被保住（mergeSlots）。
 *
 * 【链接 → key 的规则】
 *   认得出 key → 只记 key（哪怕它和这一项本来对应的 key 不同，也以你粘的为准）
 *   认不出     → 记完整链接
 *   例外：立绘没有源前缀，只记 key 会显示不出来 → key 和链接都留
 *
 * 【「API 条目 → 字段」与「排除规则」是两件事，别再搅在一起】
 *   deriveFields()      不带任何排除规则
 *   transformAmber()    在 deriveFields 前面加排除规则，只服务自动同步
 * ========================================================================= */

const STORAGE_KEY = 'icon_dict_editor_v4'
const LOG_KEY = 'genshin_icon_editor_sync_log_v1'
const MAX_LOG = 10
const DICT_SRC = 'shared/gi-icons/icon-dict.js'
const CHARS_SRC = 'shared/data/characters.txt'

const AMBER_UI = 'https://gi.yatta.moe/assets/UI/'

/* config 会随字典一起导出。prefix / ext 是 icon-loader.js 读的字段，
   一个字都不能改；alt / card 是后加的，loader 不认识、也不受影响。 */
const DEFAULT_CONFIG = {
  characters: {
    prefix: 'https://api.lunaris.moe/data/assets/avataricon/',
    ext: '.webp',
    /* 备用源：主源图挂了，缩略图会换这个地址再试一次。
       Amber 的目录结构和 lunaris 不一样 —— 头像是扁平的，名片在 namecard/ 下 */
    alt: { prefix: AMBER_UI, ext: '.png' },
    card: {
      prefix: 'https://api.lunaris.moe/data/assets/namecardpic/',
      ext: '.webp',
      alt: { prefix: `${AMBER_UI}namecard/`, ext: '.png' },
    },
  },
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

/* 槽位：'' = 头像，'card' = 名片，'art' = 立绘 */
const SLOTS = ['', 'card', 'art']
const SLOT_LABELS = { '': '头像', card: '名片', art: '立绘' }

/* 官方把旅行者拆成男女两张官方图，我们要的是仓库里那张自制的。 */
const OFFICIAL_TRAVELER_RE = /^UI_AvatarIcon_Player(Boy|Girl)/i

/* 同步时必须存在的本地条目。本地已有同 key 的条目就保持原样，不覆盖你的改动。 */
const FORCED_LOCAL = {
  characters: [
    { key: 'UI_AvatarIcon_Traveler.webp', name: '旅行者', order: 1, star: 5, local: true },
  ],
}

/* =========================================================================
 * 颜色：与 shared/gi-icons/icon-loader.js 里的 darken() 逐式相同
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

function darkenHex(hex, percent) {
  if (!hex || typeof hex !== 'string' || hex.length !== 7) return '#333333'
  const [h, s, l] = hexToHsl(hex)
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return '#333333'
  return hslToHex(h, s, Math.max(0, l * (1 - percent)))
}

/* =========================================================================
 * key ↔ 代号 ↔ 中文名
 * -------------------------------------------------------------------------
 * 归一成「代号」再比对，绮良良那种「头像叫 Momoka、名片叫 Kirara」才各查各的：
 *   UI_AvatarIcon_Momoka.webp → momoka ｜ UI_NameCardIcon_Kirara → kirara
 * 反查表用小写代号；拼地址用原样大小写的代号（URL 区分大小写）。
 * ========================================================================= */

const KEY_PREFIX_RE =
  /^UI_(?:AvatarIcon|NameCardPic|NameCardIcon|Gacha_AvatarImg|MonsterIcon|WeaponIcon|RelicIcon)_/i

function rawCode(key) {
  return String(key || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(KEY_PREFIX_RE, '')
    .replace(/_P$/i, '')
}

const codeOf = (key) => rawCode(key).toLowerCase()

/* Amber 给的是名片小图标名（UI_NameCardIcon_Hutao），
   我们要的是大图（UI_NameCardPic_Hutao_P），换前后缀即可。 */
const cardKeyFrom = (icon) => {
  const code = rawCode(icon)
  return code ? `UI_NameCardPic_${code}_P` : ''
}

/* 从 URL 里认 key。认不出返回空 —— 调用方就存完整链接。 */
const SLOT_KEY_RE = {
  '': /^UI_AvatarIcon_(.+?)(?:\.[a-z0-9]+)?$/i,
  card: /^UI_NameCard(?:Pic|Icon)_(.+?)(?:_P)?(?:\.[a-z0-9]+)?$/i,
  art: /^UI_Gacha_AvatarImg_(.+?)(?:\.[a-z0-9]+)?$/i,
}

function extractKey(input, slot = '') {
  let s = String(input || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) s = s.split('/').pop().split('?')[0]
  const m = s.match(SLOT_KEY_RE[slot] || SLOT_KEY_RE[''])
  if (!m) return ''
  const code = m[1]
  if (slot === 'card') return `UI_NameCardPic_${code}_P`
  if (slot === 'art') return `UI_Gacha_AvatarImg_${code}`
  return `UI_AvatarIcon_${code}`
}

/* 仓库内路径：老 txt 里写的是 ../../shared/xxx，统一成 shared/xxx */
function repoPath(url) {
  const s = String(url || '').trim()
  const m = s.match(/^(?:\.\.\/)+shared\//)
  return m ? `shared/${s.slice(m[0].length)}` : ''
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

const kvSrc = (o) => `prefix: "${escJs(o.prefix)}", ext: "${escJs(o.ext || '')}"`
const litSrc = (o) => `{ ${kvSrc(o)} }`

function litConfig(cfg) {
  const parts = [kvSrc(cfg)]
  if (cfg.alt) parts.push(`alt: ${litSrc(cfg.alt)}`)
  if (cfg.card) parts.push(`card: { ${kvSrc(cfg.card)}, alt: ${litSrc(cfg.card.alt)} }`)
  return `{ ${parts.join(', ')} }`
}

const litSlot = (o) => {
  const p = []
  if (o.key) p.push(`key: "${escJs(o.key)}"`)
  if (o.url) p.push(`url: "${escJs(o.url)}"`)
  if (o.local) p.push('local: true')
  return `{ ${p.join(', ')} }`
}

function litRow(row) {
  const p = [`name: "${escJs(row.name)}"`]
  if (row.star != null) p.push(`star: ${row.star}`)
  p.push(`order: ${row.order || 0}`)
  if (row.local) p.push('local: true')
  if (row.url) p.push(`url: "${escJs(row.url)}"`)
  if (row.lock) p.push('lock: true')
  if (row.card) p.push(`card: ${litSlot(row.card)}`)
  if (row.art) p.push(`art: ${litSlot(row.art)}`)
  return `{ ${p.join(', ')} }`
}

function serializeDict(config, data) {
  const lines = ['window.ICON_DICT = {', '  config: {']

  TYPES.forEach((type, ti) => {
    const cfg = config[type] || DEFAULT_CONFIG[type]
    const tail = ti < TYPES.length - 1 ? ',' : ''
    lines.push(`    ${type}: ${litConfig(cfg)}${tail}`)
  })
  lines.push('  },')

  TYPES.forEach((type, ti) => {
    lines.push('', `  /* ============ ${LABELS[type]} ============ */`, `  ${type}: {`)

    const list = data[type]
      .filter((it) => it.key)
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    if (!list.length) lines.push('    // 暂无条目')

    list.forEach((item, i) => {
      const tail = i < list.length - 1 ? ',' : ''
      lines.push(`    "${escJs(item.key)}": ${litRow(item)}${tail}`)
    })

    lines.push(`  }${ti < TYPES.length - 1 ? ',' : ''}`)
  })

  lines.push('};', '')
  return lines.join('\n')
}

/* 深拷贝一行，字段一个不漏 —— 合并逻辑里所有「保留旧行」都走它。
   以前是手写字段列表，加了新字段很容易漏掉一处，同步一次就丢数据。 */
function cloneRow(row) {
  const out = { key: row.key, name: row.name || '', order: row.order || 0 }
  if (row.star != null) out.star = row.star
  if (row.local) out.local = true
  if (row.url) out.url = row.url
  if (row.lock) out.lock = true
  if (row.card) out.card = { ...row.card }
  if (row.art) out.art = { ...row.art }
  return out
}

/* API 给的槽位与旧行合并：你「粘的完整链接」形态优先，API 不覆盖它 */
function mergeSlots(oldRow, item) {
  const out = { ...item }
  ;['card', 'art'].forEach((s) => {
    const prev = oldRow?.[s]
    if (!prev) return
    if (prev.url && !prev.local) out[s] = { ...prev }
    else if (!item?.[s]) out[s] = { ...prev }
  })
  return out
}

function readSlot(o) {
  if (!o || typeof o !== 'object') return null
  const s = { key: o.key || '', url: o.url || '', local: !!o.local }
  return s.key || s.url ? s : null
}

function dictToRows(dict, type) {
  const obj = dict[type] || {}
  return Object.keys(obj).map((k) => {
    const item = obj[k] || {}
    const row = { key: k, name: item.name || '', order: item.order || 0 }
    if (item.star != null) row.star = item.star
    if (item.local) row.local = true
    if (item.url) row.url = item.url
    if (item.lock) row.lock = true
    const card = readSlot(item.card)
    const art = readSlot(item.art)
    if (card) row.card = card
    if (art) row.art = art
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

function mergeSrc(o, def) {
  const s = o && typeof o === 'object' ? o : {}
  return {
    prefix: typeof s.prefix === 'string' && s.prefix ? s.prefix : def?.prefix || '',
    ext: typeof s.ext === 'string' ? s.ext : def?.ext || '',
  }
}

function normConfig(cfg, def) {
  const c = cfg && typeof cfg === 'object' ? cfg : {}
  const out = {
    prefix: typeof c.prefix === 'string' && c.prefix ? c.prefix : def.prefix,
    ext: typeof c.ext === 'string' ? c.ext : def.ext,
  }
  if (def.alt) out.alt = mergeSrc(c.alt, def.alt)
  if (def.card) {
    out.card = mergeSrc(c.card, def.card)
    out.card.alt = mergeSrc(c.card?.alt, def.card.alt)
  }
  return out
}

/* ========================================================================= */

export function useIconDict() {
  const toast = useToast()

  const loading = ref(true)
  const busy = ref('')
  const tab = ref('characters')
  const search = ref('')
  const dirty = ref(false)
  const activeKey = ref('')
  const filter = ref('all')

  const config = reactive(structuredClone(DEFAULT_CONFIG))
  const data = reactive({ characters: [], artifacts: [], weapons: [], monsters: [] })
  const log = ref(readLog())

  const orderToName = {}
  const nameToOrder = {}
  /* 图标名 / 剥前缀小写 / id / 'n:中文名' / 'c:名片代号' → API 原始条目 */
  const amberIndex = {}

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

    dirty.value = parsed.dirty !== false

    if (parsed.config && typeof parsed.config === 'object') {
      TYPES.forEach((t) => {
        config[t] = normConfig(parsed.config[t], DEFAULT_CONFIG[t])
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
      /* 日志只是便利功能 */
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
        if (!order || !name) return
        nameToOrder[name] = order
        /* 旅行者和旅行者·冰共用序号 1（它们是两条独立角色）：
           「序号 → 名字」只认第一个登记的，否则反查会串 */
        if (!orderToName[order]) orderToName[order] = name
      })
    } catch (e) {
      toast.error('角色白名单加载失败：' + e.message)
    }
  }

  async function fetchDict() {
    delete window.ICON_DICT
    return loadGlobalScript(`${DICT_SRC}?t=${Date.now()}`, 'ICON_DICT')
  }

  function applyDictConfig(dict) {
    if (!dict.config || typeof dict.config !== 'object') return
    TYPES.forEach((t) => {
      config[t] = normConfig(dict.config[t], DEFAULT_CONFIG[t])
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

  const missingCard = (row) => !row.card?.key && !row.card?.url
  const missingArt = (row) => !row.art?.key && !row.art?.url

  const FILTERS = [
    { value: 'all', label: '全部' },
    { value: 'noCard', label: '缺名片' },
    { value: 'noArt', label: '缺立绘' },
  ]

  const filtered = computed(() => {
    let list = sorted.value
    if (tab.value === 'characters') {
      if (filter.value === 'noCard') list = list.filter(missingCard)
      else if (filter.value === 'noArt') list = list.filter(missingArt)
    }
    if (!keyword.value) return list
    return list.filter(
      (row) =>
        (row.name || '').toLowerCase().includes(keyword.value) ||
        (row.key || '').toLowerCase().includes(keyword.value),
    )
  })

  const activeRow = computed(() =>
    tab.value === 'characters'
      ? data.characters.find((r) => r.key === activeKey.value) || null
      : null,
  )

  const counts = computed(() => ({
    all: sorted.value.length,
    noCard: sorted.value.filter(missingCard).length,
    noArt: sorted.value.filter(missingArt).length,
  }))

  const infoText = computed(() => {
    if (busy.value) return busy.value
    if (keyword.value) return `已筛选 ${filtered.value.length} / 共 ${sorted.value.length} 条`
    return `共 ${sorted.value.length} 条 · 自动保存`
  })

  /* ---------------- 地址 ---------------- */

  function slotCfg(type, slot) {
    const cfg = config[type] || {}
    if (!slot) return { src: { prefix: cfg.prefix, ext: cfg.ext }, alt: cfg.alt }
    if (slot === 'card') return { src: cfg.card, alt: cfg.card?.alt }
    return { src: null, alt: null } /* 立绘没有自动源 */
  }

  function resolveUrl(type, row) {
    const cfg = config[type] || {}
    if (!row || !row.key) return ''
    if (row.local) return `${import.meta.env.BASE_URL}shared/gi-icons/${row.key}`
    if (row.url) return row.url
    if (/^https?:\/\//i.test(row.key)) return row.key
    return cfg.prefix ? cfg.prefix + row.key + (cfg.ext || '') : ''
  }

  /* 一个槽位的「主地址 + 备用地址」。备用只给 <img> 的 error 兜底用 */
  function slotSrc(type, row, slot = '') {
    if (!row) return { src: '', alt: '' }
    if (!slot) {
      const src = resolveUrl(type, row)
      const cfg = config[type] || {}
      const alt =
        cfg.alt && cfg.alt.prefix && row.key && !row.url && !row.local
          ? cfg.alt.prefix + row.key + (cfg.alt.ext || '')
          : ''
      return { src, alt }
    }

    const o = row[slot]
    if (!o) return { src: '', alt: '' }
    if (o.local) return { src: o.url ? import.meta.env.BASE_URL + o.url : '', alt: '' }
    if (o.url) return { src: o.url, alt: '' }
    if (!o.key) return { src: '', alt: '' }

    const { src, alt } = slotCfg(type, slot)
    return {
      src: src?.prefix ? src.prefix + o.key + (src.ext || '') : '',
      alt: alt?.prefix ? alt.prefix + o.key + (alt.ext || '') : '',
    }
  }

  /* ---------------- 缩略图底色 ---------------- */

  function starStyle(row) {
    if (row.star == null) return {}
    const base = STAR_COLORS[row.star] || '#939393'
    return { '--star-color': base, '--star-edge': darkenHex(base, 0.5) }
  }

  /* ---------------- 行的读写 ---------------- */

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

  function setOrder(row, value) {
    const v = String(value ?? '').trim()
    const next = v === '' ? 0 : parseInt(v, 10) || 0

    if (tab.value === 'characters') {
      const name = (row.name || '').trim()
      if (name) row.order = findOrderByName(name, row) || next
      else {
        row.order = next
        if (next > 0) row.name = findNameByOrder(next, row) || row.name
      }
    } else {
      row.order = next
    }

    markDirty()
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
    if (row.key === activeKey.value) activeKey.value = ''
    markDirty()
    toast.success('已删除')
  }

  function clearTab() {
    data[tab.value] = []
    activeKey.value = ''
    markDirty()
    toast.success(`已清空「${LABELS[tab.value]}」`)
  }

  function select(row) {
    activeKey.value = row?.key || ''
  }

  /* ---------------- 槽位 ---------------- */

  function ensureSlot(row, slot) {
    if (!row[slot]) row[slot] = { key: '', url: '', local: false }
    return row[slot]
  }

  /* 落一个 URL：
     仓库路径（shared/…）→ local + 路径
     认得出 key 且有源前缀 → 只记 key（以你粘的为准，不管它本来对应谁）
     认得出 key 但没源前缀（立绘）→ key 和链接都留，链接保证显示
     认不出 key → 只记完整链接 */
  function applyUrl(row, slot, raw) {
    const url = String(raw || '').trim()
    if (!url) return ''

    const repo = repoPath(url)
    if (repo) {
      if (slot) {
        const o = ensureSlot(row, slot)
        o.key = ''
        o.url = repo
        o.local = true
      } else {
        row.url = repo
        row.local = true
      }
      markDirty()
      return ''
    }

    const key = extractKey(url, slot)
    const { src } = slotCfg(tab.value, slot)

    if (slot) {
      const o = ensureSlot(row, slot)
      o.local = false
      o.key = key
      o.url = key && src?.prefix ? '' : url
      markDirty()
      return key
    }

    /* 头像：key 就是这一行的身份 —— 以你粘的为准 */
    const oldKey = row.key
    row.local = false
    if (key && data[tab.value].some((r) => r !== row && r.key === key)) {
      toast.error('这个 key 已经被另一条占用了')
      row.url = url
    } else if (key) {
      row.key = key
      row.url = ''
      if (activeKey.value === oldKey) activeKey.value = key
    } else {
      row.url = url
    }
    markDirty()
    return key
  }

  function clearSlot(row, slot) {
    if (slot) delete row[slot]
    else {
      row.url = ''
      row.local = false
    }
    markDirty()
  }

  function setSlotLocal(row, slot, value) {
    if (slot) ensureSlot(row, slot).local = !!value
    else row.local = !!value
    markDirty()
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

  /* API 条目 → 字段。**不带任何排除规则**，手动粘贴也用它。
     名片：Amber 的头像响应直接带这个角色用哪张（nameCard.icon）——
           不用按 key 猜，所以「头像 Momoka、名片 Kirara」也无所谓 */
  function deriveFields(type, item) {
    if (type === 'characters') {
      const out = { name: item.name, star: item.rank || 5, order: nameToOrder[item.name] || 0 }
      const cardKey = cardKeyFrom(item.nameCard?.icon)
      if (cardKey) out.card = { key: cardKey, url: '', local: false }
      return out
    }
    if (type === 'weapons') {
      return { name: item.name, star: item.rank || 5, order: item.id || 0 }
    }
    if (type === 'artifacts') {
      const star =
        Array.isArray(item.levelList) && item.levelList.length
          ? Math.max.apply(null, item.levelList)
          : 5
      return { name: item.name, star, order: item.id || 0 }
    }
    return { name: item.name, star: null, order: item.id || 0 }
  }

  function transformAmber(type, items) {
    const kept = {}
    const skipped = new Set()

    Object.keys(items).forEach((id) => {
      const item = items[id]
      if (!item || !item.icon || !item.name) return

      if (type === 'characters') {
        if (OFFICIAL_TRAVELER_RE.test(item.icon)) {
          skipped.add(item.icon)
          return
        }
        if (!nameToOrder[item.name]) return /* 软排除：只不加 */
      } else if (type === 'weapons') {
        const order = item.id || 0
        if (order < 10000 || order >= 100000) {
          skipped.add(item.icon)
          return
        }
      } else if (type === 'monsters') {
        if (String(item.id || '').startsWith('28')) {
          skipped.add(item.icon)
          return
        }
      }

      kept[item.icon] = deriveFields(type, item)
    })

    return { kept, skipped }
  }

  /* 一张扁平索引：图标名 / 小写代号 / id 都能查到条目；
     角色额外登记 'n:中文名' 与 'c:名片代号'，供「输入名字」「粘名片 URL」反查。 */
  async function ensureAmberIndex(type) {
    if (amberIndex[type]) return amberIndex[type]
    const items = await fetchAmber(type)
    const map = {}
    Object.keys(items).forEach((k) => {
      const item = items[k]
      if (!item || !item.icon || !item.name) return
      map[item.icon] = item
      const stripped = String(item.icon).replace(/^UI_[A-Za-z]+_/i, '').toLowerCase()
      if (stripped && !map[stripped]) map[stripped] = item
      if (item.id != null && !map[String(item.id)]) map[String(item.id)] = item
      if (type === 'characters') {
        if (!map['n:' + item.name]) map['n:' + item.name] = item
        const cc = codeOf(item.nameCard?.icon)
        if (cc && !map['c:' + cc]) map['c:' + cc] = item
      }
    })
    amberIndex[type] = map
    return map
  }

  /* 反查：这一条对应源里的哪个条目。from = 'name' | 'avatar' | 'card' */
  async function itemFrom(row, from) {
    if (from === 'name') {
      const n = String(row.name || '').trim()
      if (!n) return null
      const map = await ensureAmberIndex('characters')
      /* 「旅行者·冰」这种名字，先在源里找全名，再退回中点前那段 */
      return map['n:' + n] || map['n:' + n.split('·')[0]] || null
    }
    if (from === 'card') {
      const key = row.card?.key || row.card?.url || ''
      const c = codeOf(key)
      if (!c) return null
      const map = await ensureAmberIndex('characters')
      return map['c:' + c] || null
    }
    if (!row.key) return null
    const map = await ensureAmberIndex('characters')
    return map[row.key] || map[codeOf(row.key)] || null
  }

  /* 用源里查到的条目补齐这一条：名字、另一个 key、星级。
     只补空着的，绝不覆盖你填过的。 */
  async function hydrate(row, from) {
    let item = null
    try {
      item = await itemFrom(row, from)
    } catch {
      return false
    }
    if (!item) return false

    let changed = false
    if (!row.name && item.name) {
      row.name = item.name
      changed = true
    }
    if (!row.key && item.icon) {
      row.key = item.icon
      changed = true
    }
    const cardKey = cardKeyFrom(item.nameCard?.icon)
    if (cardKey && !row.card?.key && !row.card?.url) {
      row.card = { key: cardKey, url: '', local: false }
      changed = true
    }
    if (row.star == null && item.rank) {
      row.star = item.rank
      changed = true
    }

    if (changed) markDirty()
    return changed
  }

  /* 按中文名新建一条角色。源里没有就拒绝（那种情况用「粘贴 URL」）。 */
  async function addCharacter(name) {
    const n = String(name || '').trim()
    if (!n) {
      toast.error('先填角色名')
      return false
    }
    if (data.characters.some((r) => r.name === n)) {
      toast.error(`「${n}」已经在列表里了`)
      return false
    }

    let item = null
    try {
      const map = await ensureAmberIndex('characters')
      item = map['n:' + n] || map['n:' + n.split('·')[0]] || null
    } catch (e) {
      toast.error('取源失败：' + e.message)
      return false
    }
    if (!item) {
      toast.error(`源里没有「${n}」——可以用「粘贴 URL」加它`)
      return false
    }

    const f = deriveFields('characters', item)
    const row = { key: item.icon, name: f.name || n, order: f.order || 0, star: f.star }
    if (f.card) row.card = { ...f.card }
    data.characters.push(row)
    markDirty()
    activeKey.value = row.key
    toast.success(
      f.order ? `已加入「${row.name}」` : `已加入「${row.name}」（不在 characters.txt，序号 0）`,
    )
    return true
  }

  /* ---------------- 粘贴 URL（批量） ---------------- */

  async function parsePastedUrls(text) {
    const urls = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^https?:\/\//i.test(l) || repoPath(l))

    if (!urls.length) {
      toast.error('未识别到有效链接')
      return
    }

    const type = tab.value
    const list = data[type]
    const byKey = {}
    list.forEach((row) => {
      if (row.key) byKey[row.key] = row
    })

    const created = []
    urls.forEach((url) => {
      const repo = repoPath(url)
      const key = repo ? repo.split('/').pop() : extractKey(url, '')
      if (!key) return
      const existing = byKey[key]
      if (existing) {
        applyUrl(existing, '', url)
      } else {
        const row = { key, name: '', order: 0, star: type === 'monsters' ? null : 5 }
        if (repo) {
          row.url = repo
          row.local = true
        }
        list.push(row)
        byKey[key] = row
        created.push(row)
      }
    })

    markDirty()

    if (created.length) {
      busy.value = '正在查询补全…'
      let map = {}
      try {
        map = await ensureAmberIndex(type)
      } catch {
        /* 查不到就保持空名字，不阻断流程 */
      }

      let changed = false
      created.forEach((row) => {
        const stripped = String(row.key).replace(/^UI_[A-Za-z]+_/i, '').toLowerCase()
        const item = map[row.key] || map[String(row.key).toLowerCase()] || map[stripped]
        if (!item) return

        const f = deriveFields(type, item)
        if (f.name && f.name !== row.name) {
          row.name = f.name
          changed = true
        }
        if (f.star != null && f.star !== row.star) {
          row.star = f.star
          changed = true
        }
        if (f.order && f.order !== row.order) {
          row.order = f.order
          changed = true
        }
        if (f.card && !row.card) {
          row.card = { ...f.card }
          changed = true
        }
      })

      if (changed) markDirty()
      busy.value = ''
    }

    toast.success('解析完成')
  }

  /* ---------------- 同步（合并规则 v7） ---------------- */

  /* 返回 { entry, conflicts }：
     conflicts = 源里的 key 与你手填的 key 不一致的项，**先按你的保留**，
     交给界面弹窗让你逐条选「保留我的 / 用源的」。 */
  async function syncFromAmber() {
    const before = JSON.parse(JSON.stringify(data))
    const conflicts = []

    const customByKey = {}
    const customByName = {}
    TYPES.forEach((t) => {
      customByKey[t] = {}
      customByName[t] = {}

      ;(data[t] || []).forEach((row) => {
        if (!row.local && !row.url && !row.lock) return
        if (row.key) customByKey[t][row.key] = row
        if (row.name) customByName[t][row.name] = row
      })

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
      const old = {}
      ;(data[type] || []).forEach((row) => {
        if (row.key) old[row.key] = row
      })

      /* 名字 → API 条目，用来发现「名字对上了但 key 不一样」的冲突 */
      const apiByName = {}
      Object.keys(amber[type] || {}).forEach((k) => {
        const it = amber[type][k]
        if (it?.name) apiByName[it.name] = { ...it, icon: k }
      })

      /* 1. 手填过的行先落位，整条保留 */
      Object.keys(byKey).forEach((key) => {
        merged[key] = cloneRow(byKey[key])
      })

      /* 2. API 条目：key 或名字命中手填行就跳过；否则以 API 为准。
            同 key 已有旧行 → 合并进那一行（名字/星级/序号/名片更新，
            其它字段由 mergeSlots 保住）。名片 key 不一致 → 记冲突、先保留我的 */
      Object.keys(amber[type] || {}).forEach((key) => {
        const item = amber[type][key]
        if (byKey[key] || (item.name && byName[item.name])) return

        const prev = old[key]
        if (!prev) {
          merged[key] = item
          return
        }

        const next = { ...cloneRow(prev), ...mergeSlots(prev, item) }
        if (prev.card?.key && item.card?.key && prev.card.key !== item.card.key) {
          conflicts.push({
            type,
            rowKey: key,
            name: prev.name || item.name || '',
            slot: 'card',
            mine: prev.card.key,
            theirs: item.card.key,
          })
          next.card = { ...prev.card }
        }
        merged[key] = next
      })

      /* 3. 剩下没被 API 提到的旧条目：key 判重保留（已下架或手工新增）。
            硬排除的例外 —— 连本地旧条目一起清掉。
            顺带发现头像 key 冲突：名字对得上、key 不一样 */
      ;(data[type] || []).forEach((row) => {
        if (!row.key || merged[row.key]) return
        if (excluded[type].has(row.key)) return

        if (type === 'characters' && row.name && !byKey[row.key]) {
          const item = apiByName[row.name]
          if (item && item.icon && item.icon !== row.key) {
            conflicts.push({
              type,
              rowKey: row.key,
              name: row.name,
              slot: '',
              mine: row.key,
              theirs: item.icon,
            })
          }
        }

        merged[row.key] = cloneRow(row)
      })

      data[type] = Object.keys(merged).map((k) => ({ ...cloneRow(merged[k]), key: k }))
    })

    if (activeKey.value && !data.characters.some((r) => r.key === activeKey.value)) {
      activeKey.value = ''
    }

    markDirty()
    busy.value = ''

    const entry = { at: Date.now(), first: !before.characters.length, kinds: diffTypes(before, data) }
    log.value = [entry, ...log.value].slice(0, MAX_LOG)
    saveLog()
    return { entry, conflicts }
  }

  /* 把弹窗里选中的项落到数据上 */
  function applyConflicts(items) {
    let done = 0
    items.forEach((c) => {
      const list = data[c.type] || []
      const row = list.find((r) => r.key === c.rowKey)
      if (!row) return

      if (!c.slot) {
        if (list.some((r) => r !== row && r.key === c.key)) return /* 目标 key 被占 */
        if (activeKey.value === row.key) activeKey.value = c.key
        row.key = c.key
      } else {
        row[c.slot] = { key: c.key, url: '', local: false }
      }
      done++
    })
    if (done) markDirty()
    toast.success(done ? `已更新 ${done} 项` : '没有改动')
  }

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
    filter,
    config,
    data,
    log,
    /* 派生 */
    filtered,
    sorted,
    infoText,
    counts,
    activeRow,
    activeKey,
    missingCard,
    missingArt,
    /* 行操作 */
    resolveUrl,
    slotSrc,
    starStyle,
    setOrder,
    setName,
    setStar,
    removeRow,
    clearTab,
    select,
    /* 槽位与反查 */
    applyUrl,
    clearSlot,
    setSlotLocal,
    hydrate,
    addCharacter,
    /* 业务 */
    init,
    loadDict,
    parsePastedUrls,
    syncFromAmber,
    applyConflicts,
    exportDict,
    /* 常量 */
    TYPES,
    LABELS,
    SLOTS,
    SLOT_LABELS,
    FILTERS,
  }
}

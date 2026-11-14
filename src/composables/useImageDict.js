import { computed, reactive, ref } from 'vue'
import { STAR_COLORS } from 'virtual:gg-image-lib'
import { useToast } from './useToast.js'
import { loadGlobalScript } from './useData.js'

/* =========================================================================
 * 图片字典 · 域逻辑
 * -------------------------------------------------------------------------
 * 注意：这不是「字典」本身。字典是 shared/image-dict.js，这里是
 * 编辑器页面的逻辑（载入 / 合并 / 序列化 / 颜色）。
 *
 * 【绝不能动的东西】
 *   · 导出 image-dict.js 的逐字格式（它是被两个仓库读的文件）
 *   · 星级底色 + 径向渐变：必须与 shared/image-loader.js 的
 *     applyBackground 一致
 *
 * 【地址 = config 里的规则 + 代号】
 *   config[type].prefix / ext 是主源（lunaris），config[type].alt 是备用源（Amber）
 *   名片、立绘在 config[type].card / config[type].art 里各有一组
 *   某一格想用备用源 → 那一格记 alt: true（不是把链接写死进字典）
 *     头像  { name, order, alt: true }                     → 用 config.characters.alt
 *     名片  { card: { key: "Charlotte", alt: true } }       → 用 config.characters.card.alt
 *   拼出来的地址都是同一套：prefix + 代号 + ext
 *
 * 【链接怎么落】
 *   判断一个链接属于谁，只看「路径」不比扩展名（旧数据里两种后缀都可能存在）。
 *   对得上主源规则 → 只记代号
 *   对得上备用源规则 → 只记代号 + alt: true（夏洛蒂：粘 Amber 的头像链接）
 *   两组都对不上（官网那一长串、别的站）→ 才存 url 兜底
 *   仓库内的图（…/shared/…）→ 转成站点绝对路径存 url
 *   载入老字典时会把上面这种「其实是源拼得出来的链接」自动化简代号 / 标记。
 *
 * 【三件事怎么互推】
 *   ① 中文名：查源（Amber 角色表）→ 头像代号；名片代号再按下面两条取
 *   ② 代号代换：头像代号和名片代号同名（Ambor → Ambor）—— 覆盖绝大多数，
 *      连源里没有的未实装角色也能用（URL 里带着代号就行）
 *   ③ 按英文名查源：代号代换不成立时（绮良良头像 Momoka、名片 Kirara），
 *      拿角色的 route（Kirara）去名片表对上
 *
 * 【补齐什么时候发生】（needFill）
 *   一条「有名字、有头像、就是缺名片」的行，以前没人去碰它就补不上。
 *   现在四条路都自动：
 *     · 选中这一行 → select() 里有 needFill 就补
 *     · 改了名字 / 粘了地址 → 界面在失焦或停手后调 hydrate()
 *     · 新增（名字 / 批量链接）→ 建行时就补
 *     · 同步末尾 → 源里没有的角色按「代号同名代换」再试一次
 *   补过就不再重复请求（needFill 为假就什么都不做）。
 *
 * 【「不更新」是按槽位算的】
 *   头像槽 / 名片槽：带 url 或 alt 就留你的，否则跟源走
 *   名字 / 星级 / 序号 永远跟源走 —— 只有 lock: true 是整条不动
 * ========================================================================= */

const BASE = import.meta.env.BASE_URL
/* 本地存储键名保留旧名：改它会让已存在的本地字典读不到（AGENTS 里「键名 / 表名不能改」） */
const STORAGE_KEY = 'icon_dict_editor_v4'
const LOG_KEY = 'genshin_icon_editor_sync_log_v1'
const MAX_LOG = 10
const DICT_SRC = 'shared/image-dict.js'
/* 角色序号与立绘都从图片字典现算（DICT_SRC），那两张 txt 已退休 */

const LU = 'https://api.lunaris.moe/data/assets/'
const AMBER = 'https://gi.yatta.moe/assets/UI/'

const DEFAULT_CONFIG = {
  characters: {
    prefix: `${LU}avataricon/UI_AvatarIcon_`,
    ext: '.webp',
    alt: { prefix: `${AMBER}UI_AvatarIcon_`, ext: '.png' },
    card: {
      prefix: `${LU}namecardpic/UI_NameCardPic_`,
      ext: '_P.png',
      alt: { prefix: `${AMBER}namecard/UI_NameCardPic_`, ext: '_P.png' },
    },
  },
  artifacts: {
    prefix: `${LU}artifacts/UI_RelicIcon_`,
    ext: '.webp',
    alt: { prefix: `${AMBER}reliquary/UI_RelicIcon_`, ext: '.png' },
  },
  weapons: {
    prefix: `${LU}weaponicon/UI_EquipIcon_`,
    ext: '.webp',
    alt: { prefix: `${AMBER}UI_EquipIcon_`, ext: '.png' },
  },
  monsters: {
    prefix: `${LU}monstericon/UI_MonsterIcon_`,
    ext: '.png',
    alt: { prefix: `${AMBER}monster/UI_MonsterIcon_`, ext: '.png' },
  },
}

const AMBER_ENDPOINTS = {
  characters: 'https://gi.yatta.moe/api/v2/CHS/avatar',
  weapons: 'https://gi.yatta.moe/api/v2/CHS/weapon',
  artifacts: 'https://gi.yatta.moe/api/v2/CHS/reliquary',
  monsters: 'https://gi.yatta.moe/api/v2/CHS/monster',
  namecard: 'https://gi.yatta.moe/api/v2/CHS/namecard',
}

const TYPES = ['characters', 'artifacts', 'weapons', 'monsters']
const LABELS = { characters: '角色', artifacts: '圣遗物', weapons: '武器', monsters: '怪物' }

/* 槽位：'' = 头像，'card' = 名片，'art' = 立绘 */
const SLOTS = ['', 'card', 'art']
const SLOT_LABELS = { '': '头像', card: '名片', art: '立绘' }

/* 各分类的图标名前缀：key 只留代号，这一截进 config.prefix */
const ICON_RE = {
  characters: {
    '': /^UI_AvatarIcon_/i,
    card: /^UI_NameCard(?:Pic|Icon)_/i,
    art: /^UI_Gacha_AvatarImg_/i,
  },
  artifacts: { '': /^UI_RelicIcon_/i },
  weapons: { '': /^UI_EquipIcon_/i },
  monsters: { '': /^UI_MonsterIcon_/i },
}
const ANY_ICON_RE = /^UI_[A-Za-z]+_/

/* 官方把旅行者拆成男女两张官方图，我们要的是仓库里那张自制的。 */
const OFFICIAL_TRAVELER_RE = /^UI_AvatarIcon_Player(Boy|Girl)/i

/* 不被源影响、必须存在的条目。本地已有同 key 的行就完全不动它。
   旅行者·冰 和旅行者共用头像和名片，只有立绘不同 ——
   字典的 key 不能重复（那是个对象），所以给它一个自己的 key（中文名），
   头像用 url 指回旅行者那张图（仓库里的图，走站点绝对路径）。 */
const TRAVELER_ICON = `${BASE}images/game/UI_AvatarIcon_Traveler.webp`
const TRAVELER_CARD = 'Ysxf6'
const FORCED_LOCAL = {
  characters: [
    {
      key: 'Traveler',
      name: '旅行者',
      order: 1,
      star: 5,
      url: TRAVELER_ICON,
      card: { key: TRAVELER_CARD, url: '' },
    },
    {
      key: '旅行者·冰',
      name: '旅行者·冰',
      order: 1,
      star: 5,
      url: TRAVELER_ICON,
      card: { key: TRAVELER_CARD, url: '' },
    },
  ],
}

/* =========================================================================
 * 代号：全名 / 网址 / 仓库路径 → 只剩最后那一截
 * ========================================================================= */

function codeFrom(input, type = '', slot = '') {
  let s = String(input || '').trim()
  if (!s) return ''
  s = s.split('/').pop().split('?')[0] /* 网址和仓库路径都取最后一段 */
  const hadExt = /\.[a-z0-9]+$/i.test(s)
  s = s.replace(/\.[a-z0-9]+$/i, '')

  const re = (ICON_RE[type] || {})[slot] || (ICON_RE[type] || {})[''] || ANY_ICON_RE
  let hit = false
  if (re.test(s)) {
    s = s.replace(re, '')
    hit = true
  }
  if (ANY_ICON_RE.test(s)) {
    s = s.replace(ANY_ICON_RE, '')
    hit = true
  }
  /* 认不出图标名前缀、又带着扩展名（比如官网那一长串哈希名）→ 不当代号 */
  if (!hit && hadExt) return ''
  if (slot === 'card') s = s.replace(/_P$/i, '')
  return s
}

/* 英文名：头像表是 'Amber'，名片表是 'Amber: Bunny' / 'Kirara: Neko Box' —— 取冒号前那段 */
const routeKey = (s) => String(s || '').split(':')[0].trim().toLowerCase()

/* 一条条目的识别码（去重用）：
   角色 = 代号（头像代号唯一，能一一对应）；武器 / 圣遗物 / 怪物 = ID ——
   这三个分类只有 ID 是唯一的，同一张图会被好几条共用，按代号去重会把条目吃掉。 */
const identOf = (type, row) =>
  type === 'characters' ? row.key || '' : String(row.order || row.key || '')

/* 仓库内路径（shared/… / ../shared/… / /genshin-guide/shared/…）→ 站点绝对路径。
   http 开头的不动。 */
function repoUrl(input) {
  const s = String(input || '').trim()
  if (!s || /^https?:\/\//i.test(s)) return ''
  const i = ['shared/', 'images/', 'fonts/', 'data/', 'saves/'].map((k) => s.indexOf(k)).filter((n) => n >= 0).sort((a, b) => a - b)[0] ?? -1
  return i < 0 ? '' : BASE + s.slice(i)
}

/* 两个地址是不是同一张图：只看路径，不比扩展名。
   lunaris 同一张图 .png / .webp 都可能给出（旧数据里存的是 .png），
   不比扩展名才能把它们认成「主源地址」而不是「手填的链接」。 */
function sameAsset(a, b) {
  const cut = (s) =>
    String(s || '')
      .split('?')[0]
      .replace(/\.[a-z0-9]+$/i, '')
  return !!a && !!b && cut(a) === cut(b)
}

/* =========================================================================
 * 颜色：与 shared/image-loader.js 里的 darken() 逐式相同
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
 * 序列化：导出 image-dict.js 的逐字格式
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
  if (o.alt) p.push('alt: true')
  return `{ ${p.join(', ')} }`
}

function litRow(row, dictKey = '') {
  const p = [`name: "${escJs(row.name)}"`]
  /* 识别码不是代号时（三个分类用 ID），把图标代号写进条目里 —— 拼图还要用它 */
  if (row.key && row.key !== dictKey) p.push(`key: "${escJs(row.key)}"`)
  if (row.star != null) p.push(`star: ${row.star}`)
  p.push(`order: ${row.order || 0}`)
  if (row.url) p.push(`url: "${escJs(row.url)}"`)
  if (row.alt) p.push('alt: true')
  if (row.lock) p.push('lock: true')
  if (row.nameLock) p.push('nameLock: true')
  if (row.card) p.push(`card: ${litSlot(row.card)}`)
  if (row.art) p.push(`art: ${litSlot(row.art)}`)
  return `{ ${p.join(', ')} }`
}

function serializeDict(config, data) {
  const lines = ['window.IMAGE_DICT = {', '  config: {']

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
      /* 字典键 = 识别码：角色是代号；武器 / 圣遗物 / 怪物是 ID（同一张图可能有好几条） */
      const dictKey = identOf(type, item)
      lines.push(`    "${escJs(dictKey)}": ${litRow(item, dictKey)}${tail}`)
    })

    lines.push(`  }${ti < TYPES.length - 1 ? ',' : ''}`)
  })

  lines.push('};', '')
  return lines.join('\n')
}

/* 深拷贝一行，字段一个不漏 —— 合并逻辑里所有「保留旧行」都走它。 */
function cloneRow(row) {
  const out = { key: row.key, name: row.name || '', order: row.order || 0 }
  if (row.star != null) out.star = row.star
  if (row.url) out.url = row.url
  if (row.alt) out.alt = true
  if (row.lock) out.lock = true
  if (row.nameLock) out.nameLock = true
  if (row.card) out.card = { ...row.card }
  if (row.art) out.art = { ...row.art }
  return out
}

function readSlot(o) {
  if (!o || typeof o !== 'object') return null
  const s = { key: o.key || '', url: o.url || '' }
  if (o.alt) s.alt = true
  return s.key || s.url ? s : null
}

/* 老数据归一：全名 key → 代号；local:true → 站点绝对路径。
   「其实是源拼得出来的链接」那部分交给 tidyRow（要用到 config，得在实例里做） */
function migrateRow(row, type) {
  if (row.local) {
    /* 老格式：key 就是文件名（仓库里的图放 public/images/game/） */
    if (!row.url) row.url = `${BASE}images/game/${row.key}`
    delete row.local
  } else if (row.url && !/^https?:\/\//i.test(row.url)) {
    const r = repoUrl(row.url)
    if (r) row.url = r
  }
  row.key = codeFrom(row.key, type)

  SLOTS.forEach((s) => {
    if (!s || !row[s]) return
    const o = row[s]
    if (o.local) {
      if (o.url && !/^https?:\/\//i.test(o.url)) o.url = repoUrl(o.url) || o.url
      delete o.local
    }
    o.key = codeFrom(o.key, type, s)
    if (!o.key && !o.url) delete row[s]
  })

  return row
}

function dictToRows(dict, type) {
  const obj = dict[type] || {}
  return Object.keys(obj).map((k) => {
    const item = obj[k] || {}
    /* 角色：键就是代号；三个分类：键是 ID，代号存在条目里的 key
       （老字典没有这个字段 → 退回用键当代号，照样读得进来） */
    const key = type === 'characters' ? k : item.key || k
    const order = item.order || (type === 'characters' ? 0 : parseInt(k, 10) || 0)
    const row = { key, name: item.name || '', order }
    if (item.star != null) row.star = item.star
    if (item.local) row.local = true
    if (item.url) row.url = item.url
    if (item.alt) row.alt = true
    if (item.lock) row.lock = true
    if (item.nameLock) row.nameLock = true
    const card = readSlot(item.card)
    const art = readSlot(item.art)
    if (card) row.card = card
    if (art) row.art = art
    return migrateRow(row, type)
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

export function useImageDict() {
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
  /* 代号 / 小写代号 / id / 'n:中文名' / 'r:英文名' / 'c:名片代号' → API 原始条目 */
  const amberIndex = {}
  /* { byRoute, byCode } —— 名片表索引，只收 bond 类 */
  let cardMap = null
  /* 立绘列表（由图片字典现算，见 fetchPortraits） */
  let portraitList = null

  /* ---------------- 存储 ---------------- */

  function writeLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, dirty: dirty.value }))
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

    if (parsed.data && typeof parsed.data === 'object') {
      TYPES.forEach((t) => {
        data[t] = Array.isArray(parsed.data[t])
          ? parsed.data[t].map((row) => tidyRow(migrateRow(row, t), t))
          : []
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

  /* 序号表改从图片字典现算：字典里「旅行者·冰」这类分元素条目是独立一条，
     序号 1 还是只认第一个登记的那个，跟 txt 那版行为一致 */
  async function loadCharOrder() {
    try {
      if (!window.IMAGE_DICT) await fetchDict()
      const dict = window.IMAGE_DICT?.characters || {}

      for (const k of Object.keys(orderToName)) delete orderToName[k]
      for (const k of Object.keys(nameToOrder)) delete nameToOrder[k]

      for (const [key, item] of Object.entries(dict)) {
        const name = item.name || key
        const order = parseInt(item.order, 10)
        if (!order || !name) continue
        nameToOrder[name] = order
        if (!orderToName[order]) orderToName[order] = name
      }
    } catch (e) {
      toast.error('角色序号加载失败：' + e.message)
    }
  }

  /* 立绘清单改成从图片字典现算：字典的 art.url 就是要用的地址，
     条目自己没记代号时按地址反推一个（codeFrom），与 txt 那版一致。 */
  async function fetchPortraits() {
    if (portraitList) return portraitList
    if (!window.IMAGE_DICT) await fetchDict()

    const list = []
    for (const [key, item] of Object.entries(window.IMAGE_DICT?.characters || {})) {
      const addr = item.art?.url
      if (!addr) continue
      list.push({
        order: parseInt(item.order, 10) || 0,
        name: item.name || key,
        art: { key: item.art?.key || codeFrom(addr, 'characters', 'art'), url: addr },
      })
    }

    portraitList = list
    return list
  }

  async function fetchDict() {
    delete window.IMAGE_DICT
    return loadGlobalScript(`${DICT_SRC}?t=${Date.now()}`, 'IMAGE_DICT')
  }

  async function loadDict() {
    busy.value = '正在从仓库载入…'
    try {
      const dict = (await fetchDict()) || {}
      /* config 只导出不读 —— 地址规则由 DEFAULT_CONFIG 说了算，
         免得载入一份老 prefix 的字典后地址全拼错 */
      TYPES.forEach((t) => {
        data[t] = dictToRows(dict, t).map((row) => tidyRow(row, t))
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

  /* 这一条还有没有该补的东西。名片最常见 ——
     以前只有「名字框失焦」那一条路会去补它，所以缺名片的行得人工踢一脚 */
  const needFill = (row) =>
    !!row && (!row.key || !row.name || row.star == null || missingCard(row))

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

  /* ---------------- 地址规则 ---------------- */

  function slotCfg(type, slot) {
    const cfg = config[type] || {}
    if (!slot) return { src: { prefix: cfg.prefix, ext: cfg.ext }, alt: cfg.alt }
    if (slot === 'card') return { src: cfg.card, alt: cfg.card?.alt }
    return { src: null, alt: null } /* 立绘没有自动源 */
  }

  /* 这一格该用哪组规则：带 alt 标记就用备用源 */
  function srcOf(type, slot, useAlt) {
    const c = slotCfg(type, slot)
    return useAlt && c.alt?.prefix ? c.alt : c.src
  }

  const joinSrc = (src, key) => (src?.prefix && key ? src.prefix + key + (src.ext || '') : '')
  const stdUrl = (type, slot, code, useAlt) => joinSrc(srcOf(type, slot, useAlt), code)

  /* 这一格有没有备用源可切 */
  const hasAlt = (type, slot) => !!slotCfg(type, slot).alt?.prefix

  /* 槽位现在用不用备用源（详情界面那个勾） */
  const slotAlt = (row, slot) => !!row && (slot ? !!row[slot]?.alt : !!row.alt)

  /* 一个地址属于谁：'main' 主源拼得出来的 · 'alt' 备用源拼得出来的 · 'url' 都不是 */
  function urlKind(type, slot, url, code) {
    const c = code || codeFrom(url, type, slot)
    if (!c) return 'url'
    if (sameAsset(url, stdUrl(type, slot, c, false))) return 'main'
    if (hasAlt(type, slot) && sameAsset(url, stdUrl(type, slot, c, true))) return 'alt'
    return 'url'
  }

  function slotSrc(type, row, slot = '') {
    if (!row) return { src: '', alt: '' }
    if (!slot) {
      if (row.url) return { src: row.url, alt: '' }
      const useAlt = hasAlt(type, '') && !!row.alt
      return {
        src: joinSrc(srcOf(type, '', useAlt), row.key),
        alt: joinSrc(srcOf(type, '', !useAlt), row.key),
      }
    }

    const o = row[slot]
    if (!o) return { src: '', alt: '' }
    if (o.url) return { src: o.url, alt: '' } /* 兜底链接 / 仓库绝对路径 */
    const useAlt = hasAlt(type, slot) && !!o.alt
    return {
      src: joinSrc(srcOf(type, slot, useAlt), o.key),
      alt: joinSrc(srcOf(type, slot, !useAlt), o.key),
    }
  }

  /* 把「其实就是源拼得出来的那条链接」化简：主源的 → 干脆不存；
     备用源的 → 换成 alt 标记。存死链接只留给源拼不出来的（仓库图、官网那串）。 */
  function tidySrc(o, type, slot) {
    if (!o.url || !/^https?:\/\//i.test(o.url)) return
    const kind = urlKind(type, slot, o.url, codeFrom(o.key, type, slot))
    if (kind === 'main') {
      o.url = ''
      delete o.alt
    } else if (kind === 'alt') {
      o.url = ''
      o.alt = true
    }
  }

  function tidyRow(row, type) {
    tidySrc(row, type, '')
    SLOTS.forEach((s) => {
      if (s && row[s]) tidySrc(row[s], type, s)
    })
    return row
  }

  /* 猜出来的地址能不能真加载。跨域也能拿到 onload/onerror，不需要 CORS。 */
  function probe(url) {
    return new Promise((done) => {
      if (!url) {
        done(false)
        return
      }
      const img = new Image()
      img.onload = () => done(true)
      img.onerror = () => done(false)
      img.src = url
    })
  }

  /* 名片代号能不能用（主源、备用源各试一次） */
  async function cardOk(code) {
    if (!code) return false
    const c = slotCfg('characters', 'card')
    return (await probe(joinSrc(c.src, code))) || (await probe(joinSrc(c.alt, code)))
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

  /* 怪物专用：地方传奇在大世界和深渊里名字不一样，源只给深渊那个。
     打勾 = 以我手填的名字为准：同步不再改这个名字，图 / 星级 / 序号照旧跟源走。 */
  function setNameLock(row, value) {
    row.nameLock = !!value
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

  /* 选中一条就顺手补它缺的（名片最常见），补过就不再请求。
     以前这一步只在「名字框失焦」时发生，缺名片的行没人碰就一直缺着。 */
  function select(row) {
    activeKey.value = row?.key || ''
    if (row && tab.value === 'characters' && needFill(row)) {
      hydrate(row, row.key ? 'avatar' : 'name')
    }
  }

  /* ---------------- 槽位 ---------------- */

  function ensureSlot(row, slot) {
    if (!row[slot]) row[slot] = { key: '', url: '' }
    return row[slot]
  }

  /* 落一个地址：
     1. 仓库路径（…/shared/…）→ 站点绝对路径，存 url
     2. 对得上主源规则 → 只记代号
     3. 对得上备用源规则 → 只记代号 + alt: true
     4. 两组都对不上 → 存 url 兜底 */
  function applyUrl(row, slot, raw) {
    const url = String(raw || '').trim()
    if (!url) return ''

    const type = tab.value

    const repo = repoUrl(url)
    if (repo) {
      if (slot) {
        const o = ensureSlot(row, slot)
        o.key = ''
        o.url = repo
        delete o.alt
      } else {
        row.url = repo
        delete row.alt
      }
      markDirty()
      return ''
    }

    const code = codeFrom(url, type, slot)
    const kind = urlKind(type, slot, url, code)
    const keepUrl = kind === 'url'

    const put = (o) => {
      o.key = code
      o.url = keepUrl ? url : ''
      if (kind === 'alt') o.alt = true
      else delete o.alt
    }

    if (slot) {
      const o = ensureSlot(row, slot)
      put(o)
      markDirty()
      return code
    }

    /* 头像：代号就是这一行的身份 —— 以你粘的为准 */
    const oldKey = row.key
    /* 角色：代号就是身份，不能重复；三个分类：身份是 ID，同一张图可以被好几条共用 */
    if (type === 'characters' && code && data[type].some((r) => r !== row && r.key === code)) {
      toast.error('这个代号已经被另一条占用了')
      row.url = url
      delete row.alt
    } else if (code) {
      row.key = code
      put(row)
      if (activeKey.value === oldKey) activeKey.value = code
    } else {
      row.url = url
      delete row.alt
    }
    markDirty()
    return code
  }

  function clearSlot(row, slot) {
    if (slot) delete row[slot]
    else {
      row.url = ''
      delete row.alt
    }
    markDirty()
  }

  function setSlotAlt(row, slot, value) {
    if (slot) {
      const o = ensureSlot(row, slot)
      if (value) o.alt = true
      else delete o.alt
    } else if (value) row.alt = true
    else delete row.alt
    markDirty()
  }

  /* ---------------- 源优先级：lunaris（默认） > Amber（备用） ---------------- */

  /* 四个分类在 lunaris 的清单文件名 */
  const LU_LISTS = {
    characters: 'charlist',
    weapons: 'weaponlist',
    artifacts: 'artifactlist',
    monsters: 'monsterlist',
  }

  /* lunaris 只给 qualityType，Amber 给 rank —— 换算成同一档 */
  /* lunaris 只给 qualityType，Amber 给 rank —— 换算成同一档。
     ⚠ QUALITY_GREEN 同时盖住 1 星和 2 星（无锋剑 11101 与 银剑 11201 都是这一档），
        所以武器一律改用 id 里的星数（weaponStar），这张表只给其余分类用。 */
  const QUALITY_RANK = {
    QUALITY_ORANGE: 5,
    QUALITY_ORANGE_SP: 5,
    QUALITY_PURPLE: 4,
    QUALITY_BLUE: 3,
    QUALITY_GREEN: 1, /* 这一档有歧义（1★/2★ 都落在这里），武器不用它；别的分类暂时用不到 */
    QUALITY_GRAY: 1,
  }

  /* Genshin 武器 id = 1 + 武器类型 + 星数 + 序号：
     11101 无锋剑(1★) / 11201 银剑(2★) / 11419 「一心传」名刀(4★) / 11517 银昼(5★)。
     260 把武器逐条与 Amber 的 rank 对过：共同 id 253/253 一致，只有 lunaris 有的 7 把也自洽。 */
  const weaponStar = (id) => {
    const s = String(id)
    return s.length === 5 && s[0] === '1' ? Number(s[2]) || null : null
  }

  /* 各分类的图标字段名（角色的 CardImg 是 UI_Gacha_AvatarIcon_，要换成头像那套前缀） */
  const LU_ICON = {
    characters: (c) => String(c.CardImg || '').replace(/^UI_Gacha_AvatarIcon_/, 'UI_AvatarIcon_'),
    weapons: (c) => String(c.weaponIcon || ''),
    artifacts: (c) => String(c.setIcon || ''),
    monsters: (c) => String(c.icon || ''),
  }

  /* 版本号必须现读：lunaris 的清单路径带版本（现在 7.2.51），写死就永远停在旧版 */
  let lunarisVer = ''
  async function lunarisVersion() {
    if (lunarisVer) return lunarisVer
    const res = await fetch('https://api.lunaris.moe/data/version.json', { cache: 'no-store' })
    lunarisVer = (await res.json()).version
    return lunarisVer
  }

  /* lunaris 清单 → 与 Amber 同形状的条目（多一个 source 标记，供备用源判定用） */
  async function fetchLunarisList(type) {
    const res = await fetch(
      `https://api.lunaris.moe/data/${await lunarisVersion()}/${LU_LISTS[type]}.json`,
      { cache: 'no-store' },
    )
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const list = await res.json()
    const out = {}
    Object.keys(list).forEach((id) => {
      const c = list[id] || {}
      const icon = LU_ICON[type](c)
      if (!icon) return
      out[id] = {
        id: Number(String(id).split('_')[0]) || 0,
        name: c.chsName,
        icon,
        rank: (type === 'weapons' ? weaponStar(id) : null) || QUALITY_RANK[c.qualityType] || null,
        route: c.enName || '',
        source: 'lunaris',
      }
    })
    return out
  }

  /* 取条目：lunaris 有就用 lunaris（含未实装），它没有的才落 Amber。
     两边 id 与图标代号逐条核对过，完全一致，所以覆盖不会产生重复行。 */
  async function fetchIndex(type) {
    const [lu, am] = await Promise.all([
      fetchLunarisList(type).catch(() => null),
      fetchAmber(type).catch(() => null),
    ])
    const merged = Object.assign({}, am || {})
    /* 星级以 Amber 的自报 rank 为准（它是精确星数；lunaris 的 qualityType 在低星档有歧义），
       Amber 没有这条时才用 lunaris 推出来的 rank */
    if (lu) {
      Object.keys(lu).forEach((id) => {
        const prev = merged[id]
        merged[id] = prev && prev.rank != null ? { ...lu[id], rank: prev.rank } : lu[id]
      })
    }
    if (!Object.keys(merged).length) throw new Error('两个源都没拿到' + LABELS[type])
    return merged
  }

  /* ---------------- Amber（备用源） ---------------- */

  async function fetchAmber(type) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(AMBER_ENDPOINTS[type], { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const json = await res.json()
      return (json.data && json.data.items) || json.data || json
    } finally {
      clearTimeout(timer)
    }
  }

  /* 名片表 → 英文名索引 + 代号索引，只收 type === 'bond'
     （纪行 / 活动 / 成就名片不属于任何角色） */
  async function fetchCardMap() {
    if (cardMap) return cardMap
    const items = await fetchAmber('namecard')
    const map = { byRoute: {}, byCode: {} }

    Object.keys(items).forEach((k) => {
      const it = items[k]
      if (!it || it.type !== 'bond' || !it.icon || !it.name) return
      const code = codeFrom(it.icon, 'characters', 'card')
      if (!code) return

      const route = routeKey(it.route)
      if (route && !map.byRoute[route]) map.byRoute[route] = code
      if (!map.byCode[code]) {
        map.byCode[code] = { code, route, who: String(it.name).split('·')[0].trim() }
      }
    })

    cardMap = map
    return map
  }

  /* 角色条目 → 名片代号：
     ① 源直接给的（详情接口 nameCard）② 按英文名 route 对上 ③ 同名代换 */
  function cardCodeFor(item, cards = null) {
    if (item.nameCard?.icon) return codeFrom(item.nameCard.icon, 'characters', 'card')
    const hit = cards?.byRoute[routeKey(item.route)]
    if (hit) return hit
    return codeFrom(item.icon, 'characters', 'card')
  }

  /* API 条目 → 字段。**不带任何排除规则**，手动粘贴也用它。 */
  function deriveFields(type, item, cards = null) {
    if (type === 'characters') {
      const out = { name: item.name, star: item.rank || 5, order: nameToOrder[item.name] || 0 }
      const card = item.cardCode || cardCodeFor(item, cards)
      if (card) out.card = { key: card, url: '' }
      return out
    }
    if (type === 'weapons') {
      return { name: item.name, star: item.rank || 5, order: item.id || 0 }
    }
    if (type === 'artifacts') {
      /* lunaris 的圣遗物不给 levelList，只给 qualityType —— 落到 rank */
      const star =
        Array.isArray(item.levelList) && item.levelList.length
          ? Math.max.apply(null, item.levelList)
          : item.rank || 5
      return { name: item.name, star, order: item.id || 0 }
    }
    return { name: item.name, star: null, order: item.id || 0 }
  }

  function transformAmber(type, items, cards = null) {
    const kept = {}
    const skipped = new Set()

    /* 怪物 2 区（正经 id）的名字集合，给下面认重复用 */
    const baseNames = new Set(
      type === 'monsters'
        ? Object.keys(items)
            .filter((id) => id.startsWith('2'))
            .map((id) => items[id]?.name)
            .filter(Boolean)
        : [],
    )

    Object.keys(items).forEach((id) => {
      const item = items[id]
      if (!item || !item.icon || !item.name) return
      const code = codeFrom(item.icon, type)
      if (!code) return

      if (type === 'characters') {
        if (OFFICIAL_TRAVELER_RE.test(item.icon)) {
          skipped.add(code)
          return
        }
        if (!nameToOrder[item.name]) return /* 软排除：只不加 */
      } else if (type === 'weapons') {
        const order = item.id || 0
        if (order < 10000 || order >= 100000) {
          skipped.add(code)
          return
        }
      } else if (type === 'monsters') {
        const mid = String(item.id || '')
        if (mid.startsWith('28')) {
          skipped.add(code)
          return
        }
        /* 3 / 8 区是 lunaris 给同一只怪另开的重复 id（还有 (test)WQ-BOSS- 这种测试条目）：
           名字在 2 区已经有的就跳过，按 **id** 记进排除表（不记代号 ——
           同一个代号常被好几条共用，记代号会把正经条目一起清掉）。
           第 2 遍合并时，本地那些 3 / 8 序号的旧行就是靠这个被清掉的。 */
        if (/^[38]/.test(mid) && baseNames.has(item.name)) {
          skipped.add(mid)
          return
        }
      }

      /* 识别码：角色是代号；武器 / 圣遗物 / 怪物是 **ID** ——
         同一张图被好几条共用（怪物 842 条 → 384 个代号，168 个被共用），
         按代号归并会把它们合成一条，所以按 ID 存、各列一行。 */
      const keepKey = type === 'characters' ? code : String(item.id || code)

      /* source 带上：只有备用源有的条目，建行时要把图切到备用源 */
      kept[keepKey] = { ...deriveFields(type, item, cards), source: item.source }
    })

    return { kept, skipped }
  }

  /* 一张扁平索引：代号 / 小写代号 / id / 中文名 都能查到条目。
     角色额外登记英文名和名片代号，供「粘名片 URL」反查。 */
  async function ensureAmberIndex(type) {
    if (amberIndex[type]) return amberIndex[type]

    const [items, cards] = await Promise.all([
      fetchIndex(type),
      type === 'characters' ? fetchCardMap().catch(() => null) : Promise.resolve(null),
    ])

    /* 同一个代号可能对应好几条（一张图被好几条共用）→ 另外存一份多值表，新增时挑用 */
    const map = { byCode: {} }
    Object.keys(items).forEach((k) => {
      const raw = items[k]
      if (!raw || !raw.icon || !raw.name) return
      const code = codeFrom(raw.icon, type)
      if (!code) return
      /* 名片代号一次算好挂上去，后面 hydrate / addByName 直接用 */
      const item = cards ? { ...raw, cardCode: cardCodeFor(raw, cards) } : raw

      /* 同一个代号可能对应好几条 → 全存一份，新增时挑用。
         map[code] 保持「末位赢」= 默认主源 lunaris（它的条目排在后面）。 */
      if (!map.byCode[code]) map.byCode[code] = []
      map.byCode[code].push(item)
      map[code] = item
      if (!map[code.toLowerCase()]) map[code.toLowerCase()] = item
      if (raw.id != null && !map[String(raw.id)]) map[String(raw.id)] = item
      if (!map['n:' + raw.name]) map['n:' + raw.name] = item

      if (type === 'characters') {
        const rt = routeKey(raw.route)
        if (rt && !map['r:' + rt]) map['r:' + rt] = item
        const cc = item.cardCode
        if (cc && !map['c:' + cc]) map['c:' + cc] = item
        /* 名片代号 == 头像代号的情况也登记一份（公子 Tartaglia / 一斗 Itto） */
        if (!map['c:' + code]) map['c:' + code] = item
      }
    })

    amberIndex[type] = map
    return map
  }

  /* 源里按中文名找条目（各分类都适用，「n:」是索引里的中文名键） */
  async function itemByName(name) {
    const n = String(name || '').trim()
    if (!n) return null
    const map = await ensureAmberIndex(tab.value)
    return map['n:' + n] || map['n:' + n.split('·')[0]] || null
  }

  /* 反查：这一条对应源里的哪个条目。from = 'name' | 'avatar' | 'card' */
  async function itemFrom(row, from) {
    if (from === 'name') return itemByName(row.name)

    if (from === 'card') {
      const c = codeFrom(row.card?.key || row.card?.url || '', 'characters', 'card')
      if (!c) return null
      const map = await ensureAmberIndex('characters')
      if (map['c:' + c]) return map['c:' + c]
      if (map[c]) return map[c]
      const cards = await fetchCardMap().catch(() => null)
      const hit = cards?.byCode[c]
      if (!hit) return null
      return map['r:' + hit.route] || map['n:' + hit.who] || null
    }

    if (!row.key) return null
    const map = await ensureAmberIndex('characters')
    return map[row.key] || map[String(row.key).toLowerCase()] || null
  }

  /* 补齐这一条：名字、头像代号、星级、名片代号。
     只有空着的才补 —— 你填过的绝不覆盖。 */
  async function hydrate(row, from) {
    let item = null
    try {
      item = await itemFrom(row, from)
    } catch {
      item = null
    }
    if (!item && !row.key) return false

    let changed = false
    if (!row.name && item?.name) {
      row.name = item.name
      changed = true
    }
    if (!row.key && item) {
      row.key = codeFrom(item.icon, 'characters')
      changed = true
    }
    if (row.star == null && item?.rank) {
      row.star = item.rank
      changed = true
    }

    /* 这条只有备用源（Amber）有 → 图也走备用源，否则拼出来的是主源的 404 */
    if (item?.source === 'amber' && !row.alt && !row.url) {
      row.alt = true
      changed = true
    }

    /* 名片：源里给了就用源的；源里没有这个角色（未实装）就同名代换，
       代换出来的地址要真能加载才算数 */
    if (missingCard(row) && row.key) {
      const code = item?.cardCode || ((await cardOk(row.key)) ? row.key : '')
      if (code) {
        row.card = { key: code, url: '' }
        changed = true
      }
    }

    if (changed) markDirty()
    return changed
  }

  /* ---------------- 新增（名字 / 链接 一个入口） ---------------- */

  /* ---------------- 新增：ID / 代号 / 链接 / 中文名 一个入口 ---------------- */

  /* 「新增」时同代号命中多条的候选列表（界面来挑） */
  const addCandidates = ref([])

  /* ID 是唯一值 → 直接定位一条 */
  async function itemById(id) {
    const map = await ensureAmberIndex(tab.value)
    return map[String(id)] || null
  }

  /* 代号 → 可能命中多条（同一张图被好几条共用），返回全部候选 */
  async function itemsByKey(key) {
    const map = await ensureAmberIndex(tab.value)
    const list = map.byCode?.[key] || []
    return list.length ? list : map[key] ? [map[key]] : []
  }

  /* 解析「新增」输入：ID / 代号 / 带代号的链接 / 中文名 → 候选条目。
     ID 唯一命中；代号或链接先取代号、可能命中多条（交给界面挑）；最后兜底按中文名。 */
  async function resolveAdd(text) {
    const s = String(text || '').trim()
    if (!s) return []
    /* ID：纯数字且长度 ≥ 5（怪物 8 位、武器 / 圣遗物 5 位）；代号都带字母或下划线，不会撞 */
    if (/^\d{5,}$/.test(s)) {
      const hit = await itemById(s)
      if (hit) return [hit]
    }
    const key = codeFrom(s, tab.value)
    if (key) {
      const hits = await itemsByKey(key)
      if (hits.length) return hits
    }
    const hit = await itemByName(s)
    return hit ? [hit] : []
  }

  /* 用一条源条目建一行（addByName / 挑候选 共用） */
  function addItem(item, fallbackName = '') {
    const type = tab.value
    const f = deriveFields(type, item)
    const row = {
      key: codeFrom(item.icon, type),
      name: f.name || fallbackName || '',
      order: f.order || 0,
      star: f.star,
    }
    /* 源里这条只有备用源有 → 图也走备用源 */
    if (item.source === 'amber') row.alt = true
    if (f.card) row.card = { ...f.card }
    data[type].push(row)
    markDirty()
    if (type === 'characters') activeKey.value = row.key
    return row
  }

  /* 同代号命中多条时挑一条建行 */
  function pickAddCandidate(item) {
    const row = addItem(item)
    addCandidates.value = []
    toast.success(`已加入「${row.name}」`)
    return row
  }

  /* 按中文名从源里捞一条出来（四个分类都能用） */
  async function addByName(name) {
    const type = tab.value
    const n = String(name || '').trim()
    if (!n) {
      toast.error('先填名字')
      return false
    }
    if (data[type].some((r) => r.name === n)) {
      toast.error(`「${n}」已经在列表里了`)
      return false
    }

    let item = null
    try {
      item = await itemByName(n)
    } catch (e) {
      toast.error('取源失败：' + e.message)
      return false
    }
    if (!item) {
      toast.error(`源里没有「${n}」——可以粘它的图标链接`)
      return false
    }
    if (type === 'characters' && OFFICIAL_TRAVELER_RE.test(item.icon)) {
      toast.error('旅行者是特殊条目（字典里已经占位），不用新增')
      return false
    }

    const row = addItem(item, n)
    toast.success(
      type === 'characters' && !row.order
        ? `已加入「${row.name}」（序号表里没有，序号 0）`
        : `已加入「${row.name}」`,
    )
    return true
  }

  /* 一个输入框干四件事：
     单行 → 解析：ID / 代号 / 链接 / 中文名 都能认；能定到唯一一条就建行，
           定不到唯一一条（同一张图被好几条共用）就把候选交给界面挑。
     多行 → 走批量解析（粘链接那套，本来就会自己查源补名字 / 序号）。 */
  async function addFromInput(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    if (!lines.length) {
      toast.error('先填点什么')
      return false
    }

    const one = lines.length === 1 ? lines[0] : ''
    if (one) {
      const cands = await resolveAdd(one)
      if (!cands.length) {
        toast.error('没认出来：可以是 ID（如 26310601）、代号（如 Chimera_OwlPangolin_02）、图标链接，或中文名')
        return false
      }
      if (cands.length === 1) {
        addItem(cands[0], one)
        return true
      }
      /* 同一张图被好几条共用 → 交给界面挑 */
      addCandidates.value = cands
      return false
    }

    await parsePastedUrls(lines.join('\n'))
    return true
  }

  /* ---------------- 粘贴链接（批量） ---------------- */

  async function parsePastedUrls(text) {
    const type = tab.value
    const urls = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && (/^https?:\/\//i.test(l) || !!repoUrl(l) || !!codeFrom(l, type)))

    if (!urls.length) {
      toast.error('没认出链接或代号')
      return
    }

    const list = data[type]
    const byKey = {}
    list.forEach((row) => {
      if (row.key) byKey[row.key] = row
    })

    const created = []
    urls.forEach((url) => {
      const repo = repoUrl(url)
      const code = repo ? '' : codeFrom(url, type)
      if (!code && !repo) return
      const key = code || repo.split('/').pop()

      const existing = byKey[key]
      if (existing) {
        applyUrl(existing, '', url)
        return
      }
      const row = { key, name: '', order: 0, star: type === 'monsters' ? null : 5 }
      const kind = repo ? 'url' : urlKind(type, '', url, code)
      if (kind === 'url') row.url = repo || url
      else if (kind === 'alt') row.alt = true
      list.push(row)
      byKey[key] = row
      created.push(row)
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
      for (const row of created) {
        const item = map[row.key] || map[String(row.key).toLowerCase()]
        if (item) {
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
        }
        /* 源里没有这个角色（未实装）：名片代号同名代换，验得出来就填 */
        if (type === 'characters' && missingCard(row) && row.key) {
          if (await cardOk(row.key)) {
            row.card = { key: row.key, url: '' }
            changed = true
          }
        }
      }

      if (changed) markDirty()
      busy.value = ''
    }

    toast.success('解析完成')
  }

  /* ---------------- 同步（合并规则 v13） ---------------- */

  /* 返回 { entry, conflicts }：
     conflicts = 源里的代号与你手填的代号不一致的项，**先按你的保留**，
     交给界面弹窗让你逐条选。 */
  async function syncFromAmber() {
    const before = JSON.parse(JSON.stringify(data))
    const conflicts = []

    /* 角色要额外的名片表：头像列表接口不带 nameCard */
    let cards = null
    busy.value = '正在拉取名片表…'
    try {
      cards = await fetchCardMap()
    } catch {
      cards = null
    }

    const amber = {}
    const excluded = {}
    for (const type of TYPES) {
      busy.value = '正在拉取' + LABELS[type] + '…'
      try {
        const picked = transformAmber(
          type,
          await fetchIndex(type),
          type === 'characters' ? cards : null,
        )
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
      const byIdent = {}
      const byName = {}
      ;(data[type] || []).forEach((row) => {
        if (!row.key && !row.order) return
        byIdent[identOf(type, row)] = row
        if (row.name && !byName[row.name]) byName[row.name] = row
      })

      /* 强制存在的条目（旅行者那两行）：本地已经有同 key 的行就完全不动 */
      ;(FORCED_LOCAL[type] || []).forEach((row) => {
        const id = identOf(type, row)
        if (!id || byIdent[id]) return
        byIdent[id] = row
        if (row.name && !byName[row.name]) byName[row.name] = row
      })

      /* 1. 每个源条目：先按识别码找本地行（角色 = 代号，武器 / 圣遗物 / 怪物 = ID），
            找不到再按名字找（代号被手改过也认得出）。
            找到就合并 —— 你手填的槽位留着，其余字段跟源走 */
      Object.keys(amber[type] || {}).forEach((idKey) => {
        const item = amber[type][idKey]
        const prev = byIdent[idKey] || (item.name ? byName[item.name] : null)

        if (!prev) {
          /* 新行：source 是源标记，不进字典；只有 Amber 有的条目图走备用源 */
          const row = { ...item }
          delete row.source
          if (item.source === 'amber') row.alt = true
          merged[idKey] = row
          return
        }
        if (prev.lock) {
          merged[identOf(type, prev)] = cloneRow(prev) /* lock：整条都不碰 */
          return
        }

        const next = cloneRow(prev)
        /* 这条只有备用源有，而本地这行还没定图 → 图走备用源 */
        if (item.source === 'amber' && !prev.url && !prev.alt) next.alt = true
        /* 名字打了「以我为准」的勾 → 手填的名字固定，同步不改它（图、星级、序号照旧跟源） */
        if (item.name && !prev.nameLock) next.name = item.name
        if (item.star != null) next.star = item.star
        if (item.order) next.order = item.order

        /* 头像槽：带 url / alt 就留你的。
           角色的身份是代号 → 代号和源不一样就是另一条，先留你的并记冲突；
           武器 / 圣遗物 / 怪物的身份是 ID（下面 merged 也是按 ID 存的），
           key 只是拼图用的图标代号，同一个 ID 就是同一条，不存在这种冲突 */
        if (type === 'characters' && prev.key !== idKey) {
          conflicts.push({
            type,
            rowKey: prev.key,
            name: prev.name || item.name || '',
            slot: '',
            mine: prev.key,
            theirs: idKey,
          })
        }

        /* 名片槽：带 url / alt 就留你的；代号和源不一样就记冲突、先留你的；
           其余情况以源为准 —— 这一条以前漏了，导致名片永远填不进去 */
        if (prev.card?.url || prev.card?.alt) {
          next.card = { ...prev.card }
        } else if (prev.card?.key && item.card?.key && prev.card.key !== item.card.key) {
          conflicts.push({
            type,
            rowKey: prev.key,
            name: prev.name || item.name || '',
            slot: 'card',
            mine: prev.card.key,
            theirs: item.card.key,
          })
          next.card = { ...prev.card }
        } else if (item.card) {
          next.card = { ...item.card }
        }

        merged[identOf(type, next)] = next
      })

      /* 2. 源里没提到的本地行：原样留着（下架了，或者你手工加的）。
            硬排除的例外 —— 连本地旧条目一起清掉 */
      Object.keys(byIdent).forEach((k) => {
        if (merged[k]) return
        /* excluded 里存的是图标代号（比如 '28' 开头的动物），识别码是 ID → 两个都查 */
        if (excluded[type].has(k) || excluded[type].has(byIdent[k].key)) return
        merged[k] = cloneRow(byIdent[k])
      })

      data[type] = Object.keys(merged).map((k) => {
        const row = cloneRow(merged[k])
        /* 角色：识别码就是代号，字典键 = 代号；三个分类：识别码是 ID，
           key 仍是图标代号（拼图用），不能拿 k 覆盖它 */
        return type === 'characters' ? { ...row, key: k } : row
      })
    })

    /* ---- 源里没有的角色（未实装）：同步补不到名片，这里按「代号同名代换」再试一次 ---- */
    const holes = data.characters.filter((r) => r.key && missingCard(r))
    if (holes.length) {
      busy.value = `正在补名片（${holes.length} 条）…`
      for (const row of holes) {
        if (await cardOk(row.key)) {
          row.card = { key: row.key, url: '' }
          markDirty()
        }
      }
    }

    /* ---- 立绘：从图片字典灌进来 ----
       「有差异就更新」：字典是立绘的唯一来源，要改某张图就改字典。
       按名字对；名字对不上、而这个序号只有一个角色时才退到按序号对。 */
    busy.value = '正在导入立绘对照…'
    let portraitNote = ''
    try {
      const list = await fetchPortraits()
      if (list.length) {
        const byName = {}
        const byOrder = {}
        data.characters.forEach((row) => {
          if (row.name && !byName[row.name]) byName[row.name] = row
          if (row.order) (byOrder[row.order] = byOrder[row.order] || []).push(row)
        })

        let applied = 0
        const missed = []

        list.forEach((p) => {
          let row = byName[p.name]
          if (!row) {
            const same = byOrder[p.order]
            if (same && same.length === 1) row = same[0]
          }
          if (!row) {
            missed.push(p.name)
            return
          }

          const cur = row.art
          if (cur && (cur.key || '') === p.art.key && (cur.url || '') === p.art.url) return

          row.art = { ...p.art }
          applied++
        })

        const still = data.characters.filter((r) => missingArt(r)).length
        const head = missed.slice(0, 4).join('、')
        portraitNote =
          `立绘：写入 ${applied} 项` +
          (missed.length ? ` · 没对上 ${missed.length}（${head}${missed.length > 4 ? '…' : ''}）` : '') +
          (still ? ` · 仍缺 ${still} 项` : '')
      }
    } catch (e) {
      portraitNote = '立绘对照没读到：' + e.message
    }

    if (activeKey.value && !data.characters.some((r) => r.key === activeKey.value)) {
      activeKey.value = ''
    }

    markDirty()
    busy.value = ''
    if (portraitNote) toast.success(portraitNote)

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
        if (list.some((r) => r !== row && r.key === c.key)) return /* 目标代号被占 */
        if (activeKey.value === row.key) activeKey.value = c.key
        row.key = c.key
      } else {
        const keepAlt = !!row[c.slot]?.alt
        row[c.slot] = { key: c.key, url: '' }
        if (keepAlt) row[c.slot].alt = true
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
    a.download = 'image-dict.js'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)

    dirty.value = false
    writeLocal()
    toast.success('已导出 image-dict.js')
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
    needFill,
    /* 行操作 */
    slotSrc,
    starStyle,
    setOrder,
    setName,
    setNameLock,
    setStar,
    resolveAdd,
    addItem,
    addCandidates,
    pickAddCandidate,
    removeRow,
    clearTab,
    select,
    /* 槽位与反查 */
    applyUrl,
    clearSlot,
    hydrate,
    hasAlt,
    slotAlt,
    setSlotAlt,
    /* 新增 */
    addFromInput,
    addByName,
    /* 业务 */
    init,
    loadDict,
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

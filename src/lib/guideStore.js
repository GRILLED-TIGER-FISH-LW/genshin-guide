/* =========================================================================
 * 角色一图流 · 草稿与在线存档
 * =========================================================================
 * 草稿：IndexedDB，库 / 表 / 记录名与旧版逐字一致（genshin_card_db_v5 /
 *       card_store / current_state）—— 旧工具留下的草稿，新页面打开就能接上。
 * 在线存档：public/saves/characters/NNN.角色名.json，编号取字典里的 order。
 * 补齐图标：存档文件里只有名字、不存图片（整份 7KB 左右），载入后按名字问字典。
 * ========================================================================= */
import { toRaw } from 'vue'
import { dictConfig, dictEntry, matchIcon } from '../composables/useIconLib.js'
import { loadImageMeta } from './assets.js'
import { DEFAULTS } from './guideChart.js'
import { PANEL_PRIMARY_KEYS, themeToElementName, WEAPON_ORDER } from './guideConsts.js'

const BASE = import.meta.env.BASE_URL
const SAVE_DIR = `${BASE}saves/characters/`
const ELEMENT_DIR = `${BASE}images/element/`

const IDB_KEY = 'genshin_card_db_v5'
const STORE_NAME = 'card_store'
const RECORD = 'current_state'

const IMG_KEYS = ['charImg', 'nameBgImg', 'bgImg']
const TEXT_KEYS = [
  'charName', 'version', 'date', 'author', 'theme',
  'sandMain', 'gobMain', 'cirMain', 'subStats', 'talentA', 'talentE', 'talentQ',
  /* 字体：name / fileName 跟着存档走；data 是几兆的 base64，草稿里会被剔掉，
     重新打开时按 fileName 从 public/fonts/ 取回来（见页面上的 applyFontFromState） */
  'fontName', 'fontFileName', 'fontData',
]

const str = (v) => String(v ?? '')

/* =========================================================================
 * 归一化：字段名与旧版逐字一致，旧草稿 / 旧配置 JSON / 在线存档都能喂进来
 * ========================================================================= */
const normalizeWeaponList = (list) => (Array.isArray(list)
  ? list.map((w) => ({ name: str(w?.name), img: str(w?.img), imgManual: !!w?.imgManual }))
  : [])

const normalizeAlts = (list) => (Array.isArray(list)
  ? list.map((a) => ({ name: str(a?.name), img: str(a?.img), imgManual: !!a?.imgManual }))
  : [])

const normalizeArtifactList = (list) => (Array.isArray(list)
  ? list.map((a) => (a?.type === 'double'
    ? {
      type: 'double', name1: str(a?.name1 ?? a?.name), name2: str(a?.name2), displayText: str(a?.displayText),
      img1: str(a?.img1), img1Manual: !!a?.img1Manual, img2: str(a?.img2), img2Manual: !!a?.img2Manual,
    }
    : { type: 'single', name: str(a?.name), img: str(a?.img), imgManual: !!a?.imgManual }))
  : [])

/* 一支队伍固定四格；0 号位是卡片主角，编辑器不碰，但字段要在，否则归一化会把它压掉 */
const normalizeTeamChars = (chars) => Array.from({ length: 4 }, (_, i) => {
  const c = chars?.[i] || {}
  return {
    name: str(c.name), img: str(c.img), imgManual: !!c.imgManual,
    emptyAltText: str(c.emptyAltText || '暂无备选'), alts: normalizeAlts(c.alts),
  }
})

const normalizePanel = (p) => ({
  primaryKey: PANEL_PRIMARY_KEYS.includes(p?.primaryKey) ? p.primaryKey : 'hp',
  primaryValue: str(p?.primaryValue), cr: str(p?.cr), cd: str(p?.cd), em: str(p?.em), er: str(p?.er),
})

export function normalizeGuide(raw) {
  const d = raw || {}
  const out = structuredClone(DEFAULTS)

  for (const key of TEXT_KEYS) {
    if (d[key] != null) out[key] = str(d[key])
  }
  out.imgX = Number(d.imgX) || 0

  for (const key of IMG_KEYS) {
    out[key] = str(d[key])
    out[`${key}Meta`] = d[`${key}Meta`] || null
    out[`${key}Deleted`] = !!d[`${key}Deleted`]
    out[`${key}Manual`] = !!d[`${key}Manual`]
  }

  out.teamCoreImg = str(d.teamCoreImg)
  out.teamCoreImgManual = !!d.teamCoreImgManual
  out.panel = normalizePanel(d.panel)
  out.weaponData = {
    graduate: normalizeWeaponList(d?.weaponData?.graduate),
    optional: normalizeWeaponList(d?.weaponData?.optional),
    newbie: normalizeWeaponList(d?.weaponData?.newbie),
  }
  out.artifactData = normalizeArtifactList(d.artifactData)
  out.constellationData = Array.from({ length: 6 }, (_, i) => ({
    active: !!d?.constellationData?.[i]?.active,
    desc: str(d?.constellationData?.[i]?.desc),
  }))
  out.teamData = Array.isArray(d.teamData)
    ? d.teamData.map((t) => ({ name: str(t?.name), chars: normalizeTeamChars(t?.chars) }))
    : []

  return out
}

/* =========================================================================
 * 草稿（IndexedDB）
 * ========================================================================= */
const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(IDB_KEY, 1)
  req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})

export async function loadDraft() {
  try {
    const db = await openDB()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function saveDraft(data) {
  try {
    const db = await openDB()
    /* reactive 代理不能直接进 IDB，走一次 JSON 快照（草稿本来就是纯数据） */
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
      .put(JSON.parse(JSON.stringify(toRaw(data))), RECORD)
    return true
  } catch {
    return false
  }
}

export async function clearDraft() {
  try {
    const db = await openDB()
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(RECORD)
  } catch {
    /* 清不掉也不影响界面，下次保存会重新写进去 */
  }
}

/* =========================================================================
 * 在线存档
 * ========================================================================= */
export async function fetchRepoSave(name) {
  const query = String(name || '').trim()
  if (!query) return { error: '请先填角色名' }

  const entry = await dictEntry('characters', query)
  if (!entry?.order) return { error: `字典里没有「${query}」，不确定存档编号` }

  const file = `${String(entry.order).padStart(3, '0')}.${query}.json`
  try {
    const res = await fetch(`${SAVE_DIR}${file}?t=${Date.now()}`)
    if (!res.ok) return { error: `没找到存档「${file}」` }
    return { data: await res.json(), file }
  } catch {
    return { error: `存档「${file}」读取失败` }
  }
}

/* =========================================================================
 * 补齐素材
 * -------------------------------------------------------------------------
 * 存档里只有名字，图要按名字问字典。顺序请求、一张接一张：一次载入最多二十几张
 * 图，不值得为它写并发池。
 * ========================================================================= */
export async function rematchMissing(d) {
  const entry = await dictEntry('characters', d.charName)

  if (entry) {
    /* 用户手动删过的图不补（*Deleted 就是干这个的） */
    if (!d.charImg && !d.charImgDeleted && entry.art?.url) {
      const meta = await loadImageMeta(entry.art.url)
      if (meta) {
        d.charImg = entry.art.url
        d.charImgMeta = meta
        d.charImgManual = false
      }
    }

    /* 大背景用的是名片图。注意规则在 config.characters.card 里 ——
       config.characters 那一层的 prefix/ext 是头像规则，拿它去拼 card.key 会拼出头像 */
    const cardCfg = (await dictConfig('characters'))?.card
    const cardSrc = entry.card?.alt && cardCfg?.alt ? cardCfg.alt : cardCfg
    if (!d.bgImg && !d.bgImgDeleted && cardSrc?.prefix && entry.card?.key) {
      d.bgImg = cardSrc.prefix + entry.card.key + (cardSrc.ext || '')
      d.bgImgManual = false
    }

    if (!d.teamCoreImg) {
      const avatar = await matchIcon('characters', d.charName)
      if (avatar) {
        d.teamCoreImg = avatar
        d.teamCoreImgManual = false
      }
    }
  }

  const element = themeToElementName(d.theme)
  if (!d.nameBgImg && !d.nameBgImgDeleted && element) {
    d.nameBgImg = `${ELEMENT_DIR}${element}.png`
    d.nameBgImgMeta = await loadImageMeta(d.nameBgImg)
    d.nameBgImgManual = false
  }

  for (const type of WEAPON_ORDER) {
    for (const w of d.weaponData[type] || []) {
      if (w.name && !w.img) w.img = await matchIcon('weapons', w.name)
    }
  }

  for (const a of d.artifactData || []) {
    if (a.type === 'double') {
      if (a.name1 && !a.img1) a.img1 = await matchIcon('artifacts', a.name1)
      if (a.name2 && !a.img2) a.img2 = await matchIcon('artifacts', a.name2)
    } else if (a.name && !a.img) {
      a.img = await matchIcon('artifacts', a.name)
    }
  }

  for (const team of d.teamData || []) {
    for (const c of (team.chars || []).slice(1, 4)) {
      if (c.name && !c.img) c.img = await matchIcon('characters', c.name)
      for (const alt of c.alts || []) {
        if (alt.name && !alt.img) alt.img = await matchIcon('characters', alt.name)
      }
    }
  }
}

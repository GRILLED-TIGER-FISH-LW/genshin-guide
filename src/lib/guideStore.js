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

/* 名字 + 当前元素色 → 该拿去字典里查的名字。
   旅行者一家在字典里按元素分项（旅行者 / 旅行者·冰），角色名写「旅行者」时要取
   「旅行者·冰」那一项；字典里没有这一项（岩 / 水 … 还没录）就退回原版旅行者。
   其它角色不受影响：拼出来的名字查不到，等于没拼 —— 加载器的第一遍就是逐字匹配。 */
async function dictNameWithElement(name, theme) {
  const base = String(name || '').trim()
  const element = themeToElementName(theme)
  if (!base || !element) return base
  const combo = `${base}·${element}`
  return (await dictEntry('characters', combo)) ? combo : base
}

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
export async function fetchRepoSave(name, theme) {
  const query = String(name || '').trim()
  if (!query) return { error: '请先填角色名' }

  /* 名字按元素补过再查；文件名用字典里的正式名 —— 旅行者·冰那份存的是
     001.旅行者·冰.json，输英文代号（Furina）也照样找得到 */
  const entry = await dictEntry('characters', await dictNameWithElement(query, theme))
  if (!entry?.order) return { error: `字典里没有「${query}」，不确定存档编号` }

  const file = `${String(entry.order).padStart(3, '0')}.${entry.name || query}.json`
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
 * 存档里只有名字，图要按名字问字典。
 *
 * 【什么时候补】三个入口都补：首屏恢复草稿、载入在线存档、导入配置。
 *   以前只有「从字典补素材」那颗按钮会补，而且是「图是空的才补」——
 *   存档里存着一条早就 404 的旧链接（不等于空）就被跳过，所以必须手点一下。
 *
 * 【谁说了算】手传的（*Manual）和手删的（*Deleted）一律不动；剩下的
 *   **每次都按当前字典重算**，不再看「现在有没有值」。
 *
 * 【怎么补】先把「要补哪几张」列成任务清单，最多 6 个并发跑完，
 *   最后一次性写回 —— 以前是串行 await，界面上一张一张蹦。
 * ========================================================================= */

/* 并发池：同时最多 limit 个任务；返回与任务同序的结果 */
async function runPool(tasks, limit = 6) {
  const out = new Array(tasks.length)
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const k = next++
      out[k] = await tasks[k]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return out
}

export async function rematchMissing(d) {
  /* 旅行者 + 冰 → 查「旅行者·冰」：立绘 / 名片 / 头像都取分元素那一项 */
  const entry = await dictEntry('characters', await dictNameWithElement(d.charName, d.theme))

  /* 大背景用的是名片图。注意规则在 config.characters.card 里 ——
     config.characters 那一层的 prefix/ext 是头像规则，拿它去拼 card.key 会拼出头像 */
  const cardCfg = (await dictConfig('characters'))?.card
  const cardSrc = entry?.card?.alt && cardCfg?.alt ? cardCfg.alt : cardCfg
  const element = themeToElementName(d.theme)

  /* 每张图一个任务：只发请求，返回「拿到之后怎么落」；
     全部回来再一次性赋值，界面只刷新一次 */
  const tasks = []

  /* 立绘 */
  if (!d.charImgManual && !d.charImgDeleted && entry?.art?.url) {
    const url = entry.art.url
    tasks.push(async () => {
      const meta = await loadImageMeta(url)
      return () => {
        d.charImg = url
        d.charImgMeta = meta
        d.charImgManual = false
      }
    })
  }

  /* 大背景 = 名片图 */
  if (!d.bgImgManual && !d.bgImgDeleted && cardSrc?.prefix && entry?.card?.key) {
    const url = cardSrc.prefix + entry.card.key + (cardSrc.ext || '')
    tasks.push(async () => () => {
      d.bgImg = url
      d.bgImgManual = false
    })
  }

  /* 1 号位头像就是主角色（自己传过的不动） */
  if (!d.teamCoreImgManual) {
    const name = d.charName
    tasks.push(async () => {
      const url = await matchIcon('characters', name)
      return () => {
        d.teamCoreImg = url || ''
        d.teamCoreImgManual = false
      }
    })
  }

  /* 元素图 */
  if (!d.nameBgImgManual && !d.nameBgImgDeleted && element) {
    const url = `${ELEMENT_DIR}${element}.png`
    tasks.push(async () => {
      const meta = await loadImageMeta(url)
      return () => {
        d.nameBgImg = url
        d.nameBgImgMeta = meta
        d.nameBgImgManual = false
      }
    })
  }

  /* 武器图标 */
  for (const type of WEAPON_ORDER) {
    for (const w of d.weaponData[type] || []) {
      if (!w.name || w.imgManual) continue
      const name = w.name
      tasks.push(async () => {
        const url = await matchIcon('weapons', name)
        return () => {
          w.img = url || ''
          w.imgManual = false
        }
      })
    }
  }

  /* 圣遗物图标（散搭是两个） */
  for (const art of d.artifactData || []) {
    if (art.type === 'double') {
      for (const n of [1, 2]) {
        const name = art[`name${n}`]
        if (!name || art[`img${n}Manual`]) continue
        tasks.push(async () => {
          const url = await matchIcon('artifacts', name)
          return () => {
            art[`img${n}`] = url || ''
            art[`img${n}Manual`] = false
          }
        })
      }
    } else if (art.name && !art.imgManual) {
      const name = art.name
      tasks.push(async () => {
        const url = await matchIcon('artifacts', name)
        return () => {
          art.img = url || ''
          art.imgManual = false
        }
      })
    }
  }

  /* 配队成员（0 号位是主角，不在这里）与备选 */
  for (const team of d.teamData || []) {
    for (const c of (team.chars || []).slice(1, 4)) {
      if (c.name && !c.imgManual) {
        const name = c.name
        tasks.push(async () => {
          const url = await matchIcon('characters', name)
          return () => {
            c.img = url || ''
            c.imgManual = false
          }
        })
      }
      for (const alt of c.alts || []) {
        if (!alt.name || alt.imgManual) continue
        const name = alt.name
        tasks.push(async () => {
          const url = await matchIcon('characters', name)
          return () => {
            alt.img = url || ''
            alt.imgManual = false
          }
        })
      }
    }
  }

  const applies = await runPool(tasks)
  for (const apply of applies) if (apply) apply()
}

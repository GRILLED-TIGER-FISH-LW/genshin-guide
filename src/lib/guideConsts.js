/* =========================================================================
 * 角色一图流 · 坐标与配色
 * =========================================================================
 * 与旧 public/tools/character/consts.js 同源，LAYOUT 逐字照搬 —— 批 2、批 3 要用的
 * 细尺寸（武器槽 / 圣遗物槽 / 词条盒 / 面板单元格 / 命座 / 配队）也都在里面了，
 * 后面不用再补这个文件。
 *
 * 改版式就是改这里的数：绘制代码一律引用 LAYOUT，不写死坐标。
 *
 * 没搬的（各自归批）：EXPORT_SCALE / IDB_KEY / STORE_NAME 归批 4（导出与存档），
 * WEAPON_* / PANEL_* 那几个标签表归批 2（那时才用到）。
 * ========================================================================= */

export const SVG_W = 1280
export const SVG_H = 720

export const FONT_FAMILY_DEFAULT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'

/* 元素配色：色板按钮与卡片里各面板标题前的小圆点同源 */
export const elementColors = [
  ['火', '#EC4923'], ['水', '#498FCC'], ['风', '#359697'], ['雷', '#6957C2'],
  ['草', '#66AD16'], ['冰', '#35AACC'], ['岩', '#CC9046'], ['无', '#939393'],
]

export const LAYOUT = {
  left: { x: 20, y: 20, w: 340, h: 680 },
  right: { x: 380, y: 20, w: 880, h: 680 },
  title: { offX: 20, offY: 20, fs: 15, dotR: 4, dotGap: 11 },
  padX: 20, bottomPad: 15, contentOffsetY: 42.5,
  layers: {
    weapon: { y: 20, h: 135 },
    row2: { y: 165, h: 120 },
    artifact: { x: 380, w: 580 },
    talent: { x: 970, w: 290 },
    mid: {
      y: 295, h: 175,
      stat: { x: 380, w: 290 },
      panel: { x: 680, w: 280 },
      cons: { x: 970, w: 290 },
    },
    team: { y: 480, h: 220 },
  },
  iconSize: 55, iconGap: 10, doubleGap: 2,
  weaponSlotY: 62.5, artifactSlotY: 207.5,
  weaponLabelOffsetY: 10, weaponLabelFs: 12,
  stat: { boxW: 76, boxH: 62, gap: 10, subH: 45.5, subGap: 10, iconSize: 12, labelFs: 12, subLabelFs: 12 },
  talent: { colGap: 10, boxH: 62.5, labelFs: 12, valueFs: 20 },
  panel: { cols: 2, rows: 3, cellW: 115, cellH: 32.5, gapX: 10, gapY: 10, innerPadX: 10, labelFs: 12, valueFs: 12 },
  cons: { boxW: 120, boxH: 32.5, gapX: 10, gapY: 10, seqFs: 12, descFs: 10 },
  team: { w: 270, gap: 15, mainSize: 35, mainGap: 20, altSize: 25, altGap: 10, altRowGap: 5, nameFs: 12, nameOffsetY: 16, mainOffsetY: 27, altOffsetY: 67, altLabelPadL: 20, altRangePadR: 20 },
  plusSize: 14, plusStrokeW: 1.5,
  charInfo: { padL: 20, padB: 20, lineGap: 15 },
  radius: { panel: 16, inner: 8, slotFactor: 0.15 },
  labelColor: '#FFE898',
  innerBoxFill: 'rgba(255, 255, 255, 0.3)',
}
/* 武器分三组，组内最多 4 个；标签与旧版逐字一致 */
export const WEAPON_ORDER = ['graduate', 'optional', 'newbie']
export const WEAPON_MAX = 4
export const WEAPON_LABELS = { graduate: '毕业', optional: '可选', newbie: '新手' }

/* 空值占位灰字：明显弱于填值用的 #fff，但在深色格子上读得清（旧版实测值） */
export const EMPTY_FILL = '#E6E6E6'
export const PANEL_PRIMARY_KEYS = ['hp', 'atk', 'def']
export const PANEL_PRIMARY_LABELS = { hp: '生命值', atk: '攻击力', def: '防御力' }
export const PANEL_EMPTY_TEXT = '任意'

/* 中段三块（词条 / 面板 / 命座）的内容起点：面板顶 + 标题带高度 */
export const MID_CONTENT_Y = LAYOUT.layers.mid.y + LAYOUT.contentOffsetY

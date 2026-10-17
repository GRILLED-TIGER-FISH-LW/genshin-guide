/* =========================================================================
 * 原神一图流生成器 · consts.js (一级25%黑 + 二级25%白)
 * =========================================================================
 * 修改说明：
 *   一级面板：25% 黑 (在 svg.js 中)
 *   二级面板：25% 白
 * ========================================================================= */

/* =========================================================================
 * 【C1】图标常量（依赖 shared/ui-icons.js 已加载）
 * ========================================================================= */
const SHARED = window.ICONS || { ui: {}, element: {}, artifact: {}, nav: {}, app: {} };

const ICONS = {
  up: SHARED.ui.arrowUp || '',
  down: '<span class="icon-flip-y">' + (SHARED.ui.arrowUp || '') + '</span>',
  trash: SHARED.ui.trash || '',
  chevron: SHARED.ui.chevronDown || '',
  plus: SHARED.ui.plus || '',
  export: SHARED.ui.export || '',
  import: SHARED.ui.import || ''
};

const ELEMENT_ICONS = SHARED.element || {};
const ARTIFACT_ICON_PATHS = SHARED.artifact || {};

const PLUS_ICON_PATH = 'M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5z';

/* =========================================================================
 * 【C2】基础常量
 * ========================================================================= */
const SVG_W = 1280;
const SVG_H = 720;
const EXPORT_SCALE = 3;
const IDB_KEY = 'genshin_card_db_v5';
const STORE_NAME = 'card_store';
const WEAPON_ORDER = ['graduate', 'optional', 'newbie'];
const WEAPON_MAX = 4;

/* =========================================================================
 * 【C3】LAYOUT 布局参数
 * ========================================================================= */
const LAYOUT = {
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
      cons: { x: 970, w: 290 }
    },
    team: { y: 480, h: 220 }
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
  
  /* === 视觉核心修改点 === */
  radius: { panel: 16, inner: 8, slotFactor: 0.15 },
  labelColor: '#D1CCC5', 
  innerBoxFill: 'rgba(255, 255, 255, 0.25)' // 二级面板：25%的白
};
const MID_CONTENT_Y = LAYOUT.layers.mid.y + LAYOUT.contentOffsetY;

/* =========================================================================
 * 【C4】元素色 / 字体 / 标签等杂项常量
 * ========================================================================= */
const elementColors = [
  ['火', '#EC4923', 'fire'], ['水', '#498FCC', 'water'], ['风', '#359697', 'wind'],
  ['雷', '#6957C2', 'thunder'], ['草', '#66AD16', 'grass'], ['冰', '#35AACC', 'ice'],
  ['岩', '#CC9046', 'rock'], ['无', '#939393', 'none']
];

const FONT_FAMILY_DEFAULT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const FONT_FAMILY_CUSTOM = 'CardCustomFont, "PingFang SC", "Microsoft YaHei", sans-serif';
const WEAPON_LABELS = { graduate: '毕业', optional: '可选', newbie: '新手' };
const PANEL_PRIMARY_LABELS = { hp: '生命值', atk: '攻击力', def: '防御力' };
const PANEL_PRIMARY_KEYS = ['hp', 'atk', 'def'];
const PANEL_EMPTY_TEXT = '任意';
const EMPTY_FILL = 'rgba(255,255,255,.5)';

/* =========================================================================
 * 【C5】Tab 定义 + 运行期全局变量
 * ========================================================================= */
const TAB_DEFS = [
  { key: 'style', label: '外观样式' },
  { key: 'base', label: '立绘区' },
  { key: 'weapon', label: '武器区' },
  { key: 'artifact', label: '圣遗物区' },
  { key: 'talent', label: '天赋区' },
  { key: 'stats', label: '词条区' },
  { key: 'panel', label: '面板区' },
  { key: 'cons', label: '命座区' },
  { key: 'team', label: '配队区' }
];
let currentTab = 'style';

let CHAR_NAME_TO_ORDER = {};
let NAMECARD_DICT = {};
let ART_DICT = {};

/* =========================================================================
 * 【C6】State 与 IndexedDB 持久化
 * ========================================================================= */
const State = {
  data: {
    charName: '', version: '', date: '', author: '烤吃虎鱼LW',
    imgX: 0, theme: '#939393',
    charImg: '', charImgMeta: null, charImgDeleted: false, charImgManual: false,
    bgImg: '', bgImgDeleted: false, bgImgManual: false,
    nameBgImg: '', nameBgImgMeta: null, nameBgImgDeleted: false, nameBgImgManual: false,
    fontData: '', fontName: '', fontFileName: '',
    weaponData: { graduate: [], optional: [], newbie: [] },
    artifactData: [],
    constellationData: Array.from({ length: 6 }, () => ({ active: false, desc: '' })),
    sandMain: '', gobMain: '', cirMain: '', subStats: '',
    talentA: '', talentE: '', talentQ: '',
    panel: { primaryKey: 'hp', primaryValue: '', cr: '', cd: '', em: '', er: '' },
    teamCoreImg: '', teamCoreImgManual: false, teamData: []
  }
};

let saveTimer = null;
function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_KEY, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveStateToIDB() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(State.data, 'current_state');
  } catch (e) {}
}
function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; saveStateToIDB(); }, 500);
}
async function loadStateFromIDB() {
  try {
    const db = await openDatabase();
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('current_state');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
}

/* =========================================================================
 * 【C7】纯工具函数
 * ========================================================================= */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function darken(hex, amt) {
  if (!hex || typeof hex !== 'string') return '#333333';
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return '#333333';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(v => isNaN(v))) return '#333333';
  const rr = Math.max(0, r - amt);
  const gg = Math.max(0, g - amt);
  const bb = Math.max(0, b - amt);
  return `#${rr.toString(16).padStart(2,'0')}${gg.toString(16).padStart(2,'0')}${bb.toString(16).padStart(2,'0')}`;
}
function placeholder(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="100" y="112" font-size="52" text-anchor="middle" fill="#666" font-family="sans-serif">${esc(label)}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
function moveItem(arr, from, dir) {
  const to = from + dir;
  if (to < 0 || to >= arr.length) return false;
  [arr[from], arr[to]] = [arr[to], arr[from]];
  return true;
}
function padOrder(n) { return String(n).padStart(3, '0'); }
function themeToElementName() {
  var t = (State.data.theme || '').toLowerCase();
  for (var i = 0; i < elementColors.length; i++) {
    if (elementColors[i][1].toLowerCase() === t) return elementColors[i][0];
  }
  return '';
}
async function urlExists(url) {
  try {
    var res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return true;
    if (res.status === 405) {
      var res2 = await fetch(url);
      return res2.ok;
    }
    return false;
  } catch (e) {
    try { var res3 = await fetch(url); return res3.ok; } catch (e2) { return false; }
  }
}
function loadImageMeta(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/* ============================================================
 * theme-init.js —— 主题持久化 / 防闪白 / 黑白切换
 * ------------------------------------------------------------
 * 引入方式：每个页面 <head> 内最前面，【不要加 defer / async】
 *   <script src="shared/css/theme-init.js?v=20261023"></script>
 * ------------------------------------------------------------
 * 行为：
 *   · 首次访问跟随系统 prefers-color-scheme
 *   · 用户手动切换后写入 localStorage('gi-theme')，此后以用户为准
 *   · 切换期间给 <html> 加 .theme-switching 禁用所有过渡，避免逐元素缓动
 *   · 同步更新 <meta name="theme-color">（Android 地址栏取色）
 *   · 多标签页 / iframe 之间自动同步（storage 事件）
 *   · 派发 theme:change 事件（异步），页面可监听后重绘
 * ------------------------------------------------------------
 * API：
 *   Theme.get()    → 'light' | 'dark'
 *   Theme.set(t)   → 'light' | 'dark'（并持久化）
 *   Theme.toggle() → 切换并持久化，返回新主题
 *   Theme.clear()  → 清除用户选择，回到跟随系统
 * ------------------------------------------------------------
 * v2 修正：
 *  1. 切换时先强制提交「禁过渡」状态（void offsetWidth），
 *     防止浏览器把两次样式变更合并后个别元素仍走过渡
 *  2. theme:change 改为异步派发（setTimeout 0），
 *     让主线程先完成新配色的绘制，避免监听者阻塞重绘
 *  3. 复原时机改为「双 rAF + 200ms 兜底」，带序号防快速连点错乱
 * ============================================================ */
(() => {
  'use strict';

  if (window.Theme) return;                       /* 防止重复引入 */

  const KEY = 'gi-theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const META_COLOR = { light: '#F4F1EA', dark: '#1A1816' };
  const GUARD_MS = 200;

  /* ---------- 存取（localStorage 可能被禁用，一律 try/catch） ---------- */
  const store = {
    read() {
      try { return localStorage.getItem(KEY); } catch { return null; }
    },
    write(value) {
      try {
        if (value) localStorage.setItem(KEY, value);
        else localStorage.removeItem(KEY);
      } catch { /* 无痕模式：忽略，退化为跟随系统 */ }
    }
  };

  const systemTheme = () => (media.matches ? 'dark' : 'light');
  const current = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

  /* ---------- <meta name="theme-color"> ---------- */
  let metaEl = null;
  function paintMeta(theme) {
    if (!metaEl) metaEl = document.querySelector('meta[name="theme-color"]');
    if (!metaEl) {
      metaEl = document.createElement('meta');
      metaEl.name = 'theme-color';
      document.head.appendChild(metaEl);
    }
    metaEl.content = META_COLOR[theme];
  }

  /* ---------- 切换期间的「禁过渡」窗口 ---------- */
  let switchSeq = 0;
  let switchTimer = 0;

  function endSwitch() {
    clearTimeout(switchTimer);
    switchTimer = 0;
    root.classList.remove('theme-switching');
  }

  function beginSwitch() {
    switchSeq += 1;
    const my = switchSeq;

    root.classList.add('theme-switching');
    /* 强制提交一次样式：确保「禁过渡」在改主题之前已经生效，
     * 避免部分浏览器把两次变更合并计算导致个别元素仍走过渡 */
    void root.offsetWidth;

    clearTimeout(switchTimer);
    const end = () => { if (my === switchSeq) endSwitch(); };
    requestAnimationFrame(() => requestAnimationFrame(end));
    switchTimer = setTimeout(end, GUARD_MS);
  }

  /* ---------- 应用 ---------- */
  function apply(theme, silent = false) {
    root.dataset.theme = theme;
    paintMeta(theme);
    if (silent) return;

    /* 异步派发：先让浏览器把新配色画出来，再通知监听者。
     * 这样父页面向 iframe 同步主题等重活就不会阻塞首帧重绘。 */
    setTimeout(() => {
      root.dispatchEvent(new CustomEvent('theme:change', {
        bubbles: true,
        detail: { theme }
      }));
    }, 0);
  }

  function set(theme) {
    beginSwitch();
    apply(theme);
    store.write(theme);
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    set(next);
    return next;
  }

  function clear() {
    beginSwitch();
    store.write(null);
    apply(systemTheme());
  }

  /* ============================================================
   * ① 立即应用（此行之前不能有任何 DOM 写入，保证首帧前完成）
   * ============================================================ */
  const saved = store.read();
  apply(saved === 'dark' || saved === 'light' ? saved : systemTheme(), true);

  /* ============================================================
   * ② 系统主题变化：仅在用户未手动选择时跟随
   * ============================================================ */
  const onSystemChange = () => {
    if (!store.read()) apply(systemTheme());
  };
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onSystemChange);
  } else if (typeof media.addListener === 'function') {
    media.addListener(onSystemChange);          /* 旧版 Safari 兜底 */
  }

  /* ============================================================
   * ③ 多标签页 / iframe 同步
   * ============================================================ */
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const v = e.newValue;
    apply(v === 'dark' || v === 'light' ? v : systemTheme());
  });

  /* ============================================================
   * 对外 API
   * ============================================================ */
  window.Theme = { get: current, set, toggle, clear };
})();

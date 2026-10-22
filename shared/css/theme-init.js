/* ============================================================
 * theme-init.js —— 主题持久化 / 防闪白 / 黑白切换
 * ------------------------------------------------------------
 * 引入方式：每个页面 <head> 内最前面，【不要加 defer / async】
 *   <script src="shared/theme-init.js?v=20261022"></script>
 * ------------------------------------------------------------
 * 行为：
 *   · 首次访问跟随系统 prefers-color-scheme
 *   · 用户手动切换后写入 localStorage('gi-theme')，此后以用户为准
 *   · 切换期间给 <html> 加 .theme-switching 禁过渡，避免逐元素闪动
 *   · 同步更新 <meta name="theme-color">（Android 地址栏取色）
 *   · 多标签页 / iframe 之间自动同步（storage 事件）
 *   · 派发 theme:change 事件，页面可监听后重绘（例如命座发光色）
 * ------------------------------------------------------------
 * API：
 *   Theme.get()    → 'light' | 'dark'
 *   Theme.set(t)   → 'light' | 'dark'（并持久化）
 *   Theme.toggle() → 切换并持久化，返回新主题
 *   Theme.clear()  → 清除用户选择，回到跟随系统
 * ============================================================ */
(() => {
  'use strict';

  if (window.Theme) return;                       /* 防止重复引入 */

  const KEY = 'gi-theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const META_COLOR = { light: '#F4F1EA', dark: '#1A1816' };

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

  /* ---------- 应用 ---------- */
  function apply(theme, silent = false) {
    root.dataset.theme = theme;
    paintMeta(theme);
    if (!silent) {
      root.dispatchEvent(new CustomEvent('theme:change', {
        bubbles: true,
        detail: { theme }
      }));
    }
  }

  function set(theme) {
    apply(theme);
    store.write(theme);
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    /* 先加禁过渡类，再切主题：同一帧内完成，避免逐元素闪动 */
    root.classList.add('theme-switching');
    set(next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove('theme-switching'));
    });
    return next;
  }

  function clear() {
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

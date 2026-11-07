/* ============================================================
 * theme-init.js —— 主题持久化 / 防闪白 / 黑白切换
 * ------------------------------------------------------------
 * 引入方式：每个页面 <head> 内最前面，【不要加 defer / async】
 *   <script src="shared/css/theme-init.js?v=20261024"></script>
 * ------------------------------------------------------------
 * 行为：
 *   · 首次访问跟随系统 prefers-color-scheme
 *   · 用户手动切换后写入 localStorage('gi-theme')，此后以用户为准
 *   · 切换过程中禁用所有过渡，保证颜色"一步到位"、无缓动
 *   · 同步更新 <meta name="theme-color">（Android 地址栏取色）
 *   · 多标签页 / iframe 之间自动同步（storage 事件）
 *   · 派发 theme:change 事件（绘制之后），页面可监听后重绘
 * ------------------------------------------------------------
 * API：
 *   Theme.get()    → 'light' | 'dark'
 *   Theme.set(t)   → 'light' | 'dark'（并持久化）
 *   Theme.toggle() → 切换并持久化，返回新主题
 *   Theme.clear()  → 清除用户选择，回到跟随系统
 * ------------------------------------------------------------
 * v3 修正（关键）：
 *  1. 切换改为【完全同步】：加禁过渡类 → 强制提交 → 改主题 → 强制提交 → 移类，
 *     全部在同一个任务内完成。函数返回时颜色已是最终值，不存在过渡窗口。
 *  2. localStorage 写入与事件广播全部移到 setTimeout(0)，
 *     不再占用"绘制前"的主线程时间。
 *  3. 移除 rAF 时序依赖，避免不同浏览器帧调度差异导致偶发缓动。
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

  /* 强制浏览器完成一次样式 + 布局计算 */
  function flush() {
    void root.offsetWidth;
  }

  /* ============================================================
   * 核心：同步切换。
   * 返回时颜色已是最终值，浏览器只需要绘制一次，没有任何过渡窗口。
   * ============================================================ */
  function commit(theme) {
    root.classList.add('theme-switching');   /* 禁用所有过渡 */
    flush();                                 /* 提交「禁过渡」状态 */

    root.dataset.theme = theme;              /* 换配色 */
    paintMeta(theme);
    flush();                                 /* 在禁过渡状态下提交新配色 */

    root.classList.remove('theme-switching'); /* 恢复过渡能力 */
  }

  /* 绘制之后再做这些"重活"，绝不占用绘制前的时间 */
  function afterPaint(fn) {
    setTimeout(fn, 0);
  }

  function broadcast(theme) {
    afterPaint(() => {
      root.dispatchEvent(new CustomEvent('theme:change', {
        bubbles: true,
        detail: { theme }
      }));
    });
  }

  function set(theme) {
    commit(theme);
    broadcast(theme);
    afterPaint(() => store.write(theme));
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    set(next);
    return next;
  }

  function clear() {
    const theme = systemTheme();
    commit(theme);
    broadcast(theme);
    afterPaint(() => store.write(null));
  }

  /* ============================================================
   * ① 立即应用（必须在这一步之前不发生任何 DOM 写入，保证首帧前完成）
   * ============================================================ */
  const saved = store.read();
  commit(saved === 'dark' || saved === 'light' ? saved : systemTheme());

  /* ============================================================
   * ② 系统主题变化：仅在用户未手动选择时跟随
   * ============================================================ */
  const onSystemChange = () => {
    if (store.read()) return;
    const theme = systemTheme();
    commit(theme);
    broadcast(theme);
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
    const theme = (v === 'dark' || v === 'light') ? v : systemTheme();
    commit(theme);
    broadcast(theme);
  });

  /* ============================================================
   * 对外 API
   * ============================================================ */
  window.Theme = { get: current, set, toggle, clear };
})();


/* ============================================================
 * 首屏加载保护：CSS 首次生效期间禁用一切过渡
 * ------------------------------------------------------------
 * 本文件是 <head> 里的阻塞脚本，所以这个类会在「首帧之前」就加上；
 * 等 load 事件（所有资源就绪）后再移除，此时样式早已稳定，
 * 移除不会引起任何新的过渡。
 * ============================================================ */
(() => {
  const root = document.documentElement;
  root.classList.add('booting');

  let done = false;
  const endBooting = () => {
    if (done) return;
    done = true;
    root.classList.remove('booting');
  };

  window.addEventListener('load', endBooting, { once: true });
  setTimeout(endBooting, 3000);   /* 兜底：万一 load 长期不触发 */
})();

/* ============================================================
 * dropdown.js —— 下拉面板交互引擎
 * ------------------------------------------------------------
 * HTML 结构：
 *   .dropdown > .dropdown-trigger + .dropdown-panel > .dropdown-item
 * ------------------------------------------------------------
 * 行为：
 *   · 点触发器开关；点面板外关闭；点选项关闭并派发 dropdown:select
 *   · 打开时改用 position: fixed，绕过祖先 overflow 裁剪
 *   · 上下自动翻转、水平自动内收，永不超出安全区
 *   · 内容装得下时【完全不夹高度】，避免出现多余的滚动条
 *   · 面板宽度跟随触发器；可用 CSS 变量 --dropdown-min-w 调整下限
 *   · 自动抵消祖先 transform 造成的坐标偏移
 *   · Esc 关闭并归还焦点
 * ------------------------------------------------------------
 * v4 变更：
 *  · MIN_W 改为可被 CSS 覆盖：读 --dropdown-min-w，默认 140
 *    （星级选择器这类内容很短的控件可设成 0，让面板与按钮同宽）
 * ============================================================ */
(() => {
  'use strict';

  const OPEN = 'is-open';
  const FIXED = 'is-fixed';

  const MIN_H = 60;        // 面板最小高度
  const MIN_W = 140;       // 面板最小宽度的默认值（可被 --dropdown-min-w 覆盖）
  const FLIP_SPACE = 160;  // 下方空间低于此值时优先向上展开

  let active = null;

  const triggerOf = (d) => d.querySelector('.dropdown-trigger');
  const panelOf = (d) => d.querySelector('.dropdown-panel');

  /* 从 CSS 令牌读取数值（拿不到就用回退值） */
  function token(el, name, fallback) {
    const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }

  /* 找到会建立「固定定位包含块」的祖先 */
  function fixedOrigin(el) {
    let node = el.parentElement;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (
        (cs.transform || 'none') !== 'none' ||
        (cs.filter || 'none') !== 'none' ||
        (cs.backdropFilter || 'none') !== 'none' ||
        (cs.perspective || 'none') !== 'none' ||
        (cs.contain || '').includes('paint')
      ) {
        const r = node.getBoundingClientRect();
        return { x: r.left + node.clientLeft, y: r.top + node.clientTop };
      }
      node = node.parentElement;
    }
    return { x: 0, y: 0 };
  }

  function positionPanel(dropdown) {
    const trigger = triggerOf(dropdown);
    const panel = panelOf(dropdown);
    if (!trigger || !panel) return;

    const gap = token(dropdown, '--gap', 8);
    const margin = token(dropdown, '--gap-lg', 16);
    const cssMaxH = token(dropdown, '--input-panel-max-h', 280) || 280;
    const minW = token(dropdown, '--dropdown-min-w', MIN_W);
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const rect = trigger.getBoundingClientRect();

    /* —— 水平：夹在安全区内，宽度跟随触发器 —— */
    const width = Math.min(Math.max(rect.width, minW), vw - margin * 2);
    let left = Math.round(rect.left);
    if (left + width > vw - margin) left = vw - margin - width;
    if (left < margin) left = margin;

    /* —— 先落位，再量高度（宽度影响换行） —— */
    panel.classList.add(FIXED);
    panel.style.width = `${width}px`;
    panel.style.left = `${left}px`;

    /* —— 垂直：先定方向 —— */
    const below = vh - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    const openUp = below < MIN_H || (below < FLIP_SPACE && above > below);
    const available = Math.max(0, openUp ? above : below);
    const limit = Math.min(available, cssMaxH);

    /* —— 再由方向定高度：装得下就完全不夹 —— */
    const needed = panel.scrollHeight;
    let height;
    if (needed <= limit) {
      panel.style.maxHeight = 'none';   /* 关键：不给 overflow 触发机会 */
      height = needed;
    } else {
      height = Math.max(MIN_H, limit);
      panel.style.maxHeight = `${height}px`;
    }

    let top = openUp ? rect.top - gap - height : rect.bottom + gap;
    top = Math.min(Math.max(top, margin), Math.max(margin, vh - margin - height));
    panel.style.top = `${Math.round(top)}px`;

    /* —— 抵消祖先 transform 造成的坐标偏移 —— */
    const origin = fixedOrigin(panel);
    if (origin.x || origin.y) {
      panel.style.left = `${Math.round(left - origin.x)}px`;
      panel.style.top = `${Math.round(top - origin.y)}px`;
    }
  }

  function resetPanel(dropdown) {
    const panel = panelOf(dropdown);
    if (!panel) return;
    panel.classList.remove(FIXED);
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
    panel.style.maxHeight = '';
  }

  function setExpanded(dropdown, on) {
    const trigger = triggerOf(dropdown);
    if (trigger) trigger.setAttribute('aria-expanded', String(on));
  }

  function close(dropdown) {
    if (!dropdown) return;
    const panel = panelOf(dropdown);
    dropdown.classList.remove(OPEN);
    setExpanded(dropdown, false);
    if (active === dropdown) active = null;

    if (!panel) return;
    /* 等淡出结束再复位，避免面板瞬移回原位 */
    const delay = token(dropdown, '--dur', 0.3) * 1000 + 20;
    clearTimeout(panel._resetTimer);
    panel._resetTimer = setTimeout(() => {
      if (!dropdown.classList.contains(OPEN)) resetPanel(dropdown);
    }, delay);
  }

  function open(dropdown) {
    if (active && active !== dropdown) close(active);
    const panel = panelOf(dropdown);
    if (panel) clearTimeout(panel._resetTimer);
    dropdown.classList.add(OPEN);
    setExpanded(dropdown, true);
    positionPanel(dropdown);
    active = dropdown;
  }

  const isOpen = (dropdown) => dropdown.classList.contains(OPEN);

  function toggle(dropdown) {
    if (isOpen(dropdown)) close(dropdown);
    else open(dropdown);
  }

  /* ============================================================
   * 事件
   * ============================================================ */
  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const dropdown = target.closest('.dropdown');
    if (!dropdown) {
      if (active) close(active);
      return;
    }

    if (target.closest('.dropdown-trigger')) {
      e.preventDefault();
      toggle(dropdown);
      return;
    }

    const item = target.closest('.dropdown-item');
    if (!item) return;   /* 点在面板空白/滚动条上：保持展开 */

    dropdown.dispatchEvent(new CustomEvent('dropdown:select', {
      bubbles: true,
      detail: {
        value: item.dataset.value ?? null,
        label: item.textContent.trim(),
        item,
        dropdown
      }
    }));
    close(dropdown);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !active) return;
    const dropdown = active;
    close(dropdown);
    triggerOf(dropdown)?.focus();
  });

  const reposition = () => {
    if (!active) return;
    const trigger = triggerOf(active);
    if (!trigger) return close(active);
    const r = trigger.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return close(active);
    positionPanel(active);
  };

  window.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('resize', reposition);

  window.addEventListener('scroll', (e) => {
    if (!active) return;
    const t = e.target;
    if (t instanceof Node && active.contains(t)) return;  /* 面板内部滚动不关闭 */
    close(active);
  }, true);

  /* ============================================================
   * 对外接口
   * ============================================================ */
  window.Dropdown = {
    close() { if (active) close(active); },
    position() { if (active) positionPanel(active); }
  };
})();

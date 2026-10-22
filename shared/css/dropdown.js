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
 *   · 自动抵消祖先 transform 造成的坐标偏移（弹窗内的下拉也准）
 *   · Esc 关闭并归还焦点
 * ------------------------------------------------------------
 * app.js 里只需监听（不再需要自己绑 document 点击）：
 *   el.addEventListener('dropdown:select', e => {
 *     e.detail.value;  // data-value
 *     e.detail.label;  // 选项文字
 *   });
 * ------------------------------------------------------------
 * v2 变更：
 *  1. 水平边界钳制 + 最小宽度（靠右的下拉不再溢出屏幕）
 *  2. 重写方向判断：先定方向再定高度，修复「Math.max(60,…) 把面板顶出安全区」
 *  3. 先落位再量 scrollHeight（宽度影响换行，量早了高度不准）
 *  4. 新增 ancestor transform 偏移抵消，弹窗内下拉定位正确
 *  5. 关闭改为延迟复位，消除「瞬移回原位再淡出」
 *  6. 派发 dropdown:select 事件（让「不需要在 app.js 里写绑定」成为事实）
 *  7. GAP / MARGIN / 复位延迟 全部从 CSS 令牌读取，不再与 --gap 双份维护
 *  8. 新增 Esc 关闭、aria-expanded、visualViewport 适配
 * ============================================================ */
(() => {
  'use strict';

  const OPEN = 'is-open';
  const FIXED = 'is-fixed';

  const MIN_H = 60;        // 面板最小高度
  const MIN_W = 140;       // 面板最小宽度（窄触发器不至于变成一条缝）
  const FLIP_SPACE = 160;  // 下方空间低于此值时优先向上展开

  let active = null;

  const triggerOf = (d) => d.querySelector('.dropdown-trigger');
  const panelOf = (d) => d.querySelector('.dropdown-panel');

  /* 从 CSS 令牌读取数值（拿不到就用回退值） */
  function token(el, name, fallback) {
    const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }

  /* 找到会建立「固定定位包含块」的祖先：transform / filter / backdrop-filter / perspective / contain:paint */
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
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const rect = trigger.getBoundingClientRect();

    /* —— 水平：夹在安全区内 —— */
    const width = Math.min(Math.max(rect.width, MIN_W), vw - margin * 2);
    let left = Math.round(rect.left);
    if (left + width > vw - margin) left = vw - margin - width;
    if (left < margin) left = margin;

    /* —— 先落位，再量高度（宽度决定换行，量早了不准）—— */
    panel.classList.add(FIXED);
    panel.style.width = `${width}px`;
    panel.style.left = `${left}px`;

    /* —— 垂直：先定方向，再由方向定高度 —— */
    const below = vh - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    const openUp = below < MIN_H || (below < FLIP_SPACE && above > below);
    const available = Math.max(0, openUp ? above : below);
    const height = Math.max(MIN_H, Math.min(panel.scrollHeight, available));

    let top = openUp ? rect.top - gap - height : rect.bottom + gap;
    top = Math.min(Math.max(top, margin), Math.max(margin, vh - margin - height));

    panel.style.maxHeight = `${height}px`;
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

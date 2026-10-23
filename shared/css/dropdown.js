/* ============================================================
 * dropdown.js —— 下拉面板交互引擎
 * ------------------------------------------------------------
 * v8 变更：
 *  · 修正「面板左右对称内缩」——v7 把 --gap-lg(16px) 当成面板离
 *    视口边缘的安全距离，当页面容器 padding < 16px 时，
 *    width 被压窄 (32 − 2P)、left 被抬到 16，
 *    导致左右各内缩 (16 − P) px。
 *  · 水平方向不再无条件钳制：面板宽≡触发器宽、左边缘≡触发器左边缘时，
 *    面板落在触发器框内，必然不溢出视口。
 *    只有 --dropdown-min-w 让面板比触发器宽时才钳。
 *  · 垂直方向保留 margin 钳制（面板高度可变，可能超出屏幕上下）。
 *  · 闭环校正保留：以实测渲染值为准补差，不依赖任何 CSS 假设。
 * ============================================================ */
(() => {
  'use strict';

  const OPEN = 'is-open';
  const FIXED = 'is-fixed';

  const MIN_H = 60;
  const MIN_W = 0;
  const FLIP_SPACE = 160;

  const LOCK = {
    position: 'fixed',
    right: 'auto',
    margin: '0',
    boxSizing: 'border-box',
    maxWidth: 'none'
  };

  const CLEAR = [
    'position', 'top', 'left', 'right',
    'width', 'maxHeight', 'maxWidth', 'margin', 'boxSizing'
  ];

  let active = null;

  const triggerOf = (d) => d.querySelector('.dropdown-trigger');
  const panelOf = (d) => d.querySelector('.dropdown-panel');

  function token(el, name, fallback) {
    const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }

  const styleNum = (el, prop) => {
    const v = parseFloat(el.style[prop]);
    return Number.isFinite(v) ? v : 0;
  };

  /* —— 闭环校正：以实测渲染值为准，把误差补回去 —— */
  function converge(panel, axis, target) {
    const prop = axis === 'x' ? 'left' : 'top';
    for (let i = 0; i < 2; i++) {
      const r = panel.getBoundingClientRect();
      const delta = target - (axis === 'x' ? r.left : r.top);
      if (Math.abs(delta) < 0.5) return;
      panel.style[prop] = `${styleNum(panel, prop) + delta}px`;
    }
  }

  function convergeWidth(panel, target) {
    for (let i = 0; i < 2; i++) {
      const delta = target - panel.getBoundingClientRect().width;
      if (Math.abs(delta) < 0.5) return;
      panel.style.width = `${styleNum(panel, 'width') + delta}px`;
    }
  }

  function positionPanel(dropdown) {
    const trigger = triggerOf(dropdown);
    const panel = panelOf(dropdown);
    if (!trigger || !panel) return;

    const gap = token(dropdown, '--gap', 8);
    const edge = token(dropdown, '--gap-lg', 16);
    const cssMaxH = token(dropdown, '--input-panel-max-h', 280) || 280;
    const minW = token(dropdown, '--dropdown-min-w', MIN_W);
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const rect = trigger.getBoundingClientRect();

    /* —— 内联锁死，CSS 抢不走 —— */
    panel.classList.add(FIXED);
    for (const k in LOCK) panel.style[k] = LOCK[k];

    /* —— 宽度 = 触发器宽度（先收敛，再量高度）—— */
    const width = Math.max(rect.width, minW);
    panel.style.width = `${width}px`;
    convergeWidth(panel, width);

    /* —— 水平：左边缘对准触发器；仅当面板比触发器宽时才收 —— */
    let left = rect.left;
    if (left + width > vw) left = Math.max(0, vw - width);
    if (left < 0) left = 0;
    panel.style.left = `${left}px`;

    /* —— 垂直：先定方向 —— */
    const below = vh - rect.bottom - gap - edge;
    const above = rect.top - gap - edge;
    const openUp = below < MIN_H || (below < FLIP_SPACE && above > below);
    const available = Math.max(0, openUp ? above : below);
    const limit = Math.min(available, cssMaxH);

    const needed = panel.scrollHeight;
    let height;
    if (needed <= limit) {
      panel.style.maxHeight = 'none';
      height = needed;
    } else {
      height = Math.max(MIN_H, limit);
      panel.style.maxHeight = `${height}px`;
    }

    let top = openUp ? rect.top - gap - height : rect.bottom + gap;
    top = Math.min(Math.max(top, edge), Math.max(edge, vh - edge - height));
    top = Math.round(top);
    panel.style.top = `${top}px`;

    /* —— 实测校正（横竖都补）—— */
    converge(panel, 'x', left);
    converge(panel, 'y', top);
  }

  function resetPanel(dropdown) {
    const panel = panelOf(dropdown);
    if (!panel) return;
    panel.classList.remove(FIXED);
    for (const k of CLEAR) panel.style[k] = '';
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
    if (!item) return;

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
    if (t instanceof Node && active.contains(t)) return;
    close(active);
  }, true);

  window.Dropdown = {
    close() { if (active) close(active); },
    position() { if (active) positionPanel(active); }
  };
})();

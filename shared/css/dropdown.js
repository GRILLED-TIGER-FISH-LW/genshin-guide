/* ============================================================
 * dropdown.js —— 下拉面板交互引擎
 * ------------------------------------------------------------
 * v7 变更：
 *  · 面板定位改为「闭环校正」：设完样式后读取实测渲染值，
 *    与目标值比对并补偿，最多两轮收敛。
 *    彻底摆脱对「包含块 / transform / will-change / 特异性」的依赖，
 *    任何 CSS 干扰都会被实测值纠正。
 *  · 删除 fixedOrigin()（靠 transform 特征反推包含块，漏检 will-change，
 *    且与闭环校正重复）
 *  · 定位前用内联样式锁死 position / right / margin / box-sizing /
 *    max-width，防止 CSS 规则把宽度和位置挤压回去
 *  · 宽度 = 触发器宽度，先收敛宽度再测高度（避免换行导致高度算错）
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
    const margin = token(dropdown, '--gap-lg', 16);
    const cssMaxH = token(dropdown, '--input-panel-max-h', 280) || 280;
    const minW = token(dropdown, '--dropdown-min-w', MIN_W);
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const rect = trigger.getBoundingClientRect();

    /* —— 内联锁死，CSS 抢不走 —— */
    panel.classList.add(FIXED);
    for (const k in LOCK) panel.style[k] = LOCK[k];

    /* —— 宽度 = 触发器宽度（先收敛，再量高度）—— */
    const width = Math.min(Math.max(rect.width, minW), vw - margin * 2);
    panel.style.width = `${width}px`;
    convergeWidth(panel, width);

    /* —— 水平：左边缘对准触发器，越界再钳 —— */
    let left = rect.left;
    if (left + width > vw - margin) left = vw - margin - width;
    if (left < margin) left = margin;
    panel.style.left = `${left}px`;

    /* —— 垂直：先定方向 —— */
    const below = vh - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
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
    top = Math.min(Math.max(top, margin), Math.max(margin, vh - margin - height));
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

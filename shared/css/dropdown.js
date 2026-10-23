/* ============================================================
 * dropdown.js —— 下拉面板交互引擎
 * ------------------------------------------------------------
 * v6 变更：
 *  · 水平定位不再取整（原 Math.round 会让面板与按钮错开最多 1px）
 *    三栏等分等小数宽度场景下，取整会造成「宽度一致但边缘对不齐」
 *  · 垂直方向仍保留取整（避免文字渲染模糊）
 * ============================================================ */
(() => {
  'use strict';

  const OPEN = 'is-open';
  const FIXED = 'is-fixed';

  const MIN_H = 60;
  const MIN_W = 0;
  const FLIP_SPACE = 160;

  let active = null;

  const triggerOf = (d) => d.querySelector('.dropdown-trigger');
  const panelOf = (d) => d.querySelector('.dropdown-panel');

  function token(el, name, fallback) {
    const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }

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

    /* —— 水平：全部使用精确值，不取整 —— */
    const width = Math.min(Math.max(rect.width, minW), vw - margin * 2);
    let left = rect.left;
    if (left + width > vw - margin) left = vw - margin - width;
    if (left < margin) left = margin;

    panel.classList.add(FIXED);
    panel.style.width = `${width}px`;
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
    panel.style.top = `${Math.round(top)}px`;

    /* —— 抵消祖先 transform 的偏移（同样不取整）—— */
    const origin = fixedOrigin(panel);
    if (origin.x || origin.y) {
      panel.style.left = `${left - origin.x}px`;
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

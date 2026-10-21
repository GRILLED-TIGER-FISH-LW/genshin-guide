/* ============================================================
 * dropdown.js —— 下拉面板交互
 * ============================================================
 * 用法：HTML 里写 .dropdown 结构，本文件自动接管：
 *   · 点 .dropdown-trigger 开关
 *   · 点面板外面关闭
 *   · 点 .dropdown-item 关闭
 *   · 打开时用 position: fixed 计算坐标，绕过祖先 overflow 裁剪
 * 不需要在 app.js 里写任何绑定。
 * ============================================================ */
(() => {
  'use strict';

  const OPEN = 'is-open';
  const FIXED = 'is-fixed';
  const GAP = 8;
  const MARGIN = 16;

  let active = null;

  function positionPanel(dropdown) {
    const trigger = dropdown.querySelector('.dropdown-trigger');
    const panel = dropdown.querySelector('.dropdown-panel');
    if (!trigger || !panel) return;

    panel.classList.add(FIXED);

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP - MARGIN;
    const spaceAbove = rect.top - GAP - MARGIN;
    const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
    const maxH = Math.min(panel.scrollHeight, openUp ? spaceAbove : spaceBelow);

    panel.style.left = `${rect.left}px`;
    panel.style.width = `${rect.width}px`;
    panel.style.maxHeight = `${Math.max(60, maxH)}px`;
    panel.style.top = openUp
      ? `${rect.top - GAP - Math.max(60, maxH)}px`
      : `${rect.bottom + GAP}px`;
  }

  function resetPanel(dropdown) {
    const panel = dropdown.querySelector('.dropdown-panel');
    if (!panel) return;
    panel.classList.remove(FIXED);
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
    panel.style.maxHeight = '';
  }

  function close(dropdown) {
    if (!dropdown) return;
    dropdown.classList.remove(OPEN);
    resetPanel(dropdown);
    if (active === dropdown) active = null;
  }

  function open(dropdown) {
    if (active && active !== dropdown) close(active);
    dropdown.classList.add(OPEN);
    positionPanel(dropdown);
    active = dropdown;
  }

  function toggle(dropdown) {
    if (dropdown.classList.contains(OPEN)) close(dropdown);
    else open(dropdown);
  }

  document.addEventListener('click', (e) => {
    const dropdown = e.target.closest('.dropdown');

    if (dropdown) {
      if (e.target.closest('.dropdown-trigger')) {
        e.preventDefault();
        toggle(dropdown);
        return;
      }
      if (e.target.closest('.dropdown-item')) {
        close(dropdown);
        return;
      }
      return;
    }

    if (active) close(active);
  });

  window.addEventListener('resize', () => {
    if (active) positionPanel(active);
  });

  window.addEventListener('scroll', (e) => {
    if (!active) return;
    if (e.target instanceof Node && active.contains(e.target)) return;
    close(active);
  }, true);

  window.Dropdown = {
    close: () => close(active)
  };
})();

/* =========================================================================
 * 图标字典编辑器 · app.js
 * =========================================================================
 * v5 变更（相对 v4）：
 *  · 【同步合并改用 key 判定】自定义条目（local / url）同时按 key 与 name
 *    双重保护：任一对上就跳过 API 条目。
 *    - 修掉「手打错名字的普通条目反过来覆盖 API 正确名字」的问题
 *    - 保留「API 的 key 与本地 key 不同」时不重复插入（如旅行者本地图）
 *  · 【空名字条目不再消失】第 3 步改为按 key 判重，不再依赖 row.name
 * v4 变更：
 *  · 导出按钮新增「未导出」提醒；dirty 状态写进 localStorage
 * v3 变更：
 *  · darkenHex 改为 HSL 实现，与 icon-loader.js 完全等价
 * ========================================================================= */
(function () {
  "use strict";

  /* =========================================================================
   * 【模块 1】常量与状态
   * ========================================================================= */
  const STORAGE_KEY = "icon_dict_editor_v4";

  const DEFAULT_CONFIG = {
    characters: { prefix: "https://api.lunaris.moe/data/assets/avataricon/",  ext: ".webp" },
    artifacts:  { prefix: "https://api.lunaris.moe/data/assets/artifacts/",   ext: ".webp" },
    weapons:    { prefix: "https://api.lunaris.moe/data/assets/weaponicon/",  ext: ".webp" },
    monsters:   { prefix: "https://api.lunaris.moe/data/assets/monstericon/", ext: ".png" }
  };

  const AMBER_ENDPOINTS = {
    characters: "https://gi.yatta.moe/api/v2/CHS/avatar",
    weapons:    "https://gi.yatta.moe/api/v2/CHS/weapon",
    artifacts:  "https://gi.yatta.moe/api/v2/CHS/reliquary",
    monsters:   "https://gi.yatta.moe/api/v2/CHS/monster"
  };

  const LOCAL_IMG_BASE = "../../shared/gi-icons/";
  const ALL_TYPES = ["characters", "artifacts", "weapons", "monsters"];
  const TYPE_LABELS = { characters: "角色", artifacts: "圣遗物", weapons: "武器", monsters: "怪物" };
  const STAR_OPTIONS = [1, 2, 3, 4, 5];

  const el = {
    entries: document.getElementById("entries"),
    emptyTip: document.getElementById("emptyTip"),
    emptyIcon: document.getElementById("emptyIcon"),
    emptyText: document.getElementById("emptyText"),
    statusBar: document.getElementById("status"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalTitle: document.getElementById("modalTitle"),
    modalMessage: document.getElementById("modalMessage"),
    modalCancel: document.getElementById("modalCancel"),
    modalConfirm: document.getElementById("modalConfirm"),
    pasteWrap: document.getElementById("pasteWrap"),
    pasteArea: document.getElementById("pasteArea"),
    searchInput: document.getElementById("searchInput"),
    searchClear: document.getElementById("searchClear")
  };

  let config = structuredCloneSafe(DEFAULT_CONFIG);
  let editorData = { characters: [], artifacts: [], weapons: [], monsters: [] };
  let currentTab = "characters";
  let searchQuery = "";
  let dirty = false;                  /* 有改动尚未导出为 icon-dict.js */

  const amberCache   = { characters: null, weapons: null, artifacts: null, monsters: null };
  const amberLoading = {};
  let CHAR_ORDER_TO_NAME = {};
  let CHAR_NAME_TO_ORDER = {};
  let statusTimer = null;

  /* =========================================================================
   * 【模块 2】基础工具
   * ========================================================================= */
  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function injectIcons(root = document) {
    const ui = window.ICONS?.ui ?? {};
    const iconMap = {
      search: ui.search ?? "",
      close: ui.close ?? "",
      import: ui.import ?? "",
      plus: ui.plus ?? "",
      export: ui.export ?? "",
      trash: ui.trash ?? "",
      inbox: ui.inbox ?? "",
      chevronDown: ui.chevronDown ?? "",
      chevronUp: ui.chevronUp ?? ""
    };
    root.querySelectorAll("[data-icon]").forEach(node => {
      const icon = iconMap[node.dataset.icon];
      if (icon) node.innerHTML = icon;
    });
  }

  /* 状态胶囊：共享 CSS 的状态类是 .is-visible，类型类支持 .ok / .err */
  function setStatus(msg, type) {
    if (!el.statusBar) return;
    el.statusBar.textContent = msg;
    el.statusBar.className = "status-bar is-visible" + (type ? " " + type : "");
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    if (type !== "err") {
      statusTimer = setTimeout(() => {
        statusTimer = null;
        el.statusBar.classList.remove("is-visible");
      }, 3000);
    }
  }

  /* =========================================================================
   * 【模块 3】颜色：与 icon-loader.js 的 applyBackground 完全一致
   * ========================================================================= */

  /* 与 icon-loader.js 的 hexToHsl 等价 */
  function hexToHsl(hex) {
    const num = parseInt(String(hex).replace("#", ""), 16);
    const r = ((num >> 16) & 0xFF) / 255;
    const g = ((num >> 8) & 0xFF) / 255;
    const b = (num & 0xFF) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  /* 与 icon-loader.js 的 hslToHex 等价 */
  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const toHex = (v) => Math.max(0, Math.min(255, Math.round((v + m) * 255)))
      .toString(16)
      .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /* 与 icon-loader.js 的 darken(hex, percent) 等价
   * 语义：保持色相与饱和度不变，亮度 × (1 - percent)
   * 缩略图边缘色固定传 0.5，与 loader 的 applyBackground 完全一致 */
  function darkenHex(hex, percent) {
    if (!hex || typeof hex !== "string" || hex.length !== 7) return "#333333";
    const [h, s, l] = hexToHsl(hex);
    if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return "#333333";
    return hslToHex(h, s, Math.max(0, l * (1 - percent)));
  }

  /* =========================================================================
   * 【模块 4】弹窗（确认框与粘贴框共用一个外壳，单一 Promise 入口）
   * ========================================================================= */
  let modalResolve = null;

  function closeModal(result) {
    if (el.modalBackdrop) el.modalBackdrop.classList.remove("is-visible");
    const fn = modalResolve;
    modalResolve = null;
    if (fn) fn(result);
  }

  function openModal({ title, message, confirmText, showPaste = false }) {
    return new Promise(resolve => {
      if (!el.modalBackdrop) { resolve(false); return; }

      if (el.modalTitle) el.modalTitle.textContent = title || "";
      if (el.modalMessage) el.modalMessage.textContent = message || "";
      if (el.modalConfirm) el.modalConfirm.textContent = confirmText || "确定";
      if (el.pasteWrap) el.pasteWrap.classList.toggle("hidden", !showPaste);

      modalResolve = resolve;
      el.modalBackdrop.classList.add("is-visible");

      if (showPaste && el.pasteArea) {
        setTimeout(() => { try { el.pasteArea.focus(); } catch (e) {} }, 50);
      }
    });
  }

  function showConfirm(title, message) {
    return openModal({ title, message, confirmText: "确定", showPaste: false });
  }

  async function openPasteDialog() {
    if (el.pasteArea) el.pasteArea.value = "";
    const ok = await openModal({
      title: "粘贴图标链接",
      message: "每行一个完整 URL，程序自动提取图标名并查询 Amber 中文名。",
      confirmText: "解析并添加",
      showPaste: true
    });
    if (!ok) return;
    await parsePastedUrls(el.pasteArea ? el.pasteArea.value : "");
  }

  /* =========================================================================
   * 【模块 5】数据获取层
   * ========================================================================= */
  async function loadCharOrderTxt() {
    try {
      const res = await fetch(`../../shared/data/characters.txt?t=${Date.now()}`);
      if (!res.ok) return;
      const text = await res.text();
      CHAR_ORDER_TO_NAME = {};
      CHAR_NAME_TO_ORDER = {};
      text.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith("#")) return;
        const parts = line.split(/[\s,，\t]+/);
        if (parts.length < 2) return;
        const order = parseInt(parts[0], 10);
        const name = parts.slice(1).join(" ").trim();
        if (order && name) {
          CHAR_ORDER_TO_NAME[order] = name;
          CHAR_NAME_TO_ORDER[name] = order;
        }
      });
    } catch (e) { console.warn("characters.txt 加载失败", e); }
  }

  async function loadAmberData(type) {
    if (amberCache[type]) return amberCache[type];
    if (amberLoading[type]) return amberLoading[type];

    amberLoading[type] = (async () => {
      const res = await fetch(AMBER_ENDPOINTS[type]);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      const items = (json.data && json.data.items) || json.data || json;
      const result = {};
      Object.keys(items).forEach(k => {
        const item = items[k];
        if (!item || !item.name) return;
        const id = String(item.icon || "").replace(/^UI_[A-Za-z]+_/i, "").toLowerCase();
        if (id) result[id] = item.name;
        if (item.id != null) result[String(item.id)] = item.name;
      });
      amberCache[type] = result;
      return result;
    })();

    try {
      return await amberLoading[type];
    } finally {
      amberLoading[type] = null;
    }
  }

  async function lookupAmberName(type, id) {
    if (!id) return "";
    const normalized = String(id).toLowerCase().replace(/^ui_[a-z]+_/i, "");
    try {
      const table = await loadAmberData(type);
      return table[normalized] || table[String(id).toLowerCase()] || "";
    } catch (e) { return ""; }
  }

  /* =========================================================================
   * 【模块 6】本地存储与解析
   * ========================================================================= */

  /* 导出按钮的「未导出」提醒 */
  function updateExportBtn() {
    const btn = document.getElementById("btnExport");
    if (!btn) return;
    btn.classList.toggle("is-dirty", dirty);
    btn.title = dirty ? "有改动尚未导出为 icon-dict.js" : "导出 icon-dict.js";
    const label = btn.querySelector(".btn-text");
    if (label) label.textContent = dirty ? "未导出" : "导出";
  }

  function writeLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: editorData, config, dirty }));
    } catch (e) {}
  }

  function setDirty(value) {
    if (dirty === value) return;
    dirty = value;
    updateExportBtn();
    writeLocal();
  }

  function saveLocal() {
    dirty = true;
    updateExportBtn();
    writeLocal();
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      /* 老数据没有 dirty 字段 → 视为「未导出」，提醒用户先导一次 */
      dirty = parsed.dirty !== false;

      if (parsed.config && typeof parsed.config === "object") {
        ALL_TYPES.forEach(t => {
          const cfg = parsed.config[t];
          if (!cfg || typeof cfg !== "object") return;
          config[t] = {
            prefix: typeof cfg.prefix === "string" ? cfg.prefix : DEFAULT_CONFIG[t].prefix,
            ext: typeof cfg.ext === "string" ? cfg.ext : DEFAULT_CONFIG[t].ext
          };
        });
      }

      if (parsed.data && typeof parsed.data === "object") {
        ALL_TYPES.forEach(t => {
          editorData[t] = Array.isArray(parsed.data[t]) ? parsed.data[t] : [];
        });
      }
    } catch (e) {}
  }

  function resolveUrl(type, row) {
    if (!row || !row.key) return "";
    if (row.local) return LOCAL_IMG_BASE + row.key;
    if (row.url) return row.url;
    if (/^https?:\/\//i.test(row.key)) return row.key;
    const cfg = config[type] || {};
    return cfg.prefix ? cfg.prefix + row.key + (cfg.ext || "") : "";
  }

  function extractIconFullName(input) {
    let s = String(input || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) s = s.split("/").pop().split("?")[0];
    return s.replace(/\.[^.]+$/, "");
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, " ");
  }

  function rowMatches(row) {
    if (!searchQuery) return true;
    return (row.name || "").toLowerCase().includes(searchQuery) ||
           (row.key || "").toLowerCase().includes(searchQuery);
  }

  function findOrderByName(name, excludeRow) {
    if (!name) return 0;
    const hit = editorData.characters.find(r => r !== excludeRow && r.name === name && r.order);
    return hit ? hit.order : (CHAR_NAME_TO_ORDER[name] || 0);
  }

  function findNameByOrder(order, excludeRow) {
    if (!order) return "";
    const hit = editorData.characters.find(r => r !== excludeRow && r.order === order && r.name);
    return hit ? hit.name : (CHAR_ORDER_TO_NAME[order] || "");
  }

  /* =========================================================================
   * 【模块 7】渲染
   * ========================================================================= */
  function showEmptyState(iconKey, html) {
    if (!el.emptyTip) return;
    if (el.emptyIcon) el.emptyIcon.dataset.icon = iconKey;
    if (el.emptyText) el.emptyText.innerHTML = html;
    el.emptyTip.classList.remove("hidden");
    injectIcons(el.emptyTip);
  }

  function hideEmptyState() {
    if (el.emptyTip) el.emptyTip.classList.add("hidden");
  }

  /* 星级：复用共享 .dropdown 组件（面板宽度跟随按钮，见 style.css 的 --dropdown-min-w） */
  function buildStarDropdown(row) {
    const wrap = document.createElement("div");
    wrap.className = "dropdown star-dropdown";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "dropdown-trigger";
    trigger.innerHTML =
      `<span class="dropdown-label">${row.star || 5}★</span>` +
      `<span class="dropdown-arrow">` +
        `<span class="arrow-down" data-icon="chevronDown"></span>` +
        `<span class="arrow-up" data-icon="chevronUp"></span>` +
      `</span>`;

    const panel = document.createElement("div");
    panel.className = "dropdown-panel";
    panel.innerHTML = STAR_OPTIONS.map(s =>
      `<button type="button" class="dropdown-item${s === (row.star || 5) ? " is-active" : ""}" data-value="${s}">${s}★</button>`
    ).join("");

    panel.addEventListener("click", (e) => {
      const item = e.target.closest(".dropdown-item");
      if (!item) return;
      const v = Number(item.dataset.value);
      if (!v) return;
      row.star = v;
      saveLocal();
      render();
    });

    wrap.appendChild(trigger);
    wrap.appendChild(panel);
    return wrap;
  }

  function buildRow(row) {
    const card = document.createElement("div");
    card.className = "card item-card";

    const line = document.createElement("div");
    line.className = "entry-row";

    /* ---- 1. 序号 ---- */
    const inpOrder = document.createElement("input");
    inpOrder.type = "number";
    inpOrder.className = "entry-order";
    inpOrder.value = row.order || "";
    inpOrder.title = "序号";
    inpOrder.addEventListener("change", () => {
      const v = (inpOrder.value || "").trim();
      const newOrder = v === "" ? 0 : (parseInt(v, 10) || 0);
      if (currentTab === "characters") {
        const curName = (row.name || "").trim();
        if (curName) {
          row.order = findOrderByName(curName, row) || newOrder;
        } else {
          row.order = newOrder;
          if (newOrder > 0) row.name = findNameByOrder(newOrder, row) || row.name;
        }
      } else {
        row.order = newOrder;
      }
      saveLocal();
      render();          /* 序号变了要重排 */
    });
    line.appendChild(inpOrder);

    /* ---- 2. 缩略图 ---- */
    const thumb = document.createElement("div");
    thumb.className = "entry-thumb";
    if (row.star != null) {
      const c = window.ICON_LIB?.starColors?.[row.star] || "#939393";
      thumb.style.setProperty("--star-color", c);
      thumb.style.setProperty("--star-edge", darkenHex(c, 0.5));   /* 与 loader 完全一致 */
    }
    const thumbImg = document.createElement("img");
    thumbImg.alt = "";
    thumbImg.loading = "lazy";
    const url = resolveUrl(currentTab, row);
    if (url) {
      thumbImg.src = url;
      thumbImg.onerror = () => thumbImg.removeAttribute("src");
    }
    thumb.appendChild(thumbImg);
    line.appendChild(thumb);

    /* ---- 3. 名字 ---- */
    const inpName = document.createElement("input");
    inpName.type = "text";
    inpName.className = "entry-name";
    inpName.value = row.name || "";
    inpName.placeholder = "中文名";
    inpName.addEventListener("input", () => {
      row.name = inpName.value;
      saveLocal();
    });
    inpName.addEventListener("blur", () => {
      row.name = (inpName.value || "").trim();
      inpName.value = row.name;
      if (currentTab === "characters") {
        const newOrder = row.name ? (findOrderByName(row.name, row) || row.order || 0) : 0;
        if (newOrder !== row.order) {
          row.order = newOrder;
          inpOrder.value = newOrder || "";
        }
      }
      saveLocal();
    });
    line.appendChild(inpName);

    /* ---- 4. 星级 ---- */
    if (currentTab !== "monsters") line.appendChild(buildStarDropdown(row));

    /* ---- 5. 删除 ---- */
    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn-icon btn-danger";
    btnDel.title = "删除";
    btnDel.dataset.icon = "trash";
    btnDel.addEventListener("click", () => {
      const idx = editorData[currentTab].indexOf(row);
      if (idx >= 0) editorData[currentTab].splice(idx, 1);
      saveLocal();
      render();
      setStatus("已删除", "ok");
    });
    line.appendChild(btnDel);

    card.appendChild(line);
    return card;
  }

  function render() {
    if (!el.entries) return;

    const list = (editorData[currentTab] || [])
      .slice()
      .sort((a, b) => (a.order || 99999999) - (b.order || 99999999));
    const filtered = list.filter(rowMatches);

    setStatus(searchQuery ? `已筛选 ${filtered.length} / 共 ${list.length} 条` : `共 ${list.length} 条 · 自动保存`);

    el.entries.innerHTML = "";

    if (!filtered.length) {
      if (list.length) {
        showEmptyState("search", "没有找到匹配的条目<br>试试其他关键词");
      } else {
        showEmptyState("inbox", "当前分类还没有条目<br>点上方按钮开始");
      }
      return;
    }

    hideEmptyState();

    const frag = document.createDocumentFragment();
    filtered.forEach(row => frag.appendChild(buildRow(row)));
    el.entries.appendChild(frag);

    injectIcons(el.entries);
  }

  /* =========================================================================
   * 【模块 8】业务逻辑
   * ========================================================================= */
  async function parsePastedUrls(text) {
    const urls = String(text || "")
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => /^https?:\/\//i.test(l));

    if (!urls.length) { setStatus("未识别到有效链接", "err"); return; }

    const cfg = config[currentTab] || { prefix: "", ext: "" };
    const list = editorData[currentTab];
    const byKey = {};
    list.forEach(row => { if (row.key) byKey[row.key] = row; });

    const created = [];
    urls.forEach(url => {
      const key = extractIconFullName(url);
      if (!key) return;
      const isConfig = cfg.prefix && url === (cfg.prefix + key + (cfg.ext || ""));
      const existing = byKey[key];
      if (existing) {
        if (!isConfig) existing.url = url;
        else delete existing.url;
      } else {
        const row = { key, name: "", order: 0, star: currentTab === "monsters" ? null : 5 };
        if (!isConfig) row.url = url;
        list.push(row);
        byKey[key] = row;
        created.push(row);
      }
    });

    saveLocal();
    render();

    if (created.length) {
      setStatus("正在查询中文名…");
      try { await loadAmberData(currentTab); } catch (e) {}

      let changed = false;
      for (const r of created) {
        const name = await lookupAmberName(currentTab, r.key);
        if (name && name !== r.name) { r.name = name; changed = true; }
      }
      if (changed) {
        saveLocal();
        render();
      }
    }

    setStatus("解析完成", "ok");
  }

  async function fetchAmberItems(type) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(AMBER_ENDPOINTS[type], { signal: controller.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      return (json.data && json.data.items) || json.data || json;
    } finally {
      clearTimeout(timer);
    }
  }

  function transformAmberItems(type, items) {
    const result = {};
    Object.keys(items).forEach(id => {
      const item = items[id];
      if (!item || !item.icon || !item.name) return;

      let order = 0, star = null;
      if (type === "characters") {
        if (!CHAR_NAME_TO_ORDER[item.name]) return;
        order = CHAR_NAME_TO_ORDER[item.name];
        star = item.rank || 5;
      } else if (type === "weapons") {
        order = item.id || 0;
        star = item.rank || 5;
        if (order < 10000 || order >= 100000) return;
      } else if (type === "artifacts") {
        order = item.id || 0;
        star = (Array.isArray(item.levelList) && item.levelList.length)
          ? Math.max.apply(null, item.levelList)
          : 5;
      } else if (type === "monsters") {
        order = item.id || 0;
      }

      result[item.icon] = { name: item.name, star, order };
    });
    return result;
  }

  /* -------------------------------------------------------------------------
   * 同步合并规则（v5）
   * ---------------------------------------------------------
   * 自定义条目 = 带 local 或 url 的条目，两者都按 key 与 name 双重登记。
   *
   * 1. 自定义条目先落位，name / star / order / local / url 全部保留
   * 2. API 条目：key 命中自定义 → 跳过
   *              name 命中自定义 → 跳过（应对「本地 key 与 API 不同」，
   *                                例如自制的旅行者头像 UI_AvatarIcon_Traveler.webp）
   *              都没命中 → 以 API 数据为准（手打错的名字在这里被修正）
   * 3. 剩余旧条目按 key 判重后原样保留：
   *              key 已在上两步出现 → 说明数据来自 API 或自定义，跳过
   *              key 未出现        → API 已下架或手工新增，保留
   * ------------------------------------------------------------------------- */
  async function syncFromAmber() {
    setStatus("正在从 Amber 同步…");
    config = structuredCloneSafe(DEFAULT_CONFIG);

    const customByKey  = {};
    const customByName = {};
    ALL_TYPES.forEach(type => {
      customByKey[type] = {};
      customByName[type] = {};
      (editorData[type] || []).forEach(row => {
        if (!row.local && !row.url) return;
        if (row.key) customByKey[type][row.key] = row;
        if (row.name) customByName[type][row.name] = row;
      });
    });

    const amberResult = {};
    for (const type of ALL_TYPES) {
      setStatus("正在拉取" + TYPE_LABELS[type] + "…");
      try {
        const items = await fetchAmberItems(type);
        amberResult[type] = transformAmberItems(type, items);
      } catch (e) {
        setStatus("同步失败：" + TYPE_LABELS[type] + " - " + e.message, "err");
        return;
      }
    }

    setStatus("正在合并数据…");

    ALL_TYPES.forEach(type => {
      const merged = {};
      const byKey  = customByKey[type]  || {};
      const byName = customByName[type] || {};

      /* 1. 自定义条目先落位 */
      Object.keys(byKey).forEach(key => {
        const row = byKey[key];
        merged[key] = {
          name: row.name,
          star: row.star,
          order: row.order,
          local: row.local,
          url: row.url
        };
      });

      /* 2. API 条目 */
      Object.keys(amberResult[type] || {}).forEach(key => {
        const item = amberResult[type][key];
        if (byKey[key] || (item.name && byName[item.name])) return;
        merged[key] = item;
      });

      /* 3. 剩余旧条目（按 key 判重） */
      (editorData[type] || []).forEach(row => {
        if (!row.key || merged[row.key]) return;
        merged[row.key] = {
          name: row.name,
          star: row.star,
          order: row.order,
          local: row.local,
          url: row.url
        };
      });

      editorData[type] = Object.keys(merged).map(k => {
        const r = merged[k];
        const out = { key: k, name: r.name || "", order: r.order || 0 };
        if (r.star != null) out.star = r.star;
        if (r.local) out.local = true;
        if (r.url) out.url = r.url;
        return out;
      });
    });

    saveLocal();
    render();

    const summary = ALL_TYPES.map(t => `${TYPE_LABELS[t]} ${editorData[t].length}`).join(" · ");
    setStatus("同步完成 · " + summary, "ok");
  }

  async function loadFromRepo() {
    setStatus("正在从仓库载入…");
    try {
      const res = await fetch("../../shared/gi-icons/icon-dict.js?t=" + Date.now());
      if (!res.ok) throw new Error("HTTP " + res.status);
      const code = await res.text();

      const sandbox = { window: {} };
      new Function("window", code)(sandbox.window);
      const dict = sandbox.window.ICON_DICT || {};

      if (dict.config && typeof dict.config === "object") {
        ALL_TYPES.forEach(t => {
          const cfg = dict.config[t];
          if (!cfg || typeof cfg !== "object") return;
          config[t] = {
            prefix: typeof cfg.prefix === "string" ? cfg.prefix : DEFAULT_CONFIG[t].prefix,
            ext: typeof cfg.ext === "string" ? cfg.ext : DEFAULT_CONFIG[t].ext
          };
        });
      }

      ALL_TYPES.forEach(type => {
        const obj = dict[type] || {};
        editorData[type] = Object.keys(obj).map(k => {
          const item = obj[k] || {};
          const out = { key: k, name: item.name || "", order: item.order || 0 };
          if (item.star != null) out.star = item.star;
          if (item.local) out.local = true;
          if (item.url) out.url = item.url;
          return out;
        });
      });

      saveLocal();
      render();
      setStatus("已从仓库载入", "ok");
    } catch (e) {
      setStatus("载入失败：" + e.message, "err");
    }
  }

  function exportJS() {
    const lines = ["window.ICON_DICT = {", "  config: {"];

    ALL_TYPES.forEach((type, ti) => {
      const cfg = config[type] || DEFAULT_CONFIG[type];
      lines.push(`    ${type}: { prefix: "${esc(cfg.prefix)}", ext: "${esc(cfg.ext || "")}" }${ti < ALL_TYPES.length - 1 ? "," : ""}`);
    });
    lines.push("  },");

    ALL_TYPES.forEach((type, ti) => {
      lines.push("", `  /* ============ ${TYPE_LABELS[type]} ============ */`, `  ${type}: {`);

      const list = editorData[type]
        .filter(it => it.key)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      if (!list.length) lines.push("    // 暂无条目");

      list.forEach((item, i) => {
        const parts = [`name: "${esc(item.name)}"`];
        if (item.star != null) parts.push(`star: ${item.star}`);
        parts.push(`order: ${item.order || 0}`);
        if (item.local) parts.push("local: true");
        if (item.url) parts.push(`url: "${esc(item.url)}"`);
        lines.push(`    "${esc(item.key)}": { ${parts.join(", ")} }${i < list.length - 1 ? "," : ""}`);
      });

      lines.push(`  }${ti < ALL_TYPES.length - 1 ? "," : ""}`);
    });
    lines.push("};", "");

    const blob = new Blob([lines.join("\n")], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "icon-dict.js";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus("已导出", "ok");
    setDirty(false);
  }

  /* =========================================================================
   * 【模块 9】事件绑定
   * ========================================================================= */
  function bindEvents() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentTab = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach(b => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", String(on));
        });
        searchQuery = "";
        if (el.searchInput) el.searchInput.value = "";
        if (el.searchClear) el.searchClear.classList.remove("is-visible");
        render();
      });
    });

    if (el.searchInput) {
      el.searchInput.addEventListener("input", () => {
        searchQuery = el.searchInput.value.trim().toLowerCase();
        if (el.searchClear) el.searchClear.classList.toggle("is-visible", searchQuery !== "");
        render();
      });
    }
    if (el.searchClear) {
      el.searchClear.addEventListener("click", () => {
        searchQuery = "";
        if (el.searchInput) { el.searchInput.value = ""; el.searchInput.focus(); }
        el.searchClear.classList.remove("is-visible");
        render();
      });
    }

    if (el.modalCancel) el.modalCancel.addEventListener("click", () => closeModal(false));
    if (el.modalConfirm) el.modalConfirm.addEventListener("click", () => closeModal(true));
    if (el.modalBackdrop) {
      el.modalBackdrop.addEventListener("click", (e) => {
        if (e.target === el.modalBackdrop) closeModal(false);
      });
    }

    document.getElementById("btnSync")?.addEventListener("click", syncFromAmber);
    document.getElementById("btnLoad")?.addEventListener("click", loadFromRepo);
    document.getElementById("btnExport")?.addEventListener("click", exportJS);
    document.getElementById("btnPaste")?.addEventListener("click", openPasteDialog);

    document.getElementById("btnClear")?.addEventListener("click", async () => {
      const ok = await showConfirm("清空当前分类", `确定清空「${TYPE_LABELS[currentTab]}」的所有条目吗？`);
      if (!ok) return;
      editorData[currentTab] = [];
      saveLocal();
      render();
      setStatus("已清空", "ok");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && el.modalBackdrop?.classList.contains("is-visible")) {
        closeModal(false);
      }
    });
  }

  /* =========================================================================
   * 【模块 10】启动
   * ========================================================================= */
  (async function init() {
    try {
      try {
        await window.__bootPromise;
      } catch (e) {
        console.warn("[boot]", e);
      }

      if (typeof window.ICONS === "undefined") {
        throw new Error("图标库未加载（ui-icons.js），请刷新重试");
      }

      injectIcons();
      await loadCharOrderTxt();
      loadLocal();

      bindEvents();
      render();
      updateExportBtn();

      document.body.classList.add("ready");
    } catch (err) {
      console.error("[init]", err);
      const bootEl = document.querySelector(".boot-loading");
      if (bootEl) {
        bootEl.style.whiteSpace = "pre-wrap";
        bootEl.textContent = '初始化失败：' + (err && err.message ? err.message : String(err)) +
          '\n请刷新重试；若持续失败，请把这条信息反馈给维护者。';
      }
    }
  })();
})();

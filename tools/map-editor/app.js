/* =========================================================================
 * 图标字典编辑器 · app.js
 * =========================================================================
 * v2 变更：
 *  1. 【致命】状态类名 .show → .is-visible（状态胶囊 / 弹窗 / 搜索清除按钮）
 *     —— overlays.css 与 inputs.css 用的都是 .is-visible，原来这些全都不显示
 *  2. 【致命】弹窗重构成「单一 Promise 入口」
 *     —— 原来 modalConfirm 上同时挂了 addEventListener 和 onclick，
 *        点「清空」的确定会顺带执行一次粘贴解析
 *     —— 同时补上 pasteWrap 的显隐切换（确认框不再误显示输入框）
 *  3. 星级原生 <select> → 共享 .dropdown 组件
 *  4. render() 不再在「名字失焦」时全量重建 → 打字后不失焦、长列表不卡
 *  5. loadLocal() 恢复 config（原来 saveLocal 存了却从不读回）
 *  6. init() 补齐错误兜底，图标注入加空值保护
 *  7. 新增 injectIcons()，支持限定作用域（列表重建时只扫局部）
 *  8. parsePastedUrls() 改为批量提交，从「每加一条渲染一次」降到最多两次
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
   * 【模块 3】弹窗（确认框与粘贴框共用一个外壳，单一 Promise 入口）
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
   * 【模块 4】数据获取层
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
   * 【模块 5】本地存储与解析
   * ========================================================================= */
  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: editorData, config }));
    } catch (e) {}
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      /* config（原来存了却从不读回，这里补上） */
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

      /* 条目数据 */
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

  /* 生成 JS 源码时用：转义反斜杠、双引号，换行压成空格 */
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

  function darkenHex(hex, amt) {
    if (!hex || typeof hex !== "string" || hex.length !== 7) return "#333333";
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  /* =========================================================================
   * 【模块 6】渲染
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

  /* 星级：复用共享 .dropdown 组件（原生 select 已废弃） */
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

    /* 面板只挂一个监听，避免每条选项各挂一个 */
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
      render();          /* 序号变了要重排，这里重建是必要的 */
    });
    line.appendChild(inpOrder);

    /* ---- 2. 缩略图 ---- */
    const thumb = document.createElement("div");
    thumb.className = "entry-thumb";
    if (row.star != null) {
      const c = window.ICON_LIB?.starColors?.[row.star] || "#939393";
      thumb.style.setProperty("--star-color", c);
      thumb.style.setProperty("--star-edge", darkenHex(c, 50));
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
    /* 失焦只做归一化，不重建列表 → 打字后不失焦、长列表不卡 */
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

    injectIcons(el.entries);   /* 只扫列表，不扫整页 */
  }

  /* =========================================================================
   * 【模块 7】业务逻辑
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
    render();                     /* 第一次：先把条目显示出来 */

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
        render();                 /* 第二次：名字补全后统一重建 */
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

  async function syncFromAmber() {
    setStatus("正在从 Amber 同步…");
    config = structuredCloneSafe(DEFAULT_CONFIG);

    /* 先收集自定义来源（local / url），同步时优先保留 */
    const customByName = {};
    ALL_TYPES.forEach(type => {
      customByName[type] = {};
      (editorData[type] || []).forEach(row => {
        if ((row.local || row.url) && row.name) customByName[type][row.name] = row;
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
      const customMap = customByName[type] || {};
      const customNames = new Set(Object.keys(customMap));

      /* 1. 自定义优先 */
      Object.keys(customMap).forEach(name => {
        const row = customMap[name];
        merged[row.key] = { name: row.name, star: row.star, order: row.order, local: row.local, url: row.url };
      });

      /* 2. Amber 补入，跳过重名 */
      const amberNames = new Set();
      Object.keys(amberResult[type] || {}).forEach(key => {
        const item = amberResult[type][key];
        if (customNames.has(item.name)) return;
        amberNames.add(item.name);
        merged[key] = item;
      });

      /* 3. 保留现有但 Amber 没有的 */
      const existingByName = {};
      (editorData[type] || []).forEach(row => { if (row.name) existingByName[row.name] = row; });
      Object.keys(existingByName).forEach(name => {
        if (amberNames.has(name) || customNames.has(name)) return;
        const row = existingByName[name];
        merged[row.key] = { name: row.name, star: row.star, order: row.order, local: row.local, url: row.url };
      });

      editorData[type] = Object.keys(merged).map(k => {
        const r = merged[k];
        const out = { key: k, name: r.name, order: r.order };
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

      /* 在隔离的 window 对象里执行，取出 ICON_DICT */
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
  }

  /* =========================================================================
   * 【模块 8】事件绑定
   * ========================================================================= */
  function bindEvents() {
    /* Tab 切换 */
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

    /* 搜索 */
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

    /* 弹窗按钮：只在这里绑一次，避免和 openModal 抢同一个按钮 */
    if (el.modalCancel) el.modalCancel.addEventListener("click", () => closeModal(false));
    if (el.modalConfirm) el.modalConfirm.addEventListener("click", () => closeModal(true));
    if (el.modalBackdrop) {
      el.modalBackdrop.addEventListener("click", (e) => {
        if (e.target === el.modalBackdrop) closeModal(false);
      });
    }

    /* 顶部操作按钮 */
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

    /* Esc 关闭弹窗 */
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && el.modalBackdrop?.classList.contains("is-visible")) {
        closeModal(false);
      }
    });
  }

  /* =========================================================================
   * 【模块 9】启动
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

      injectIcons();                     /* 静态区域图标：搜索 / 按钮 / 空态 */
      await loadCharOrderTxt();
      loadLocal();

      bindEvents();
      render();

      document.body.classList.add("ready");
    } catch (err) {
      console.error("[init]", err);
      const bootEl = document.querySelector(".boot-loading");
      if (bootEl) {
        bootEl.style.whiteSpace = "pre-wrap";
        bootEl.textContent = "初始化失败：" + (err && err.message ? err.message : String(err)) +
          "\n请刷新重试；若持续失败，请把这条信息反馈给维护者。";
      }
    }
  })();
})();

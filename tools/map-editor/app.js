/* =========================================================================
 * 图标字典编辑器 · app.js (2026 现代 ES6+ 彻底重构版)
 * =========================================================================
 * 核心改造：
 * 1. 彻底消灭所有 var，全面采用 const / let。
 * 2. 彻底消灭 .then() 回调地狱，全部改为 async / await。
 * 3. 彻底清除原生 confirm()，改用全局自定义 UI 弹窗。
 * 4. 将 fetch 与 DOM 操作逻辑极度精简，去除了大量冗余状态。
 * ========================================================================= */
(function () {
  "use strict";

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

  // DOM 缓存集中管理
  const el = {
    entries: document.getElementById("entries"),
    emptyTip: document.getElementById("emptyTip"),
    statusBar: document.getElementById("status"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalTitle: document.getElementById("modalTitle"),
    modalMessage: document.getElementById("modalMessage"),
    modalCancel: document.getElementById("modalCancel"),
    modalConfirm: document.getElementById("modalConfirm"),
    pasteArea: document.getElementById("pasteArea"),
    searchInput: document.getElementById("searchInput"),
    searchClear: document.getElementById("searchClear")
  };

  let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  let editorData = { characters: [], artifacts: [], weapons: [], monsters: [] };
  let currentTab = "characters";
  let searchQuery = "";

  const amberCache   = { characters: null, weapons: null, artifacts: null, monsters: null };
  const amberLoading = {};
  let CHAR_ORDER_TO_NAME = {};
  let CHAR_NAME_TO_ORDER = {};
  let statusTimer = null;

  // 现代 Toast 封装
  function setStatus(msg, type) {
    el.statusBar.textContent = msg;
    el.statusBar.className = "status-bar show" + (type ? " " + type : "");
    if (statusTimer) clearTimeout(statusTimer);
    if (type !== "err") {
      statusTimer = setTimeout(() => el.statusBar.classList.remove("show"), 3000);
    }
  }

  // 现代 Confirm 封装
  function showConfirm(title, message) {
    return new Promise(resolve => {
      el.modalTitle.textContent = title;
      el.modalMessage.textContent = message;
      const cleanup = (result) => {
        el.modalBackdrop.classList.remove("show");
        el.modalCancel.onclick = null;
        el.modalConfirm.onclick = null;
        el.modalBackdrop.onclick = null;
        resolve(result);
      };
      el.modalCancel.onclick = () => cleanup(false);
      el.modalConfirm.onclick = () => cleanup(true);
      el.modalBackdrop.onclick = (e) => { if (e.target === el.modalBackdrop) cleanup(false); };
      el.modalBackdrop.classList.add("show");
    });
  }

  // ===== 数据获取层 (全 async/await) =====
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

    try { return await amberLoading[type]; } 
    finally { amberLoading[type] = null; }
  }

  async function lookupAmberName(type, id) {
    if (!id) return "";
    const normalized = String(id).toLowerCase().replace(/^ui_[a-z]+_/i, "");
    try {
      const table = await loadAmberData(type);
      return table[normalized] || table[String(id).toLowerCase()] || "";
    } catch (e) { return ""; }
  }

  // ===== 工具函数 =====
  const saveLocal = () => localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: editorData, config }));
  
  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.data) {
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

  const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  
  function rowMatches(row) {
    if (!searchQuery) return true;
    return (row.name || "").toLowerCase().includes(searchQuery) || 
           (row.key || "").toLowerCase().includes(searchQuery);
  }

  // ===== 渲染层 =====
  function render() {
    const list = (editorData[currentTab] || []).slice().sort((a, b) => (a.order || 99999999) - (b.order || 99999999));
    const filtered = list.filter(rowMatches);

    setStatus(searchQuery ? `已筛选 ${filtered.length} / 共 ${list.length} 条` : `共 ${list.length} 条 · 自动保存`);

    el.entries.innerHTML = "";
    if (list.length && !filtered.length) {
      el.emptyTip.classList.add("show");
      el.emptyTip.innerHTML = '<span class="big-icon">🔍</span><span>没有找到匹配的条目<br>试试其他关键词</span>';
      return;
    }
    if (!list.length) {
      el.emptyTip.classList.add("show");
      el.emptyTip.innerHTML = '<span class="big-icon">📭</span><span>当前分类还没有条目<br>点上方按钮开始</span>';
      return;
    }
    el.emptyTip.classList.remove("show");

    filtered.forEach(row => {
      const card = document.createElement("div");
      card.className = "item-card";
      const line = document.createElement("div");
      line.className = "entry-row";

      // 1. 编号
      const inpOrder = document.createElement("input");
      inpOrder.type = "number"; inpOrder.className = "entry-order"; inpOrder.value = row.order || ""; inpOrder.title = "序号";
      inpOrder.addEventListener("change", function () {
        const v = (this.value || "").trim();
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
        saveLocal(); render();
      });
      line.appendChild(inpOrder);

      // 2. 缩略图 (CSS 变量动态注入)
      const thumb = document.createElement("div");
      thumb.className = "entry-thumb";
      if (row.star != null) {
        const c = (window.ICON_LIB?.starColors?.[row.star]) || "#939393";
        thumb.style.setProperty('--star-color', c);
        thumb.style.setProperty('--star-edge', darkenHex(c, 50));
      }
      const thumbImg = document.createElement("img");
      thumbImg.alt = ""; thumbImg.loading = "lazy";
      thumb.appendChild(thumbImg);
      line.appendChild(thumb);
      
      const url = resolveUrl(currentTab, row);
      if (url) {
        thumbImg.src = url;
        thumbImg.onerror = () => thumbImg.removeAttribute("src");
      }

      // 3. 名字
      const inpName = document.createElement("input");
      inpName.type = "text"; inpName.className = "entry-name"; inpName.value = row.name || ""; inpName.placeholder = "中文名";
      inpName.addEventListener("input", () => { row.name = inpName.value; saveLocal(); });
      inpName.addEventListener("blur", () => {
        row.name = (inpName.value || "").trim();
        if (currentTab === "characters") {
          row.order = row.name ? (findOrderByName(row.name, row) || row.order) : 0;
        }
        saveLocal(); render();
      });
      line.appendChild(inpName);

      // 4. 星级
      if (currentTab !== "monsters") {
        const selStar = document.createElement("select");
        selStar.className = "star-select";
        [1, 2, 3, 4, 5].forEach(s => {
          const opt = document.createElement("option");
          opt.value = s; opt.textContent = s + "★";
          if (s === (row.star || 5)) opt.selected = true;
          selStar.appendChild(opt);
        });
        selStar.addEventListener("change", () => { row.star = parseInt(selStar.value, 10) || 5; saveLocal(); render(); });
        line.appendChild(selStar);
      }

      // 5. 删除
      const btnDel = document.createElement("button");
      btnDel.type = "button"; btnDel.className = "entry-del btn-danger"; btnDel.innerHTML = ICONS.ui.trash;
      btnDel.addEventListener("click", () => {
        const idx = editorData[currentTab].indexOf(row);
        if (idx >= 0) editorData[currentTab].splice(idx, 1);
        saveLocal(); render(); setStatus("已删除", "ok");
      });
      line.appendChild(btnDel);

      card.appendChild(line);
      el.entries.appendChild(card);
    });
  }

  // ===== 业务逻辑层 (全 async/await) =====
  async function parsePastedUrls(text) {
    const urls = text.split(/\r?\n/).map(l => l.trim()).filter(l => /^https?:\/\//i.test(l));
    if (!urls.length) return setStatus("未识别到有效链接", "err");

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
        if (!isConfig) existing.url = url; else delete existing.url;
      } else {
        const row = { key, name: "", order: 0, star: currentTab === "monsters" ? null : 5 };
        if (!isConfig) row.url = url;
        list.push(row); byKey[key] = row; created.push(row);
      }
    });

    saveLocal(); render();

    if (created.length) {
      setStatus("正在查询中文名…");
      try { await loadAmberData(currentTab); } catch (e) {}
      for (const r of created) {
        const name = await lookupAmberName(currentTab, r.key);
        if (name) r.name = name;
        saveLocal(); render();
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
    } finally { clearTimeout(timer); }
  }

  function transformAmberItems(type, items) {
    const result = {};
    Object.keys(items).forEach(id => {
      const item = items[id];
      if (!item?.icon || !item.name) return;
      let order = 0, star = null;
      if (type === "characters") {
        if (!CHAR_NAME_TO_ORDER[item.name]) return;
        order = CHAR_NAME_TO_ORDER[item.name]; star = item.rank || 5;
      } else if (type === "weapons") {
        order = item.id || 0; star = item.rank || 5;
        if (order < 10000 || order >= 100000) return;
      } else if (type === "artifacts") {
        order = item.id || 0;
        star = (Array.isArray(item.levelList) && item.levelList.length) ? Math.max.apply(null, item.levelList) : 5;
      } else if (type === "monsters") {
        order = item.id || 0;
      }
      result[item.icon] = { name: item.name, star, order };
    });
    return result;
  }

  async function syncFromAmber() {
    setStatus("正在从 Amber 同步…");
    config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    
    // 收集自定义源
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
        return setStatus("同步失败：" + TYPE_LABELS[type] + " - " + e.message, "err");
      }
    }

    setStatus("正在合并数据…");
    ALL_TYPES.forEach(type => {
      const merged = {};
      const customMap = customByName[type] || {};
      const customNames = new Set(Object.keys(customMap));
      
      // 先放自定义
      Object.keys(customMap).forEach(name => {
        const row = customMap[name];
        merged[row.key] = { name: row.name, star: row.star, order: row.order, local: row.local, url: row.url };
      });

      // 再放 Amber，跳过重名
      const amberNames = new Set();
      Object.keys(amberResult[type] || {}).forEach(key => {
        const item = amberResult[type][key];
        if (customNames.has(item.name)) return;
        amberNames.add(item.name);
        merged[key] = item;
      });

      // 保留现有但 Amber 没有的
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

    saveLocal(); render();
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
      if (dict.config) config = dict.config;

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
      saveLocal(); render(); setStatus("已从仓库载入", "ok");
    } catch (e) {
      setStatus("载入失败：" + e.message, "err");
    }
  }

  // 辅助计算
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

  // 导出
  function exportJS() {
    const lines = ["window.ICON_DICT = {", "  config: {"];
    ALL_TYPES.forEach((type, ti) => {
      const cfg = config[type] || DEFAULT_CONFIG[type];
      lines.push(`    ${type}: { prefix: "${esc(cfg.prefix)}", ext: "${esc(cfg.ext || "")}" }${ti < ALL_TYPES.length - 1 ? "," : ""}`);
    });
    lines.push("  },");

    ALL_TYPES.forEach((type, ti) => {
      lines.push("", `  /* ============ ${TYPE_LABELS[type]} ============ */`, `  ${type}: {`);
      const list = editorData[type].filter(it => it.key).sort((a, b) => (a.order || 0) - (b.order || 0));
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
    a.href = url; a.download = "icon-dict.js";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus("已导出", "ok");
  }

  // 初始化与事件绑定
  (async function init() {
    try { await window.__bootPromise; } catch (e) { console.warn(e); }
    
    // 注入图标
    const iconMap = { btnSync: ICONS.ui.import, btnPaste: ICONS.ui.plus, btnLoad: ICONS.ui.import, btnExport: ICONS.ui.export, btnClear: ICONS.ui.trash };
    Object.keys(iconMap).forEach(id => {
      const iconEl = document.querySelector(`#${id} .btn-icon`);
      if (iconEl) iconEl.innerHTML = iconMap[id];
    });

    await loadCharOrderTxt();
    loadLocal();

    // 绑定事件
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentTab = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
        searchQuery = ""; if (el.searchInput) el.searchInput.value = ""; if (el.searchClear) el.searchClear.classList.remove("show");
        render();
      });
    });

    if (el.searchInput) {
      el.searchInput.addEventListener("input", () => {
        searchQuery = el.searchInput.value.trim().toLowerCase();
        if (el.searchClear) el.searchClear.classList.toggle("show", searchQuery !== "");
        render();
      });
    }
    if (el.searchClear) {
      el.searchClear.addEventListener("click", () => {
        searchQuery = ""; if (el.searchInput) { el.searchInput.value = ""; el.searchInput.focus(); }
        el.searchClear.classList.remove("show"); render();
      });
    }

    document.getElementById("btnSync").addEventListener("click", syncFromAmber);
    document.getElementById("btnLoad").addEventListener("click", loadFromRepo);
    document.getElementById("btnExport").addEventListener("click", exportJS);
    
    document.getElementById("btnPaste").addEventListener("click", () => {
      el.pasteArea.value = ""; el.modalBackdrop.classList.add("show");
      setTimeout(() => el.pasteArea.focus(), 50);
    });
    el.modalCancel.addEventListener("click", () => el.modalBackdrop.classList.remove("show"));
    el.modalConfirm.addEventListener("click", () => {
      el.modalBackdrop.classList.remove("show");
      parsePastedUrls(el.pasteArea.value);
    });
    
    document.getElementById("btnClear").addEventListener("click", async () => {
      const ok = await showConfirm("清空当前分类", `确定清空「${TYPE_LABELS[currentTab]}」的所有条目吗？`);
      if (!ok) return;
      editorData[currentTab] = [];
      saveLocal(); render(); setStatus("已清空", "ok");
    });

    render();
    document.body.classList.add("ready");
  })();
})();

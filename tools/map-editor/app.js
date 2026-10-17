/* =========================================================================
 * 图标字典编辑器 · app.js (2026 现代扁平版)
 * =========================================================================
 * 核心改动：
 * 1. 彻底移除 JS 内联样式（如星空渐变计算），交由 CSS 类名控制。
 * 2. 状态栏改为悬浮胶囊显示，带消失动画。
 * 3. 清理多余工具函数，代码更精简。
 * ========================================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
   * 【JS 模块 1】常量配置
   * ------------------------------------------------------------------- */
  var STORAGE_KEY = "icon_dict_editor_v4";

  var DEFAULT_CONFIG = {
    characters: { prefix: "https://api.lunaris.moe/data/assets/avataricon/",  ext: ".webp" },
    artifacts:  { prefix: "https://api.lunaris.moe/data/assets/artifacts/",   ext: ".webp" },
    weapons:    { prefix: "https://api.lunaris.moe/data/assets/weaponicon/",  ext: ".webp" },
    monsters:   { prefix: "https://api.lunaris.moe/data/assets/monstericon/", ext: ".png" }
  };

  var AMBER_ENDPOINTS = {
    characters: "https://gi.yatta.moe/api/v2/CHS/avatar",
    weapons:    "https://gi.yatta.moe/api/v2/CHS/weapon",
    artifacts:  "https://gi.yatta.moe/api/v2/CHS/reliquary",
    monsters:   "https://gi.yatta.moe/api/v2/CHS/monster"
  };

  var LOCAL_IMG_BASE = "../../shared/gi-icons/";
  var ALL_TYPES = ["characters", "artifacts", "weapons", "monsters"];
  var TYPE_LABELS = { characters: "角色", artifacts: "圣遗物", weapons: "武器", monsters: "怪物" };

  /* ---------------------------------------------------------------------
   * 【JS 模块 2】DOM 引用
   * ------------------------------------------------------------------- */
  var entriesEl     = document.getElementById("entries");
  var emptyTip      = document.getElementById("emptyTip");
  var statusBar     = document.getElementById("status");
  var modalBackdrop = document.getElementById("modalBackdrop");
  var pasteArea     = document.getElementById("pasteArea");
  var searchInput   = document.getElementById("searchInput");
  var searchClear   = document.getElementById("searchClear");

  /* ---------------------------------------------------------------------
   * 【JS 模块 3】全局状态
   * ------------------------------------------------------------------- */
  var config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  var editorData = { characters: [], artifacts: [], weapons: [], monsters: [] };
  var currentTab = "characters";
  var searchQuery = "";

  var amberCache   = { characters: null, weapons: null, artifacts: null, monsters: null };
  var amberLoading = {};
  var CHAR_ORDER_TO_NAME = {};
  var CHAR_NAME_TO_ORDER = {};
  var statusTimer = null;

  /* ---------------------------------------------------------------------
   * 【JS 模块 4】Amber 数据加载 + 查询
   * ------------------------------------------------------------------- */
  function stripAmberPrefix(icon) {
    if (!icon) return "";
    return String(icon)
      .replace(/^UI_AvatarIcon_/i, "")
      .replace(/^UI_EquipIcon_/i, "")
      .replace(/^UI_RelicIcon_/i, "")
      .replace(/^UI_MonsterIcon_/i, "")
      .toLowerCase();
  }

  async function loadAmberData(type) {
    if (amberCache[type]) return amberCache[type];
    if (amberLoading[type]) return amberLoading[type];

    var promise = (async function () {
      var res = await fetch(AMBER_ENDPOINTS[type]);
      if (!res.ok) throw new Error("HTTP " + res.status);
      var json = await res.json();
      var raw = (json && json.data) || json || {};
      var items = raw.items || raw;
      var result = {};
      Object.keys(items).forEach(function (k) {
        var item = items[k];
        if (!item || typeof item !== "object") return;
        var name = item.name || "";
        if (!name) return;
        var icon = item.icon || "";
        var id = stripAmberPrefix(icon);
        if (id) result[id] = name;
        if (item.id != null) result[String(item.id)] = name;
      });
      amberCache[type] = result;
      return result;
    })();

    amberLoading[type] = promise;
    try { await promise; } finally { amberLoading[type] = null; }
    return promise;
  }

  async function lookupAmberName(type, id) {
    if (!id) return "";
    var normalized = String(id).toLowerCase()
      .replace(/^ui_avataricon_/i, "")
      .replace(/^ui_equipicon_/i, "")
      .replace(/^ui_relicicon_/i, "")
      .replace(/^ui_monstericon_/i, "");
    try {
      var table = await loadAmberData(type);
      return table[normalized] || table[String(id).toLowerCase()] || "";
    } catch (e) {
      return "";
    }
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 5】characters.txt 加载
   * ------------------------------------------------------------------- */
  async function loadCharOrderTxt() {
    try {
      var res = await fetch("../../shared/data/characters.txt?t=" + Date.now());
      if (!res.ok) return;
      var text = await res.text();
      CHAR_ORDER_TO_NAME = {};
      CHAR_NAME_TO_ORDER = {};
      text.split(/\r?\n/).forEach(function (line) {
        line = line.trim();
        if (!line || line.startsWith("#")) return;
        var parts = line.split(/[\s,，\t]+/);
        if (parts.length < 2) return;
        var order = parseInt(parts[0], 10);
        var name = parts.slice(1).join(" ").trim();
        if (!order || !name) return;
        CHAR_ORDER_TO_NAME[order] = name;
        CHAR_NAME_TO_ORDER[name] = order;
      });
    } catch (e) { console.warn("characters.txt 加载失败", e); }
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 6】查找辅助
   * ------------------------------------------------------------------- */
  function findOrderByName(name, excludeRow) {
    if (!name) return 0;
    var list = editorData.characters || [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r !== excludeRow && r.name === name && r.order) return r.order;
    }
    if (CHAR_NAME_TO_ORDER[name]) return CHAR_NAME_TO_ORDER[name];
    return 0;
  }

  function findNameByOrder(order, excludeRow) {
    if (!order) return "";
    var list = editorData.characters || [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r !== excludeRow && r.order === order && r.name) return r.name;
    }
    if (CHAR_ORDER_TO_NAME[order]) return CHAR_ORDER_TO_NAME[order];
    return "";
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 7】本地存储
   * ------------------------------------------------------------------- */
  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: editorData, config: config }));
    } catch (e) {}
  }
  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.data) {
        ALL_TYPES.forEach(function (t) {
          if (Array.isArray(parsed.data[t])) editorData[t] = parsed.data[t];
          else editorData[t] = [];
        });
      }
    } catch (e) {}
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 8】工具函数
   * ------------------------------------------------------------------- */
  function setStatus(msg, type) {
    statusBar.textContent = msg;
    statusBar.className = "status-bar show" + (type ? " " + type : "");
    
    // 自动隐藏（如果没错误，3秒后隐藏）
    if (statusTimer) clearTimeout(statusTimer);
    if (type !== "err") {
      statusTimer = setTimeout(function() {
        statusBar.classList.remove("show");
      }, 3000);
    }
  }

  function resolveUrl(type, row) {
    if (!row || !row.key) return "";
    if (row.local) return LOCAL_IMG_BASE + row.key;
    if (row.url) return row.url;
    if (/^https?:\/\//i.test(row.key)) return row.key;
    var cfg = config[type] || {};
    if (cfg.prefix) return cfg.prefix + row.key + (cfg.ext || "");
    return "";
  }

  function extractIconFullName(input) {
    var s = String(input || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) s = s.split("/").pop().split("?")[0];
    return s.replace(/\.[^.]+$/, "");
  }

  function esc(s) {
    return String(s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function rowMatches(row) {
    if (!searchQuery) return true;
    var name = String(row.name || "").toLowerCase();
    var key = String(row.key || "").toLowerCase();
    return name.indexOf(searchQuery) >= 0 || key.indexOf(searchQuery) >= 0;
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 9】条目列表渲染（含搜索筛选）
   * ------------------------------------------------------------------- */
  function render() {
    var list = editorData[currentTab] || [];
    var sorted = list.slice().sort(function (a, b) {
      var ao = a.order || 99999999;
      var bo = b.order || 99999999;
      return ao - bo;
    });

    var filtered = sorted.filter(rowMatches);

    if (searchQuery) {
      setStatus("已筛选 " + filtered.length + " / 共 " + sorted.length + " 条");
    } else {
      setStatus("共 " + sorted.length + " 条 · 自动保存");
    }

    entriesEl.innerHTML = "";

    if (sorted.length && !filtered.length) {
      emptyTip.classList.add("show");
      emptyTip.innerHTML = '<span class="big-icon">🔍</span><span>没有找到匹配的条目<br>试试其他关键词</span>';
      return;
    }
    if (!sorted.length) {
      emptyTip.classList.add("show");
      emptyTip.innerHTML = '<span class="big-icon">📭</span><span>当前分类还没有条目<br>点上方按钮开始</span>';
      return;
    }
    emptyTip.classList.remove("show");

    filtered.forEach(function (row) {
      var card = document.createElement("div");
      card.className = "item-card";

      var line = document.createElement("div");
      line.className = "entry-row";

      // 1. 编号
      var inpOrder = document.createElement("input");
      inpOrder.type = "number"; inpOrder.className = "entry-order";
      inpOrder.value = row.order || "";
      inpOrder.title = "序号";
      inpOrder.addEventListener("change", function () {
        var v = (inpOrder.value || "").trim();
        var newOrder = v === "" ? 0 : (parseInt(v, 10) || 0);

        if (currentTab === "characters") {
          var curName = (row.name || "").trim();
          if (curName) {
            var autoOrder = findOrderByName(curName, row);
            row.order = autoOrder ? autoOrder : newOrder;
          } else {
            row.order = newOrder;
            if (newOrder > 0) {
              var autoName = findNameByOrder(newOrder, row);
              if (autoName) row.name = autoName;
            }
          }
        } else {
          row.order = newOrder;
        }
        saveLocal(); render();
      });
      line.appendChild(inpOrder);

      // 2. 缩略图 (带星空背景)
      var thumb = document.createElement("div");
      // 应用星级类名
      if (row.star != null) {
        thumb.className = "entry-thumb star-" + row.star;
      } else {
        thumb.className = "entry-thumb";
      }
      
      var thumbImg = document.createElement("img");
      thumbImg.alt = "";
      thumbImg.loading = "lazy";
      thumb.appendChild(thumbImg);
      line.appendChild(thumb);
      
      var url = resolveUrl(currentTab, row);
      if (url) {
        thumbImg.src = url;
        thumbImg.onerror = function () { thumbImg.removeAttribute("src"); };
      }

      // 3. 名字
      var inpName = document.createElement("input");
      inpName.type = "text"; inpName.className = "entry-name";
      inpName.value = row.name || ""; inpName.placeholder = "中文名";
      inpName.addEventListener("input", function () { row.name = inpName.value; saveLocal(); });
      inpName.addEventListener("blur", function () {
        var name = (inpName.value || "").trim();
        row.name = name;
        if (currentTab === "characters") {
          if (name) {
            var autoOrder = findOrderByName(name, row);
            if (autoOrder) row.order = autoOrder;
          } else {
            row.order = 0;
          }
        }
        saveLocal(); render();
      });
      line.appendChild(inpName);

      // 4. 星级 (怪物不显示)
      if (currentTab !== "monsters") {
        var selStar = document.createElement("select");
        selStar.className = "star-select";
        [1, 2, 3, 4, 5].forEach(function (s) {
          var opt = document.createElement("option");
          opt.value = s; opt.textContent = s + "★";
          if (s === (row.star || 5)) opt.selected = true;
          selStar.appendChild(opt);
        });
        selStar.addEventListener("change", function () {
          row.star = parseInt(selStar.value, 10) || 5;
          saveLocal(); render();
        });
        line.appendChild(selStar);
      }

      // 5. 删除
      var btnDel = document.createElement("button");
      btnDel.type = "button"; btnDel.className = "entry-del btn-xs btn-danger";
      btnDel.innerHTML = ICONS.ui.trash;
      btnDel.addEventListener("click", function () {
        var idx = editorData[currentTab].indexOf(row);
        if (idx >= 0) editorData[currentTab].splice(idx, 1);
        saveLocal(); render(); setStatus("已删除", "ok");
      });
      line.appendChild(btnDel);

      card.appendChild(line);
      entriesEl.appendChild(card);
    });
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 10】粘贴 URL 解析
   * ------------------------------------------------------------------- */
  async function parsePastedUrls(text) {
    var lines = String(text || "").split(/\r?\n/);
    var urls = lines.map(function (l) { return l.trim(); }).filter(function (l) { return /^https?:\/\//i.test(l); });
    if (!urls.length) { setStatus("未识别到有效链接", "err"); return; }

    var cfg = config[currentTab] || { prefix: "", ext: "" };
    var list = editorData[currentTab];

    var byKey = {};
    list.forEach(function (row) { if (row.key) byKey[row.key] = row; });

    var updated = [];
    var created = [];

    urls.forEach(function (url) {
      var key = extractIconFullName(url);
      if (!key) return;

      var isConfig = !!(cfg.prefix && url === (cfg.prefix + key + (cfg.ext || "")));
      var customUrl = isConfig ? "" : url;

      var existing = byKey[key];
      if (existing) {
        if (customUrl) existing.url = customUrl;
        else delete existing.url;
        updated.push(existing);
      } else {
        var row = { key: key, name: "", order: 0 };
        if (currentTab === "monsters") row.star = null;
        else row.star = 5;
        if (customUrl) row.url = customUrl;
        list.push(row);
        byKey[key] = row;
        created.push(row);
      }
    });

    saveLocal(); render();

    if (created.length) {
      setStatus("正在查询中文名…");
      var amberReady = false;
      try { await loadAmberData(currentTab); amberReady = true; } catch (e) { amberReady = false; }
      if (amberReady) {
        for (var i = 0; i < created.length; i++) {
          var r = created[i];
          var name = await lookupAmberName(currentTab, r.key);
          if (name) r.name = name;
          saveLocal(); render();
        }
      }
    }

    var msg = [];
    if (updated.length) msg.push("更新 " + updated.length + " 条");
    if (created.length) msg.push("新增 " + created.length + " 条");
    setStatus(msg.length ? msg.join(" · ") : "无变化", "ok");
    saveLocal(); render();
  }

  function openPasteModal() {
    pasteArea.value = "";
    modalBackdrop.classList.add("show");
    setTimeout(function () { pasteArea.focus(); }, 50);
  }
  function closePasteModal() { modalBackdrop.classList.remove("show"); }

  /* ---------------------------------------------------------------------
   * 【JS 模块 11】从 Amber 同步
   * ------------------------------------------------------------------- */
  async function fetchAmberItems(type) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var res = await fetch(AMBER_ENDPOINTS[type], { signal: controller.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var json = await res.json();
      var raw = (json && json.data) || json || {};
      return raw.items || raw;
    } finally {
      clearTimeout(timer);
    }
  }

  function transformAmberItems(type, items) {
    var result = {};
    Object.keys(items).forEach(function (id) {
      var item = items[id];
      if (!item || typeof item !== "object") return;
      var icon = item.icon || "";
      var name = item.name || "";
      if (!icon || !name) return;

      var key = icon;
      var order = 0;
      var star = null;

      if (type === "characters") {
        if (!CHAR_NAME_TO_ORDER[name]) return;
        order = CHAR_NAME_TO_ORDER[name];
        star = item.rank || 5;
      } else if (type === "weapons") {
        order = item.id || 0;
        star = item.rank || 5;
        if (order < 10000 || order >= 100000) return;
      } else if (type === "artifacts") {
        order = item.id || 0;
        var lvList = Array.isArray(item.levelList) ? item.levelList : [];
        star = lvList.length ? Math.max.apply(null, lvList) : 5;
      } else if (type === "monsters") {
        order = item.id || 0;
      }

      result[key] = { name: name, star: star, order: order };
    });
    return result;
  }

  async function syncFromAmber() {
    setStatus("正在从 Amber 同步…");

    config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    var customByName = {};
    ALL_TYPES.forEach(function (type) {
      customByName[type] = {};
      (editorData[type] || []).forEach(function (row) {
        if ((row.local || row.url) && row.name) customByName[type][row.name] = row;
      });
    });

    var amberResult = {};
    for (var i = 0; i < ALL_TYPES.length; i++) {
      var type = ALL_TYPES[i];
      setStatus("正在拉取" + TYPE_LABELS[type] + "…");
      try {
        var items = await fetchAmberItems(type);
        amberResult[type] = transformAmberItems(type, items);
      } catch (e) {
        setStatus("同步失败：" + TYPE_LABELS[type] + " - " + (e.message || "超时或网络异常"), "err");
        return;
      }
    }

    setStatus("正在合并数据…");
    ALL_TYPES.forEach(function (type) {
      var merged = {};
      var customMap = customByName[type] || {};
      var customNames = {};
      Object.keys(customMap).forEach(function (name) { customNames[name] = true; });

      Object.keys(customMap).forEach(function (name) {
        var row = customMap[name];
        var out = { name: row.name, star: row.star, order: row.order };
        if (row.local) out.local = true;
        if (row.url) out.url = row.url;
        merged[row.key] = out;
      });

      var amberItems = amberResult[type] || {};
      var amberNames = {};
      Object.keys(amberItems).forEach(function (key) {
        var item = amberItems[key];
        if (customNames[item.name]) return;
        amberNames[item.name] = true;
        merged[key] = item;
      });

      var existingByName = {};
      (editorData[type] || []).forEach(function (row) {
        if (row.name) existingByName[row.name] = row;
      });
      Object.keys(existingByName).forEach(function (name) {
        if (amberNames[name]) return;
        if (customNames[name]) return;
        var row = existingByName[name];
        var out = { name: row.name, star: row.star, order: row.order };
        if (row.local) out.local = true;
        if (row.url) out.url = row.url;
        merged[row.key] = out;
      });

      editorData[type] = Object.keys(merged).map(function (k) {
        var r = merged[k];
        var out = { key: k, name: r.name, order: r.order };
        if (r.star != null) out.star = r.star;
        if (r.local) out.local = true;
        if (r.url) out.url = r.url;
        return out;
      });
    });

    saveLocal();
    render();

    var summary = ALL_TYPES.map(function (t) {
      return TYPE_LABELS[t] + " " + editorData[t].length;
    }).join(" · ");
    setStatus("同步完成 · " + summary, "ok");
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 12】清空当前分类
   * ------------------------------------------------------------------- */
  function clearCurrent() {
    var label = TYPE_LABELS[currentTab];
    if (!confirm("确定清空「" + label + "」的所有条目吗？")) return;
    editorData[currentTab] = [];
    saveLocal(); render(); setStatus("已清空", "ok");
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 13】从仓库载入
   * ------------------------------------------------------------------- */
  function loadFromRepo() {
    setStatus("正在从仓库载入…");
    fetch("../../shared/gi-icons/icon-dict.js?t=" + Date.now())
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (code) {
        var sandbox = { window: {} };
        new Function("window", code)(sandbox.window);
        var dict = sandbox.window.ICON_DICT || {};
        if (dict.config) config = dict.config;
        ALL_TYPES.forEach(function (type) {
          var obj = dict[type] || {};
          var keys = Object.keys(obj);
          editorData[type] = keys.map(function (k) {
            var item = obj[k] || {};
            var out = { key: k, name: item.name || "", order: item.order || 0 };
            if (item.star != null) out.star = item.star;
            if (item.local) out.local = true;
            if (item.url) out.url = item.url;
            return out;
          });
        });
        saveLocal(); render(); setStatus("已从仓库载入", "ok");
      })
      .catch(function (e) { setStatus("载入失败：" + e.message, "err"); });
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 14】导出 icon-dict.js
   * ------------------------------------------------------------------- */
  function buildDictJS() {
    var lines = [];
    lines.push("window.ICON_DICT = {");
    lines.push("  config: {");
    ALL_TYPES.forEach(function (type, ti) {
      var cfg = config[type] || DEFAULT_CONFIG[type] || { prefix: "", ext: "" };
      lines.push('    ' + type + ': { prefix: "' + esc(cfg.prefix) + '", ext: "' + esc(cfg.ext || "") + '" }' + (ti < ALL_TYPES.length - 1 ? "," : ""));
    });
    lines.push("  },");

    ALL_TYPES.forEach(function (type, ti) {
      lines.push("");
      lines.push("  /* ============ " + TYPE_LABELS[type] + " ============ */");
      lines.push("  " + type + ": {");

      var list = editorData[type].slice()
        .filter(function (it) { return it.key; })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

      if (!list.length) lines.push("    // 暂无条目");

      list.forEach(function (item, i) {
        var parts = ['name: "' + esc(item.name) + '"'];
        if (item.star != null) parts.push("star: " + item.star);
        parts.push("order: " + (item.order || 0));
        if (item.local) parts.push("local: true");
        if (item.url) parts.push('url: "' + esc(item.url) + '"');
        var line = '    "' + esc(item.key) + '": { ' + parts.join(", ") + " }";
        if (i < list.length - 1) line += ",";
        lines.push(line);
      });

      lines.push("  }" + (ti < ALL_TYPES.length - 1 ? "," : ""));
    });

    lines.push("};");
    lines.push("");
    return lines.join("\n");
  }

  function exportJS() {
    var blob = new Blob([buildDictJS()], { type: "text/javascript;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "icon-dict.js";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    setStatus("已导出，上传到 shared/gi-icons/ 覆盖", "ok");
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 15】主题 (父页面控制)
   * ------------------------------------------------------------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 16】图标注入
   * ------------------------------------------------------------------- */
  function injectIcons() {
    var iconMap = {
      "btnSync":   ICONS.ui.import,
      "btnPaste":  ICONS.ui.plus,
      "btnLoad":   ICONS.ui.import,
      "btnExport": ICONS.ui.export,
      "btnClear":  ICONS.ui.trash
    };
    Object.keys(iconMap).forEach(function (id) {
      var el = document.querySelector("#" + id + " .btn-icon");
      if (el) el.innerHTML = iconMap[id];
    });
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 17】事件绑定
   * ------------------------------------------------------------------- */
  function bindEvents() {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentTab = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });

        searchQuery = "";
        if (searchInput) searchInput.value = "";
        if (searchClear) searchClear.classList.remove("show");

        render();
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        searchQuery = (searchInput.value || "").trim().toLowerCase();
        if (searchClear) searchClear.classList.toggle("show", searchQuery !== "");
        render();
      });
    }

    if (searchClear) {
      searchClear.addEventListener("click", function () {
        searchQuery = "";
        if (searchInput) { searchInput.value = ""; searchInput.focus(); }
        searchClear.classList.remove("show");
        render();
      });
    }

    document.getElementById("btnSync").addEventListener("click", syncFromAmber);
    document.getElementById("btnPaste").addEventListener("click", openPasteModal);
    document.getElementById("modalCancel").addEventListener("click", closePasteModal);
    document.getElementById("modalConfirm").addEventListener("click", function () {
      closePasteModal();
      parsePastedUrls(pasteArea.value);
    });
    modalBackdrop.addEventListener("click", function (e) { if (e.target === modalBackdrop) closePasteModal(); });
    document.getElementById("btnClear").addEventListener("click", clearCurrent);
    document.getElementById("btnLoad").addEventListener("click", loadFromRepo);
    document.getElementById("btnExport").addEventListener("click", exportJS);
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 18】跨 iframe 通信
   * ------------------------------------------------------------------- */
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "theme") {
      applyTheme(e.data.theme);
    }
  });

  /* ---------------------------------------------------------------------
   * 【JS 模块 19】初始化
   * ------------------------------------------------------------------- */
  (async function init() {
    try { await window.__bootPromise; } catch (e) { console.warn(e); }

    injectIcons();
    await loadCharOrderTxt();
    loadLocal();
    bindEvents();
    render();

    document.body.classList.add("ready");
  })();

})();

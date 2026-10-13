/* =========================================================================
 * 图标字典编辑器 · app.js
 * =========================================================================
 * 模块导航（搜索 "【JS 模块 N】" 快速跳转）：
 *   【JS 模块 1】 常量配置
 *   【JS 模块 2】 DOM 引用
 *   【JS 模块 3】 全局状态
 *   【JS 模块 4】 Amber 数据加载 + 查询
 *   【JS 模块 5】 characters.txt 加载
 *   【JS 模块 6】 查找辅助（字典 ↔ 编号）
 *   【JS 模块 7】 本地存储
 *   【JS 模块 8】 工具函数
 *   【JS 模块 9】 条目列表渲染（含搜索筛选）
 *   【JS 模块 10】粘贴 URL 解析
 *   【JS 模块 11】从 Amber 同步（生成完整字典）
 *   【JS 模块 12】清空当前分类
 *   【JS 模块 13】从仓库载入 icon-dict.js
 *   【JS 模块 14】导出 icon-dict.js
 *   【JS 模块 15】主题（由父页面控制，本页仅被动接收）
 *   【JS 模块 16】图标注入
 *   【JS 模块 17】事件绑定
 *   【JS 模块 18】跨 iframe 通信
 *   【JS 模块 19】初始化
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
  var searchQuery = "";   /* 当前搜索词（小写），空 = 不过滤 */

  var amberCache   = { characters: null, weapons: null, artifacts: null, monsters: null };
  var amberLoading = {};

  var CHAR_ORDER_TO_NAME = {};
  var CHAR_NAME_TO_ORDER = {};

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
      if (!res.ok) { console.warn("characters.txt HTTP " + res.status); return; }
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
      console.log("characters.txt 加载成功，共 " + Object.keys(CHAR_NAME_TO_ORDER).length + " 条");
    } catch (e) {
      console.warn("characters.txt 加载失败：", e.message);
    }
  }

  /* ---------------------------------------------------------------------
   * 【JS 模块 6】查找辅助：字典优先，其次 txt
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
    statusBar.className = "status-bar" + (type ? " " + type : "");
  }

  function starColor(s) {
    var lib = window.ICON_LIB;
    return (lib && lib.starColors && lib.starColors[s]) || "#939393";
  }

  function darkenHex(hex, amt) {
    if (!hex || typeof hex !== "string") return "#333333";
    var h = hex.charAt(0) === "#" ? hex.slice(1) : hex;
    if (h.length !== 6) return "#333333";
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(function (v) { return isNaN(v); })) return "#333333";
    var rr = Math.max(0, r - amt);
    var gg = Math.max(0, g - amt);
    var bb = Math.max(0, b - amt);
    return "#" + rr.toString(16).padStart(2, "0") + gg.toString(16).padStart(2, "0") + bb.toString(16).padStart(2, "0");
  }

  /**
   * 解析条目最终 URL。优先级：
   *   1. local: true   → 仓库本地文件（LOCAL_IMG_BASE + key）
   *   2. url: "..."    → 单条指定链接
   *   3. key 是 http   → 直接用
   *   4. 拼接          → prefix + key + ext
   */
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

  function makeThumbFor(row, cb) {
    cb(resolveUrl(currentTab, row));
  }

  function esc(s) {
    return String(s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  /**
   * 判断某条记录是否匹配当前搜索词。
   * 规则：搜索词小写后，若为空则匹配；否则 name 或 key 任一包含即匹配。
   */
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

    /* 过滤 */
    var filtered = sorted.filter(rowMatches);

    /* 状态栏：显示筛选计数 */
    if (searchQuery) {
      setStatus("已筛选 " + filtered.length + " / 共 " + sorted.length + " 条");
    } else {
      setStatus("共 " + sorted.length + " 条 · 编辑自动保存");
    }

    entriesEl.innerHTML = "";

    /* 原列表非空但筛选后为空 → 显示"无匹配" */
    if (sorted.length && !filtered.length) {
      emptyTip.style.display = "block";
      emptyTip.innerHTML = '<span class="big-icon">🔍</span>没有找到匹配的条目<br>试试其他关键词';
      return;
    }
    /* 原列表就空 → 显示默认空状态 */
    if (!sorted.length) {
      emptyTip.style.display = "block";
      emptyTip.innerHTML = '<span class="big-icon">📭</span>当前分类还没有条目<br>点上方按钮开始';
      return;
    }
    emptyTip.style.display = "none";

    filtered.forEach(function (row) {
      var card = document.createElement("div");
      card.className = "item-card";

      /* 一行布局：编号 / 头像 / 名字 / 星级 / 删除 */
      var line = document.createElement("div");
      line.className = "entry-row";

      /* 编号 */
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

      /* 缩略图 */
      var thumb = document.createElement("div");
      thumb.className = "entry-thumb";
      if (row.star != null) {
        var c = starColor(row.star);
        var edge = darkenHex(c, 50);
        thumb.style.background = "radial-gradient(circle, " + c + ", " + edge + ")";
      }
      var thumbImg = document.createElement("img");
      thumbImg.alt = "";
      thumbImg.loading = "lazy";
      thumb.appendChild(thumbImg);
      line.appendChild(thumb);
      makeThumbFor(row, function (url) {
        if (url) {
          thumbImg.src = url;
          thumbImg.onerror = function () { thumbImg.removeAttribute("src"); };
        }
      });

      /* 名字 */
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

      /* 星级（怪物不显示） */
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

      /* 删除 */
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
   * -------------------------------------------------------------------
   * 语义：给某个图标 key 指定源。
   *   1. 从 URL 取文件名（去后缀）当作 key
   *   2. 判断 URL 是否严格符合 config 规则（=== prefix + key + ext）
   *        符合 → 不加 url，走拼接
   *        不符合 → 保留完整 URL 到 url 字段
   *   3. 按 key 找已有条目
   *        找到 → 只更新 url 字段，不动 order、不新增、不改中文名
   *        没找到 → 新建条目（order: 0），查 Amber 补中文名
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
   * 【JS 模块 11】从 Amber 同步（生成完整字典）
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
        if (!CHAR_NAME_TO_ORDER[name]) return;  /* txt 里没有 → 跳过 */
        order = CHAR_NAME_TO_ORDER[name];
        star = item.rank || 5;
      } else if (type === "weapons") {
        order = item.id || 0;
        star = item.rank || 5;
        /* 只保留 5 位 order 的武器（过滤幻化皮肤、测试数据等 6 位 order） */
        if (order < 10000 || order >= 100000) return;
      } else if (type === "artifacts") {
        order = item.id || 0;
        var lvList = Array.isArray(item.levelList) ? item.levelList : [];
        star = lvList.length ? Math.max.apply(null, lvList) : 5;
      } else if (type === "monsters") {
        order = item.id || 0;
        /* 怪物无 star */
      }

      result[key] = { name: name, star: star, order: order };
    });
    return result;
  }

  async function syncFromAmber() {
    setStatus("正在从 Amber 同步…");

    config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    /* 备份编辑器里带"自定义来源"的条目（local 或 url），按名字索引 */
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

      /* 3.1 先放自定义来源条目（local / url），保持原样 */
      Object.keys(customMap).forEach(function (name) {
        var row = customMap[name];
        var out = { name: row.name, star: row.star, order: row.order };
        if (row.local) out.local = true;
        if (row.url) out.url = row.url;
        merged[row.key] = out;
      });

      /* 3.2 Amber 里的条目：名字被自定义来源占用则跳过 */
      var amberItems = amberResult[type] || {};
      var amberNames = {};
      Object.keys(amberItems).forEach(function (key) {
        var item = amberItems[key];
        if (customNames[item.name]) return;
        amberNames[item.name] = true;
        merged[key] = item;
      });

      /* 3.3 现有条目里 Amber 没有、也不是自定义来源的 → 保留（含 url 字段） */
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

      /* 3.4 转成数组 */
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
   * 【JS 模块 13】从仓库载入 icon-dict.js
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
   * 【JS 模块 15】主题
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
    /* Tab 切换：清空搜索 */
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentTab = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });

        /* 清空搜索框 */
        searchQuery = "";
        if (searchInput) searchInput.value = "";
        if (searchClear) searchClear.classList.remove("show");

        render();
      });
    });

    /* 搜索输入 */
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        searchQuery = (searchInput.value || "").trim().toLowerCase();
        if (searchClear) searchClear.classList.toggle("show", searchQuery !== "");
        render();
      });
    }

    /* 清除搜索 */
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
    /* 等资源加载器完成 */
    try { await window.__bootPromise; } catch (e) { console.warn(e); }

    injectIcons();
    await loadCharOrderTxt();
    loadLocal();
    bindEvents();
    render();

    /* 一切就绪，揭开启动遮罩 */
    document.body.classList.add("ready");
  })();

})();

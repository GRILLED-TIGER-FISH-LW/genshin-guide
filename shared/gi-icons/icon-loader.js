/* ============================================================
 * 图标加载器 · 全站共享
 * 四种模式（按优先级从高到低）：
 *   1. 本地：条目带 local: true，key 是文件名（如 UI_AvatarIcon_Traveler.webp），从 icons/ 根目录加载
 *      （老格式，新数据不写这个 —— 仓库里的图直接存站点绝对路径，走第 2 条）
 *   2. 覆盖：条目带 url 字段，直接使用该 url
 *   3. URL ：key 以 http 开头，直接用
 *   4. 代号：key 是图标代号（如 Ambor / 10001_4），靠 config[type].prefix 拼 URL
 *      —— prefix 里含图标名常量（如 https://…/avataricon/UI_AvatarIcon_）
 * ============================================================ */
(function () {
  "use strict";

  var STAR_COLORS = { 1: "#85949C", 2: "#649C74", 3: "#54A4B4", 4: "#9174A9", 5: "#DCA454" };

  function hexToHsl(hex) {
    var num = parseInt(hex.replace("#", ""), 16);
    var r = ((num >> 16) & 0xFF) / 255, g = ((num >> 8) & 0xFF) / 255, b = (num & 0xFF) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return "#" + [r + m, g + m, b + m]
      .map(function (v) { return Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, "0"); })
      .join("");
  }
  function darken(hex, percent) {
    var hsl = hexToHsl(hex);
    return hslToHex(hsl[0], hsl[1], Math.max(0, hsl[2] * (1 - percent)));
  }

  var ICON_BASE = (function () {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (src.indexOf("icon-loader.js") >= 0) return src.replace(/icon-loader\.js.*$/, "");
    }
    return "icons/";
  })();

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("图标加载失败：" + src)); };
      img.src = src;
    });
  }

  function applyBackground(img, star, opts) {
    /* 无星级（如怪物图标）→ 不加背景，直接返回原图 */
    if (star == null) {
      var canvas0 = document.createElement("canvas");
      canvas0.width = img.width;
      canvas0.height = img.height;
      canvas0.getContext("2d").drawImage(img, 0, 0);
      return canvas0.toDataURL("image/png");
    }

    opts = opts || {};
    var size = opts.size || 256;
    var padding = opts.padding != null ? opts.padding : 0;
    var color = STAR_COLORS[star] || "#939393";
    var edgeColor = darken(color, 0.5);

    var canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext("2d");
    var r = size * 0.707;
    var grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, r);
    grad.addColorStop(0, color); grad.addColorStop(1, edgeColor);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);

    var inner = size * (1 - padding * 2);
    var ratio = Math.min(inner / img.width, inner / img.height);
    var w = img.width * ratio, h = img.height * ratio;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL("image/png");
  }

  function stripExt(s) { return String(s || "").replace(/\.[^.]+$/, ""); }
  function stripSuffix(s) {
    return String(s || "")
      .replace(/[（(][^）)]*[）)]/g, "")
      .replace(/[·•・].*$/, "")
      .replace(/[—–\-].*$/, "")
      .trim();
  }
  function stripPrefix(s) { return String(s || "").replace(/^UI_[A-Za-z]+_/i, ""); }

  /* ============ 提取英文 ID（剥掉历史遗留的 UI_AvatarIcon_ 这类前缀） ============ */
  function extractId(type, key) {
    if (!key) return "";
    var raw = "";
    if (/^https?:\/\//i.test(key)) {
      var last = key.split("/").pop() || "";
      raw = stripExt(last);
    } else {
      var dict = window.ICON_DICT;
      if (dict && dict[type] && dict[type][key] && dict[type][key].local) {
        raw = stripExt(key);
      } else {
        raw = key;
      }
    }
    return stripPrefix(raw);
  }

  /* ============ 把传进来的 key 归一成字典里真实存在的那个 ============
     字典里存的是代号（Ambor）。老调用方 / 老草稿里可能还存着全名
     （UI_AvatarIcon_Ambor），那就剥掉前缀再查一次。 */
  function resolveKey(type, key) {
    var dict = window.ICON_DICT;
    if (!dict || !dict[type]) return "";
    var k = String(key == null ? "" : key);
    if (dict[type][k]) return k;
    var bare = stripPrefix(stripExt(k));
    if (bare && dict[type][bare]) return bare;
    return "";
  }

  /* ============ 解析最终 URL ============ */
  function getPath(type, key) {
    var dict = window.ICON_DICT;
    var k = resolveKey(type, key);
    if (!k) return "";
    var item = dict[type][k];

    /* 1. 本地：从 icons/ 根目录加载（老格式，优先级最高） */
    if (item.local) return ICON_BASE + k;
    /* 2. 单条目 URL 覆盖（也包含仓库内图片的站点绝对路径） */
    if (item.url) return item.url;
    /* 3. 完整 URL：直接用 */
    if (/^https?:\/\//i.test(k)) return k;
    /* 4. 代号 + 前缀 + 后缀（prefix 已含图标名常量） */
    var cfg = dict.config && dict.config[type];
    if (cfg && cfg.prefix) return cfg.prefix + k + (cfg.ext || "");
    return "";
  }

  /* ============ 匹配 ============ */
  function match(type, query) {
    var dict = window.ICON_DICT;
    if (!dict || !dict[type]) return null;
    var q = String(query || "").trim();
    if (!q) return null;
    var qLower = q.toLowerCase();
    var qNoSuffix = stripSuffix(q).toLowerCase();
    var qStripped = stripPrefix(qNoSuffix);

    var items = dict[type];
    var key, item, idLower;

    /* 第一遍：一模一样的那种。
       必须先跑这遍 —— 「旅行者·冰」在第二遍会被 stripSuffix 削成「旅行者」，
       抢在它自己前面命中基础旅行者。 */
    for (key in items) {
      item = items[key] || {};
      idLower = extractId(type, key).toLowerCase();
      if (q === item.name || qLower === idLower || qLower === String(key).toLowerCase()) {
        return { key: key, name: item.name, star: item.star };
      }
    }

    /* 第二遍：宽松匹配（去括号、去 · 后面、剥 UI_ 前缀） */
    for (key in items) {
      item = items[key] || {};
      idLower = extractId(type, key).toLowerCase();

      /* 中文名匹配 */
      if (q === item.name || qNoSuffix === (item.name || "").toLowerCase()) {
        return { key: key, name: item.name, star: item.star };
      }
      /* 英文 ID 匹配 */
      if (qLower === idLower || qNoSuffix === idLower || qStripped === idLower) {
        return { key: key, name: item.name, star: item.star };
      }
      /* 完整 key 匹配 */
      if (qLower === String(key).toLowerCase() || qStripped === String(key).toLowerCase()) {
        return { key: key, name: item.name, star: item.star };
      }
    }
    return null;
  }

  var cache = {};
  function ck(type, key) { return type + "::" + key; }

  async function load(type, key, opts) {
    var dict = window.ICON_DICT;
    var k = resolveKey(type, key);
    if (!k) throw new Error("未知图标：" + type + "/" + key);
    var c = ck(type, k);
    if (cache[c]) return cache[c];
    var path = getPath(type, k);
    if (!path) throw new Error("无法解析路径：" + type + "/" + key);
    var img = await loadImage(path);
    var dataURL = applyBackground(img, dict[type][k].star, opts);
    cache[c] = dataURL;
    return dataURL;
  }

  async function fromName(type, name, opts) {
    var m = match(type, name);
    if (!m) return null;
    var dataURL = await load(type, m.key, opts);
    return { key: m.key, name: m.name, star: m.star, dataURL: dataURL };
  }

  function getCached(type, key) {
    var k = resolveKey(type, key) || key;
    return cache[ck(type, k)] || null;
  }

  /* ============ 选择器 ============ */
  var pickerCSS = [
    ".icon-picker-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9000;opacity:0;pointer-events:none;transition:opacity .22s}",
    ".icon-picker-backdrop.show{opacity:1;pointer-events:auto}",
    ".icon-picker{position:fixed;left:0;right:0;bottom:0;z-index:9001;background:#fff;border-radius:16px 16px 0 0;max-height:75vh;display:flex;flex-direction:column;transform:translateY(100%);transition:transform .28s cubic-bezier(.16,1,.3,1);box-shadow:0 -12px 40px rgba(0,0,0,.15)}",
    ".icon-picker.show{transform:translateY(0)}",
    ".icon-picker-header{padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee;flex-shrink:0}",
    ".icon-picker-title{font-size:15px;font-weight:600;color:#222}",
    ".icon-picker-close{width:30px;height:30px;border-radius:8px;border:1px solid #ddd;background:#fff;color:#222;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:16px;padding:0}",
    ".icon-picker-search{padding:10px 16px;flex-shrink:0}",
    ".icon-picker-search input{width:100%;height:38px;padding:0 12px;border-radius:10px;border:1px solid #ddd;background:#f5f5f5;color:#222;font-size:14px;outline:none}",
    ".icon-picker-grid{flex:1;overflow-y:auto;padding:8px 16px 20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}",
    ".icon-picker-item{aspect-ratio:1;border-radius:10px;border:1px solid #eee;background:#fff;cursor:pointer;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px;transition:transform .12s}",
    ".icon-picker-item:active{transform:scale(.94)}",
    ".icon-picker-item img{width:100%;height:100%;object-fit:contain;border-radius:6px;display:block}",
    ".icon-picker-item-name{font-size:10px;color:#999;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;text-align:center}",
    ".icon-picker-empty{grid-column:1/-1;text-align:center;color:#999;font-size:13px;padding:40px 0}",
    "@media(min-width:640px){.icon-picker{left:50%;right:auto;bottom:auto;top:50%;width:480px;max-height:70vh;border-radius:16px;transform:translate(-50%,-45%) scale(.96)}.icon-picker.show{transform:translate(-50%,-50%) scale(1)}}"
  ].join("");

  function ensureStyles() {
    if (document.getElementById("icon-picker-style")) return;
    var s = document.createElement("style");
    s.id = "icon-picker-style";
    s.textContent = pickerCSS;
    document.head.appendChild(s);
  }

  function openPicker(type, onSelect, opts) {
    opts = opts || {};
    ensureStyles();
    var dict = window.ICON_DICT;
    if (!dict || !dict[type]) return;

    var allItems = Object.keys(dict[type]).map(function (k) {
      return { key: k, name: dict[type][k].name, star: dict[type][k].star };
    });

    var backdrop = document.createElement("div");
    backdrop.className = "icon-picker-backdrop";
    var picker = document.createElement("div");
    picker.className = "icon-picker";
    picker.innerHTML =
      '<div class="icon-picker-header"><div class="icon-picker-title">' + (opts.title || "选择图标") + '</div><button type="button" class="icon-picker-close">×</button></div>' +
      '<div class="icon-picker-search"><input type="text" placeholder="搜索名称..." /></div>' +
      '<div class="icon-picker-grid"></div>';
    document.body.appendChild(backdrop);
    document.body.appendChild(picker);

    var searchInput = picker.querySelector(".icon-picker-search input");
    var gridEl = picker.querySelector(".icon-picker-grid");

    function renderGrid() {
      var q = searchInput.value.toLowerCase();
      var list = allItems.filter(function (it) {
        if (!q) return true;
        return (it.name || "").toLowerCase().indexOf(q) >= 0 || it.key.toLowerCase().indexOf(q) >= 0;
      });
      if (!list.length) { gridEl.innerHTML = '<div class="icon-picker-empty">没有匹配</div>'; return; }
      gridEl.innerHTML = list.map(function (it) {
        return '<div class="icon-picker-item" data-key="' + it.key.replace(/"/g, "&quot;") + '">' +
          '<img src="' + getPath(type, it.key) + '" loading="lazy" onerror="this.style.opacity=.2" />' +
          '<div class="icon-picker-item-name">' + (it.name || "") + '</div></div>';
      }).join("");
      gridEl.querySelectorAll(".icon-picker-item").forEach(function (el) {
        el.addEventListener("click", async function () {
          var key = el.dataset.key;
          try {
            var dataURL = await load(type, key, opts.renderOpts);
            onSelect({ key: key, name: dict[type][key].name, star: dict[type][key].star, dataURL: dataURL });
          } catch (e) {}
          close();
        });
      });
    }

    function close() {
      backdrop.classList.remove("show"); picker.classList.remove("show");
      setTimeout(function () {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (picker.parentNode) picker.parentNode.removeChild(picker);
      }, 300);
    }

    searchInput.addEventListener("input", renderGrid);
    picker.querySelector(".icon-picker-close").addEventListener("click", close);
    backdrop.addEventListener("click", close);
    renderGrid();
    requestAnimationFrame(function () { backdrop.classList.add("show"); picker.classList.add("show"); });
  }

  window.ICON_LIB = {
    base: ICON_BASE,
    starColors: STAR_COLORS,
    match: match,
    load: load,
    fromName: fromName,
    getCached: getCached,
    applyBackground: applyBackground,
    getPath: getPath,
    extractId: extractId,
    resolveKey: resolveKey,
    openPicker: openPicker,
    applyBackgroundToFile: function (file, star, opts) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var img = new Image();
          img.onload = function () { resolve(applyBackground(img, star, opts)); };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  };
})();

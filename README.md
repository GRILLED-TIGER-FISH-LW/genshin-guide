<div align="center">

# 原神攻略工具集

> 个人自用的原神攻略图制作工具集 · 纯前端 · 本地处理 · 不收集任何数据

[![在线访问](https://img.shields.io/badge/在线访问-打开网站-9E6C47?style=flat-square\&logo=googlechrome\&logoColor=white)](https://grilled-tiger-fish-lw.github.io/genshin-guide/)
[![最后更新](https://img.shields.io/github/last-commit/grilled-tiger-fish-lw/genshin-guide?style=flat-square\&label=最后更新\&color=9E6C47\&logo=github\&logoColor=white)](https://github.com/grilled-tiger-fish-lw/genshin-guide/commits)
[![Tech Stack](https://img.shields.io/badge/Tech-Vanilla%20JS%20%7C%20HTML5-F4F1EA?style=flat-square)]()

[工具列表](#tools) · [仓库结构](#structure) · [本地运行](#local) · [设计系统](#design) · [开发约定](#rules) · [更新记录](./CHANGELOG.md)

</div>

---

> [!NOTE]
> **2026 视觉重构已完成**：全站控件统一由 `shared/css/` 的设计系统驱动，各工具只负责布局。
> 移除了会破坏 `position: fixed` 定位的 `backdrop-filter`，改用 `color-mix()` 半透明 + 细描边实现玻璃质感；
> 原生滚动条 / 滑块 / 下拉 / 弹窗全部深度重写，尺寸与间距全部走统一刻度。

<a id="tools" name="tools"></a>
## 🛠️ 工具列表

主页为 Bento 网格布局，点击卡片进入工具。工具页面在 `iframe` 中运行（懒加载，切换不重新加载）。

| 工具 | 入口 | 说明 | 状态 |
|---|---|---|---|
| **角色一图流** | [`#character`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#character) | 武器 / 圣遗物 / 天赋 / 命座 / 配队总览 | ✅ 已重构 |
| **图标字典编辑器** | [`#map-editor`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#map-editor) | 维护 `icon-dict.js`，查缺补漏 | ✅ 已重构 |
| **封面制作** | [`#video-cover`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#video-cover) | 视频封面 / 合集封面排版生成 | ✅ 已重构 |
| **图片处理** | — | 背景修改 / 双图羽化 / 图层拼接等 | 🟡 可用，待拆分重构 |
| **图表** | — | 雷达图 / 柱状图 | 🟡 可用，待拆分重构 |
| **角色梯队** | — | S / A / B 三档排行榜 | 🟡 可用，待拆分重构 |

---

<a id="structure" name="structure"></a>
## 📁 仓库结构

```text
genshin-guide/
├── index.html                主页（Bento 网格，iframe 载入工具）
├── favicon.ico
├── README.md
├── CHANGELOG.md
│
├── tools/                    所有工具页
│   ├── character/            角色一图流（consts / svg / app 三层）
│   ├── map-editor/           图标字典编辑器
│   └── video-cover/          封面制作
│       ├── video/            视频封面
│       └── collection/       合集封面
│
└── shared/                   共享资源
    ├── css/                  ★ 设计系统：令牌 + 各组件 + 下拉引擎 + 主题初始化
    ├── gi-icons/             游戏图标系统：加载器 + 图标字典
    ├── data/                 纯文本数据字典
    ├── fonts/                字体库
    ├── assets/               本地素材
    └── saves/                在线存档
```

> `tools/` 下另有 `image-tools.html` / `chart.html` / `tier.html` 三个单文件工具（功能可用，待拆分重构）。
> `shared/` 根下另有 `ui-icons.js`（共享图标库，Fluent UI System Icons）。

---

<a id="local" name="local"></a>
## 🚀 本地运行

纯静态项目，**没有构建步骤**。建议起一个本地服务器（直接用 `file://` 打开会因 CORS 拿不到 `fetch` 的数据文件）。

```bash
git clone https://github.com/grilled-tiger-fish-lw/genshin-guide.git
cd genshin-guide
python -m http.server 8080
```

打开 `http://localhost:8080` 即可预览。

---

<details>
<summary><b>🎨 角色一图流 (点击展开详情)</b></summary>

<br>

- **核心功能**：编辑角色信息、一键匹配图片、导出 4K PNG / JSON、载入在线存档。
- **校验**：角色名必须在 `characters.txt` 中。
- **导出优化**：导出 JSON 自动剥离字典匹配的图片与字体数据，体积从十几 MB 降到几十 KB；导入时按名字自动重新匹配。
- **底层架构**：拆分为 `consts.js`（数据）/ `svg.js`（绘制）/ `app.js`（逻辑）三层。
- **预览**：吸顶固定在顶部，只有编辑区内部滚动。

</details>

<details>
<summary><b>🎨 图标字典编辑器 (点击展开详情)</b></summary>

<br>

- **核心功能**：从 Amber 一键同步数据，维护图标映射字典。
- **粘贴 URL**：给某个 key 指定来源，系统自动判断是否走拼接规则。
- **导出**：一键生成 `icon-dict.js`。
- **UI 细节**：缩略图的星空径向渐变由 CSS 变量注入，**算法与 `icon-loader.js` 的 `applyBackground` 完全一致**，因此与其它工具里已烘焙的图标颜色对得上。
- **星级**：使用共享下拉组件，面板宽度与按钮同宽。

</details>

<details>
<summary><b>🎨 封面制作 (点击展开详情)</b></summary>

<br>

- **视频封面**：支持角色攻略 / Boss 攻略 / 自定义模式。自动匹配立绘、名片、编号、怪物图标。
- **合集封面**：2K 分辨率，背景用 Canvas 预生成高斯模糊，并做边缘像素拉伸防止漏底。
- **性能**：模糊层带缓存（半分辨率渲染 + JPEG），打字时不重算背景。
- **交互**：点击预览图切换工具栏显隐；支持导出 / 导入配置。

</details>

---

<a id="design" name="design"></a>
## 🎨 设计系统

所有视觉规则集中在 `shared/css/theme.css`，各工具的自带 `style.css` **只做布局**。

> [!TIP]
> **改一处，全站同步。** 比如把 `--h-ctl` 从 32px 改成 36px，全站按钮、输入框、下拉、列表行会一起变。

### 尺寸 / 间距刻度

| 类别 | 令牌 | 值 |
|---|---|---|
| 控件高度 | `--h-ctl` | 32px |
| 控件内边距 | `--pad-ctl` | 8px |
| 圆角 | `--r-ctl` / `--r-panel` / `--r-pill` | 4.8 / 12 / 999 |
| 间距 | `--gap-xs` / `--gap-sm` / `--gap` / `--gap-lg` | 2 / 4 / 8 / 16 |
| 字号 | `--fs-xs` / `--fs-sm` / `--fs-md` / `--fs-lg` | 10 / 12 / 14 / 16 |
| 图标 | `--icon-sm` / `--icon` / `--icon-lg` | 14 / 18 / 24 |
| 动效 | `--dur` / `--ease` | 0.3s / `cubic-bezier(.16,1,.3,1)` |
| 浮层 | `--glass` / `--shadow-pop` / `--mask` | 半透明底 / 弹层阴影 / 遮罩 |
| 底部留白 | `--dock-space` | 88px（给固定导出胶囊让位） |

### 层级表（禁止再写魔法数字）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--z-toolbar` | 15 | 预览区浮动工具栏 |
| `--z-sticky` | 30 | 吸顶条 |
| `--z-nav` | 40 | 导航栏 |
| `--z-dock` | 45 | 导出胶囊 |
| `--z-dropdown` | 50 | 下拉面板 |
| `--z-status` | 60 | 状态胶囊 |
| `--z-drawer-backdrop` / `--z-drawer` | 90 / 100 | 侧边抽屉 |
| `--z-modal` | 200 | 弹窗 |
| `--z-toast` | 300 | 提示条 |

### 状态类名

| 类名 | 用途 |
|---|---|
| `.is-active` | 选中态（Tab / 列表项 / 分段控件） |
| `.is-open` | 展开态（下拉 / 抽屉 / 子菜单） |
| `.is-visible` | 显示态（Toast / 弹窗 / 搜索清除按钮） |
| `.hidden` | 硬隐藏（`display: none !important`） |

### 排版原则

- **严禁 `margin`**：用 flex 的 `gap` 或 `padding`。所有 `.css` 里搜 `margin` 应当搜不到（UA 伪元素除外）。
- **间距网兜**：`.stack`（纵向 8）/ `.stack-lg`（纵向 16）/ `.row`（横向 8）/ `.row-pad`（面板内边距）。
- **居中**：父级是 flex 时用 `align-self: center`，不要用 `margin: 0 auto`。
- **禁止 `backdrop-filter`**：它会让该元素成为后代的「固定定位包含块」，破坏下拉/弹层的定位，并在 Android 上造成滚动掉帧。玻璃质感用 `color-mix()` + 描边实现。

### 主题机制

- 首选主题存在 `localStorage['gi-theme']`，没有则跟随系统 `prefers-color-scheme`。
- `theme-init.js` 在 `<head>` 中**同步阻塞加载**（不能加 `defer`），保证首帧前就定好主题，不闪白。
- 切换时给 `<html>` 加 `.theme-switching` 禁用过渡，改完再移除，避免逐元素缓动。
- `body` 未加 `.ready` 前，侧边栏等易闪元素用 `display: none` 挡住。

---

<a id="rules" name="rules"></a>
## 🧩 开发约定

### 五条铁律

1. **不留冗余、不用原生** —— 删除错误与无用代码；不使用浏览器原生的按钮 / 下拉 / 滚动条 / 弹窗 / 滑块。
2. **语法现代** —— 不用 `var`，一律 `const` / `let`；不用 `.then()` 链，一律 `async/await`；元素级样式用 `:where()` 降低特异性，让组件类永远能覆盖。
3. **提交前自查** —— 有没有遗漏、有没有失效引用（`id` / 图标键 / CSS 变量）。
4. **优先复用** —— 组件优先用 `shared/css/*` 与 `ui-icons.js`；确实没有，再参考已有工具的实现。
5. **动态加载** —— 所有外链 CSS / JS 都带 `?t=Date.now()` 时间戳，杜绝静态引用被缓存。

### 具体规范

| 项目 | 规定 |
|---|---|
| 内联样式 | 禁止在 HTML 与 `innerHTML` 里写 `style="..."`；**唯一例外**是用 `el.style.setProperty('--x', v)` 注入 CSS 变量 |
| 弹窗 / 提示 | 禁止 `alert()` / `confirm()`，统一用 `overlays.css` 的 Toast 与 Modal（状态类 `.is-visible`） |
| 显隐 | 硬隐藏用 `.hidden`；组件显隐用 `.is-*`；不要用 JS 直接改 `display` |
| 颜色 / 尺寸 / 层级 | 一律引用令牌，不写死十六进制色值、px 尺寸、`z-index` 数字 |
| 选择器 | 避免依赖 `:has()` 等兼容性不稳的特性；跨浏览器差异大的地方优先用相邻兄弟选择器 |
| 加载骨架 | 每个入口页统一：`<head>` 首次同步引 `theme-init.js` → boot 脚本并行加载 `theme.css` + `ui-icons.js` + `dropdown.js` → 加载完成后给 `body` 加 `.ready` |
| 错误兜底 | `__bootPromise` 必须有 `.catch()`，初始化必须有 `try/catch`，失败时在加载遮罩上显示原因，**不能白屏** |

---

<a id="notes" name="notes"></a>
## 📌 备注与致谢

- **中文名查询**：[Project Amber](https://gi.yatta.moe)
- **本地数据**：所有编辑数据存在浏览器本地（IndexedDB / `localStorage`），字体也缓存一份
- **UI 图标**：[Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons)
- **元素 / 圣遗物图标**：[iconfont · 原神图标库](https://www.iconfont.cn/collections/detail?cid=34264)（作者：SwordMasterJS）
- **favicon**：AI 生成（豆包），工具箱 + 游戏手柄图标

---

<div align="center">
  <p>个人自用，随意参考。</p>
</div>

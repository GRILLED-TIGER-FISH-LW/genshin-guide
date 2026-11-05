<div align="center">

# 原神攻略工具集

> 个人自用的原神攻略图制作工具集 · 纯前端 · 本地处理 · 不收集任何数据

[![在线访问](https://img.shields.io/badge/在线访问-打开网站-9E6C47?style=flat-square&logo=googlechrome&logoColor=white)](https://grilled-tiger-fish-lw.github.io/genshin-guide/)
[![最后更新](https://img.shields.io/github/last-commit/grilled-tiger-fish-lw/genshin-guide?style=flat-square&label=最后更新&color=9E6C47&logo=github&logoColor=white)](https://github.com/grilled-tiger-fish-lw/genshin-guide/commits)
[![Tech Stack](https://img.shields.io/badge/Tech-Vite%20%7C%20Vue%203%20%7C%20Tailwind%204-F4F1EA?style=flat-square)]()

[工具列表](#tools) · [仓库结构](#structure) · [技术要点](#tech) · [更新记录](./CHANGELOG.md)

</div>

---

> [!NOTE]
> **动手改代码之前，先看 [AGENTS.md](./AGENTS.md)。**
> 两仓库（本仓库 + [adventurer-handbook](https://github.com/grilled-tiger-fish-lw/adventurer-handbook)）共用的约定、共享层清单、协作规则都在那里；本仓库的里程碑与坑位在 [CHANGELOG](./CHANGELOG.md)。

<a id="tools" name="tools"></a>
## 🛠️ 工具列表

主页为 Bento 网格布局，点击卡片进入工具。**已搬进 SPA 的工具是真正的 Vue 组件；还没搬的由 `FrameLayer` 用 iframe 常驻托管**（`v-show` 隐藏、不销毁，切换工具不重新加载）。

| 工具 | 入口 | 说明 | 状态 |
|---|---|---|---|
| **角色一图流** | [`#character`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#character) | 武器 / 圣遗物 / 天赋 / 命座 / 配队总览 | 🟡 仍是 iframe |
| **图标字典编辑器** | [`#icon-editor`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#icon-editor) | 维护 `icon-dict.js`，查缺补漏 | ✅ 已搬进 SPA |
| **封面制作 · 视频封面** | [`#video-cover/video`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#video-cover/video) | 角色 / Boss / 自定义三种模式的封面排版 | ✅ 已搬进 SPA |
| **封面制作 · 合集封面** | [`#video-cover/collection`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#video-cover/collection) | 合集封面排版生成 | ✅ 已搬进 SPA |
| **图片处理** | — | 背景修改 / 双图羽化 / 图层拼接等 | 🟡 仍是 iframe |
| **图表** | — | 雷达图 / 柱状图 | 🟡 仍是 iframe |
| **角色梯队** | — | S / A / B 三档排行榜 | 🟡 仍是 iframe |

> 老书签照旧可用：`index.html` 会把旧 hash 归一成新路由（`#character` → `#/character`）。

---

<a id="structure" name="structure"></a>
## 📁 仓库结构

    genshin-guide/
    ├── index.html                Vite 入口：主题预置 + 加载守卫 + 旧 hash 归一
    ├── favicon.ico
    ├── package.json  vite.config.js
    ├── README.md  CHANGELOG.md  AGENTS.md
    │
    ├── src/                      SPA
    │   ├── main.js  router.js  App.vue
    │   ├── styles/               tokens.css（令牌唯一真源）· base.css · app.css
    │   ├── components/           通用控件（Btn Field Seg Radios Slider Dropdown Modal Combobox
    │   │                         Icon Tabs PreviewFrame DockCta ToastHost AppNav AppDrawer
    │   │                         FrameLayer SyncReport）
    │   ├── composables/          useTheme useToast useData useIconDict
    │   ├── lib/                  videoCover · collectionCover · fonts（纯绘制 / 导出 / 存档）
    │   └── views/                Home · IconEditor · VideoCover · CollectionCover
    │
    ├── tools/                    还没搬进 SPA 的旧工具页（原样 cp 进 dist，不走打包）
    │   ├── character/            角色一图流（consts / svg / app 三层）
    │   ├── image-tools.html      图片处理        🟡 待搬
    │   ├── chart.html            图表            🟡 待搬
    │   └── tier.html             角色梯队        🟡 待搬
    │
    └── shared/                   共享资源（仓库根，不进打包，靠 build 时 cp）
        ├── css/                  旧工具仍在用的设计系统（新 SPA 不加载）
        ├── gi-icons/             游戏图标：加载器 + 图标字典
        ├── data/                 纯文本数据字典
        ├── fonts/                字体库 + fonts.json
        ├── assets/               本地素材（立绘 / 名片 / 封面底图 / logo）
        ├── saves/                在线存档
        └── ui-icons.js           共享 UI 图标库（Fluent UI System Icons）

`shared/` 和 `tools/` **故意留在仓库根、不进打包**：构建脚本里手工 `cp` 进 `dist`，这样目录层级、工具页里的相对路径、跨仓库绝对 URL 三者一起保住。

---

## 🎨 各工具说明

<details>
<summary><b>视频封面</b>（已搬进 SPA）</summary>

<br>

- 角色攻略 / Boss 攻略 / 自定义三种模式。角色模式填角色名 → 自动补编号、立绘、名片图；Boss 模式填 Boss 名 → 自动补怪物图标。
- 预览就是页面里那份真正的 `<svg>`，导出时克隆同一份节点、把远程图烘成 data URL 再栅格化 —— 预览与导出永远一致。
- 切换模式有确认框（会清掉背景图 / 立绘 / Boss 头像），避免误操作。
- 配置可导出 / 导入 JSON；草稿存 IndexedDB（`video_cover_db` / `video_state`）。

</details>

<details>
<summary><b>合集封面</b>（已搬进 SPA）</summary>

<br>

- 2K（2560×1440）画布，背景用 Canvas 预生成高斯模糊，并做边缘像素拉伸防止漏底。
- 模糊层只在换背景图 / 改模糊 / 改亮度时重算，结果按「图 + 模糊 + 亮度」缓存。
- 字号随内容自适应（超宽逐级缩字号），整块垂直居中。
- 点预览空白处淡出右上角工具栏；草稿存 IndexedDB（`video_cover_db` / `collection_state`）。

</details>

<details>
<summary><b>图标字典编辑器</b>（已搬进 SPA）</summary>

<br>

- 从 Amber 一键同步数据，维护图标映射字典；硬规则（武器非五位数 / 28 开头怪物 / 官方旅行者图）记入 `skipped` 并清掉本地同 key 条目，软规则只加不删。
- 粘贴 URL 会按 `deriveFields()` 自动补名字、星级、序号；导出 `icon-dict.js` 的格式被两个仓库读取，逐字不能变。
- 缩略图渐变算法与 `icon-loader.js` 的 `applyBackground` 一致，因此和其它工具里已烘焙的图标颜色对得上。

</details>

<details>
<summary><b>其余三个工具</b>（仍是 iframe 旧版）</summary>

<br>

- 角色一图流、图片处理、图表、角色梯队仍是 `tools/` 下的旧版页面，功能正常，但视觉与新系统不一致（已知遗留）。
- 它们与 SPA 之间靠 `FrameLayer` 通信；迁移方式：模板 1:1 搬、纯绘图与导出引擎留在 `src/lib/`、碰 DOM 的那部分换成共享控件。

</details>

---

<a id="tech" name="tech"></a>
## 🎨 技术要点（速查）

> 完整约定与协作规则见 **[AGENTS.md](./AGENTS.md)**；里程碑与坑位见 **[CHANGELOG](./CHANGELOG.md)**。

### 技术栈

Vite + Vue 3 + vue-router(hash) + Tailwind 4。**没有遗留引擎、没有运行时 `window` 全局**（唯一例外见 AGENTS.md），页面里只有 Vue 组件和共享控件。

### 尺寸线（控件三档，别再手写高度）

| 档位 | 高度 | 用在哪 |
|---|---|---|
| `sm` | 36px | 工具栏、列表行、卡片角 |
| `md` | 40px（窄屏）/ 36px（宽屏） | 表单、弹窗 |
| `lg` | 48px | 只有底部悬浮主操作（`DockCta`） |

圆角：控件 8px（`rounded-ctl`）、卡片 12px（`rounded-panel`）；**胶囊只给页签和徽章**，普通按钮永远是 8px 矩形。

### 焦点

全站一种方言：`focus-visible:outline-2 outline-offset-1 outline-accent`。
例外：`Modal` 面板与 `AppDrawer` 抽屉不画环；容器会裁掉 outline 的地方用负 `outline-offset`。

### 禁用项

- **`backdrop-filter` 全站禁用** —— 它会让元素成为后代 fixed 元素的包含块，破坏弹层定位。
- **不用浏览器原生样式**：滚动条、下拉、复选框、滑块全部走共享控件。
- **不改 `tokens.css` 里的值**：它与另一个仓库逐字节相同。

### 加载

所有动态资源（字体、数据字典、图标字典、图片）一律**带时间戳**，路径一律走 `import.meta.env.BASE_URL + 'shared/…'`（相对路径在 SPA 里是按仓库根算的，`../../shared/` 会跑到域名外面）。

---

## 📌 备注与致谢

- **中文名查询**：[Project Amber](https://gi.yatta.moe)
- **本地数据**：所有编辑数据存在浏览器本地（IndexedDB / `localStorage`），字体也缓存一份
- **UI 图标**：[Fluent UI System Icons](https://yesicon.app/zh-Hans/fluent)
- **元素 / 圣遗物图标**：[iconfont · 原神图标库](https://www.iconfont.cn/collections/detail?cid=34264)（作者：SwordMasterJS）
- **favicon**：AI 生成（豆包），工具箱 + 游戏手柄图标

---

<div align="center">
  <p>个人自用，随意参考。</p>
</div>

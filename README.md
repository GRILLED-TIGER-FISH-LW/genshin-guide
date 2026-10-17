<div align="center">

# 原神攻略工具集

> 个人自用的原神攻略图制作工具集 · 纯前端 · 本地处理 · 不收集任何数据

[![在线访问](https://img.shields.io/badge/在线访问-打开网站-4C8BF5?style=flat-square&logo=googlechrome&logoColor=white)](https://grilled-tiger-fish-lw.github.io/genshin-guide/)
[![最后更新](https://img.shields.io/github/last-commit/grilled-tiger-fish-lw/genshin-guide?style=flat-square&label=最后更新&color=4C8BF5&logo=github&logoColor=white)](https://github.com/grilled-tiger-fish-lw/genshin-guide/commits)

[工具列表](#tools) · [仓库结构](#structure) · [本地运行](#local) · [角色一图流](#character-tool) · [封面制作](#cover-tool) · [主题系统](#theme) · [更新记录](./CHANGELOG.md)

</div>

---

<a id="tools" name="tools"></a>
## 🛠️ 工具列表

> 主页是单页应用，顶部为 Bento 网格首页，点击卡片进入工具。左侧抽屉切换工具，工具页面在 `iframe` 中运行（懒加载）。

| 工具 | 入口 | 说明 | 状态 |
|---|---|---|---|
| 角色一图流 | [`#character`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#character) | 武器 / 圣遗物 / 天赋 / 命座 / 配队总览 | ✅ |
| 图标字典编辑器 | [`#map-editor`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#map-editor) | 维护 `icon-dict.js` | ✅ |
| 封面制作 | [`#video-cover`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#video-cover) | 视频封面 / 合集封面 | ✅ |
| 图片处理 | — | 背景修改 / 双图羽化 / 对位裁切 / 图层拼接 / 武器图标 / 武器卡片 / 成就制作 | 🚧 |
| 图表 | — | 雷达图 / 柱状图 | 🚧 |
| 角色梯队 | — | S / A / B 三档排行榜 | 🚧 |

> ✅ 已上线 · 🚧 开发中

---

<a id="structure" name="structure"></a>
## 📁 仓库结构

```
genshin-guide/
├── index.html            主页（单页应用，iframe 载入工具）
├── README.md
├── CHANGELOG.md
├── favicon.png
│
├── tools/                所有工具页
│   ├── character/        角色一图流（已拆：consts.js + svg.js + app.js）
│   ├── map-editor/       图标字典编辑器（已拆）
│   ├── video-cover/      封面制作（已拆）
│   │   ├── video/        视频封面
│   │   └── collection/   合集封面
│   ├── image-tools.html  图片处理（待拆）
│   ├── chart.html        图表（待拆）
│   └── tier.html         角色梯队（待拆）
│
└── shared/               共享资源
    ├── theme.css         共享主题变量 + 通用控件
    ├── ui-icons.js       共享 UI 图标库
    ├── gi-icons/         游戏图标系统
    ├── data/             纯文本数据
    ├── fonts/            字体库
    ├── assets/           本地素材
    └── saves/            在线存档
```

---

<a id="local" name="local"></a>
## 🚀 本地运行

纯静态项目，不需要构建，任意静态服务器即可。

```bash
git clone https://github.com/grilled-tiger-fish-lw/genshin-guide.git
cd genshin-guide
python -m http.server 8080
```

然后打开 `http://localhost:8080`。

> [!TIP]
> 直接用 `file://` 打开会有跨域和字体加载问题，建议起一个本地服务器。

---

<a id="character-tool" name="character-tool"></a>
## 🎨 角色一图流

**入口：** `https://grilled-tiger-fish-lw.github.io/genshin-guide/#character`

- 编辑角色信息（名称 / 版本 / 日期 / 作者）
- 一键匹配样式图（立绘 / 元素图 / 名片图）—— **三路并发下载**
- 武器、圣遗物、天赋、词条、面板、命座、配队编辑
- 图标按名字自动匹配（武器 / 圣遗物 / 角色头像 / 备选角色）
- 导出 4K PNG / JSON 配置
- 载入在线存档

<details>
<summary><b>编辑界面 / 校验 / 导出细节</b></summary>

<br>

- **编辑界面**：预览区在上，横向胶囊 Tab 切换编辑区。点预览图可隐藏浮动按钮。
- **角色名校验**：角色名必须在 `characters.txt` 里。否则立绘 / 名片 / 头像跳过，元素图照常显示（只跟主题色走）。
- **导出 JSON**：自动剥离字典匹配来的图片（只保留手动上传的）+ 字体数据，体积从十几 MB 降到几十 KB。导入时按名字自动重匹配，字体按名字重新加载。
- **字体缓存**：字体首次下载后存进 IndexedDB，之后不管刷新还是重启浏览器，0 秒加载。
- **导出 PNG**：导出前把所有图片字段洗成 `dataURL`，绕过跨域限制和相对路径解析问题。

</details>

<details>
<summary><b>文件结构（已拆三份）</b></summary>

<br>

```
tools/character/
├── index.html    页面结构
├── style.css     本工具特有布局
├── consts.js     常量 / LAYOUT / State / 工具函数
├── svg.js        SVG 绘制 / 排版 / buildSVG
└── app.js        编辑器 / 匹配 / 导出 / 导入
```

</details>

---

<a id="map-editor-tool" name="map-editor-tool"></a>
## 🎨 图标字典编辑器

**入口：** `https://grilled-tiger-fish-lw.github.io/genshin-guide/#map-editor`

维护 `shared/gi-icons/icon-dict.js` 的可视化工具。

- **从 Amber 同步**：一键拉取角色 / 圣遗物 / 武器 / 怪物 4 类数据
- **粘贴 URL**：给某个 key 指定源
  - URL 严格等于 `prefix + key + ext` → 不加 `url` 字段（走拼接）
  - 否则 → 存完整 `url`
  - 找到同名 key 就更新，找不到才新建（新建条目 `order: 0`）
- 手动调整序号 / 星级
- 一键导出 `icon-dict.js`

<details>
<summary><b>同步规则 / key 格式 / 条目字段</b></summary>

<br>

- **同步规则**：`local` 或 `url` 的条目，名字冲突时跳过 Amber。
- **字典 key 格式**：图标全名（如 `UI_AvatarIcon_HuTao`）。

| 字段 | 说明 |
|---|---|
| `name` | 中文名 |
| `star` | 星级（怪物没有） |
| `order` | 序号 |
| `local` | 可选。本地文件，从仓库根目录加载 |
| `url` | 可选。覆盖默认拼接规则，指向指定链接 |

</details>

---

<a id="cover-tool" name="cover-tool"></a>
## 🎨 封面制作

**入口：** `https://grilled-tiger-fish-lw.github.io/genshin-guide/#video-cover`

### 视频封面

| 模式 | 主标题 | 胶囊标签 | 副标题第一行 | 副标题第二行 |
|---|---|---|---|---|
| **角色攻略** | 固定 `角色培养\n攻略图鉴` | 固定 `攻略` | 固定 `No.xxx`（自动编号，小字号） | 角色名（大字号，可编辑） |
| **Boss攻略** | 固定 `世界Boss\n&地方传奇` | 固定 `攻略` | BOSS 名（大字号，可编辑） | 任意文本（小字号，可编辑） |
| **自定义** | 可编辑 | 可编辑 | 可编辑 + 字号选择 | 可编辑 + 字号选择 |

<details>
<summary><b>匹配逻辑 / 其他功能</b></summary>

<br>

- **角色攻略**匹配（走「名字（元素）」→「名字」回退）：
  - 编号 ← `characters.txt`
  - 立绘 ← `character-art.txt`
  - 名片图 ← `namecards.txt`
- **Boss 攻略**头像 ← `icon-dict.js` 的 monsters 字典（走 `ICON_LIB.fromName`）。
- **其他**：游戏 Logo 选择 / 画布背景上传 + 亮度、模糊调整 / 参考线 / 导出导入配置 / 清空 / 导出 4K PNG。

</details>

### 合集封面

- 输出分辨率固定 2K（2560 × 1440）
- 背景图上传（自动模糊）
- 主副标题文字
- 字体选择
- 导出 PNG（≤ 5MB）

---

<a id="assets" name="assets"></a>
## 🖼️ 素材来源

| 素材 | 来源 |
|---|---|
| 立绘 | `shared/data/character-art.txt` 字典（官方外链为主，个别本地文件放 `shared/assets/portrait/`） |
| 元素图 | `shared/assets/characters/element/` |
| 名片图 | `shared/data/namecards.txt` 字典（Lunaris 外链） |
| 角色头像 / 武器 / 圣遗物 / 怪物图标 | `shared/gi-icons/icon-dict.js`（Lunaris 外链，个别条目用 `url` 覆盖） |

**图标源优先级**（`icon-loader.js` 的 `getPath`）：

1. `local: true`（仓库本地文件）
2. `url: "..."`（单条覆盖）
3. key 是完整 URL
4. 拼接 `config.prefix + key + config.ext`

---

<a id="saves" name="saves"></a>
## 💾 在线存档

存档路径：`shared/saves/characters/`
命名格式：`编号.角色名.json`（编号补零三位，如 `001.旅行者.json`）

- **导出**：角色卡右上角浮动工具栏「导出」
- **上传**：手动上传到 `shared/saves/characters/`
- **载入**：外观样式 Tab →「载入在线存档」

---

<a id="theme" name="theme"></a>
## 🎨 主题 / 控件系统

所有样式统一由 `shared/theme.css` 管理，分为 22 个模块。全站采用 2026 现代扁平化设计（焦糖色 / 莫兰迪色系）。

- **变量**：燕麦米色（日间） / 深咖灰（夜间），严格限制整数像素尺寸。
- **通用控件**：按钮 / 输入框 / 下拉 / 滑块 / 容器 / 缩略图 / 浮动工具栏 / 毛玻璃 Dock / 玻璃拟态弹窗等。
- **去原生化**：所有浏览器原生的 `<input type="range">`、复选框、滚动条均已被深度重写，彻底告别丑陋的默认样式。
- **无边框设计**：去除死板边框，层级由透明度和背景色阶差决定。

> **改一处样式，所有工具同步生效。** 各工具的 `style.css` 只保留排版与布局。

---

<a id="dev" name="dev"></a>
## 🧩 开发约定

- 每个工具拆成 `index.html` + `style.css` + 若干 JS，避免单文件过大。
- 通用样式全部走 `shared/theme.css`，工具自带 `style.css` 只写布局。
- **绝对禁止内联样式**：禁止在 HTML 标签和 JS 的 `innerHTML` 中写 `style="..."`，一律使用类名或 CSS 变量（如星空渐变）。
- **绝对禁止原生弹窗**：禁止使用 `alert()` / `confirm()`，统一使用 `shared/theme.css` 提供的 Toast 与自定义 Modal。
- 交互显隐一律通过添加或移除 `.hidden` 类来控制，禁止直接用 JS 修改 `display`。
- 数据文件全部纯文本，方便手改和 diff。

---

<a id="notes" name="notes"></a>
## 📌 备注

- 中文名查询：[Project Amber](https://gi.yatta.moe)
- 所有编辑数据存在浏览器本地（IndexedDB），字体也缓存一份
- **UI 图标**：[Phosphor Icons](https://yesicon.app/zh-Hans/ph)
- **元素 / 圣遗物图标**：[iconfont · 原神图标库](https://www.iconfont.cn/collections/detail?cid=34264)（作者 SwordMasterJS）
- **favicon**：AI 生成（豆包），工具箱 + 游戏手柄

---

<div align="center">

*个人自用，随意参考。*

</div>

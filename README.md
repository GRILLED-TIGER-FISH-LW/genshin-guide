<div align="center">

# 原神攻略工具集

> 个人自用的原神攻略图制作工具集 · 纯前端 · 本地处理 · 不收集任何数据

[![在线访问](https://img.shields.io/badge/在线访问-打开网站-9E6C47?style=flat-square\&logo=googlechrome\&logoColor=white)](https://grilled-tiger-fish-lw.github.io/genshin-guide/)
[![最后更新](https://img.shields.io/github/last-commit/grilled-tiger-fish-lw/genshin-guide?style=flat-square\&label=最后更新\&color=9E6C47\&logo=github\&logoColor=white)](https://github.com/grilled-tiger-fish-lw/genshin-guide/commits)
[![Tech Stack](https://img.shields.io/badge/Tech-Vanilla%20JS%20%7C%20HTML5-F4F1EA?style=flat-square)]()

[工具列表](#tools) · [仓库结构](#structure) · [技术要点](#tech) · [更新记录](./CHANGELOG.md)

</div>

---

> [!NOTE]
> 全站控件统一由 `shared/css/` 的设计系统驱动，各工具只负责自己的布局。
> **动手改代码之前，先看 [CHANGELOG](./CHANGELOG.md) 里的「技术约定」** —— 当前有效的令牌、类名、加载骨架、布局规则都记在那里。

<a id="tools" name="tools"></a>
## 🛠️ 工具列表

主页为 Bento 网格布局，点击卡片进入工具。工具页在 `iframe` 中运行（懒加载，切换不重新加载）。

| 工具 | 入口 | 说明 | 状态 |
|---|---|---|---|
| **角色一图流** | [`#character`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#character) | 武器 / 圣遗物 / 天赋 / 命座 / 配队总览 | ✅ 已重构 |
| **图标字典编辑器** | [`#map-editor`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#map-editor) | 维护 `icon-dict.js`，查缺补漏 | ✅ 已重构 |
| **封面制作** | [`#video-cover`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#video-cover) | 视频封面 / 合集封面排版生成 | ✅ 已重构 |
| **图片处理** | — | 背景修改 / 双图羽化 / 图层拼接等 | 🟡 可用，待拆分重构 |
| **图表** | — | 雷达图 / 柱状图 | 🟡 可用，待拆分重构 |
| **角色梯队** | — | S / A / B 三档排行榜 | 🟡 可用，待拆分重构 |

> 🟡 三个工具目前仍是旧版单文件（`.html` 内联全部样式与逻辑，未接入设计系统）。功能正常，但视觉与其它工具不一致，属于已知遗留。

---

<a id="structure" name="structure"></a>
## 📁 仓库结构

```text
genshin-guide/
├── index.html                主页（Bento 网格，iframe 载入工具）
├── favicon.ico
├── README.md
├── CHANGELOG.md              ★ 技术约定 + 更新日志
│
├── tools/                    所有工具页
│   ├── character/            角色一图流（consts / svg / app 三层）
│   ├── map-editor/           图标字典编辑器
│   ├── video-cover/          封面制作
│   │   ├── video/            视频封面
│   │   └── collection/       合集封面
│   │
│   ├── image-tools.html      图片处理        🟡 待拆分
│   ├── chart.html            图表            🟡 待拆分
│   └── tier.html             角色梯队        🟡 待拆分
│
└── shared/                   共享资源
    ├── css/                  ★ 设计系统：令牌 + 各组件 + 下拉引擎 + 主题初始化
    ├── gi-icons/             游戏图标系统：加载器 + 图标字典
    ├── data/                 纯文本数据字典
    ├── fonts/                字体库
    ├── assets/               本地素材
    ├── saves/                在线存档
    └── ui-icons.js           共享 UI 图标库（Fluent UI System Icons）
```

---

## 🎨 各工具说明

<details>
<summary><b>角色一图流</b></summary>

<br>

- **核心功能**：编辑角色信息、一键匹配图片、导出 4K PNG / JSON、载入在线存档。
- **校验**：角色名必须在 `characters.txt` 中。
- **导出优化**：导出 JSON 自动剥离字典匹配的图片与字体数据，体积从十几 MB 降到几十 KB；导入时按名字自动重新匹配。
- **底层架构**：拆分为 `consts.js`（数据）/ `svg.js`（绘制）/ `app.js`（逻辑）三层。
- **布局**：预览吸顶固定，只有编辑区内部滚动。

</details>

<details>
<summary><b>图标字典编辑器</b></summary>

<br>

- **核心功能**：从 Amber 一键同步数据，维护图标映射字典。
- **粘贴 URL**：给某个 key 指定来源，系统自动判断是否走拼接规则。
- **导出**：一键生成 `icon-dict.js`；有未导出的改动时按钮变红提醒。
- **缩略图渐变**：算法与 `icon-loader.js` 的 `applyBackground` 完全一致，因此和其它工具里已烘焙的图标颜色对得上。
- **星级**：使用共享下拉组件，面板宽度与按钮同宽。

</details>

<details>
<summary><b>封面制作</b></summary>

<br>

- **视频封面**：角色攻略 / Boss 攻略 / 自定义三种模式。自动匹配立绘、名片、编号、怪物图标。切换模式有确认框，避免误清空。
- **合集封面**：2K 分辨率，背景用 Canvas 预生成高斯模糊，并做边缘像素拉伸防止漏底。
- **性能**：模糊层半分辨率渲染 + JPEG + 缓存，拖动滑块不重算背景。
- **交互**：点击预览空白处切换工具栏显隐；支持导出 / 导入配置。

</details>

---

<a id="tech" name="tech"></a>
## 🎨 技术要点（速查）

> 完整约定（五条铁律、排版原则、主题机制、加载骨架、错误兜底）见 **[CHANGELOG](./CHANGELOG.md)**。

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
| 浮层 | `--glass` / `--shadow-pop` | 半透明底 / 弹层阴影 |
| 底部留白 | `--dock-space` | 88px（给固定导出胶囊让位） |

### 层级（禁止再写魔法数字）

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
| `.is-active` | 选中态 |
| `.is-open` | 展开态 |
| `.is-visible` | 显示态 |
| `.hidden` | 硬隐藏 |

---

## 📌 备注与致谢

- **中文名查询**：[Project Amber](https://gi.yatta.moe)
- **本地数据**：所有编辑数据存在浏览器本地（IndexedDB / `localStorage`），字体也缓存一份
- **UI 图标**：[Fluent UI System Icons](https://yesicon.app/zh-Hans/fluent))
- **元素 / 圣遗物图标**：[iconfont · 原神图标库](https://www.iconfont.cn/collections/detail?cid=34264)（作者：SwordMasterJS）
- **favicon**：AI 生成（豆包），工具箱 + 游戏手柄图标

---

<div align="center">
  <p>个人自用，随意参考。</p>
</div>

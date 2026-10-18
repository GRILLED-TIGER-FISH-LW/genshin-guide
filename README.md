<div align="center">

# 原神攻略工具集

> 个人自用的原神攻略图制作工具集 · 纯前端 · 本地处理 · 不收集任何数据

[![在线访问](https://img.shields.io/badge/在线访问-打开网站-5A76FC?style=flat-square\&logo=googlechrome\&logoColor=white)](https://grilled-tiger-fish-lw.github.io/genshin-guide/)
[![最后更新](https://img.shields.io/github/last-commit/grilled-tiger-fish-lw/genshin-guide?style=flat-square\&label=最后更新\&color=5A76FC\&logo=github\&logoColor=white)](https://github.com/grilled-tiger-fish-lw/genshin-guide/commits)
[![Tech Stack](https://img.shields.io/badge/Tech-Vanilla%20JS%20%7C%20HTML5-F4F1EA?style=flat-square)]()

[工具列表](#tools) · [仓库结构](#structure) · [本地运行](#local) · [角色一图流](#character-tool) · [主题系统](#theme) · [更新记录](./CHANGELOG.md)

</div>

---

> [!NOTE]
> **2026 视觉重构已完成**：全站现已采用现代扁平化设计，彻底去除冗余内联样式与原生浏览器控件，统一使用半透明毛玻璃、极简边框与焦糖色系。视觉体验已全面对齐 2026 主流 Web 工具。

## 🛠️ 工具列表

主页为 Bento 网格布局，点击卡片进入工具。工具页面在 `iframe` 中运行（懒加载）。

| 工具 | 入口 | 说明 | 状态 |
|---|---|---|---|
| **角色一图流** | [`#character`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#character) | 武器 / 圣遗物 / 天赋 / 命座 / 配队总览 | ✅ |
| **图标字典编辑器** | [`#map-editor`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#map-editor) | 维护 `icon-dict.js`，查缺补漏 | ✅ |
| **封面制作** | [`#video-cover`](https://grilled-tiger-fish-lw.github.io/genshin-guide/#video-cover) | 视频封面 / 合集封面排版生成 | ✅ |
| **图片处理** | — | 背景修改 / 双图羽化 / 图层拼接等 | 🚧 |
| **图表** | — | 雷达图 / 柱状图 | 🚧 |
| **角色梯队** | — | S / A / B 三档排行榜 | 🚧 |

---

## 📁 仓库结构

```text
genshin-guide/
├── index.html            主页（Bento 网格，iframe 载入工具）
├── README.md
├── CHANGELOG.md
│
├── tools/                所有工具页
│   ├── character/        角色一图流 (consts.js + svg.js + app.js)
│   ├── map-editor/       图标字典编辑器
│   ├── video-cover/      封面制作
│   │   ├── video/        视频封面
│   │   └── collection/   合集封面
│   └── ...
│
└── shared/               共享资源
    ├── theme.css         共享主题变量 + 通用控件 (极度核心)
    ├── ui-icons.js       共享 UI 图标库 (Phosphor)
    ├── gi-icons/         游戏图标系统
    ├── data/             纯文本数据字典
    ├── fonts/            字体库
    ├── assets/           本地素材
    └── saves/            在线存档
```

---

## 🚀 本地运行

纯静态项目，不需要构建。建议起一个本地服务器（直接用 `file://` 打开会有 CORS 限制）。

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
- **导出优化**：导出 JSON 自动剥离字典匹配的图片和字体数据，体积从十几 MB 降到几十 KB。导入时按名字自动重新匹配。
- **底层架构**：拆分为 `consts.js`（数据）、`svg.js`（绘制）、`app.js`（逻辑）。

</details>

<details>
<summary><b>🎨 图标字典编辑器 (点击展开详情)</b></summary>

<br>

- **核心功能**：从 Amber 一键同步数据，维护图标映射字典。
- **粘贴 URL**：给某 key 指定源，系统自动判断是否走拼接规则。
- **导出**：一键生成 `icon-dict.js`。
- **UI 细节**：星空渐变由 CSS 变量动态注入。

</details>

<details>
<summary><b>🎨 封面制作 (点击展开详情)</b></summary>

<br>

- **视频封面**：支持角色攻略、Boss 攻略、自定义模式。自动匹配立绘、名片、编号、怪物图标。
- **合集封面**：2K 分辨率，背景自动 Canvas 预生成高斯模糊，边缘像素防漏底。
- **交互**：点击预览图直接替换背景图；支持导出/导入配置。

</details>

---

<a id="theme" name="theme"></a>
## 🎨 主题 / 控件系统

所有样式统一由 `shared/theme.css` 管理。全站采用 2026 现代扁平化设计。

> [!TIP]
> **改一处样式，所有工具同步生效。** 各工具的自带 `style.css` 只保留布局，不再管控件外观。

- **色彩变量**：燕麦米色（日间） / 深咖灰（夜间），焦糖色强调。
- **通用控件**：按钮 / 输入框 / 下拉 / 滑块 / 玻璃拟态容器 / 浮动工具栏 / 毛玻璃 Dock / 自定义 Toast / 自定义弹窗。
- **去原生化**：所有原生的滚动条、滑块、单选框均被深度重写。

---

## 🧩 开发约定

1. **绝对禁止内联样式**：禁止在 HTML 标签和 JS 的 `innerHTML` 中写 `style="..."`。一律使用 `class` 或 CSS 变量（如星空渐变）。
2. **绝对禁止原生弹窗**：禁止使用 `alert()` / `confirm()`，统一使用 `shared/theme.css` 提供的 Toast 与自定义 Modal。
3. **现代语法**：全面废弃 `var`，使用 `const` / `let` 和 `async/await`。精简代码，提交前必须自查冗余与缺失。
4. **显隐控制**：交互显隐通过添加或移除 `.hidden` 类来控制，禁止直接用 JS 修改 `display`。

---

<div align="center">
  <p>个人自用，随意参考。</p>
</div>

# 更新记录

按日期倒序排列（最新在最上）。

> **文件定位**：给 AI 助手「恢复记忆」用。
> 只记**关键里程碑**（让 AI 知道什么已经做完，不要重复做）和**待办**（让 AI 知道可能的下一个方向）。
> 不记流水账。细节看代码本身。

---

## 2026-10-20 · 全局 `.hidden` + 角色一图流合规清理

**里程碑**：
- `shared/theme.css` 模块 4 新增全局显隐类 `.hidden:not(.float-toolbar) { display: none !important; }`。此前全站没有通用显隐类，`theme.css` 只有 `.float-toolbar.hidden`（opacity 专用），所以各工具一直用内联 `style="display:none"`。
- 角色一图流 4 文件合规清理：
  - `index.html`：5 处内联 file input → `class="hidden"`；加载器 `var` → `const`/箭头函数/`async`。
  - `app.js`：6 处内联 file input、2 处 `style.display`、1 处色块内联 → 全部改 `.hidden` / CSS 变量；字体 fetch 补 `?t=` 时间戳。
  - `style.css`：`.swatch-btn` 增加 `--swatch-color` 支持，颜色由 JS 注入 CSS 变量，不再写内联。
- **修复沃雅妮莎 / 旅行者立绘 404**：`app.js` 的 `loadArtDict()` 曾把字典里的 `../../shared/` 硬改写成 `../../../shared/`。一图流在 `tools/character/`（两层深），多退一层 → 相对路径条目全部 404，绝对 URL 条目不受影响。已删除该改写，保留字典原值。

**备忘**：
- `.hidden` 由共享层定义，用 `:not(.float-toolbar)` 避开模块 13 那条需要 opacity 过渡的专用规则。
- `style.setProperty('--accent' / '--swatch-color')` 是设置 CSS 变量，不属于内联排版样式，合规。

**待办**：
- 其他工具（`video-cover`、`map-editor` 等）逐步迁移到 `class="hidden"`。**迁移前必须先搜各自 `style.css` 是否已定义 `.hidden`**：若语义是淡出/其他而非 `display:none`，先改名（如 `.fade-hidden`）或删除，再切换，避免与全局规则打架。

---

## 2026-10-19 · 新增角色埃洛伊

**里程碑**：
- `shared/data/characters.txt` 新增埃洛伊，编号 **38**；原 38~122 整体 +1（米提亚 → 123），37 及以下不动。
- 同步更新 `shared/data/character-art.txt`、`shared/data/namecards.txt`、`icon-dict.js`（编辑器挂源）；在线存档 `shared/saves/characters/` 已手动修正。
- 沃雅妮莎立绘本地文件名随之重命名：`120.沃雅妮莎.webp` → `121.沃雅妮莎.webp`。
- 埃洛伊立绘、名片源暂留空，待补。
- 已验证：`consts.js` / `app.js` / `svg.js` / 视频封面代码**无需改动**（匹配走名字，不走编号）。

**备忘**：
- 编号只是展示用序号，工具实际按**角色名**匹配字典；但插入中间仍会让所有以编号为 key 的存档错位，需手动同步。

---

## 2026-10-18 · 全站现代化重构

**核心里程碑（2026 视觉重构）**：
- **视觉规范大换血**：彻底抛弃旧版 iOS 风格与原生控件。确立“燕麦米色/深咖灰 + 焦糖色”的莫兰迪色系；全站去除死黑边框，改用极细描边与背景色阶差；所有原生滑块、复选框、下拉框、滚动条均被深度重写。
- **外壳与主页**：主页新增 Bento 网格首页；顶栏、侧边栏、底部 Dock 全量改为毛玻璃材质；底部移动端 Dock 升级为悬浮胶囊按钮。
- **角色一图流**：卡片面板改为玻璃态（一级 40% 黑，二级 30% 白，无全局遮罩）；圣遗物图标增加白色描边；`app.js` 彻底消除内联样式与冗余代码，合并重复的图标匹配函数，补齐所有缺失的字体缓存与加载逻辑。
- **图标字典编辑器**：星空渐变背景由 JS 内联迁移至 CSS 变量动态注入；重构 UI 布局，修复替换按钮点击失效与排版挤压问题。
- **视频/合集封面**：原生 `alert`/`confirm` 全面替换为全局 Toast 与自定义 Modal；画布背景、浮动素材统一改为正方形预览图；彻底移除冗余的排版内联样式；合集封面 UI 与视频封面完全对齐。

**约束与规范更改**：
1. **绝对禁止**在 HTML 和 JS 中使用内联排版样式（`style="..."`）。
2. **绝对禁止**使用原生的 `alert()` 和 `confirm()`。
3. **语法必须现代化**，全面废弃 `var`，使用 `const`/`let` 和 `async/await`。杜绝老旧回调。
4. 每次提交代码前**必须自查**，删除冗余废弃代码，确保依赖完整不报错。

---

## 2026-10-13

**里程碑**：
- 已拆工具页加资源加载器：所有 CSS / JS 走时间戳 URL，加载前显示启动遮罩。
- 主页 iframe 的 src 加时间戳。
- 视频封面 / 合集封面：背景模糊机制重写（canvas 预生成，解决边缘透明）。
- 图标字典编辑器：新增搜索框，按中文名 / key 实时筛选。

---

## 2026-10-09

**里程碑**：
- 角色一图流重构：拆 `app.js` → `{consts.js, svg.js, app.js}`；导出 JSON 剥离图片、导入自动重匹配；字体加 IndexedDB 缓存；导出 PNG 前把图片洗成 dataURL。
- 视频封面稳定化：修一批 bug，图层顺序调整。
- 图标字典编辑器支持 `url` 字段；粘贴 URL 语义改为「给 key 挂源」。

---

## 2026-10-08

**里程碑**：
- 拆 `tools/video-cover.html` → `tools/video-cover/{video,collection}/`。
- `shared/theme.css` 从「只有变量」扩展成「变量 + 通用控件」（22 模块）。
- 新增字典：`shared/data/namecards.txt`、`shared/data/character-art.txt`。

---

## 2026-10-07

**里程碑**：
- 新建 `shared/` 目录。
- 拆工具页，主页重写：支持「单工具 + 多子工具」两种形态。
- UI 图标从 Solar 换成 Phosphor。

---

## 📌 命名规范

- **文件夹 / 文件名**：英文小写，多词用短横线。
- **工具拆分结构**：`tools/<name>/{index.html, style.css, app.js}`。
- **多子工具**：`tools/<name>/{subA, subB}/`，各自完整三件套。
- **路径规则**：
  - `tools/<name>/index.html` → `../../shared/xxx`
  - `tools/<name>/<sub>/index.html` → `../../../shared/xxx`

---

## 🗺️ 关键路径速查

| 内容 | 路径 |
|---|---|
| 主页 | `index.html` |
| 共享主题 + 通用控件 | `shared/theme.css` |
| 共享 UI 图标 | `shared/ui-icons.js` |
| 游戏图标 | `shared/gi-icons/` |
| 角色编号 | `shared/data/characters.txt` |
| 名片图字典 | `shared/data/namecards.txt` |
| 立绘字典 | `shared/data/character-art.txt` |
| 字体库 | `shared/fonts/` |
| 在线存档 | `shared/saves/characters/` |

---

## 🤖 给 AI 的备忘

> [!IMPORTANT]
> **记忆恢复**：读完 README 和 CHANGELOG 后，简单确认即可，**等我下指令**。不要主动给方案或改代码。

### 修改流程
1. **先给方案，我确认后再给代码**。
2. 我发齐文件后，你**一次发回一个完整文件**。代码必须完整，用 4 个反引号包裹。
3. 我**只用手机**操作，看不到 Console。如果有改动，请确保语法无误，或者告诉我怎么快速回退。

### 关键坑位备忘
- **导出 PNG 丢图**：导出前把图片洗成 `dataURL`。
- **缓存**：所有工具页都有资源加载器，CSS/JS 走时间戳 URL，不要删。
- **字体**：加载慢，靠 IndexedDB 缓存。
- **界面规范**：所有样式优先用 `theme.css` 里的类，工具自带 `style.css` 只写布局，严禁内联。
- **显隐统一用 `.hidden`**：全局定义在 `theme.css` 模块 4，是 `display:none !important`。**不要再用 `style="display:none"` 或 `el.style.display`**。例外：`.float-toolbar.hidden` 是 opacity 过渡，被 `:not()` 排除，保持原样。
- **迁移其他工具到 `.hidden` 前，先搜它的 `style.css` 有无同名 `.hidden`**，语义不同则先改名，否则会和全局规则打架。
- **角色匹配**：工具实际按**角色名**查字典，编号仅为展示序号。但插入角色会导致后续编号整体位移，以编号为 key 的在线存档需手动同步。
- **立绘看不见**：先查 `state.characterX` 是否被拖偏（持久化在 IndexedDB），别急着怀疑数据。
- **相对路径字典值**：`character-art.txt` 里的 `../../shared/...` 是按**工具页所在层级**写的。`tools/character/` 两层深，原值直接可用，**不要再做 `../` 改写**。

---

## 🚧 待办事项

- `tools/image-tools.html` 拆分及加资源加载器。
- `tools/chart.html` 拆分及加资源加载器。
- `tools/tier.html` 是否拆分待定。
- **其他工具迁移到全局 `.hidden`**（`video-cover`、`map-editor` 等），迁移前先查各自 `style.css` 是否已定义 `.hidden`，冲突则先改名。改动哪个工具就顺手清哪个，不批量。

# 更新记录

按日期倒序排列（最新在最上）。

> **文件定位**：给 AI 助手「恢复记忆」用。
> 只记**关键里程碑**（让 AI 知道什么已经做完，不要重复做）和**待办**（让 AI 知道可能的下一个方向）。
> 不记流水账。细节看代码本身。

---

## 2026-10-23 · 设计系统重构收尾

**里程碑**：
- **共享 CSS 全量重写**：8 个文件 = 1 个令牌入口（`theme.css`）+ 7 个组件层。确立刻度令牌（`--h-ctl` / `--pad-ctl` / `--r-ctl` / `--gap-*` / `--fs-*` / `--icon-*` / `--dur` / `--ease` / `--z-*` / `--dock-space`），全站禁用 `margin` 改走 `gap`/`padding`，状态类名统一 `.is-*`。
- **新增 `shared/css/dropdown.js`**：下拉引擎。fixed 定位绕过祖先裁剪，上下自动翻转、水平内收，内容装得下就不夹高度，可派发 `dropdown:select`。
- **新增 `shared/css/theme-init.js`**：主题持久化（`localStorage['gi-theme']`）+ 首帧防闪白 + 切换期间禁过渡 + `booting` 首屏保护。
- **`ui-icons.js`**：升级为 Fluent UI 七段结构，末尾加兼容块（`ICONS.app.close` 别名 / `window.icons` 别名 / 统一补无障碍属性）。
- **四个工具全部迁移完成**：`character` / `video-cover/video` / `video-cover/collection` / `map-editor`。旧类名（`.ios-*` / `.tab-sheet` / `.btn-sm` / `.bottom-dock` / 原生 `<select>`）全部清零。
- **父页面重构**：主题统一交给 `Theme` 模块，iframe 通过 `storage` 事件 + `postMessage` 双路同步；侧边栏加首屏保护不再闪。

**备忘**：
- 本轮修掉的都是「**看着能用、实际是坏的**」的问题，具体坑位见底部「关键坑位备忘」。
- 静态资源引用约定：外链 CSS/JS 走 `?t=Date.now()`；`theme-init.js` 因必须最早同步执行，用**无参数**引用，改了需要手动清缓存。

**待办**：
- 另一仓库（`index.html` + `style.css` + 4 个工具 + 删 `icons.js`）尚未迁移。

---

## 2026-10-20 · 全局 `.hidden` + 角色卡合规清理

- `theme.css` 新增全局显隐类，各工具开始用 `class="hidden"` 取代内联 `style="display:none"`。
- 角色卡清理 4 个文件：内联 file input、`el.style.display`、色块内联全部改为类 / CSS 变量。
- 修复立绘 404：`loadArtDict()` 曾把字典里的 `../../shared/` 硬改写成 `../../../shared/`，多退一层导致相对路径条目全挂。**已删除改写，字典值直接用。**

---

## 2026-10-19 · 新增角色埃洛伊

- `characters.txt` 新增埃洛伊（编号 38），原 38~122 整体 +1。
- 同步 `character-art.txt` / `namecards.txt` / `icon-dict.js` / 在线存档。
- 立绘、名片源暂空待补。
- **工具代码无需改动**：匹配按角色名，不走编号。

---

## 2026-10-18 · 全站现代化重构

- 视觉换血：燕麦米色 / 深咖灰 + 焦糖色；去掉死黑边框，改极细描边 + 色阶差；原生滑块、复选框、下拉、滚动条全部重写。
- 主页改 Bento 网格；顶栏、侧边栏、底部 Dock 改玻璃材质。
- 游戏内卡片（角色一图流）改玻璃态；圣遗物图标加白描边。
- 视频 / 合集封面：`alert`/`confirm` 换成全局 Toast + Modal。
- **确定四条开发约束**：禁内联排版样式、禁原生弹窗、语法必须现代、提交前自查。

---

## 2026-10-13 · 加载器与背景模糊

- 所有工具页加资源加载器：CSS/JS 走时间戳 URL，加载期间显示启动遮罩。
- 封面工具的背景模糊改为 canvas 预生成，修掉边缘透明漏底。
- 图标字典编辑器新增搜索框。

---

## 2026-10-09 · 角色卡拆分 + 字典扩展

- 角色卡 `app.js` 拆为 `consts.js` / `svg.js` / `app.js` 三层。
- 导出 JSON 剥离图片、导入自动重匹配；字体加 IndexedDB 缓存；导出 PNG 前把图片洗成 dataURL。
- 图标字典支持 `url` 字段。

---

## 2026-10-08 · 目录结构调整

- 拆 `video-cover.html` → `video-cover/{video,collection}/`。
- `theme.css` 从「只有变量」扩展成「变量 + 通用控件」。
- 新增 `namecards.txt` / `character-art.txt` 字典。

---

## 2026-10-07 · 项目起步

- 新建 `shared/`；主页重写，支持「单工具 + 多子工具」两种形态。
- UI 图标定为 Phosphor（**已于 2026-10-23 换成 Fluent UI**）。

---

## 📌 命名规范

- **文件夹 / 文件名**：英文小写，多词用短横线。
- **工具结构**：`tools/<name>/{index.html, style.css, app.js}`；`style.css` **只写布局**。
- **多子工具**：`tools/<name>/{subA, subB}/`，各自完整三件套。
- **路径**：`tools/<name>/` → `../../shared/xxx`；`tools/<name>/<sub>/` → `../../../shared/xxx`。
- **状态类名**：`.is-active`（选中）/ `.is-open`（展开）/ `.is-visible`（显示）/ `.hidden`（硬隐藏）。

---

## 🗺️ 关键路径速查

| 内容 | 路径 |
|---|---|
| 主页 | `index.html` |
| 设计系统入口（令牌 + 重置 + 外壳） | `shared/css/theme.css` |
| 各组件样式 | `shared/css/{buttons,inputs,panels,preview,editor,overlays,home}.css` |
| 下拉引擎 | `shared/css/dropdown.js` |
| 主题持久化 + 防闪白 | `shared/css/theme-init.js` |
| 共享 UI 图标 | `shared/ui-icons.js` |
| 游戏图标加载 / 字典 | `shared/gi-icons/` |
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
3. 我**只用手机**操作，看不到 Console。改动要保证语法无误，或告诉我怎么快速回退。
4. **别记流水账**：里程碑只写"做完了什么"，不写过程。

### 关键坑位备忘

**加载与主题**
- `theme-init.js` 必须 `<head>` 里**同步阻塞**引入（不能加 `defer`），否则首帧闪白。
- 首屏易闪的元素用 `body:not(.ready) xxx { display: none }` 挡住，别只靠禁用过渡。
- `backdrop-filter` **全站禁用**：它会让元素成为后代的「固定定位包含块」，破坏弹层定位，Android 上还掉帧。玻璃质感用 `color-mix()` + 描边。

**样式特异性**
- 元素级样式用 `input:where(...)`（特异性 0,0,1），**不要用 `:where(input[...])`（特异性 0,0,0）**——后者会被 `theme.css` 的 `* { padding: 0 }` 压掉。
- 布局硬伤高发：`1fr` 必须写 `minmax(0, 1fr)`；flex 纵列子项加 `flex-shrink: 0` 防止被压扁。

**组件状态**
- 共享 CSS 用 **`.is-visible`**，不是 `.show`。两者混用会导致 Toast / Modal **完全不显示**。
- 同一个按钮不要同时挂 `addEventListener` 和 `onclick`，会**双触发**。
- `.dropdown-panel` 打开时由 `dropdown.js` 内联写入宽度；面板最小宽度可用 `--dropdown-min-w` 覆盖。

**媒体与渲染**
- 导出 PNG 前必须把图片洗成 `dataURL`，否则跨域图丢失。
- `scrollHeight` 是取整值，直接拿它当 `max-height` 会差 0.5px → 冒出多余滚动条。装得下就别设上限。
- SVG 的 `@font-face` 家族名必须和 `text { font-family }` 里用的**同一个名字**，否则导出字体不生效。
- 星级底色等渐变：算法必须和 `icon-loader.js` 的 `applyBackground` 一致（HSL 亮度 × 0.5），否则和已烘焙的图片颜色对不上。

**预览与滚动**
- 预览框用 `aspect-ratio` 定高，别写死 `32vh` + `max-height`，否则内容比例不符会出现黑边。
- 「预览固定 + 内容滚动」的页面：`body { height: 100dvh; overflow: hidden }`，只让表单区 `flex: 1; min-height: 0; overflow-y: auto`。

**数据与路径**
- 工具按**角色名**查字典，编号只是展示序号。插入角色会让后续编号整体位移，以编号为 key 的存档需手动同步。
- `character-art.txt` 里的 `../../shared/...` 是按工具页层级写的，**不要再做 `../` 改写**。
- 立绘看不见先查 `state.characterX` 是否被拖偏（存在 IndexedDB），别急着怀疑数据。

---

## 🚧 待办事项

- **另一仓库**：`index.html` + `style.css` + 4 个工具（`tales` / `tales-editor` / `gift-set` / `gift-set-editor`）迁移，并删除 `icons.js`（内容已并入 `ui-icons.js` 的 `handbook` 段）。注意 `tales` 有 `.hidden` 业务标记冲突，需先改名。
- `tools/image-tools.html` 拆分 + 加资源加载器。
- `tools/chart.html` 拆分 + 加资源加载器。
- `tools/tier.html` 是否拆分待定。

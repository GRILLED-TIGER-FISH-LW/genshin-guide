# 更新记录

按日期倒序排列（最新在最上）。

> **文件定位**：给 AI 助手「恢复记忆」用。
> 只记**关键里程碑**（让 AI 知道什么已经做完，不要重复做）和**待办**（让 AI 知道可能的下一个方向）。
> 不记流水账。细节看代码本身。

---

## 2026-10-23 · 设计系统重构收尾

**里程碑**：
- **共享 CSS 全量重写**：1 个令牌入口（`theme.css`）+ 7 个组件层。确立刻度令牌（`--h-ctl` / `--pad-ctl` / `--r-ctl` / `--gap-*` / `--fs-*` / `--icon-*` / `--dur` / `--ease` / `--z-*` / `--dock-space`），全站禁用 `margin` 改走 `gap`/`padding`，状态类名统一 `.is-*`。
- **新增 `shared/css/dropdown.js`**：下拉引擎。fixed 定位绕过祖先裁剪，上下自动翻转，可派发 `dropdown:select`。经三轮迭代后定为「**实测闭环校正**」——设完 `left/top/width` 立刻读 `getBoundingClientRect()` 与目标值比对并补偿，不依赖任何对祖先 transform / 包含块的推断。
- **新增 `shared/css/theme-init.js`**：主题持久化（`localStorage['gi-theme']`）+ 首帧防闪白 + 切换期间禁过渡 + `booting` 首屏保护。
- **`ui-icons.js`**：升级为 Fluent UI 七段结构，末尾加兼容块（`ICONS.app.close` 别名 / `window.icons` 别名 / 统一补无障碍属性）。
- **四个工具完成迁移 + 动线重排**：
  - `character`：配队区「备选角色」改紧凑行（头像+名字+↑↓✕），嵌套从 4 层降到 3 层；预览区改回默认光标。
  - `video-cover/video`：section 顺序改为「攻略模式 → 画布背景 → 主标题 → 副标题 → 胶囊标签 → 字体 → 游戏 Logo」；切换模式加确认框。
  - `video-cover/collection`：section 顺序改为「画布背景 → 文字内容 → 字体」。
  - `map-editor`（图标字典编辑器）：导出按钮加「未导出」红线提醒，dirty 状态持久化到 localStorage。
- **父页面重构**：主题统一交给 `Theme` 模块，iframe 通过 `storage` 事件 + `postMessage` 双路同步；侧边栏加首屏保护不再闪。

**备忘**：
- 本轮修掉的都是「**看着能用、实际是坏的**」的问题，具体坑位见底部「关键坑位备忘」。
- 静态资源引用约定：外链 CSS/JS 走 `?t=Date.now()`；`theme-init.js` 因必须最早同步执行，用**无参数**引用，改了需要手动清缓存。
- `tools/map-editor/` 目录里放的是**图标字典编辑器**，目录名与 `#map-editor` 路由都是历史遗留。当前实况如此，是否改名待定。

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
- **跨仓库引用**（另一仓库 `adventurer-handbook` 引用本仓库共享资源）：一律用**绝对 URL**，不能写相对路径。
  ```
  https://grilled-tiger-fish-lw.github.io/genshin-guide/shared/…
  ```
- **状态类名**：`.is-active`（选中）/ `.is-open`（展开）/ `.is-visible`（显示）/ `.hidden`（硬隐藏）。
- **业务标记**：不要用 `.hidden` 表示「这条数据被隐藏」这种业务状态，会撞全局类。用 `.is-biz-hidden` 之类的独立名字。

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
5. 改动前先说清楚**动的是共享层还是工具本地文件**，以及影响范围。

### 关键坑位备忘

**加载与主题**
- `theme-init.js` 必须 `<head>` 里**同步阻塞**引入（不能加 `defer`），否则首帧闪白。
- 首屏易闪的元素用 `body:not(.ready) xxx { display: none }` 挡住，别只靠禁用过渡。
- `backdrop-filter` **全站禁用**：它会让元素成为后代的「固定定位包含块」，破坏弹层定位，Android 上还掉帧。玻璃质感用 `color-mix()` + 描边。
- **主题图标双显**：`.xxx-theme-moon { display: none }` 是 (0,1,0)，会被共享的 `.float-btn .icon-slot` (0,2,0) 压掉 → 太阳月亮同时出现。必须提到 (0,3,0)，如 `.xxx-theme-btn .icon-slot.xxx-theme-moon`。

**样式特异性**
- 元素级样式用 `input:where(...)`（特异性 0,0,1），**不要用 `:where(input[...])`（特异性 0,0,0）**——后者会被 `theme.css` 的 `* { padding: 0 }` 压掉。
- 布局硬伤高发：`1fr` 必须写 `minmax(0, 1fr)`；flex 纵列子项加 `flex-shrink: 0` 防止被压扁。
- **`.field` 是 `align-items: flex-start`**，子元素不会被拉伸。`<input>` 自带 `width: 100%` 所以看不出问题，但 `.combobox`、自定义 `<label>` 这类 div/label 必须自己写 `width: 100%`，否则和上下字段对不齐。
- **`.icon-slot` 的宽高只在 `.dropdown-trigger` 上下文里有定义**。`.btn` / `.float-btn` 里的由 buttons.css 单独给；**自己写的按钮类必须手动补 `width/height` + `svg { 100% }`**，否则 icon 按默认尺寸撑开。

**组件状态**
- 共享 CSS 用 **`.is-visible`**，不是 `.show`。两者混用会导致 Toast / Modal **完全不显示**。
- 列表选中态用 `.is-active`，不是 `.active`。分段控件 `.seg-btn` 同理。
- 同一个按钮不要同时挂 `addEventListener` 和 `onclick`，会**双触发**。
- `.dropdown-panel` 打开时由 `dropdown.js` 内联写入宽度；面板最小宽度可用 `--dropdown-min-w` 覆盖。

**下拉定位**
- 面板宽度 ≡ 触发器宽度时，**数学上不可能溢出视口**，不要再用 `--gap-lg` 之类的间距令牌当「安全边距」去钳制 —— 那样会把面板压窄并整体内缩（曾出现左右各缩 4px 的现象）。
- 不要靠推断祖先 `transform` 来修正 fixed 定位，会漏检 `will-change` / `contain` / `content-visibility`。用实测闭环校正更可靠。

**滚动条**
- **绝对不能同时写 `scrollbar-width` / `scrollbar-color` 和 `::-webkit-scrollbar`** —— Chrome 121+ 一旦看到标准属性生效，就整组忽略伪元素，圆角 thumb 与 track 留白全部失效，方角滚动条会从容器圆角处露出来。
- 圆角容器内的滚动条：`::-webkit-scrollbar-thumb` 给 `border-radius: var(--r-pill)`，`::-webkit-scrollbar-track` 给 `margin-block` 让滑块远离上下圆角。

**媒体与渲染**
- 导出 PNG 前必须把图片洗成 `dataURL`，否则跨域图丢失。
- `scrollHeight` 是取整值，直接拿它当 `max-height` 会差 0.5px → 冒出多余滚动条。装得下就别设上限。
- SVG 的 `@font-face` 家族名必须和 `text { font-family }` 里用的**同一个名字**，否则导出字体不生效。
- 星级底色等渐变：算法必须和 `icon-loader.js` 的 `applyBackground` 一致（HSL 亮度 × 0.5），否则和已烘焙的图片颜色对不上。
- `textarea` 的 `resize: vertical` 会在右下角画出原生手柄，深色背景下渲染成黑白小方块。一律 `resize: none` + `::-webkit-resizer { display: none }`。

**预览与滚动**
- 预览框用 `aspect-ratio` 定高，别写死 `32vh` + `max-height`，否则内容比例不符会出现黑边。
- 「顶栏固定 + 内容滚动」的页面：`body { height: 100dvh; overflow: hidden }`（**`min-height` 不够，必须是 `height`**），只让内容区 `flex: 1; min-height: 0; overflow-y: auto`。
- 预览框本身不是按钮，`cursor: default`；只有真的绑了点击行为（如切换浮动工具栏）才用 `pointer`。
- 页面没有底部 Dock 时，`padding-bottom` 不要再套 `--dock-space`（88px），那是给固定导出胶囊留位的。

**数据与路径**
- 工具按**角色名**查字典，编号只是展示序号。插入角色会让后续编号整体位移，以编号为 key 的存档需手动同步。
- `character-art.txt` 里的 `../../shared/...` 是按工具页层级写的，**不要再做 `../` 改写**。
- 立绘看不见先查 `state.characterX` 是否被拖偏（存在 IndexedDB），别急着怀疑数据。

---

## 🚧 待办事项

- `tools/image-tools.html` 拆分三件套 + 接入设计系统。
- `tools/chart.html` 拆分三件套 + 接入设计系统。
- `tools/tier.html` 是否拆分待定（也可保持单文件，但要接入设计系统）。
- `tools/map-editor/` 目录名与 `#map-editor` 路由是否改为「图标字典编辑器」语义，待定。

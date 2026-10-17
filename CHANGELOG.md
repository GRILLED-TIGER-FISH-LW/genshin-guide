# 更新记录

按日期倒序排列（最新在最上）。

> **文件定位**：给 AI 助手「恢复记忆」用。
> 只记**关键里程碑**（让 AI 知道什么已经做完，不要重复做）和**待办**（让 AI 知道可能的下一个方向）。
> 不记流水账。细节看代码本身。

---

## 2026-10-18

**里程碑**：
- **全站视觉重构（2026 现代扁平化）**：彻底抛弃 iOS 风格与原生控件，采用焦糖色/莫兰迪色系；去除全站死黑边框，统一改用极细描边与背景色阶差；重写所有原生滑块、复选框、下拉框与滚动条；底部移动端 Dock 全部改为悬浮胶囊。
- **主页（Dashboard）**：新增 Bento 网格首页，支持图标懒加载；侧边栏加入“首页”入口；顶栏与侧边栏改为半透明毛玻璃；退出工具时直接回到网格视图，不再强刷。
- **角色一图流**：`svg.js`/`consts.js` 移除发光滤镜与粗边框，改为玻璃态面板（一级 40% 黑，二级 20% 白，无全局遮罩）；圣遗物图标增加白色描边；恢复淡黄色标签文字；`style.css` / `app.js` 彻底去内联，修复了复杂表单的头部挤压、按钮换行问题。
- **图标字典编辑器**：重构 UI 布局，顶部工具栏毛玻璃化；星空渐变背景从 JS 内联迁移至 CSS 变量动态注入；修复替换按钮点击失效问题；头像等比例展示。
- **视频封面**：修复原生 `alert`/`confirm`，全面接入 Toast 与自定义弹窗；画布背景、浮动素材统一改为正方形预览图，点击直接唤出文件选择器替换。

**约定更改**：
- **绝对禁止**在 HTML 和 JS 中编写内联排版样式（`style="..."`）。
- **绝对禁止**使用原生的 `alert()` 和 `confirm()`。
- 复杂布局优先使用 CSS Flex/Grid，组件外观一律交由 `shared/theme.css` 控制。

---

## 2026-10-13

**里程碑**：
- 已拆工具页（主页 + character + map-editor + video-cover/video + video-cover/collection）加资源加载器：所有 CSS / JS 走时间戳 URL，加载前显示启动遮罩，解决"改动后要清缓存才生效"
- 主页 iframe 的 src 加时间戳
- 视频封面 / 合集封面：背景模糊机制重写。模糊图改用 canvas 预生成（原图 cover 缩放 + 边缘像素拉伸 pad + blur + 亮度），解决"模糊后边缘透明露底图"和"模糊会放大图片"
- 图标字典编辑器：新增搜索框，按中文名 / key 实时筛选

---

## 2026-10-09

**里程碑**：
- 角色一图流重构：拆 `app.js` → `{consts.js, svg.js, app.js}`；导出 JSON 剥离图片、导入自动重匹配；字体加 IndexedDB 缓存；导出 PNG 前把图片洗成 dataURL
- 角色一图流：配队区 2/3/4 号位和备选支持 `名字·元素` 输入（两级回退）；匹配完成后只刷新缩略图，不重建编辑器
- 立绘匹配 key 从 `名字（元素）` 改为 `名字·元素`
- 视频封面稳定化：修一批 bug（无字 / 清空还原 / 导出虚线 / 图片丢失 / 胶囊文字隐形 / 预览撑爆），图层顺序调整
- 图标字典编辑器支持 `url` 字段；粘贴 URL 语义改为「给 key 挂源」
- 图标系统支持单条 `url` 覆盖，优先级 `local > url > http key > 拼接`（`icon-loader.js`）
- `ui-icons.js` export / import 方向对调

---

## 2026-10-08

**里程碑**：
- 拆 `tools/video-cover.html` → `tools/video-cover/{video,collection}/`
- `shared/theme.css` 从「只有变量」扩展成「变量 + 通用控件」（22 模块）
- 角色卡改造：横向 Tab、浮动按钮方形、立绘 / 名片图走字典
- 图标字典编辑器：统一风格、一行布局、缩略图 lazy
- 新增字典：`shared/data/namecards.txt`、`shared/data/character-art.txt`
- 新增目录：`shared/assets/portrait/`
- favicon 换成 `favicon.png`
- 字体加载机制重写

**删除**：
- `tools/video-cover.html`
- `shared/assets/characters/standing/`
- `temp-namecard-check.html`

---

## 2026-10-07

**里程碑**：
- 新建 `shared/` 目录
- 拆 `tools/character.html` → `tools/character/`，`tools/map-editor.html` → `tools/map-editor/`
- 主页重写：支持「单工具 + 多子工具」两种形态
- UI 图标从 Solar 换成 Phosphor
- 字典 key 从短 ID 改为图标全名

---

## 命名规范

- **文件夹 / 文件名**：英文小写，多词用短横线
- **工具拆分结构**：`tools/<name>/{index.html, style.css, app.js}`
- **多子工具**：`tools/<name>/{subA, subB}/`，各自完整三件套
- **文件顶部带模块导航注释**
- **路径规则**：
  - `tools/<name>/index.html` → `../../shared/xxx`
  - `tools/<name>/<sub>/index.html` → `../../../shared/xxx`

---

## 关键路径速查

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
| 本地立绘 | `shared/assets/portrait/` |
| 元素图 | `shared/assets/characters/element/` |
| 在线存档 | `shared/saves/characters/` |
| 角色卡拆分文件 | `tools/character/{consts.js, svg.js, app.js}` |

---

## 给 AI 的备忘

### 0. 定位

你是我的助手。我发 `README.md` + `CHANGELOG.md` 让你恢复记忆。

读完：简单确认（一两句话）→ **等我下指令**。不要主动给方案或改代码。

### 1. 修改流程

- 先给方案，我确认后再给代码
- 我**先发齐**所有相关文件 → 你**一次一个**发回完整文件
- 代码必须完整版，不说"改哪一处"
- 4 反引号包裹

### 2. 环境

- 我**只用手机**操作 GitHub 网页端
- 我**看不到 Console**
- 改完没效果 → 关浏览器重开 / 无痕测试

### 3. 关键坑位

- **导出 PNG 丢图**：blob SVG 里相对路径失效 + 外链受 CORS → 导出前把图片洗成 dataURL
- **`imgManual`**：区分手动上传 / 字典匹配，导出 JSON 时前者保留后者剥离
- **匹配不重建编辑器**：只更新缩略图 `src`（`data-img-target`），避免打断输入框
- **字体**：慢是 GitHub Pages 问题，靠 IndexedDB 缓存
- **角色名匹配**：立绘 / 名片 / 1 号位严格；2/3/4 号位 / 备选两级回退（`·` 分隔）
- **视频封面图层**：底层 → `underMiddle=true` 素材 → 模糊层 → `underMiddle=false` 素材 → 胶囊 → 文字
- **视频封面模糊**：用 canvas 预生成（不用 SVG `feGaussianBlur`，浏览器对 `edgeMode` 支持不稳，会导致边缘透明）
- **缓存**：所有工具页都有资源加载器，CSS/JS 走时间戳 URL

### 4. 界面规范

- 优先用 `shared/theme.css` 和 `tools/character/` 里已有的类
- 能直接用就不新增样式；内缩在 HTML 层控制

---

## 待办

**（仅供 AI 了解可能的方向，不代表要立刻做）**

- 拆 `tools/image-tools.html` → `tools/image-tools/{7 个子工具}/`，拆完给每个 subtool 加独立 `src` + 加资源加载器
- 拆 `tools/chart.html` → `tools/chart/{radar,bar}/`，同上
- `tools/tier.html` 是否拆待定，拆完同样加资源加载器

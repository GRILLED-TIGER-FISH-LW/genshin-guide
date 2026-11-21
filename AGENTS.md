# 给 AI 助手的维护手册

> 读完本文件，简单确认即可，**等我下指令**。不要主动给方案或改代码。
> 只记方法：协作流程、诊断套路、实现约定。具体实现看代码本身。

---

## 一、环境约束

| 约束 | 后果 |
|---|---|
| 我**只用手机**操作 GitHub 网页端 | 方案不能依赖命令行或本地环境；改文件只能靠网页端整份覆盖 |
| 我**看不到 Console** | 出错只能靠页面现象、UI 反馈、导出结果判断 |
| 我**没有本地构建环境** | 构建靠 GitHub Actions，改完必须等部署 |
| 排查靠**截图 + 粘贴文本** | 报错必须能被「看到」，否则无法定位 |

**推论**：所有方案要满足「手机上能贴、出错能看见、失败能回退」。

---

## 二、协作流程

1. **先给方案，我确认后再给代码。**
2. **一次给 3 到 4 个完整文件**，不要一个一个发。
3. 每个文件**必须完整**，4 个反引号包裹，可直接整段替换。
4. 改动前说清：动的是**共享层还是本地文件**，影响范围多大，**要不要同步另一个仓库**。
5. **不记流水账**：只说做完了什么，不写过程。
6. 文档里**不要出现嵌套的三反引号**（外层用 4 个反引号发我时会截断），内层代码块一律用 4 空格缩进。

### 定位改动位置

**不要让我去搜索某段代码** —— 搜不到的原因很多（空格、缩进、版本不一致），白费一轮对话。

| 改动规模 | 怎么给 |
|---|---|
| 1 处、1 行以内 | 说清**哪个文件** + 给出**完整一整行** + 注明共几处 |
| 2 处以上，或涉及一个块 | **直接给全文** |
| 机械改动 / 大删除 | 写进 `reorg-list.txt` 清单（见第六节），我 dispatch 一次 |

**给自己的两条纪律**（吃过亏）：

- 给「原文」之前，**grep 结果不要用 `head` 截断** —— 漏看一处就会白跑一轮机器人。
- 自检要查**实际行为**（`grep "text('data/x.txt')"`），不要查名字：新文注释里顺手写个被检查的字符串，会把自己卡住。

---

## 三、当前架构

单一 Vue 单页应用，**唯一的例外是还没搬过来的 3 个旧工具**（iframe 常驻托管）。

    ├── index.html              入口：内联主题预置 + 加载守卫 + 旧 hash 归一
    ├── src/
    │   ├── main.js router.js App.vue
    │   ├── styles/             tokens.css（令牌唯一真源）· base.css · app.css
    │   ├── components/         通用控件
    │   ├── composables/        useTheme · useToast · useData · useImageDict · useIconLib
    │   ├── lib/                纯绘制 / 导出 / 存档引擎（不碰界面）
    │   │                       videoCover · collectionCover · guideChart · guideConsts
    │   │                       guideStore · assets · fonts
    │   └── views/              Home · CharacterGuide · ImageDict · VideoCover · CollectionCover
    └── public/                 整目录照搬进 dist（不走打包）
        ├── shared/             UI 图标库 + 图片字典 / 加载器 —— 真共享，只有这两样
        ├── tools/              旧工具页（图片处理 / 图表 / 角色梯队）
        ├── data/               只剩 logos.txt（角色数据已并入图片字典）
        ├── fonts/              字体库
        ├── images/             本地素材（元素 / 立绘 / 封面底图 / 游戏图标）
        └── saves/characters/   角色一图流的存档

### 路由

`router.js` 的 `TOOLS` 是**唯一真源**：首页卡片、侧栏、顶栏标题、iframe 地址全部从它推出来。

| 字段 | 含义 |
|---|---|
| `frame` | 走 iframe 的旧工具页（相对仓库根） |
| `component` | 已搬进 SPA 的真组件 |
| `subtools` | 子工具；带 `component` 的已搬，带 `frame` 的各自一页，都不带的共用父页面 |

- **没有 `frame` 时 `FrameLayer` 自动跳过**，所以搬迁 = 把 `frame` 换成 `component`。
- `FrameLayer` 里的 iframe 常驻（`v-show` 隐藏、绝不销毁），保住旧版「切换不重新加载」。
  **它的根节点必须 `pointer-events-none`，只有真正显示的那一帧和加载遮罩是 `auto`** —— 否则会吃掉全站点击。
- `App.vue` 的 `RouterView` 套了 `KeepAlive`：**搬进来的视图必须常驻**，否则引擎的监听和首屏渲染会丢。
- 每条 `path` / `redirect` 必须以 `/` 开头（写成 `'character'` 会在 `createRouter()` 抛错 → 白屏）。

### 跨仓库依赖

**只剩 1 个，且只有单向**：

- `adventurer-handbook` → 绝对 URL 读本仓库的 `public/shared/image-dict.js`（**图片字典**）。**已知 4 个文件在读**：`src/views/{GiftSet,GiftSetEditor,Tales,TalesEditor}.vue`，每个文件两处（URL 常量 + `loadGlobalScript(..., 'IMAGE_DICT')`），都带 `.catch(() => null)`，所以断了只是没图标、不白屏。
- 图片字典页的图标键仍叫 `nav.iconEditor`（图标键名与另一个仓库共用，不随页面改名）。
- **反向禁止**：本仓库不依赖 `adventurer-handbook`；图标一律来自本仓库自己的 `public/shared/ui-icons.js`。

---

## 四、实现约定

### 共享层（改这些要两个仓库一起改）

- **数字框的显示文本自己管**：`Slider` 的数字框用「本地 `text` + 打字期间不回灌 + 失焦归位」，**不要**把 `:value` 绑成 `undefined` —— 那会把输入框清空，成了「点进去打什么都看不见」（2026-11-10 修过）。拖动条与数字框靠同一个 `model` 双向同步。
- **选图的热区只有缩略图**：缩略图写 `<button type="button" @click="el?.click()">` + 一个 `sr-only` 的 `<input type="file">`，**别**把整行包进 `<label>` —— 那样点文字、点空白都会弹选图（视频封面 / 合集封面的背景行 2026-11-10 改过；角色一图流的缩略图本来就是这种写法）。

| 文件 | 说明 |
|---|---|
| `src/styles/tokens.css` | 令牌唯一真源，**与另一仓库逐字节相同** |
| `src/components/Btn.vue` | 档位 `sm/md/lg`；变体 `primary/secondary/ghost/danger/float/float-danger`；纯图标用 `square` + **`#icon` 具名插槽** |
| `src/components/{Field,Dropdown,Seg,Radios,Slider,Modal,Icon}` | 表单与控件 |
| `src/components/{PreviewFrame,DockCta}` | 工具页外壳：预览框（16:9 + 右上角浮动工具栏 + 点一下淡出）、底部悬浮主操作 |
| `src/components/{AppNav,AppDrawer,FrameLayer,ToastHost,SyncReport}` | 应用外壳 |
| `src/lib/fonts.js` | 字体：清单 / 取字节 / 装进文档 / 导出用的 `@font-face` 文本 |
| `src/lib/assets.js` | 资源层：图片尺寸 / 远程图转 dataURL / 存文件 / SVG→PNG |
| `public/shared/image-loader.js` | 图片加载器：`getPath` / `match` / `load` / `openPicker`。本仓库运行时（`useIconLib.js`）与构建期虚拟模块在读，另一个仓库不读它 |

**先看有没有现成的**：控件一律用共享层，不新写本地样式、不用浏览器原生外观。

### 令牌与几何

- 颜色、圆角、阴影、缓动都在 `tokens.css` 的 `@theme` 里，**改颜色只改这一个文件**（并同步另一仓库）。
- 色板取 **Claude 官方七色**，几何取 Notion（控件 8px 矩形、卡片 12px、**胶囊只给页签和徽章**）。

  | 角色 | 色值 | 用在哪 |
  |---|---|---|
  | Dark | `#141413` | 主文字（白天）/ 深色页面底（夜间） |
  | Light | `#faf9f5` | 卡片、浅色底 / 夜间主文字 |
  | Mid Gray | `#b0aea5` | 次级元素：需要看得见的边、次要图标 |
  | Light Gray | `#e8e6dc` | 微妙背景：凹槽 `sunken`、`surface-2`、默认分隔线 |
  | Orange | `#d97757` | 主强调 `accent`（按钮、选中态、链接） |
  | Blue | `#6a9bcc` | 次强调 `info` |
  | Green | `#788c5d` | `success` |

- **两个纯色之间不够用的档，只能在这两个纯色之间混**（注释里标比例，如 `canvas` = Light + Light Gray 对半）。手调色相出来的中间色会发灰发黄，已经全部清掉。
- 调色板没有的两支语义色自己留：`danger` 红（危险操作）、`warning` 黄（取 Orange 的色相压暗），别和 accent 混用。
- **选中态全站一套**：`accent-soft` 垫色 + `accent-strong` 文字（抽屉菜单再加左侧 2px `accent` 竖条），`el-segmented` 的轨道用 `sunken`、选中项用 `accent-soft`。别拿 `sunken` 当选中色 —— 那是一块灰底，看着像没选中。
- 深色模式**靠变量覆盖**（`[data-theme="dark"]`），不用 `dark:` 前缀。
- 颜色一律走令牌（`bg-surface-2` / `border-line-3` / `shadow-float`…），不写裸 hex。
- **凹槽类表面**（卡片 hover、`collapse` 底、已完成底色）一律复用 `--color-sunken`，**不要再新造第二个令牌**。暗色下它必须比 `--color-surface` 亮一档，否则这些地方整片看不见。
- **控件跟它所在的面同色**：卡片里的控件底一律 `--color-surface`（= `el-card` 的底），靠 `--el-border-color*` 那条描边区分，别用凹槽色 `sunken` 当控件的底；滑块轨道也用同一条描边（`--el-slider-runway-bg-color: var(--el-border-color)`）。选中态优先 EP 默认（`primary` 实心 + 白字），与 `el-radio-button` 一致。
- EP 组件自己的变量（`--el-slider-runway-bg-color`、`--el-segmented-*`）要在**组件选择器上**盖，写在 `:root` 会被 EP 组件级定义和暗色 css-vars 遮住。
- **列表里的缩略图统一 40px（`size-10`）**，正好等于表单控件高度，所以和输入框天然对齐；再小的（如备选）32px。

### 控件高度

| 场景 | 高度 |
|---|---|
| 工具栏 / 列表行 / 卡片角 | `sm` 36px |
| 页内表单 / 弹窗 | `md` 40px（窄屏）· 36px（宽屏） |
| 底部悬浮主操作 | `lg` 48px（只有 `DockCta` 用） |

### 焦点样式（全站统一，只有一种）

所有可聚焦控件一律 `focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent`。

- 容器会裁 outline 的（如横向滚动区）改用负 `outline-offset` 画内描边。
- 程序化聚焦的容器（`Modal` 面板、`AppDrawer` 抽屉）用 `focus:outline-none`，故意不画环。

### 禁用清单

| 禁 | 原因 |
|---|---|
| `backdrop-filter` | 破坏 fixed 包含块 + Android 掉帧。用实色或 `color-mix()` |
| 颜色属性的 `transition` | 主题切换会渐变，只允许 `transform` / `opacity` / `box-shadow` |
| 裸 `1fr` | 用 `minmax(0, 1fr)` 或 Tailwind 的 `grid-cols-*` |
| 单独用 `outline-none` | 杀掉焦点环，必须有 `focus:*` 替代 |
| 布局用 `margin` | 用 `gap` |
| 从外面用 `!` 覆盖组件档位 | 优先给共享组件加档位（如 `Btn` 的 `lg` / `float-danger`），别从外面染档位颜色 |

### 状态与文案

- 状态类：`.is-active` / `.is-open` / `.is-visible` / `.hidden`。
- **业务状态不要用 `.hidden`**（撞全局硬隐藏），用 `.is-biz-hidden` 这类独立名字。
- **UI 文案不写具体数字**，除非它来自数据。

### 加载与数据

- **进 IndexedDB 前必须深拷贝**：`reactive` 的状态直接 `put()` 会 `DataCloneError`（嵌套数组 / 对象都是 Proxy），被 catch 吞掉就是「草稿永远不更新，每次进来读旧数据」—— 一图流早就用 `JSON.parse(JSON.stringify(toRaw(data)))` 绕过了，视频封面 2026-11-10 才补上。几兆的字体 base64 一律不进草稿，进页面按文件名重取。**落进草稿的该是「怎么找回来」，不是「东西本身」**：视频封面第一批只存了字体名与 base64、忘了写 `fontFileName`，base64 一剔就找不回来了 —— 凡是「重取」的字段，写入的地方与读回的地方要能对上。

- **所有动态资源走时间戳**（`?t=`），路径一律 `import.meta.env.BASE_URL + 'shared/…'`。
  工具页时代那种 `../../shared/` 在 SPA 里会跑到域名根外面，必须换掉。
  （没搬的旧工具页仍写着 `../../shared/`，由 `vite.config.js` 里的插件在构建时改写成带仓库前缀的 `shared/`。）
- 图标走**构建期虚拟模块**，运行时不再加载图标脚本：
  - `virtual:gg-icons` ← `public/shared/ui-icons.js`（只收值是 `<svg` 开头的条目，剥掉外层 `<svg>`，键名 `组.名字`，如 `ui.trash`）
  - `virtual:gg-image-lib` ← `public/shared/image-loader.js`（只取 `STAR_COLORS`；它在加载时会摸 `document`，插件里给了 `DOC_STUB` 垫片）
  - **代价**：虚拟模块只给 24 视框能用的界面图标；`element` / `artifact` 两组是 **1024 视框的路径数据**，用 `Icon.vue` 会画到画面外（它外框写死 24）。要用就自己套 `viewBox="0 0 1024 1024"`（`CharacterGuide.vue` 里的 `elementIcon()` 就是这么干的）。
- **允许的运行时全局**：图片字典要用的 `window.IMAGE_DICT` / `window.IMAGE_LIB`，走 `useData.js` 的 `loadGlobalScript()` 载入；`src/lib/` 与 `composables/useIconLib.js` 里各有一处 `window`，**不外溢**。
- `composables/useIconLib.js` 的名字**故意不带 `image`**：它同时管 `ui-icons.js`（界面图标），改名会误导。
- 本地草稿一律 IndexedDB，**库名 / 表名 / 键名不能改**：`video_cover_db` / `video_state`、`collection_state`、`icon_dict_editor_v4`、`genshin_card_db_v5` / `card_store` / `current_state`。
- **字典是角色数据的唯一真源**：序号（`order`）、立绘（`art.url`）、名片（`card.key` + `config.characters.card` 规则）。封面与一图流都从这里取，不再有 txt。

### 图片字典的数据模型（`public/shared/image-dict.js`）

- **旅行者一家按元素分项**：字典里 `Traveler`（旅行者）与 `旅行者·冰` 是两条，各有自己的立绘，名片与编号相同（都是 `order: 1`）。查字典前先把名字按当前元素色补成「名字·元素」，查得到就用它、查不到退回原名 —— 加载器的第一遍本来就是逐字匹配，所以「旅行者·冰」不会被削回「旅行者」。这条**只在一图流里做**（`guideStore.js` 的 `dictNameWithElement()`：立绘 / 名片 / 头像 / 在线存档文件名都走它），封面工具与字典编辑器按名字匹配即可，队里那个旅行者也不知道什么元素。

- **地址 = 规则 + 代号**。`config[分类]` 放两组源规则：主源（lunaris）用 `prefix` / `ext`，备用源（Amber）在同级的 `alt`。条目 key 是**代号**（`Ambor` / `10001_4` / `Sword_Blunt`），不是图标全名。
- 条目字段：`name` / `order` / `star` / `url` / `alt` / `lock` / `card` / `art`。
  - `url`：直接用它（**只在源拼不出来时才写**，比如仓库里的图、官网那一串）；`alt: true`：这一格改用备用源那组规则（lunaris 图不对时用，如夏洛蒂）。
  - `card` / `art` 是槽位对象（`{ key, url, alt }`）；`key` 是那一格的代号 —— 头像代号和名片代号**可以不一样**（绮良良：Momoka / Kirara）。
  - **名片地址要拼 `config.characters.card` 那一组规则**（顶层 `prefix` / `ext` 是头像规则，拿它去拼 `card.key` 会拼出头像）。
  - `lock: true`：这一条同步整条不碰。**其余情况下同步按槽位算**：头像槽 / 名片槽带 `url` 或 `alt` 就留用户的，名字 / 星级 / 序号永远跟源走。
- **导出格式逐字不能变**（两个仓库都在读）；老格式（全名 key、`local: true`）载入时会被自动归一，`image-loader.js` 也留着兼容分支。
- 星级底色等渐变算法必须与 `image-loader.js` 的 `applyBackground` 一致。

### 绘制与导出

- **导出图里的字体靠内嵌 @font-face**：SVG 当图片渲染时摸不到页面的 `document.fonts`，所以字体 CSS 必须在**克隆出来的节点**上用 `document.createElementNS('…svg', 'style')` 塞进 `<defs>`（角色一图流与视频封面同一套写法）。视频封面曾让 Vue 渲染这个 `<style>`，导出图一直是默认字体（2026-11-10）。几兆的 data URL 还要「先出一张 320×180 的小图预热」，否则第一次栅格化常常赶在字体加载完之前。
- **文字度量会写进 computed，字体装好要让它重算**：`fonts.js` 的 `installFont` / `dropFont` 成功时自增 `fontRev`；凡是**按文字宽度定位**的 computed（视频封面的胶囊标签 / 底部签名、一图流的配队标题 / 副词条 / 散搭标签）都要读一次 `fonts.fontRev`。漏了就是「重进页面时位置是偏的，动一下 / 删掉再添一个才正」—— 因为把 `s.fontName` 设成同一个值不触发重算（2026-11-10 修过）。

- 两种都允许，按改动量选：
  - **视频封面 / 合集封面**：预览用模板里那份真正的 `<svg>`，导出克隆同一份节点。
  - **角色一图流**：引擎拼 SVG 字符串（`guideChart.js`，坐标走 `guideConsts.js`），预览 `v-html` 塞进去；导出时从 DOM 取那份 `<svg>` 克隆。它 30KB 的坐标代码搬进模板不划算，所以保持字符串。
- 导出前必须把图片洗成 `dataURL`，否则跨域图会拖脏 canvas、`toBlob` 直接抛错。
- 导出的 SVG 是**独立文档**，摸不到页面的 `document.fonts`，所以 `@font-face` 必须内嵌（只在导出的那一瞬间挂上，避免预览把字体解析两遍）。
- 导出倍数：封面与一图流都是 3 倍 → 3840×2160（合集封面 2560×1440）。
- 模糊层：半分辨率 + JPEG + 按「图 + 参数」缓存，只在参数变化时重算。

---

## 五、诊断套路

### 白屏

按顺序查，不要跳步：

1. **`Settings → Pages → Source` 是不是 `GitHub Actions`**。若是 `Deploy from a branch`，Pages 会把仓库源码当网站 —— 源码 `index.html` 引用 `/src/main.js`，浏览器解析不了 `.vue`，必然白屏。
2. **`vite.config.js` 里 `base: '/genshin-guide/'` 在不在**。丢了则产物引用 `/assets/…`，少仓库前缀，全部 404。
3. **缓存**：Pages 的 HTML 缓存约 10 分钟，加 `?t=1` 绕过，或换个标签页打开。

> `index.html` 里有内联守卫脚本：4 秒内没渲染出内容，会把实际引用的脚本路径打在屏幕上。**让它先说话。**

| 屏幕显示的路径 | 结论 |
|---|---|
| 带 `/genshin-guide/assets/` | base 对，产物没部署上去 |
| 只有 `/assets/…` | base 配错 |
| 是 `/src/main.js` | Pages 源没切成 GitHub Actions |

### 部署失败怎么读日志

`Actions` → 红的 workflow → 点 **`build`** 方框 → 点红的步骤 → **拉到最底**（错误在最后十几行，前面全是 npm 噪音）。

| 报错关键词 | 原因 |
|---|---|
| `Could not resolve "../components/X.vue"` | 文件没建、放错目录，或名字大小写不对。**Rollup 遇到第一个无法解析的 import 就停，一次只报一个** —— 缺文件要一次性核对 |
| `Cannot use import statement outside a module` | `package.json` 少了 `"type": "module"` |
| `Get Pages site failed` | Pages 源不是 `GitHub Actions` |

**只有 `deploy` 红、`build` 全绿** = 代码没问题，是 Pages 那边的事：

| `deploy` 报错 | 原因 | 解法 |
|---|---|---|
| `due to in progress deployment` | 上一秒连推了好几次，部署队列互撞，或 Pages 侧留了个假锁 | ① 先等所有 run 结束；② `Settings → Pages` 把 `Source` 切走保存、再切回 `GitHub Actions` 保存（重置站点状态）；③ 还不行就删掉 `github-pages` 环境（`Settings → Environments` 行右侧垃圾桶，会要一次邮箱验证码），下一次 deploy 会自动重建 |
| `Artifact not found` | 用了 `Re-run failed jobs`（只重跑 deploy，不重新生成产物） | 改用 `Re-run all jobs`，或直接 `Run workflow` 手动跑一次 |

> **在手机网页端没法「攒着一次提交」**（存一个文件就是一次提交），所以别指望靠少推来避免撞车 —— 撞了按上面的表处理就行。

### 「改了但没效果」

**先确认文件真的更新了**，不要假设：

1. 搜文件里的独特标记（如注释里的版本说明），搜不到 = 没替换成功。
2. 不带 `?t=` 打开可能是旧缓存。
3. **只有部分改动生效 → 大概率是构建没跟上**（今天的部署全红，线上还是旧版本）。先看 `Actions` 是不是绿的，再判断视觉。

### 样式没生效 / 时好时坏

- 同一元素上**两个同属性 utility**（如 `bg-surface` 和 `bg-surface-2`），谁赢取决于 Tailwind 生成 CSS 的顺序，**不是模板里的顺序**。修法：让它们互斥，写进同一个条件；真要覆盖就用 `!` 后缀（`text-danger!`），但那是例外，见第四节。
- **组件根节点自带 `w-full` 的**（`Dropdown`），从外面塞宽度类会打架 → 套一层定宽容器。
- 手写 CSS 里直接写 `var(--color-x)` 而没有 utility 用到它 → Tailwind **不会输出这个变量**。
- 整页横向溢出、要左右拖 → 容器是 grid 却没写列，隐式轨道被 `flex-wrap` 的 max-content 撑开。**加 `grid-cols-1`**。
- **`inheritAttrs: false` 的组件**：`class` 会跟着 `$attrs` 落到它内部绑的那个元素上。`Field` 已经特殊处理（class 归外壳、其余归 input），所以给它传 `flex-1` 有效；自建组件别踩这个坑。
- **危险色在小尺寸图标按钮上「看不见」**：`danger` 的底色 `#f8e9e7` 与卡片底 `#faf9f5` 对比只有 1.02:1，所以删除按钮一律补一条 `border border-danger/30`（旧版也是靠那 1px 红线区分）。同一页出现两次以上就抽个 `DEL = 'border border-danger/30'` 常量（一图流、图片字典都这么写），只出现一次就直接写进 class（视频封面的浮动图片行）；预览框右上角那种悬浮按钮一律用 `Btn` 的 `float-danger` 档（自带这条红边），三个工具别再各写各的。

### 点了没反应 / 全站都点不动

`FrameLayer` 那层空的全屏容器盖住了路由视图还收事件 → 它的根节点必须 `pointer-events-none`，只有真正显示的那一帧和按钮是 `auto`。

### 图标不显示 / 缺几条线

- key 是**驼峰**（`ui.chevronDown`），且要带组名（`ui.` / `nav.` / `app.`）。
- 箭头类要用 `bold`（实心），其他按钮用默认线框。
- 组名分不清时，去 `public/shared/ui-icons.js` 里核对该键在哪一组。
- **取不到名字不会报错，只会渲染成空白** —— 空白图标先怀疑名字写错（`ui.link` 这种就不存在）。
- **`element` / `artifact` 那两组是 1024 视框**，`Icon.vue` 装不下（见第四节）。
- 用 `<Icon>` 时颜色靠 `class="text-danger"` 之类传进去，它会并进根节点的类里（只含尺寸与 `shrink-0`，不会打架）。

### 字体不生效

- SVG 里 `@font-face` 的家族名必须和 `font-family` 用的**同一个名字**，否则导出时字体不生效。
- 字体在预览里靠 `document.fonts`，在导出里靠内嵌 `@font-face`；两边都要有。
- 字体名带空格要加引号（`'优设标题黑', system-ui, sans-serif`）。
- **别把字体字节存进草稿或配置**：几兆的 base64 会让每次自动保存都卡一下。只存名字 + 文件名，打开时按文件名从 `public/fonts/` 重新取。

### 手机上卡住

窄屏是**分栏切换**（列表 ↔ 表单）。任何「清空选中项」的操作都必须同时把当前栏切回列表；**返回按钮要放在最外层**，保证任何状态都能回列表。

---

## 六、批量搬迁（清单式 Action）

机械改动（一批改名 / 挪位置 / 全站同一个字符串替换 / 删几个文件）**不用一个个文件去改** —— 交给 `.github/workflows/reorg.yml`，**清单写在仓库根的 `reorg-list.txt`**（工作流本身常驻，改清单不用碰它）。

**清单文件（`reorg-list.txt`）四段**（每段开头一行 `== 段名 ==`）：

| 段 | 格式 |
|---|---|
| `MOVES` | 一行一条：`旧路径 -> 新路径` |
| `EDITS` | 一条一个块：`### 文件路径`，然后 `<<<<` 原文 `>>>>`，再 `<<<<` 新文 `>>>>`（原文可多行，逐字查找，找不到就中止） |
| `DELETES` | 一行一个路径（文件或目录都行） |
| `CHECKS` | 一行一条命令，非 0 即中止（失败会打印该命令的输出） |

- **多行块必须用 python 解析**：bash 的 `while read` 是按行读的，会把多行块拆成一堆假清单（第一版就这么栽的，清单里已经写着这句）。
- **行首 `###` 只在标记区外当头**：原文 / 新文里出现行首 `###`（比如改文档里的小标题）不会被切错。
- **取数省成本（给 AI）**：开工先读这份 AGENTS 与清单文件，别现场探索；抓文件只抓要改的那几行、一次打印不超过 60 行；不打印整文件 diff；本地验证**最多一次**且只跑「原文唯一 + 自检」；**不要把自己上一轮给过的文件再读回来**。
- **跑法**：改 `reorg-list.txt` → 提交（一次提交）→ `Actions` → 左侧 `Reorg` → `Run workflow`（从 `main` 跑，清单名会变成分支名 `reorg-<名字>`）→ 日志里那段 `git status --short` 就是这次动了哪些文件。
- **验收**：`https://github.com/GRILLED-TIGER-FISH-LW/<仓库>/compare/main...reorg-<名字>` → 开 PR → Merge → 删临时分支。GitHub 推的分支在手机上看不到「recent pushes」横幅，直接用这条链接。
- **顺序铁律**：`EDITS` → `DELETES` → `CHECKS` → 构建 → 才提交推送。所以「先改代码、再删它读的文件」在一个清单里是安全的。
- **铁律**：只推 `reorg-<名字>` 分支，**永远不碰 main**；任一步失败都不推；替换找不到原文就中止；**原文在同一文件里出现不止一次也中止**（否则 `str.replace` 会顺手改掉别处）；自检失败就中止。
- **跨仓库复用**：文件可以照抄，但 **`workflow_dispatch` 只能触发默认分支上已有的 workflow**，所以得先在那个仓库的默认分支上把它建出来。
- **只适合机械改动**：真正要重写的东西（比如把旧工具搬进 SPA）不适用 —— 那种要反复改、反复看效果。

---

## 七、待办 / 下一步

### 当前状态（每批合并后更新；下一轮开工先读这段，别去现场探索）

- **最后合并**：`dict-ep` —— 图片字典编辑器全量回归 EP：搜索 / 页签 / 筛选（`el-input` + 两个 `el-segmented`）、5 个 `el-button`、列表 `el-image`（带预览）+ `el-tag` + `el-empty` + `v-loading`、详情 `el-input-number`（序号、星级）、`el-input`、`el-checkbox`；确认改 `ElMessageBox`，两个自造 `Modal` 改 `el-dialog`；`SyncReport` 内部改 `el-dialog` + `el-collapse`；`useToast` 内部换 `ElMessage` 并删掉 `ToastHost`（30+ 个调用点一行没改）。同时修「地址框看不出当前值 / 内容一更新就弹回列表」：框里显示已保存的值（只有代号时按源拼出完整链接），新增 `reselect(row)` 在代号变化后把选中带过去。旅行者头像改名 `旅行者.webp`，字典键 `Traveler` → `旅行者`（`FORCED_LOCAL` 同步，否则会多出一条）。
- **上一批**：`bg-fix` —— 「控件跟所在的面同色」：`el-segmented` 的垫色改回卡片色 `--color-surface`（= 所在 `el-card` 大框的底：白天亮米白、夜里浅黑灰）并补一条和卡片一样的 1px 描边；选中项回到 EP 默认（`primary` 实心 + 白字），与「小字号 / 大字号」那组单选框一致。`el-slider` 轨道改用 `--el-border-color`（= 文本框边框那条）。顺手清掉 `app.css` 里所有 `color-mix`（老浏览器无效值 —— 暗色下 `--el-border-color` 因此坏掉，整套输入框没有边框）与过期的 `--el-color-primary-rgb`（还是旧强调色 `204, 120, 92`）。
- **上一批**：`palette-fix` —— 令牌对齐 Claude 官方七色：`accent` 由手调的 `#cc785c` 换成 Orange `#d97757`（`accent-soft` 12% → 16%）、`success` 换 Green `#788c5d`、新增 `info` Blue `#6a9bcc`；中性色改成「两个纯色之间对半混」（`canvas` = Light+Light Gray、`surface-2`/`sunken`/`line` = Light Gray、`line-2` = Light Gray+Mid Gray），暗色 `canvas` → Dark `#141413`、`sunken` → `#302d27`；删掉调色板外的 `accent-teal` / `accent-amber`。**选中态统一成 accent-soft 垫色 + accent-strong 文字**（抽屉菜单加左侧 2px 竖条），修「选中项看着发灰」；`el-segmented` 轨道用 sunken、选中项用 accent-soft。
- **上一批**：`fill-fix4` —— 凹槽类表面统一复用 `--color-sunken`（暗色值 `#1f1e1b`→`#2f2b24`；原来与卡片同值，滑块轨道 / segmented 选中项 / hover / collapse 底在夜里全看不见），删掉上一批新造的 `--color-well(-strong)`；`el-slider` / `el-segmented` 的变量直接盖在组件上。视频封面 7 个滑块弃用 `show-input`，改「拖动条 + `el-input-number` 88px + 单位文字」。
- **上一批**：`home-unify` —— 首页与两个封面工具回归 EP。首页：卡片固定 132px（标题/描述各最多两行，描述统一压到 12 个汉字以内、一句话说清用途）、顶栏 `el-button circle`、抽屉回默认头部、暗色三件套（`dark/css-vars.css` + `useTheme` 与 `index.html` 首帧同时切 `html.dark`）、全站 `line-3` 改 `line-2`（令牌不存在，类不生成）。合集封面 + 视频封面的自造控件全部换 EP；修合集封面「模糊背景画布比目标大 2×pad，模糊核边界外透明 → 整张画进去就透边」与「缓存存裸 canvas → 导出 drawImage 报参数类型错」。
- **EP 无对应物、故意自造（别再硬套）**：①背景图缩略图 `<button>`（显示用户上传的图，`el-button` 没有图片内容形态）；②`PreviewFrame`（16:9 深底容器 + 工具栏点空白淡出）；③底部悬浮定位层（`el-affix` 是滚动固钉，不解决居中 + 安全区）；④隐藏 `<input type="file">`（`el-upload` 功能过剩）。
- **首页卡片规则（两个仓库一致）**：半栏由 `el-col :span="12"` 定；水平间距用 `:gutter="12"`（只吃 number，写数组会变 NaN），垂直间距补 `row-gap`；卡片固定 132px，标题与描述各 `line-clamp: 2`；描述不超过 12 个汉字。
- **滑块**：不用 `el-slider` 的 `show-input`（它的数字框宽度被 EP 写死在 130px 里，也塞不进单位）。一律「`el-slider class="min-w-0 flex-1"` + `el-input-number style="width: 88px" size="small" controls-position="right"` + 单位 `<el-text class="shrink-0">`」三项一行，两个控件绑同一个值；标签里不写单位，单位单独显示。
- **样式底座**：`tokens.css` / `base.css` / `app.css` 已与冒险之证线上逐字节对齐（`tokens.css` 含全套字号 `--text-body-sm` 等、控件尺寸 `--spacing-icon-btn`；`app.css` 含 EP 主题映射与 `html.dark` 暗色）。改样式先对齐这两个仓库，别只改一边。
- **字典编辑器的约定**：地址框里显示的**就是这一格已保存的值**（手填地址原样；只有代号就按源拼出完整地址），所以刷新后框里照样有内容；缩略图永远按**已保存的值**算（`slotSrc`），不跟正在输入的草稿走 —— 打字时图不会乱跳。代号 / 序号一变必须 `reselect(row)` 把选中挪过去，否则详情栏的 `v-if` 会把正在编辑的界面关掉（表现就是「改着改着弹回列表」）。列表行仍是原生 `<button>`（EP 没有「可选中行」这种组件），其余全部 EP。
- **字典约定**：`public/shared/image-dict.js` 里，武器 / 圣遗物的键是**编号**（只用于内部防重与排序），真实代号在条目的 `key` 字段；角色恰好键就是代号。拼图地址、匹配都按 `name` 与 `key` 走，绝不能拿键当代号。
- **三个 md 的更新约定**：每批 reorg 合并后按需更新 `AGENTS.md`（最后合并 / 约定）、`README.md`（用户可见的功能说明）、`CHANGELOG.md`；`CHANGELOG` 一天只保留一条，同一天多次改动合并进同一条，与冒险之证一致。
- **图标分工**：功能图标用 Element Plus、内容标识图标用 Solar（`src/icons/solar.js` 登记，linear 常规、bold 选中/强调），不混用。
- **已定未做**：`public/tools/` 三个 iframe 旧工具（图片处理 7 个子功能、图表、角色梯队）；图片处理要等用户定「留哪几个」，搬进 SPA 时一并改它们的删除按钮样式。
- **跨仓库**：`adventurer-handbook` 按绝对 URL 读本仓库 `public/shared/image-dict.js`（4 个页面、各两处）；它那边不要 `order === 1` 的旅行者一家，过滤只留在它那 4 个页面里。
- **清单式 Action**：清单在 `reorg-list.txt`，工作流不用再动。

### 接下来这件（已定）

**图片处理工具**
接下来要搬 / 改的是它，但**不整体拆**：留几个子功能、删几个，具体留哪些待定。

### 还没搬进 SPA 的 3 个工具（按建议顺序）

| 工具 | 说明 |
|---|---|
| 图片处理 | 7 个子功能，共用父页面靠 postMessage 切；滑杆很多，`Slider` 已备好（见上面那条） |
| 图表 | 雷达图 / 柱状图 |
| 角色梯队 | 单页，最简单，可以拿来当收尾 |

搬家法（已验证）：**模板 1:1 搬、纯绘制与导出引擎留在 `src/lib/`、碰 DOM 的那部分换成共享控件**（旧 `app.js` 里 `bindEvents` / `syncInputsFromState` / `renderXxx` / `injectIcons` / `showToast` / `showConfirm` 这一大票全是废代码，直接删）。
角色一图流那批补充两条：**① 30KB 级的坐标代码留在引擎里拼字符串、`v-html` 预览**（搬进模板不划算）；**② 老界面的骨架（组头 / 收起展开 / 条目的操作按钮位置）照抄，别自己重新设计** —— 那套结构用户已经用熟了。
**③ 旧的按钮一颗都别丢**：搬之前把旧页面每个 panel 里的按钮列一遍对着打勾。一图流的「匹配样式图」就是搬家时漏掉的，2026-11-09 才补回成「从字典补素材」。**顺带看它按下去是「重算」还是「补缺」**：那颗按钮是重算（旧 `matchStyleImages()` 不带 `onlyEmpty` 一律覆盖），而 `rematchMissing` 是补缺，接错就是「改了名字再按没反应」—— 同一天又补了一批 `force`。

### 其他小事

- `src/lib/assets.js` 已是资源层正本；`videoCover.js` / `collectionCover.js` 里还各留一份 `loadImage` / `urlToDataURL` / `download`（第三个用它的工具出现时抽过来的），下次动那两个文件时删掉、改从这里 import。
- `adventurer-handbook` 的 `Btn.vue` 还缺 `lg` / `float` / `float-danger` 三档 —— 那边现在没有预览框、也没有底部悬浮主操作，用不到；等哪页真用上再同步。`tokens.css` 要求两仓库逐字节相同，改动一律两边同时改（`--color-preview` 与同步日期已于 2026-11-08 对齐）。
- `ToastHost` 的 `role="status"` + `aria-live="assertive"` 两仓库保持一致，知道不规范但故意保留。
- **合集封面同款隐患（没改）**：它的草稿是一次次把字体的几兆 base64 写进 IDB（改个标题就写几兆），字体装不上时也是静默回默认。哪天动 `CollectionCover.vue` 时照视频封面这批改：草稿不带 `fontData` + `ensureFont()` 式的重取。

### 字典编辑器：怪物不匹配源（2026-11-15）

- **识别码**：角色 = 代号；圣遗物 / 武器 / 怪物 = **ID**（怪物同一个图标代号常被好几条共用，按代号归并会选错行）。
- **怪物不做源匹配**：同步时整个分类跳过（不拉源、不合并），本地行原样保留；加怪物时连源都不查，直接按链接 / 代号建一行。
- **改序号必须连身份一起挪**：`identOf` 对非角色就是**序号**，改序号等于改行的身份；凡是「按身份找行」的 computed（`activeRow`）都会因此找不到行，详情栏被 `v-if` 关掉，看着像「跳回列表」。修法：`setOrder` 里改之前先记 `oldIdent`，改完 `if (activeKey.value === oldIdent) activeKey.value = identOf(tab.value, row)`。
- **链接只存代号**：粘贴的链接只要能提出代号（`codeFrom`），就只存 key、清空 url；**`alt` 只由界面上的「备用源」勾控制**，不要根据链接来自哪个源去设 —— 出图默认主源优先，主源没有时缩略图靠 `data-alt` 自动回退。仓库图链接（`repoUrl`）整条留 URL。
- **新增后要选中新行**：`activeKey` 跟着 `identOf` 走，否则用户得再点一次才能编辑。

### 协作约定（2026-11-15）

- **给 reorg 清单前先对齐 main 的当前 SHA**：清单里的「原文」必须和 main 当前内容逐字一致，否则工作流报「没找到原文」、整批作废。
- **沙箱命令**：每条都要套 `timeout`，输出控制在 90 行以内。网络抓取超时会返回 HTML 错误页，调用方拿它当 JSON 解析会报 `Unexpected JSON token`。**超时规则：默认 30 秒，硬杀。**
- **清单里不要改 reorg-list.txt 自己**：EDITS 的原文 / 新文里带 `== MOVES ==` 这种段落标记行时，解析器会把它当成段落结尾、把 EDITS 段截断（这次就是这么错的）。要改清单开头，直接网页端手粘那几行备注。

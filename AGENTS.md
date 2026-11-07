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

---

## 三、当前架构

单一 Vue 单页应用，**唯一的例外是还没搬过来的 4 个旧工具**（iframe 常驻托管）。

    ├── index.html              入口：内联主题预置 + 加载守卫 + 旧 hash 归一
    ├── src/
    │   ├── main.js router.js App.vue
    │   ├── styles/             tokens.css（令牌唯一真源）· base.css · app.css
    │   ├── components/         通用控件
    │   ├── composables/        useTheme · useToast · useData · useIconDict
    │   ├── lib/                纯绘制 / 导出 / 存档引擎（不碰界面）
    │   └── views/              Home · IconEditor · VideoCover · CollectionCover
    └── public/                 整目录照搬进 dist（不走打包）
        ├── shared/             UI 图标库 + 图片字典 / 加载器 —— 真共享，只有这两样
        ├── tools/              旧工具页；character/css/ 是「角色一图流」自己的样式
        ├── data/               4 个纯文本数据字典（待退休）
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

- `adventurer-handbook` → 绝对 URL 读本仓库的 `public/shared/gi-icons/icon-dict.js`（**图片字典**：角色头像 / 名片 / 立绘 + 圣遗物 / 武器 / 怪物）。文件名与内容已经不太相符，改名见待办。
- **反向禁止**：本仓库不依赖 `adventurer-handbook`；图标一律来自本仓库自己的 `public/shared/ui-icons.js`。

---

## 四、实现约定

### 共享层（改这些要两个仓库一起改）

| 文件 | 说明 |
|---|---|
| `src/styles/tokens.css` | 令牌唯一真源，**与另一仓库逐字节相同** |
| `src/components/Btn.vue` | 档位 `sm/md/lg`；变体 `primary/secondary/ghost/danger/float`；纯图标用 `square` + **`#icon` 具名插槽** |
| `src/components/{Field,Dropdown,Seg,Radios,Slider,Modal,Icon}` | 表单与控件 |
| `src/components/{PreviewFrame,DockCta}` | 工具页外壳：预览框（16:9 + 右上角浮动工具栏 + 点一下淡出）、底部悬浮主操作 |
| `src/components/{AppNav,AppDrawer,FrameLayer,ToastHost,SyncReport}` | 应用外壳 |
| `src/lib/fonts.js` | 字体：清单 / 取字节 / 装进文档 / 导出用的 `@font-face` 文本 |
| `public/shared/gi-icons/icon-loader.js` | 图标加载器：`getPath` / `match` / `load` / `openPicker`。**两个仓库都在读** |

**先看有没有现成的**：控件一律用共享层，不新写本地样式、不用浏览器原生外观。

### 令牌与几何

- 颜色、圆角、阴影、缓动都在 `tokens.css` 的 `@theme` 里，**改颜色只改这一个文件**（并同步另一仓库）。
- 色板取 Claude（`#f5f0e8` 底 / `#141413` 字 / `#cc785c` 强调），几何取 Notion（控件 8px 矩形、卡片 12px、**胶囊只给页签和徽章**）。
- 深色模式**靠变量覆盖**（`[data-theme="dark"]`），不用 `dark:` 前缀。
- 颜色一律走令牌（`bg-surface-2` / `border-line-3` / `shadow-float`…），不写裸 hex。

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
| 从外面用 `!` 覆盖组件档位 | 优先给共享组件加档位（如 `Btn` 的 `lg`） |

### 状态与文案

- 状态类：`.is-active` / `.is-open` / `.is-visible` / `.hidden`。
- **业务状态不要用 `.hidden`**（撞全局硬隐藏），用 `.is-biz-hidden` 这类独立名字。
- **UI 文案不写具体数字**，除非它来自数据。

### 加载与数据

- **所有动态资源走时间戳**（`?t=`），路径一律 `import.meta.env.BASE_URL + 'shared/…'`。
  工具页时代那种 `../../shared/` 在 SPA 里会跑到域名根外面，必须换掉。
  （没搬的旧工具页仍写着 `../../shared/`，由 `vite.config.js` 里的插件在构建时改写成带仓库前缀的 `shared/`。）
- 图标走**构建期虚拟模块**，运行时不再加载图标脚本：
  - `virtual:gg-icons` ← `public/shared/ui-icons.js`（只收值是 `<svg` 开头的条目，剥掉外层 `<svg>`，键名 `组.名字`，如 `ui.trash`）
  - `virtual:gg-icon-lib` ← `public/shared/gi-icons/icon-loader.js`（只取 `STAR_COLORS`；它在加载时会摸 `document`，插件里给了 `DOC_STUB` 垫片）
- **唯一允许的运行时全局**：Boss 图标要用的 `window.ICON_LIB.fromName(...)`，走 `useData.js` 的 `loadGlobalScript()` 载入图片字典。**这个 `window` 只出现在 `src/lib/` 里，不外溢**。
- 本地草稿一律 IndexedDB，**库名 / 表名 / 键名不能改**：`video_cover_db` / `state` / `video_state`、`collection_state`、`icon_dict_editor_v4`。

### 图片字典的数据模型（`public/shared/gi-icons/icon-dict.js`）

- **地址 = 规则 + 代号**。`config[分类]` 放两组源规则：主源（lunaris）用 `prefix` / `ext`，备用源（Amber）在同级的 `alt`。条目 key 是**代号**（`Ambor` / `10001_4` / `Sword_Blunt`），不是图标全名。
- 条目字段：`name` / `order` / `star` / `url` / `alt` / `lock` / `card` / `art`。
  - `url`：直接用它（**只在源拼不出来时才写**，比如仓库里的图、官网那一串）；`alt: true`：这一格改用备用源那组规则（lunaris 图不对时用，如夏洛蒂）。
  - `card` / `art` 是槽位对象（`{ key, url, alt }`）；`key` 是那一格的代号 —— 头像代号和名片代号**可以不一样**（绮良良：Momoka / Kirara）。
  - `lock: true`：这一条同步整条不碰。**其余情况下同步按槽位算**：头像槽 / 名片槽带 `url` 或 `alt` 就留用户的，名字 / 星级 / 序号永远跟源走。
- **导出格式逐字不能变**（两个仓库都在读）；老格式（全名 key、`local: true`）载入时会被自动归一，`icon-loader.js` 也留着兼容分支。
- 星级底色等渐变算法必须与 `icon-loader.js` 的 `applyBackground` 一致。

### 绘制与导出

- 预览用**模板里那份真正的 `<svg>`**，导出时克隆同一份节点、把远程图烘成 data URL 再栅格化 —— 预览与导出共用一份结构，不要再写「导出专用」的第二个分支。
- 导出前必须把图片洗成 `dataURL`，否则跨域图会丢。
- 导出的 SVG 是**独立文档**，摸不到页面的 `document.fonts`，所以 `@font-face` 必须内嵌（只在导出的那一瞬间挂上，避免预览把字体解析两遍）。
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

- 同一元素上**两个同属性 utility**（如 `bg-surface` 和 `bg-surface-2`），谁赢取决于 Tailwind 生成 CSS 的顺序，**不是模板里的顺序**。修法：让它们互斥，写进同一个条件。
- **组件根节点自带 `w-full` 的**（`Dropdown`），从外面塞宽度类会打架 → 套一层定宽容器。
- 手写 CSS 里直接写 `var(--color-x)` 而没有 utility 用到它 → Tailwind **不会输出这个变量**。
- 整页横向溢出、要左右拖 → 容器是 grid 却没写列，隐式轨道被 `flex-wrap` 的 max-content 撑开。**加 `grid-cols-1`**。

### 点了没反应 / 全站都点不动

`FrameLayer` 那层空的全屏容器盖住了路由视图还收事件 → 它的根节点必须 `pointer-events-none`，只有真正显示的那一帧和按钮是 `auto`。

### 图标不显示 / 缺几条线

- key 是**驼峰**（`ui.chevronDown`），且要带组名（`ui.` / `nav.` / `app.`）。
- 箭头类要用 `bold`（实心），其他按钮用默认线框。
- 组名分不清时，去 `public/shared/ui-icons.js` 里核对该键在哪一组。
- **取不到名字不会报错，只会渲染成空白** —— 空白图标先怀疑名字写错（`ui.link` 这种就不存在）。
- 用 `<Icon>` 时颜色靠 `class="text-danger"` 之类传进去，它会并进根节点的类里（只含尺寸与 `shrink-0`，不会打架）。

### 字体不生效

- SVG 里 `@font-face` 的家族名必须和 `font-family` 用的**同一个名字**，否则导出时字体不生效。
- 字体在预览里靠 `document.fonts`，在导出里靠内嵌 `@font-face`；两边都要有。
- 字体名带空格要加引号（`'优设标题黑', system-ui, sans-serif`）。

### 手机上卡住

窄屏是**分栏切换**（列表 ↔ 表单）。任何「清空选中项」的操作都必须同时把当前栏切回列表；**返回按钮要放在最外层**，保证任何状态都能回列表。

---

## 六、批量搬迁（临时 Action）

机械改动（一批改名 / 挪位置 / 全站同一个字符串替换 / 删几个文件）**不用一个个文件去改** —— 交给 `.github/workflows/reorg.yml`（模板，清单直接写在文件里）；哪天不想留它也直接删，按下面几条重写就行。

- **清单区（文件顶部）**：① `MOVES` 每行「旧路径 -> 新路径」② `EDITS` 每行「文件 ||| 原文 ||| 新文」③ `DELETES` 每行一个路径。整行以 `#` 开头的是注释。
- **跑法**：改清单 → 提交（一次提交）→ `Actions` → 左侧 `Reorg` → `Run workflow`（从 `main` 跑，输入分支名）→ 日志里那段 `git status --short` 就是这次动了哪些文件。
- **验收**：`https://github.com/GRILLED-TIGER-FISH-LW/<仓库>/compare/main...reorg/<分支名>` → 开 PR → Merge → 删临时分支。GitHub 推的分支在手机上看不到「recent pushes」横幅，直接用这条链接。
- **铁律**：只推 `reorg/<名字>` 分支，**永远不碰 main**；构建不过不推；替换前先 `grep -qF` 确认原文存在，找不到就 `exit 1`（宁可失败，不可误删）；删文件前先 `grep -rl` 确认全仓没人引用。
- **跨仓库复用**：文件可以照抄，但 **`workflow_dispatch` 只能触发默认分支上已有的 workflow**，所以得先在那个仓库的默认分支上把它建出来。
- **只适合机械改动**：真正要重写的东西（比如把旧工具搬进 SPA）不适用 —— 那种要反复改、反复看效果。

---

## 七、待办 / 下一步

### 接下来这三件（已定）

1. **四个 txt 退休，两个仓库都只读字典**
   本仓库 `videoCover.js` 的 `loadData()` 还在读 `characters.txt` / `character-art.txt` / `namecards.txt`（+ 与本事无关的 `logos.txt`）；编辑器也还在读前两个。改法：封面改成从字典取序号 / 立绘 / 名片，编辑器删掉 `CHARS_SRC` / `PORTRAIT_SRC` 与 `fetchPortraits()`、同步里那段立绘导入——**代码块和 txt 要一起删**，否则每次同步都弹「立绘对照没读到」。同时**白名单取消**（旅行者已经是字典里的独立条目，同步可以直接收 API 的全部角色）。删完 `public/data/` 只留 `logos.txt`。
2. **字典改名**
   它已经是「原神图片通用字典」，再叫图标字典不合适。要一起动的：文件名 `public/shared/gi-icons/icon-dict.js`（建议挪出 `gi-icons/` —— 那个目录本该只放仓库里的图），全局变量 `window.ICON_DICT` / `window.ICON_LIB`，虚拟模块 `virtual:gg-icon-lib`，编辑器页面 / 路由 / 抽屉 / README 里所有「图标字典」字样。**注意跨仓库**：`adventurer-handbook` 是按绝对 URL 读这个文件的，改名会 404，两个仓库必须同一批改完。
3. **图片处理工具**
   接下来要搬 / 改的是它，但**不整体拆**：留几个子功能、删几个，具体留哪些待定。

### 还没搬进 SPA 的 4 个工具（按建议顺序）

| 工具 | 说明 |
|---|---|
| 角色一图流 | 最大的一块（`public/tools/character/`，已有 consts / svg / app 三层） |
| 图片处理 | 7 个子功能，共用父页面靠 postMessage 切；滑杆很多，`Slider` 已备好（见上面第 3 条） |
| 图表 | 雷达图 / 柱状图 |
| 角色梯队 | 单页，最简单，可以拿来当收尾 |

搬家法（已验证）：**模板 1:1 搬、纯绘制与导出引擎留在 `src/lib/`、碰 DOM 的那部分换成共享控件**（旧 `app.js` 里 `bindEvents` / `syncInputsFromState` / `renderXxx` / `injectIcons` / `showToast` / `showConfirm` 这一大票全是废代码，直接删）。

### 其他小事

- `src/lib/` 里 `loadImage` / `urlToDataURL` / `download` 在 `videoCover.js` 和 `collectionCover.js` 各有一份 —— **第三个要用它们的工具出现时**抽到 `src/lib/assets.js`。
- `Btn.vue` 的 `lg` / `float` 是新加的档位，**记得同步到 `adventurer-handbook`**。
- `ToastHost` 的 `role="status"` + `aria-live="assertive"` 两仓库保持一致，知道不规范但故意保留。

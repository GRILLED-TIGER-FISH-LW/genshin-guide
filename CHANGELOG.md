# 更新记录

按时间倒序排列（最新在最上）。

**归档规则**（随时间自动粗化，避免文件无限膨胀）：

| 范围 | 粒度 |
|---|---|
| 当前月份 | 按天，一天一条（同一天做的几件事合成一条） |
| 之前的月份 | 合并成一条「月记录」 |
| 之前的年份 | 合并成一条「年记录」 |
| 更早 | 以此类推 |

> 当前是 2026 年 11 月，所以 11 月按天记；**11 月一结束，这些条目就会合并成一条「2026 年 11 月」**。10 月及更早已按此规则压缩完毕。

**每条格式**：起因 → 经过 → 结果。只记里程碑，不写过程细节。

---

## 2026 年 11 月

### 2026-11-08 · 角色一图流搬进 SPA；四张 txt 退休，图标字典改名「图片字典」

- **起因**：角色一图流是最后一块「旧界面」大工具（`public/tools/character/`，consts / svg / app 三层，`app.js` 74KB）；它的数据还分散在 `characters.txt` / `character-art.txt` / `namecards.txt` 三张文本表里，与图片字典两套并存 —— 表现就是「旅行者·冰」这类分元素角色在视频封面里只有立绘，编号与名片是空的。
- **经过**：卡片按旧版骨架 1:1 复刻进 Vue（九个分区、组头可收起展开、散搭左右并排、备选左缩进竖线、缩略图 40px 对齐输入框）；坐标与配色进 `guideConsts.js`，绘制引擎原样进 `guideChart.js`（拼字符串 + `v-html`，改动量最小），草稿 / 在线存档 / 从字典补齐素材进 `guideStore.js`，资源层抽成 `assets.js`（图片尺寸 / 远程图转 dataURL / 存文件 / SVG→PNG）；封面工具的 `loadData()` 与字典编辑器的序号表、立绘清单改成现算自字典，三张 txt 与 `public/tools/character/` 一并删除。全程用清单式临时 Action 在手机上完成。同一批还顺手把字典改名：它已经不只管图标，`icon-dict.js` / `icon-loader.js` 从 `shared/gi-icons/` 挪到 `shared/` 叫 `image-dict.js` / `image-loader.js`，全局变量与虚拟模块跟着叫 `IMAGE_DICT` / `IMAGE_LIB` / `virtual:gg-image-lib`，页面、路由（`#/image-dict`）与全站文案改成「图片字典」；另一个仓库那 4 处读法同批改完，两边名字才对齐。
- **结果**：字典成为角色数据的唯一真源，`public/data/` 只剩 `logos.txt`；卡片支持自动草稿、载入仓库存档、字体选择、导出 3840×2160 PNG；「旅行者·冰」这类角色的编号与名片不再缺；站点只剩 3 个 iframe 旧工具；`shared/` 里只剩 `ui-icons.js` 与改名后的图片字典 / 加载器，`gi-icons/` 这个只放代码的目录消失。

### 2026-11-07 · 字典扩成「原神图片通用字典」，仓库目录跟着归位

- **起因**：两件事同一天做完。① 字典里只有角色头像 key 与星级 / 序号，名片得手工填，三张 txt 各管一段数据，字典当不了唯一真源；两个源站又各有毛病（lunaris 更新快但个别图是错的、Amber 慢但更准）。② 迁到 Vite 之后 `public/` 还是老结构（`shared/data`、`shared/fonts`、`shared/assets`、`shared/css`），`src/components/` 里还留着两个没人引用的死组件，文档里的路径与目录树也是迁移前的。
- **经过**：① 角色行扩成三个槽位（头像 / 名片 / 立绘），key 从图标全名改成代号（`UI_AvatarIcon_Ambor` → `Ambor`），地址改由 `config[分类].prefix + 代号 + ext` 拼；四个分类各配主源 + 备用源两组规则，某一格图不对就在那一格记 `alt: true`，字典里不再写死链接；名片归属按「接口自带 → 英文名 → 中文名 → 代号同名」四级查；编辑器同步改成宽屏双栏 / 窄屏子页，加「缺名片 / 缺立绘」筛选与代号冲突弹窗。② 分四批纯机械整理：数据字典 → `public/data/`、字体 → `public/fonts/`、素材 → `public/images/`、存档 → `public/saves/`；一图流自己的 10 个样式文件跟着唯一使用者进 `public/tools/character/css/`；删掉没人引用的 `Tabs.vue` 与 `Combobox.vue`；README / AGENTS 的目录树与路径重写。两件事都靠临时 GitHub Action（清单式 `git mv` + 精确替换 + 构建门槛，只推分支）在手机上完成。
- **结果**：字典成为图片的唯一真源（角色 125 条，含「旅行者·冰」独立条目），导出格式换代、两个消费方靠 loader 兼容老格式；`public/shared/` 只剩真正共享的两样，目录名与内容一一对应；顺手修掉「名片永远填不进去」与「粘链接被吞掉」两个 bug。剩下的 txt 退休 / 字典改名 / 图片处理取舍记进 AGENTS.md 待办。

### 2026-11-06 · 封面制作两个子工具搬进 SPA

- **起因**：视频封面与合集封面还是「独立 HTML + 自己的 CSS/JS」，和 SPA 是两套东西；之前只有图标字典编辑器搬过，这次要验证「带绘制引擎的工具怎么搬」。
- **经过**：两个工具各拆成「纯绘制 / 导出引擎（`src/lib/`）+ Vue 页面（`src/views/`）」；预览从「拼 SVG 字符串」改成模板里那份真正的 `<svg>`，导出改为克隆同一份节点、把远程图烘成 data URL 再栅格化；共享层补了 `Slider` / `PreviewFrame` / `DockCta` / `Radios` 和 `lib/fonts.js`；`tools/video-cover/` 整个删除。中途踩了 Pages 部署队列互撞（60 秒内连推三次提交），靠重置 Pages 源解决，与代码无关。
- **结果**：预览与导出共用同一份结构，不再有「同一张图画两遍」的分支；旧草稿与旧配置 JSON 原样兼容（IndexedDB 键名和字段名没动）；三个工具共用同一套控件与预览框。

### 2026-11-05 · 迁移到 Vite + Vue 3（骨架 + 图标字典编辑器）

- **起因**：原架构是「原生 JS + HTML + iframe」，设计系统分散在 `shared/css/` 各文件里，改一次样式要到处排查；目标是和 `adventurer-handbook` 同形，好一起维护。
- **经过**：整站重建成 Vite + Vue 3 + vue-router(hash) + Tailwind 4；设计系统换成 `src/styles/tokens.css`（色板 Claude、几何 Notion，与另一仓库逐字节相同）；落地通用控件层；图标字典编辑器整页搬进 SPA 并删除 `tools/icon-editor/`；图标改走构建期虚拟模块（`virtual:gg-icons` / `virtual:gg-icon-lib`），SPA 侧不再运行时加载图标脚本；部署源从「分支根目录」改成 GitHub Actions 产物。
- **结果**：站点从「多页 + iframe」变成单一 Vue 应用，主题不再跨 iframe 同步；老 hash 书签免费兼容；未搬的 4 个工具由 `FrameLayer` 常驻托管，切换不重载；回退方式改为 `git revert` 单条提交。

---

## 2026 年 10 月

### 2026 年 10 月 · 设计系统统一 + 角色一图流拆分

- **起因**：四个工具各自维护样式；共享 CSS 只有变量、没有控件层；主题切换会闪白；下拉面板会被祖先的 `overflow` 裁掉；图标来源与档位不统一。
- **经过**：`shared/` 拆成 1 个令牌入口 + 7 个组件层，确立刻度令牌（`--h-ctl` / `--gap-*` / `--fs-*` / `--icon-*` / `--z-*`）、状态类 `.is-*`、全站禁 `margin` 改走 `gap`；新增 `dropdown.js`（实测闭环定位）与 `theme-init.js`（首帧防闪白）；角色卡拆成 `consts.js` / `svg.js` / `app.js` 三层；所有工具页加资源加载器，外链走时间戳 URL；封面背景模糊改 Canvas 预生成；文字按钮收图标统一走 `.btn-collapse`；`tools/map-editor/` 改名 `icon-editor` 并升到 v5。
- **结果**：四个工具共用同一套设计系统，视觉一致；主题切换不闪白；下拉不再被裁；`icon-dict.js` 的导出格式与两个仓库对齐。这批约定后来整个换成了 Vue 侧的 `tokens.css` + 控件层（见 11 月）。

---

> 协作流程、环境约束、诊断套路与已知坑位见 [AGENTS.md](./AGENTS.md)。

<div align="center">

# 原神攻略工具集

> 个人自用的原神攻略图制作工具集 · 纯前端 · 本地处理 · 不收集任何数据

[![在线访问](https://img.shields.io/badge/在线访问-打开网站-9E6C47?style=flat-square&logo=googlechrome&logoColor=white)](https://grilled-tiger-fish-lw.github.io/genshin-guide/)
[![最后更新](https://img.shields.io/github/last-commit/GRILLED-TIGER-FISH-LW/genshin-guide?style=flat-square&label=最后更新&color=9E6C47&logo=github&logoColor=white)]()
[![Tech Stack](https://img.shields.io/badge/Tech-Vue%203%20%7C%20Vite%20%7C%20Tailwind-f5f0e8?style=flat-square)]()

[开始使用](#start) · [工具导航](#tools) · [数据保存](#save) · [常见问题](#faq) · [项目结构](#structure)

</div>

---

<a id="start" name="start"></a>
## 🚀 开始使用

打开站点后，首页是一张卡片网格，**点卡片进工具，左上角 ☰ 随时切换**。

**不需要登录，不需要填任何个人信息，打开就能用。不会上传任何图片，全部在你手机本地处理。**

| 你想要 | 怎么做 |
|---|---|
| 做一张角色攻略封面 | 进「封面制作 → 视频封面」，选「角色攻略」模式，第二行填角色名 |
| 做一张世界 Boss 封面 | 同上，切到「Boss攻略」模式，第一行填 Boss 名 |
| 做一张合集封面 | 进「封面制作 → 合集封面」，上传背景图 + 填标题 |
| 维护图标字典 | 进「图标字典编辑器」，一键从 Amber 同步 |
| 换手机、换浏览器 | 先导出配置 / 存档，到新设备导入（见[数据保存](#save)） |
| 夜间使用 | 点右上角图标切换深浅色 |

首次打开会自动跟随系统主题，之后按你的选择记住。

---

<a id="tools" name="tools"></a>
## 🛠️ 工具导航

| 工具 | 打开 | 状态 |
|---|---|---|
| 首页 | [打开](https://grilled-tiger-fish-lw.github.io/genshin-guide/) | — |
| 角色一图流 | [打开](https://grilled-tiger-fish-lw.github.io/genshin-guide/#/character) | 🟡 旧版界面 |
| 图标字典编辑器 | [打开](https://grilled-tiger-fish-lw.github.io/genshin-guide/#/icon-editor) | ✅ 新界面 |
| 封面制作 · 视频封面 | [打开](https://grilled-tiger-fish-lw.github.io/genshin-guide/#/video-cover/video) | ✅ 新界面 |
| 封面制作 · 合集封面 | [打开](https://grilled-tiger-fish-lw.github.io/genshin-guide/#/video-cover/collection) | ✅ 新界面 |
| 图片处理 | [打开](https://grilled-tiger-fish-lw.github.io/genshin-guide/#/image-tools) | 🟡 旧版界面 |
| 图表 | [打开](https://grilled-tiger-fish-lw.github.io/genshin-guide/#/chart) | 🟡 旧版界面 |
| 角色梯队 | [打开](https://grilled-tiger-fish-lw.github.io/genshin-guide/#/tier) | 🟡 旧版界面 |

> 老书签照旧能用（`#character` 会自动变成 `#/character`）。
> 🟡 的几个工具功能正常，只是还没搬到新界面，视觉上和别的不太一样，属于已知遗留。

---

## 🖼️ 封面制作 · 视频封面

### 三种模式

| 模式 | 做什么 | 你要填 |
|---|---|---|
| **角色攻略** | 自动配编号 + 立绘 + 名片图 | 第二行填**角色名** |
| **Boss攻略** | 自动配怪物图标 | 第一行填 **Boss 名** |
| **自定义** | 全部手填，可加浮动素材 | 主标题 / 副标题 / 标签文字 |

切模式会弹确认框 —— 因为**会清掉背景图、立绘、Boss 头像**，别误点。

### 操作

- **预览框右上角**四个按钮：参考线、导出配置、导入配置、清空。
- **点预览空白处**可以把右上角那排按钮淡出，看清整张图；再点一下回来。
- **名字要在输入框失焦（点别处）后才会去匹配**，匹配不到会弹提示。
- 立绘位置、背景亮度、背景模糊、标签文字亮度都是滑杆，**右侧数字框可以直接输入精确值**。
- 自定义模式可以加多张「浮动素材」，每张能调 X 位置 / 缩放 / 圆角，以及放在模糊层上方还是下方。

### 导出

- 底部悬浮的「导出图片」= 3840×2160 PNG。
- **字体只作用于导出的图**，导出时字体会被内嵌进图片，换设备也不会变。
- 导出文件名取「第二行 → 第一行 → 主标题」，后面跟当天日期。
- 配置可以导出成 JSON（不含字体数据，体积小），换设备时用它恢复。

---

## 🖼️ 封面制作 · 合集封面

- 2560×1440，背景图会自动模糊（模糊度 / 亮度可调），并做边缘拉伸防漏底。
- 主标题白色、副标题浅金，整块自动垂直居中；单行太长会自动缩字号。
- 右上角一个清空按钮，点预览空白处同样会淡出。
- 草稿自动保存，下次打开还在。

---

## 🔤 图标字典编辑器

- **一键同步**：从 Amber 拉最新数据，合并进本地字典。
- **硬规则**（武器非五位数 / 28 开头怪物 / 官方旅行者图）会跳过并记进「跳过」，同时清掉本地同 key 的条目；**软规则只加不删**。
- **粘贴 URL** 会自动补名字、星级、序号。
- **导出 `icon-dict.js`**：格式被两个仓库读取，改动前想清楚。
- 有未导出的改动时，导出按钮会变红提醒。

---

<a id="save" name="save"></a>
## 💾 数据保存

**全部存在你这台设备的浏览器里，不会上传到任何服务器，也不会跨设备同步。**

| 内容 | 存在哪 |
|---|---|
| 图标字典编辑器的编辑内容 | 浏览器本地存储（`icon_dict_editor_v4`） |
| 视频封面配置 | 浏览器 IndexedDB（`video_cover_db` → `video_state`） |
| 合集封面配置 | 浏览器 IndexedDB（`video_cover_db` → `collection_state`） |
| 深浅色选择 | 浏览器本地存储 |

> ⚠️ 封面的「清空」是**立即生效且不可撤销**的，里面有二次确认；清空前建议先「导出配置」备份。
> 换手机时：封面用**导出配置 JSON** 搬，图标字典用**导出 `icon-dict.js`** 搬。

---

<a id="faq" name="faq"></a>
## ❓ 常见问题

**换了大字体，导出的图里还是默认字体？**
字体要等下载完（下拉旁会显示「正在加载…」）。如果显示「字体加载失败」，重新选一次即可；也可能是那个字体文件本身有问题。

**导出的图能和预览一模一样吗？**
能。预览和导出用的是同一份画面结构，不存在「预览好导出坏」。

**封面导出的图很大？**
视频封面是 3840×2160，几千 KB 是正常的。合集封面是 2560×1440。

**我选的图片会上传吗？**
不会。图片只在你的浏览器里用 Canvas 处理，不经过任何服务器。

**为什么有几个工具长得不一样？**
那几个还没搬到新界面（见上面的🟡）。功能都是好的。

**清空缓存后草稿没了？**
会没。清空浏览器数据 = 删掉本机草稿；重要配置建议导出成 JSON 存别处。

---

<a id="structure" name="structure"></a>
## 📁 项目结构

    genshin-guide/
    ├── index.html                入口（主题预置 + 加载守卫 + 旧链接归一）
    ├── src/                      页面与控件
    │   ├── styles/               设计令牌 + 全局基线
    │   ├── components/           通用控件
    │   ├── composables/          主题 / 提示队列 / 数据加载
    │   ├── lib/                  绘制与导出引擎
    │   └── views/                页面
    └── public/                   整个目录原样搬到网站根
        ├── shared/               共享资源（UI 图标库 + 图片字典 / 加载器）
        ├── tools/                还没搬进新界面的旧工具页
        │   └── character/        角色一图流（含它自己的 css/）
        ├── data/                 纯文本数据字典
        ├── fonts/                字体库
        ├── images/               本地素材
        └── saves/characters/     角色一图流的存档

> 想改代码的话，先看 [AGENTS.md](./AGENTS.md)（协作流程、实现约定、诊断套路）和 [CHANGELOG](./CHANGELOG.md)（里程碑）。

---

## 📌 备注与致谢

- **中文名查询**：[Project Amber](https://gi.yatta.moe)
- **UI 图标**：[Fluent UI System Icons](https://yesicon.app/zh-Hans/fluent)
- **元素 / 圣遗物图标**：[iconfont · 原神图标库](https://www.iconfont.cn/collections/detail?cid=34264)（作者：SwordMasterJS）
- **favicon**：AI 生成（豆包），工具箱 + 游戏手柄图标

---

<div align="center">
  <p>个人自用，随意参考。</p>
</div>

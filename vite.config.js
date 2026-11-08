# 清单文件：给 .github/workflows/reorg.yml 读的。四段，每段开头一行 == 段名 ==。
#   MOVES    一行一条：旧路径 -> 新路径
#   EDITS    一条一个块：### 文件路径，然后 <<<< 原文 >>>>，再 <<<< 新文 >>>>（原文逐字、在该文件里唯一）
#            —— 这一段里不要写 # 注释行（会被当成文件路径）
#   DELETES  一行一个路径（文件或目录都行）
#   CHECKS   一行一条命令，非 0 即中止
# 跑法：改这个文件 → 提交 → Actions → Reorg → Run workflow（清单名 = 分支名）
#
# 这一批（traveler-element）：旅行者一家在字典里按元素分项（旅行者 / 旅行者·冰）。
#   查字典前把名字按当前元素色补成「名字·元素」，查得到就用那一项、查不到退回原名。
#   只在一图流里做（角色卡独有），封面工具与字典编辑器不动。

== MOVES ==
# 这批没有要搬的文件

== EDITS ==
### src/lib/guideStore.js
<<<<
const BASE = import.meta.env.BASE_URL
const SAVE_DIR = `${BASE}saves/characters/`
const ELEMENT_DIR = `${BASE}images/element/`
>>>>
<<<<
const BASE = import.meta.env.BASE_URL
const SAVE_DIR = `${BASE}saves/characters/`
const ELEMENT_DIR = `${BASE}images/element/`

/* 名字 + 当前元素色 → 该拿去字典里查的名字。
   旅行者一家在字典里按元素分项（旅行者 / 旅行者·冰），角色名写「旅行者」时要取
   「旅行者·冰」那一项；字典里没有这一项（岩 / 水 … 还没录）就退回原版旅行者。
   其它角色不受影响：拼出来的名字查不到，等于没拼 —— 加载器的第一遍就是逐字匹配。 */
async function dictNameWithElement(name, theme) {
  const base = String(name || '').trim()
  const element = themeToElementName(theme)
  if (!base || !element) return base
  const combo = `${base}·${element}`
  return (await dictEntry('characters', combo)) ? combo : base
}
>>>>

### src/lib/guideStore.js
<<<<
export async function fetchRepoSave(name) {
  const query = String(name || '').trim()
  if (!query) return { error: '请先填角色名' }

  const entry = await dictEntry('characters', query)
  if (!entry?.order) return { error: `字典里没有「${query}」，不确定存档编号` }

  const file = `${String(entry.order).padStart(3, '0')}.${query}.json`
>>>>
<<<<
export async function fetchRepoSave(name, theme) {
  const query = String(name || '').trim()
  if (!query) return { error: '请先填角色名' }

  /* 名字按元素补过再查；文件名用字典里的正式名 —— 旅行者·冰那份存的是
     001.旅行者·冰.json，输英文代号（Furina）也照样找得到 */
  const entry = await dictEntry('characters', await dictNameWithElement(query, theme))
  if (!entry?.order) return { error: `字典里没有「${query}」，不确定存档编号` }

  const file = `${String(entry.order).padStart(3, '0')}.${entry.name || query}.json`
>>>>

### src/lib/guideStore.js
<<<<
  const entry = await dictEntry('characters', d.charName)
>>>>
<<<<
  /* 旅行者 + 冰 → 查「旅行者·冰」：立绘 / 名片 / 头像都取分元素那一项 */
  const entry = await dictEntry('characters', await dictNameWithElement(d.charName, d.theme))
>>>>

### src/views/CharacterGuide.vue
<<<<
  const res = await fetchRepoSave(s.charName)
>>>>
<<<<
  const res = await fetchRepoSave(s.charName, s.theme)
>>>>

### CHANGELOG.md
<<<<
「载入在线存档」那条路仍是只补缺。
>>>>
<<<<
「载入在线存档」那条路仍是只补缺。**第三轮**：用户指出旅行者一家在字典里是按元素分项的（`旅行者` / `旅行者·冰`），原来只按名字查，永远是原版那一项。于是查字典前先把名字按当前元素色补成「名字·元素」，查得到就用它、查不到退回原名 —— 立绘 / 名片 / 头像与在线存档文件名都走这一套，其它角色因为拼出来的名字查不到，等于没拼。
>>>>

### CHANGELOG.md
<<<<
字典里查不到就回到占位图。
>>>>
<<<<
字典里查不到就回到占位图；旅行者按元素分项：角色名「旅行者」+ 元素冰，立绘 / 名片取「旅行者·冰」那一项，字典里没录的元素（岩 / 水 …）退回原版旅行者。
>>>>

### AGENTS.md
<<<<
- **最后合并**：`match-force` —— 「从字典补素材」走 `rematchMissing(s, true)`：**按钮 = 重算**（先清立绘 / 元素图 / 大背景与手删标记，再按名字与主题色算），**载入存档 = 只补缺**。上一批 `match-style` 把这颗按钮加回来（旧版叫「匹配样式图」）。再上一批 `danger-buttons`：全站删除按钮只剩两档 —— 表单里 `danger` + `border border-danger/30`（同页多处抽 `DEL` 常量），浮在图上用 `float-danger`。
>>>>
<<<<
- **最后合并**：`traveler-element` —— 旅行者一家按元素分项：查字典前先把名字补成「名字·元素」（`dictNameWithElement()`），查不到退回原名；一图流独有。上一批 `match-force`：「从字典补素材」走 `rematchMissing(s, true)`（**按钮 = 重算**，**载入存档 = 只补缺**）。再上一批 `match-style` 把这颗按钮加回来（旧版叫「匹配样式图」）。
>>>>

### AGENTS.md
<<<<
### 图片字典的数据模型（`public/shared/image-dict.js`）
>>>>
<<<<
### 图片字典的数据模型（`public/shared/image-dict.js`）

- **旅行者一家按元素分项**：字典里 `Traveler`（旅行者）与 `旅行者·冰` 是两条，各有自己的立绘，名片与编号相同（都是 `order: 1`）。查字典前先把名字按当前元素色补成「名字·元素」，查得到就用它、查不到退回原名 —— 加载器的第一遍本来就是逐字匹配，所以「旅行者·冰」不会被削回「旅行者」。这条**只在一图流里做**（`guideStore.js` 的 `dictNameWithElement()`：立绘 / 名片 / 头像 / 在线存档文件名都走它），封面工具与字典编辑器按名字匹配即可，队里那个旅行者也不知道什么元素。
>>>>

== DELETES ==
# 这批没有要删的文件

== CHECKS ==
grep -q 'async function dictNameWithElement' src/lib/guideStore.js
test "$(grep -c 'dictNameWithElement(' src/lib/guideStore.js)" = 3
grep -q 'entry.name || query' src/lib/guideStore.js
grep -q 'fetchRepoSave(s.charName, s.theme)' src/views/CharacterGuide.vue
grep -q '旅行者·冰' CHANGELOG.md
grep -qF '旅行者一家按元素分项' AGENTS.md
grep -qF '`traveler-element`' AGENTS.md

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

/* 同步报告 + 更新日志
 * -------------------------------------------------------------------------
 * app.js 的 syncFromAmber() 只往状态条写一行汇总，看不到「新增了哪些」。
 * 这个组件从外面把这件事补上，一行 app.js 都不改：
 *
 *   1. 点 #btnSync 时先快照 localStorage 里的字典     → 这是「同步前」
 *   2. 盯 #status 的文字，出现「同步完成」说明 app.js 已经把字典写回去了
 *   3. 再读一次 localStorage                          → 这是「同步后」
 *   4. 按 key 比对出 新增 / 改名 / 消失，写进日志并弹出来
 *
 * 本次结果与历史记录共用同一个浮层：索引 0 那条默认展开。
 *
 * shortcut: 靠 #status 的文字当完成信号、靠 localStorage 当数据源，不碰
 *           app.js 内部。等 app.js 挪进 src/lib/ 之后，改成让 syncFromAmber
 *           直接 dispatchEvent 一份报告，上面三步全部删掉。
 * ------------------------------------------------------------------------- */

const STORAGE_KEY = 'icon_dict_editor_v4' /* 与 app.js 的 STORAGE_KEY 一致，勿改 */
const LOG_KEY = 'genshin_icon_editor_sync_log_v1'
const MAX_LOG = 10
const MAX_ROWS = 30 /* 单节最多列这么多行，多了只报数量 */

const ORDER = ['characters', 'artifacts', 'weapons', 'monsters']
const LABELS = { characters: '角色', artifacts: '圣遗物', weapons: '武器', monsters: '怪物' }

const open = ref(false)
const log = ref([])
const panel = ref(null)

let armed = false
let before = null
let statusEl = null
let observer = null

/* ---------------- 读 / 写 ---------------- */
function readDict() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw).data || null
  } catch {
    return null
  }
}

function readLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveLog() {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log.value))
  } catch {
    /* 无痕模式写不进去，忽略：日志本来只是便利功能 */
  }
}

/* ---------------- 比对 ---------------- */
const cut = (arr, n) => (arr.length > n ? arr.slice(0, n) : arr)

function diffTypes(beforeData, afterData) {
  const out = {}
  for (const t of ORDER) {
    const beforeRows = beforeData?.[t] || []
    const afterRows = afterData?.[t] || []

    const seen = new Map(beforeRows.map((r) => [r.key, r]))
    const added = []
    const renamed = []

    for (const row of afterRows) {
      const old = seen.get(row.key)
      if (!old) {
        added.push({ key: row.key, name: row.name || '' })
      } else if ((old.name || '') !== (row.name || '')) {
        renamed.push({ key: row.key, from: old.name || '', to: row.name || '' })
      }
      seen.delete(row.key)
    }

    const gone = [...seen.values()].map((r) => ({ key: r.key, name: r.name || '' }))

    out[t] = {
      from: beforeRows.length,
      to: afterRows.length,
      added: cut(added, MAX_ROWS),
      addedMore: Math.max(0, added.length - MAX_ROWS),
      renamed: cut(renamed, MAX_ROWS),
      renamedMore: Math.max(0, renamed.length - MAX_ROWS),
      gone: cut(gone, MAX_ROWS),
      goneMore: Math.max(0, gone.length - MAX_ROWS),
    }
  }
  return out
}

const changedTypes = (entry) =>
  ORDER.filter((t) => {
    const k = entry.kinds?.[t]
    return k && (k.added.length || k.renamed.length || k.gone.length)
  })

function summaryOf(entry) {
  if (entry.first) return '首次载入'
  const parts = changedTypes(entry).map((t) => {
    const k = entry.kinds[t]
    const bits = []
    if (k.added.length) bits.push(`+${k.added.length}`)
    if (k.renamed.length) bits.push(`~${k.renamed.length}`)
    if (k.gone.length) bits.push(`-${k.gone.length}`)
    return `${LABELS[t]} ${bits.join(' ')}`
  })
  return parts.length ? parts.join(' · ') : '无变化'
}

function when(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* ---------------- 触发 ---------------- */
function onSyncClick() {
  armed = true
  before = readDict()
}

function onStatusChange() {
  const text = statusEl?.textContent || ''

  /* 同步失败也要解除武装，否则下次成功的同步会拿旧快照去比 */
  if (text.startsWith('同步失败')) {
    armed = false
    return
  }
  if (!armed || !text.startsWith('同步完成')) return

  armed = false
  const after = readDict()
  if (!after) return

  const entry = { at: Date.now(), first: !before, kinds: diffTypes(before, after) }
  log.value = [entry, ...log.value].slice(0, MAX_LOG)
  saveLog()

  open.value = true
  nextTick(() => panel.value?.focus())
}

function onKey(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  log.value = readLog()

  /* 同步按钮与状态条都由 app.js 那边的模板提供，这里只挂监听。
     SyncReport 在 app.js 被 import 之前就挂载了，所以我们的 click 监听
     比 app.js 的先注册、先执行 —— 快照拿到的一定是同步前的数据。 */
  document.getElementById('btnSync')?.addEventListener('click', onSyncClick)
  document.getElementById('btnSyncLog')?.addEventListener('click', () => {
    open.value = true
    nextTick(() => panel.value?.focus())
  })

  statusEl = document.getElementById('status')
  if (statusEl) {
    observer = new MutationObserver(onStatusChange)
    observer.observe(statusEl, { childList: true, characterData: true, subtree: true })
  }

  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  observer?.disconnect()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sr">
      <div
        v-if="open"
        class="fixed inset-0 z-[200] grid place-items-center bg-mask p-4"
        @mousedown.self="open = false"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sr-title"
          tabindex="-1"
          class="grid max-h-[80dvh] w-full max-w-md grid-rows-[auto_minmax(0,1fr)_auto] gap-3 rounded-panel border border-line bg-surface p-4 shadow-float focus:outline-none"
        >
          <div class="flex items-center gap-2">
            <h2 id="sr-title" class="min-w-0 flex-1 text-sm font-semibold text-ink">
              同步日志
            </h2>
            <button
              type="button"
              class="grid size-7 shrink-0 place-items-center rounded-ctl text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              aria-label="关闭"
              @click="open = false"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
                <path
                  d="M4.4 4.55a.75.75 0 0 1 1.06 0L12 11.1l6.54-6.55a.75.75 0 1 1 1.06 1.06L13.06 12.1l6.54 6.55a.75.75 0 1 1-1.06 1.06L12 13.16 5.46 19.7a.75.75 0 0 1-1.06-1.06l6.54-6.55-6.54-6.56a.75.75 0 0 1 0-1.06"
                />
              </svg>
            </button>
          </div>

          <div class="grid min-h-0 content-start gap-2 overflow-y-auto">
            <p v-if="!log.length" class="py-6 text-center text-xs text-muted">
              还没有记录。点上面的「从 Amber 同步」，这里会记下每次的变化。
            </p>

            <details
              v-for="(e, i) in log"
              :key="e.at"
              :open="i === 0"
              class="rounded-ctl border border-line bg-surface-2 p-3"
            >
              <summary class="flex cursor-pointer items-baseline gap-2 text-xs">
                <span class="shrink-0 text-muted">{{ when(e.at) }}</span>
                <span class="min-w-0 flex-1 truncate font-medium text-ink">{{ summaryOf(e) }}</span>
              </summary>

              <div class="mt-3 grid gap-3">
                <p v-if="e.first" class="text-xs leading-relaxed text-body">
                  首次载入：本地还没有字典，这次是从 Amber 拉的全量，不逐条列了。
                </p>

                <section
                  v-for="t in changedTypes(e)"
                  :key="t"
                  class="grid gap-1.5 border-t border-line pt-3 first:border-t-0 first:pt-0"
                >
                  <p class="text-xs font-medium text-ink">
                    {{ LABELS[t] }}
                    <span class="font-normal text-muted">{{ e.kinds[t].from }} → {{ e.kinds[t].to }}</span>
                  </p>

                  <template v-if="e.kinds[t].added.length">
                    <p class="text-xs text-body">新增 {{ e.kinds[t].added.length }}</p>
                    <ul class="grid gap-1 pl-3">
                      <li
                        v-for="r in e.kinds[t].added"
                        :key="'a' + r.key"
                        class="flex min-w-0 items-baseline gap-1.5 text-xs"
                      >
                        <span class="shrink-0 text-body">{{ r.name || '(未命名)' }}</span>
                        <span class="min-w-0 truncate text-muted">{{ r.key }}</span>
                      </li>
                    </ul>
                    <p v-if="e.kinds[t].addedMore" class="pl-3 text-xs text-muted">
                      …还有 {{ e.kinds[t].addedMore }} 条
                    </p>
                  </template>

                  <template v-if="e.kinds[t].renamed.length">
                    <p class="text-xs text-body">改名 {{ e.kinds[t].renamed.length }}</p>
                    <ul class="grid gap-1 pl-3">
                      <li
                        v-for="r in e.kinds[t].renamed"
                        :key="'r' + r.key"
                        class="flex min-w-0 items-baseline gap-1.5 text-xs"
                      >
                        <span class="shrink-0 text-muted line-through">{{ r.from || '(空)' }}</span>
                        <span class="shrink-0 text-muted">→</span>
                        <span class="min-w-0 truncate text-body">{{ r.to || '(空)' }}</span>
                      </li>
                    </ul>
                    <p v-if="e.kinds[t].renamedMore" class="pl-3 text-xs text-muted">
                      …还有 {{ e.kinds[t].renamedMore }} 条
                    </p>
                  </template>

                  <template v-if="e.kinds[t].gone.length">
                    <p class="text-xs text-body">消失 {{ e.kinds[t].gone.length }}</p>
                    <ul class="grid gap-1 pl-3">
                      <li
                        v-for="r in e.kinds[t].gone"
                        :key="'g' + r.key"
                        class="flex min-w-0 items-baseline gap-1.5 text-xs text-muted"
                      >
                        <span class="shrink-0">{{ r.name || '(未命名)' }}</span>
                        <span class="min-w-0 truncate">{{ r.key }}</span>
                      </li>
                    </ul>
                    <p v-if="e.kinds[t].goneMore" class="pl-3 text-xs text-muted">
                      …还有 {{ e.kinds[t].goneMore }} 条
                    </p>
                  </template>
                </section>

                <p v-if="!e.first && !changedTypes(e).length" class="text-xs text-muted">
                  这次没有任何变化。
                </p>
              </div>
            </details>
          </div>

          <div class="flex justify-end">
            <button
              type="button"
              class="grid h-9 shrink-0 place-items-center rounded-ctl border border-line-2 bg-surface px-4 text-sm font-medium text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              @click="open = false"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sr-enter-active,
.sr-leave-active {
  transition: opacity 160ms var(--ease-spring);
}
.sr-enter-from,
.sr-leave-to {
  opacity: 0;
}
</style>

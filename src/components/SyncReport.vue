<script setup>
import { ref } from 'vue'

/* 同步报告 / 更新日志 —— 纯展示组件，数据从 useImageDict 来。
   外壳走 EP 的 el-dialog（Esc 关闭、焦点、遮罩都由它处理），
   每一次同步是一条 el-collapse-item，默认展开最近那次。
   syncFromAmber() 直接算出 diff，所以旧版那套「从外面猜」的探测全部删掉了。 */

const open = defineModel({ type: Boolean, default: false })

defineProps({
  /* [{ at, first, kinds }, …]，索引 0 是最近一次，默认展开 */
  log: { type: Array, default: () => [] },
})

const TYPES = ['characters', 'artifacts', 'weapons', 'monsters']
const LABELS = { characters: '角色', artifacts: '圣遗物', weapons: '武器', monsters: '怪物' }

/* 默认展开第 0 条（最近一次） */
const opened = ref([0])

function changedTypes(entry) {
  return TYPES.filter((t) => {
    const k = entry.kinds?.[t]
    return k && (k.added.length || k.renamed.length || k.gone.length)
  })
}

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
</script>

<template>
  <el-dialog v-model="open" title="同步日志" width="92%" align-center>
    <el-empty v-if="!log.length" description="还没有记录。点上面的「从源匹配」，这里会记下每次的变化。" />

    <el-collapse v-else v-model="opened">
      <el-collapse-item v-for="(e, i) in log" :key="e.at" :name="i">
        <template #title>
          <span class="flex min-w-0 items-baseline gap-2 text-xs">
            <span class="shrink-0 text-muted">{{ when(e.at) }}</span>
            <span class="min-w-0 flex-1 truncate font-medium text-ink">{{ summaryOf(e) }}</span>
          </span>
        </template>

        <div class="grid gap-3">
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
      </el-collapse-item>
    </el-collapse>

    <template #footer>
      <el-button @click="open = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

import { createRouter, createWebHashHistory } from 'vue-router'
import Home from './views/Home.vue'

/* =========================================================================
 * 工具清单 —— 唯一真源。
 * 首页卡片、侧栏菜单、顶栏标题、iframe 地址，全部从这里推出来。
 *
 *   key        路由片段（就是旧 hash 名，老书签因此原样可用）
 *   label      工具名
 *   icon       本仓库 shared/ui-icons.js 里的键
 *   frame      工具自己的页面（相对仓库根；构建后由 cp 原样进 dist）
 *   component  已搬进 SPA 的工具：直接用真组件，不再走 iframe
 *   subtools   子工具；带 frame 的各自一个页面，不带的共用父页面（靠 postMessage 切）；
 *              带 component 的已搬进 SPA
 * ========================================================================= */
export const TOOLS = [
    {
    key: 'character',
    label: '角色一图流',
    icon: 'nav.character',
    /* 已搬进 SPA：用真组件，不再走 iframe。
       故意不给 frame —— FrameLayer 只认 frame，会自动跳过它 */
    component: () => import('./views/CharacterGuide.vue'),
  },
  {
    key: 'icon-editor',
    label: '图标字典编辑器',
    icon: 'nav.iconEditor',
    /* 已搬进 SPA：用真组件，不再走 iframe。
       故意不给 frame —— FrameLayer 只认 frame，会自动跳过它 */
    component: () => import('./views/IconEditor.vue'),
  },
  {
    key: 'video-cover',
    label: '封面制作',
    icon: 'nav.videoCover',
    /* 两个子工具都搬进 SPA 了，自己不再有页面 */
    subtools: [
      {
        key: 'video',
        label: '视频封面',
        component: () => import('./views/VideoCover.vue'),
      },
      {
        key: 'collection',
        label: '合集封面',
        component: () => import('./views/CollectionCover.vue'),
      },
    ],
  },
  {
    key: 'image-tools',
    label: '图片处理',
    icon: 'nav.imageTools',
    frame: 'tools/image-tools.html',
    subtools: [
      { key: 'background', label: '背景修改' },
      { key: 'blend', label: '双图羽化' },
      { key: 'overlay', label: '对位裁切' },
      { key: 'collage', label: '图层拼接' },
      { key: 'weapon-icon', label: '武器图标' },
      { key: 'weapon-card', label: '武器卡片' },
      { key: 'achievement', label: '成就制作' },
    ],
  },
  {
    key: 'chart',
    label: '图表',
    icon: 'nav.chart',
    frame: 'tools/chart.html',
    subtools: [
      { key: 'radar', label: '雷达图' },
      { key: 'bar', label: '柱状图' },
    ],
  },
  {
    key: 'tier',
    label: '角色梯队',
    icon: 'nav.tier',
    frame: 'tools/tier.html',
  },
]

/* 工具页的 iframe 由 FrameLayer 常驻托管，路由只负责「当前是哪一个」。
   已搬进 SPA 的工具用自己的组件，这个空组件不产生任何 DOM。 */
const ToolPage = { name: 'ToolPage', render: () => null }

/* 注意：vue-router 强制要求每条 path / redirect 都以 '/' 开头，
   写成 'character' 会在 createRouter() 阶段直接抛错，整个应用起不来。 */
function toolRoutes() {
  const out = []

  for (const t of TOOLS) {
    const subs = t.subtools || []

    for (const s of subs) {
      out.push({
        path: `/${t.key}/${s.key}`,
        name: `${t.key}:${s.key}`,
        component: s.component || ToolPage,
        meta: {
          tool: t.key,
          sub: s.key,
          subLabel: s.label,
          label: t.label,
          icon: t.icon,
          /* 子工具自带页面就用自己的，否则共用父页面；搬进 SPA 的不带 frame */
          frame: s.component ? '' : s.frame || t.frame,
        },
      })
    }

    if (t.frame) {
      out.push({
        path: `/${t.key}`,
        name: t.key,
        component: ToolPage,
        meta: { tool: t.key, sub: '', subLabel: '', label: t.label, icon: t.icon, frame: t.frame },
      })
    } else if (t.component) {
      /* 已搬进 SPA 的工具：自己的组件自己管 DOM，meta 里不带 frame */
      out.push({
        path: `/${t.key}`,
        name: t.key,
        component: t.component,
        meta: { tool: t.key, sub: '', subLabel: '', label: t.label, icon: t.icon },
      })
    } else {
      /* 只有子工具、自己没有页面 → 直接落到第一个子工具 */
      out.push({ path: `/${t.key}`, redirect: `/${t.key}/${subs[0].key}` })
    }
  }

  return out
}

const routes = [
  { path: '/', name: 'home', component: Home, meta: { title: '原神攻略工具集' } },
  ...toolRoutes(),
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

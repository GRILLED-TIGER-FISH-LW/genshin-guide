import {
  HomeIcon,
  UserIdIcon,
  BookIcon,
  ClapperboardPlayIcon,
  GalleryIcon,
  ChartIcon,
  RankingIcon,
  HamburgerMenuIcon,
  Sun2Icon,
  MoonIcon,
} from '@solar-icons/vue/linear'
import {
  HomeIcon as HomeBold,
  UserIdIcon as UserIdBold,
  BookIcon as BookBold,
  ClapperboardPlayIcon as ClapperboardPlayBold,
  GalleryIcon as GalleryBold,
  ChartIcon as ChartBold,
  RankingIcon as RankingBold,
  HamburgerMenuIcon as HamburgerMenuBold,
  Sun2Icon as Sun2Bold,
  MoonIcon as MoonBold,
} from '@solar-icons/vue/bold'

/* 内容标识图标统一走 Solar：linear 是常规，bold 是选中/强调。
   名字即 router.js 里 `solar:` 后面的部分；功能图标走 Element Plus，
   不在这里登记。 */
const SETS = {
  home: { linear: HomeIcon, bold: HomeBold },
  'user-id': { linear: UserIdIcon, bold: UserIdBold },
  book: { linear: BookIcon, bold: BookBold },
  'clapperboard-play': { linear: ClapperboardPlayIcon, bold: ClapperboardPlayBold },
  gallery: { linear: GalleryIcon, bold: GalleryBold },
  chart: { linear: ChartIcon, bold: ChartBold },
  ranking: { linear: RankingIcon, bold: RankingBold },
  'hamburger-menu': { linear: HamburgerMenuIcon, bold: HamburgerMenuBold },
  'sun-2': { linear: Sun2Icon, bold: Sun2Bold },
  moon: { linear: MoonIcon, bold: MoonBold },
}

export function solarIcon(name, bold = false) {
  const key = String(name || '').replace(/^solar:/, '')
  const set = SETS[key]
  return set ? (bold ? set.bold : set.linear) : null
}

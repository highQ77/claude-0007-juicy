import { $, h, container } from '../core.js';
import { NAV } from '../data.js';
import { router } from '../router.js';
import Logo from './logo.js';

export default $.component({
  name: 'Footer',
  view: () =>
    h('footer', 'border-t border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900/40',
      container('grid gap-10 py-14 md:grid-cols-4',
        h('div', 'md:col-span-2',
          Logo(),
          h('p', 'mt-4 max-w-sm text-sm leading-relaxed text-stone-600 dark:text-stone-400', '我們相信好的設計來自理解。從策略到落地，陪伴品牌走得更遠。')
        ),
        h('div', '',
          h('p', 'text-sm font-semibold', '網站導覽'),
          h('ul', 'mt-4 space-y-2 text-sm text-stone-600 dark:text-stone-400',
            NAV.map(({ to, label }) => h('li', '', $('a').link(to, router).addClass('hover:text-stone-900 dark:hover:text-white').text(label)))
          )
        ),
        h('div', '',
          h('p', 'text-sm font-semibold', '聯絡資訊'),
          h('ul', 'mt-4 space-y-2 text-sm text-stone-600 dark:text-stone-400',
            h('li', '', '台北市某某區光明路 100 號 3 樓'),
            h('li', '', 'hello@lumio.example'),
            h('li', '', '週一至週五 10:00–18:00')
          )
        )
      ),
      container('flex flex-col gap-2 border-t border-stone-200 py-6 text-xs text-stone-500 sm:flex-row sm:justify-between dark:border-stone-800',
        h('p', '', `© ${new Date().getFullYear()} 拾光設計 Lumio Studio`),
        h('p', '', '本網站為 juicy.js ＋ Tailwind CSS 範例，公司、人物與作品皆為虛構。')
      )
    ),
});

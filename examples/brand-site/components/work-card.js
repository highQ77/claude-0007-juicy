import { $, h } from '../core.js';
import { router } from '../router.js';

// 作品卡片：WorkCard({ work })
export default $.component({
  name: 'WorkCard',
  props: ['work'],
  view: ({ work }) =>
    $('a').link('/work/' + work.id, router).addClass('group block').append(
      h('div', `relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br ${work.gradient}`,
        h('span', 'absolute inset-0 grid place-items-center text-7xl font-black text-white/90 transition duration-500 group-hover:scale-110', work.glyph),
        h('span', 'absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-stone-800', work.category)
      ),
      h('div', 'mt-4 flex items-baseline justify-between gap-4',
        h('h3', 'text-lg font-bold group-hover:text-amber-600 dark:group-hover:text-amber-400', work.title),
        h('span', 'text-sm text-stone-500', String(work.year))
      ),
      h('p', 'mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-400', work.summary)
    ),
});

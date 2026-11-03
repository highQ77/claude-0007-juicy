import { $, h, container } from '../core.js';
import { WORKS } from '../data.js';
import { router } from '../router.js';
import NotFound from './not-found.js';

// 作品內頁（/work/:id）：路由以 route prop 傳入
export default $.component({
  name: 'WorkDetail',
  props: ['route'],
  computed: {
    work() {
      return WORKS.find((w) => w.id === this.route.params.id);
    },
    next() {
      const i = WORKS.indexOf(this.work);
      return WORKS[(i + 1) % WORKS.length];
    },
  },
  view: (vm) => {
    const w = vm.work;
    if (!w) return $(NotFound);
    return h('article', '',
      h('div', `bg-gradient-to-br ${w.gradient} text-white`,
        container('py-20 sm:py-28',
          $('a').link('/work', router).addClass('text-sm font-medium text-white/80 hover:text-white').text('← 回到作品集'),
          h('p', 'mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-white/80', `${w.category}・${w.year}`),
          h('h1', 'mt-3 text-4xl font-black tracking-tight sm:text-6xl', w.title),
          h('p', 'mt-4 max-w-2xl text-lg text-white/90', w.summary)
        )
      ),
      container('grid gap-12 py-20 md:grid-cols-3',
        h('div', 'md:col-span-2 space-y-10',
          h('section', '', h('h2', 'text-2xl font-bold', '挑戰'), h('p', 'mt-3 leading-relaxed text-stone-600 dark:text-stone-400', w.challenge)),
          h('section', '', h('h2', 'text-2xl font-bold', '做法'), h('p', 'mt-3 leading-relaxed text-stone-600 dark:text-stone-400', w.approach))
        ),
        h('aside', 'rounded-2xl bg-stone-50 p-6 dark:bg-stone-900/60',
          h('h2', 'text-sm font-semibold uppercase tracking-[0.2em] text-stone-500', '成果'),
          h('dl', 'mt-4 space-y-5',
            w.results.map((r) => h('div', '',
              h('dt', 'text-sm text-stone-500 dark:text-stone-400', r.label),
              h('dd', 'text-3xl font-black text-stone-900 dark:text-white', r.value)
            ))
          )
        )
      ),
      container('pb-20',
        $('a').link('/work/' + vm.next.id, router).addClass('group flex items-center justify-between rounded-2xl border border-stone-200 p-6 transition hover:border-stone-900 dark:border-stone-800 dark:hover:border-stone-400').append(
          h('span', '', h('span', 'block text-sm text-stone-500', '下一個作品'), h('span', 'mt-1 block text-xl font-bold', vm.next.title)),
          h('span', 'text-2xl transition group-hover:translate-x-1', '→')
        )
      )
    );
  },
});

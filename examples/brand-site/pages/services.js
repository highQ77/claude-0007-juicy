import { $, h, container } from '../core.js';
import { SERVICES, PROCESS, FAQ } from '../data.js';
import SectionHeading from '../components/section-heading.js';
import CallToAction from '../components/call-to-action.js';

export default $.component({
  name: 'ServicesPage',
  data: () => ({ open: 0 }), // 常見問題目前展開的項目
  view: (vm) =>
    h('div', '',
      container('py-20 sm:py-28',
        SectionHeading('Services', '我們能為你做什麼', '可以單獨委託其中一項，也可以把整個品牌交給我們，從策略一路做到上線。')
      ),
      container('grid gap-6 pb-20 md:grid-cols-2',
        SERVICES.map((s) => h('div', 'rounded-2xl border border-stone-200 p-8 dark:border-stone-800',
          h('div', 'flex items-center gap-4',
            h('span', 'grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-2xl text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', s.icon),
            h('h2', 'text-xl font-bold', s.title)
          ),
          h('p', 'mt-4 leading-relaxed text-stone-600 dark:text-stone-400', s.desc),
          h('ul', 'mt-6 space-y-2 text-sm',
            s.items.map((item) => h('li', 'flex items-center gap-2', h('span', 'text-amber-500', '✓'), item))
          )
        ))
      ),
      // 合作流程
      h('section', 'bg-stone-50 py-20 dark:bg-stone-900/40',
        container('',
          SectionHeading('Process', '合作流程', '清楚的流程讓每個階段都有明確的產出與決策點。'),
          h('ol', 'mt-12 grid gap-6 md:grid-cols-4',
            PROCESS.map((p) => h('li', 'rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800',
              h('span', 'text-3xl font-black text-amber-500', p.step),
              h('h3', 'mt-3 text-lg font-bold', p.title),
              h('p', 'mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400', p.desc)
            ))
          )
        )
      ),
      // 常見問題（手風琴）
      container('py-20',
        SectionHeading('FAQ', '常見問題', null, true),
        h('div', 'mx-auto mt-10 max-w-3xl divide-y divide-stone-200 rounded-2xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800',
          FAQ.map((f, i) => h('div', '',
            h('button', 'flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold hover:bg-stone-50 dark:hover:bg-stone-900')
              .attr({ type: 'button', 'aria-expanded': String(vm.open === i) })
              .on('click', () => (vm.open = vm.open === i ? -1 : i))
              .append(f.q, h('span', 'text-xl text-amber-500 transition ' + (vm.open === i ? 'rotate-45' : ''), '+')),
            vm.open === i && h('p', 'px-6 pb-5 leading-relaxed text-stone-600 dark:text-stone-400').transition('fade').text(f.a)
          ))
        )
      ),
      $(CallToAction)
    ),
});

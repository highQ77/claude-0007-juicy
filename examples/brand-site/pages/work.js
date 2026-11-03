import { $, h, container } from '../core.js';
import { CATEGORIES, WORKS } from '../data.js';
import SectionHeading from '../components/section-heading.js';
import WorkCard from '../components/work-card.js';
import CallToAction from '../components/call-to-action.js';

export default $.component({
  name: 'WorkPage',
  data: () => ({ category: '全部' }),
  computed: {
    list() {
      return this.category === '全部' ? WORKS : WORKS.filter((w) => w.category === this.category);
    },
  },
  view: (vm) =>
    h('div', '',
      container('py-20 sm:py-28',
        SectionHeading('Our work', '作品集', '挑選近年的代表專案。點進作品可以看到我們遇到的問題、做法與成果。'),
        // 分類篩選
        h('div', 'mt-10 flex flex-wrap gap-2').attr({ role: 'tablist', 'aria-label': '作品分類' }).append(
          CATEGORIES.map((c) => h('button', 'rounded-full px-4 py-2 text-sm font-medium transition ' +
            (vm.category === c
              ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'))
            .attr({ type: 'button', role: 'tab', 'aria-selected': String(vm.category === c) })
            .text(c)
            .on('click', () => (vm.category = c)))
        ),
        h('div', 'mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3',
          vm.list.map((work) => h('div', '').key(work.id).transition('fade').append(WorkCard({ work })))
        )
      ),
      $(CallToAction)
    ),
});

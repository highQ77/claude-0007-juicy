import { $, h, container } from '../core.js';
import { TEAM, TIMELINE } from '../data.js';
import SectionHeading from '../components/section-heading.js';
import CallToAction from '../components/call-to-action.js';

const VALUES = [
  { title: '先理解，再設計', desc: '每個專案都從訪談與研究開始，設計的每個決定都有原因。' },
  { title: '少即是多', desc: '去掉不必要的裝飾，讓品牌最重要的訊息被看見。' },
  { title: '長期陪伴', desc: '交付不是結束。我們追蹤成效，和品牌一起成長。' },
];

export default $.component({
  name: 'AboutPage',
  view: () =>
    h('div', '',
      container('py-20 sm:py-28',
        SectionHeading('About us', '我們是一群相信「理解」的設計師',
          '2016 年，兩位設計師在台北的小公寓成立了拾光設計。我們相信，好的設計不是把東西變漂亮，而是把對的事情說清楚。')
      ),
      // 價值
      container('grid gap-6 pb-20 md:grid-cols-3',
        VALUES.map((v, i) => h('div', 'rounded-2xl bg-stone-50 p-8 dark:bg-stone-900/60',
          h('span', 'text-sm font-black text-amber-600 dark:text-amber-400', '0' + (i + 1)),
          h('h3', 'mt-3 text-xl font-bold', v.title),
          h('p', 'mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400', v.desc)
        ))
      ),
      // 里程碑
      h('section', 'bg-stone-50 py-20 dark:bg-stone-900/40',
        container('',
          SectionHeading('Milestones', '一路走來'),
          h('ol', 'mt-12 space-y-8 border-l-2 border-amber-400 pl-8',
            TIMELINE.map((t) => h('li', 'relative',
              h('span', 'absolute -left-[41px] top-1 h-4 w-4 rounded-full border-4 border-white bg-amber-500 dark:border-stone-900'),
              h('p', 'text-sm font-black text-amber-600 dark:text-amber-400', t.year),
              h('p', 'mt-1 text-base text-stone-700 dark:text-stone-300', t.text)
            ))
          )
        )
      ),
      // 團隊
      container('py-20',
        SectionHeading('Our team', '核心團隊', '來自品牌、網站與產品設計的不同背景，一起解決問題。'),
        h('div', 'mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4',
          TEAM.map((m) => h('div', '',
            h('div', `grid aspect-square place-items-center rounded-2xl bg-gradient-to-br ${m.gradient} text-5xl font-black text-white`, m.name[0]),
            h('h3', 'mt-4 text-lg font-bold', m.name),
            h('p', 'text-sm text-amber-600 dark:text-amber-400', m.role),
            h('p', 'mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400', m.bio)
          ))
        )
      ),
      $(CallToAction)
    ),
});

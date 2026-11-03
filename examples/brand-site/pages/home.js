import { $, h, container } from '../core.js';
import { STATS, SERVICES, WORKS, TESTIMONIALS, fetchNews } from '../data.js';
import buttonLink from '../components/button-link.js';
import SectionHeading from '../components/section-heading.js';
import CountUp from '../components/count-up.js';
import WorkCard from '../components/work-card.js';
import CallToAction from '../components/call-to-action.js';

export default $.component({
  name: 'HomePage',
  data: () => ({
    // 在 data 中建立：頁面卸載時自動停止
    news: $.resource(fetchNews),
  }),
  view: (vm) =>
    h('div', '',
      // Hero
      h('section', 'relative overflow-hidden',
        h('div', 'absolute -right-24 top-10 h-80 w-80 animate-float rounded-full bg-gradient-to-br from-amber-300 to-rose-400 opacity-50 blur-3xl dark:opacity-30'),
        h('div', 'absolute -left-24 bottom-0 h-72 w-72 animate-float rounded-full bg-gradient-to-br from-sky-300 to-violet-400 opacity-40 blur-3xl [animation-delay:-3s] dark:opacity-20'),
        container('relative py-24 sm:py-32',
          h('p', 'inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-4 py-1.5 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-900/70 dark:text-stone-300',
            h('span', 'h-2 w-2 rounded-full bg-emerald-500'), '2026 年第一季專案開放預約中'),
          h('h1', 'mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl',
            '讓好品牌，', h('br', ''), h('span', 'bg-gradient-to-r from-amber-500 to-rose-500 bg-clip-text text-transparent', '被看見也被記住。')),
          h('p', 'mt-6 max-w-xl text-lg leading-relaxed text-stone-600 dark:text-stone-400',
            '拾光設計是一間專注品牌識別、網站與產品介面的設計工作室，陪伴品牌從策略走到每一個接觸點。'),
          h('div', 'mt-10 flex flex-wrap gap-3', buttonLink('/work', '看看我們的作品'), buttonLink('/contact', '預約免費諮詢', 'secondary'))
        )
      ),
      // 數據
      container('grid grid-cols-2 gap-6 border-y border-stone-200 py-10 md:grid-cols-4 dark:border-stone-800',
        STATS.map((s) => h('div', 'text-center',
          h('p', 'text-3xl font-black text-stone-900 sm:text-4xl dark:text-white', CountUp({ to: s.value, suffix: s.suffix })),
          h('p', 'mt-1 text-sm text-stone-500 dark:text-stone-400', s.label)
        ))
      ),
      // 服務摘要
      container('py-20',
        h('div', 'flex flex-wrap items-end justify-between gap-6',
          SectionHeading('What we do', '從策略到落地的完整服務', '一個團隊處理品牌、網站與產品，所有接觸點的體驗都一致。'),
          buttonLink('/services', '了解服務內容 →', 'secondary')
        ),
        h('div', 'mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4',
          SERVICES.map((s) => h('div', 'rounded-2xl border border-stone-200 p-6 transition hover:-translate-y-1 hover:shadow-lg dark:border-stone-800 dark:hover:shadow-black/40',
            h('span', 'grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-2xl text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', s.icon),
            h('h3', 'mt-5 text-lg font-bold', s.title),
            h('p', 'mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400', s.desc)
          ))
        )
      ),
      // 精選作品
      h('section', 'bg-stone-50 py-20 dark:bg-stone-900/40',
        container('',
          h('div', 'flex flex-wrap items-end justify-between gap-6',
            SectionHeading('Selected work', '精選作品', '每個專案都從理解開始，最後用成果說話。'),
            buttonLink('/work', '看全部作品 →', 'secondary')
          ),
          h('div', 'mt-12 grid gap-8 md:grid-cols-3', WORKS.slice(0, 3).map((work) => WorkCard({ work }).key(work.id)))
        )
      ),
      // 客戶怎麼說
      container('py-20',
        SectionHeading('Testimonials', '客戶怎麼說', null, true),
        h('div', 'mt-12 grid gap-6 md:grid-cols-3',
          TESTIMONIALS.map((t) => h('figure', 'flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800',
            h('blockquote', 'text-base leading-relaxed text-stone-700 dark:text-stone-300', '“' + t.quote + '”'),
            h('figcaption', 'mt-6 text-sm', h('span', 'font-bold', t.name), h('span', 'ml-2 text-stone-500', t.title))
          ))
        )
      ),
      // 最新消息（$.resource）
      container('pb-4',
        h('div', 'rounded-2xl border border-stone-200 p-6 sm:p-8 dark:border-stone-800',
          h('div', 'flex items-center justify-between',
            h('h2', 'text-xl font-bold', '最新消息'),
            h('button', 'text-sm text-stone-500 hover:text-stone-900 disabled:opacity-40 dark:hover:text-white')
              .attr({ type: 'button', disabled: vm.news.loading })
              .text(vm.news.loading ? '載入中…' : '重新整理')
              .on('click', () => vm.news.refetch())
          ),
          vm.news.loading && !vm.news.ready
            ? h('ul', 'mt-6 space-y-4', [1, 2, 3].map(() => h('li', 'h-6 animate-pulse rounded bg-stone-200 dark:bg-stone-800')))
            : vm.news.error
              ? h('p', 'mt-6 text-sm text-rose-600', '消息載入失敗，請稍後再試。')
              : h('ul', 'mt-6 divide-y divide-stone-200 dark:divide-stone-800',
                (vm.news.data || []).map((n) => h('li', 'flex flex-wrap items-center gap-3 py-3 text-sm',
                  h('time', 'w-24 text-stone-500', n.date),
                  h('span', 'rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium dark:bg-stone-800', n.tag),
                  h('span', 'font-medium', n.title)
                ))
              )
        )
      ),
      $(CallToAction)
    ),
});

import { $, h, container } from '../core.js';
import { router } from '../router.js';

// 頁面底部的「預約諮詢」區塊
export default $.component({
  name: 'CallToAction',
  view: () =>
    container('py-20',
      h('div', 'relative overflow-hidden rounded-3xl bg-stone-900 px-6 py-14 text-center text-white sm:px-12 dark:bg-stone-800',
        h('div', 'absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 opacity-40 blur-3xl'),
        h('h2', 'relative text-3xl font-black tracking-tight sm:text-4xl', '有個想法，想聊聊嗎？'),
        h('p', 'relative mx-auto mt-4 max-w-xl text-stone-300', '第一次諮詢免費。告訴我們你的品牌與目標，我們會在兩個工作天內回覆。'),
        h('div', 'relative mt-8 flex justify-center',
          $('a').link('/contact', router).text('預約免費諮詢').addClass('rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-900 transition hover:bg-amber-100')
        )
      )
    ),
});

// 路由：每個頁面都是獨立的檔案，以 $.import() 在第一次進入時才載入
import { $, h, container } from './core.js';
import { WORKS } from './data.js';
import { ui } from './store.js';

// 頁面載入中：骨架畫面
const loading = () =>
  container('animate-pulse space-y-6 py-24',
    h('div', 'h-4 w-32 rounded bg-stone-200 dark:bg-stone-800'),
    h('div', 'h-10 w-2/3 rounded bg-stone-200 dark:bg-stone-800'),
    h('div', 'h-4 w-1/2 rounded bg-stone-200 dark:bg-stone-800')
  );

// 頁面載入失敗：可重試
const error = (err, retry) =>
  container('py-32 text-center',
    h('p', 'text-lg font-bold', '頁面載入失敗'),
    h('p', 'mt-2 text-sm text-stone-500', err.message),
    h('button', 'mt-6 rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white dark:bg-white dark:text-stone-900')
      .attr('type', 'button').text('重新載入').on('click', retry)
  );

const page = (load) => $.import(load, { loading, error });

// import() 的路徑相對於這個檔案
export const pages = {
  home: page(() => import('./pages/home.js')),
  about: page(() => import('./pages/about.js')),
  services: page(() => import('./pages/services.js')),
  work: page(() => import('./pages/work.js')),
  workDetail: page(() => import('./pages/work-detail.js')),
  contact: page(() => import('./pages/contact.js')),
  notFound: page(() => import('./pages/not-found.js')),
};

const SITE = '拾光設計 Lumio Studio';

export const router = $.router({
  // 預設 hash 模式（網址像 #/about），不需要伺服器的路由設定
  routes: {
    '/': { view: pages.home, meta: { title: '' } },
    '/about': { view: pages.about, meta: { title: '關於我們' } },
    '/services': { view: pages.services, meta: { title: '服務' } },
    '/work': { view: pages.work, meta: { title: '作品' } },
    '/work/:id': { view: pages.workDetail, meta: { title: '作品' } },
    '/contact': { view: pages.contact, meta: { title: '聯絡我們' } },
    '*': { view: pages.notFound, meta: { title: '找不到頁面' } },
  },
  scrollBehavior: (_to, _from, saved) => saved || { top: 0 }, // 上一頁回到原本位置，其他換頁回到頂端
  afterEach(to) {
    const work = to.matched === '/work/:id' && WORKS.find((w) => w.id === to.params.id);
    const title = work ? work.title : to.meta.title;
    document.title = title ? `${title}｜${SITE}` : SITE;
    ui.toggleMenu(false);
  },
});

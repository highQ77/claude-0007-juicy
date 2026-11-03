import { $, h, container } from '../core.js';
import buttonLink from '../components/button-link.js';

export default $.component({
  name: 'NotFound',
  view: () =>
    container('py-32 text-center',
      h('p', 'text-7xl font-black text-amber-500', '404'),
      h('h1', 'mt-4 text-2xl font-bold', '找不到這個頁面'),
      h('p', 'mt-2 text-stone-600 dark:text-stone-400', '網址可能打錯了，或頁面已經移除。'),
      h('div', 'mt-8', buttonLink('/', '回到首頁'))
    ),
});

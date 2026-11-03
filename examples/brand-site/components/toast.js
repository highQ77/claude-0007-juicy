import { $, h } from '../core.js';
import { ui } from '../store.js';

// 提示訊息：用 Teleport 渲染到 body，不受頁面版面影響；以 ui.notify(訊息) 顯示
export default $.component({
  name: 'Toast',
  view: () =>
    $.teleport('body',
      ui.toast && h('div', 'pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4')
        .transition('toast')
        .attr({ role: 'status', 'aria-live': 'polite' })
        .append(h('div', 'pointer-events-auto rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-stone-900', ui.toast))
    ),
});

import { $ } from '../core.js';
import { router } from '../router.js';

// 按鈕樣式的路由連結：variant 為 'primary' 或 'secondary'
export default (to, label, variant = 'primary') =>
  $('a').link(to, router).text(label).addClass(
    'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-950 ' +
    (variant === 'primary'
      ? 'bg-stone-900 text-white hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200'
      : 'border border-stone-300 text-stone-800 hover:border-stone-900 dark:border-stone-700 dark:text-stone-100 dark:hover:border-stone-300')
  );

import { h } from '../core.js';

// 區塊標題：小標、標題、說明
export default (eyebrow, title, desc, center = false) =>
  h('div', 'max-w-2xl ' + (center ? 'mx-auto text-center' : ''),
    h('p', 'text-sm font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400', eyebrow),
    h('h2', 'mt-3 text-3xl font-black tracking-tight sm:text-4xl', title),
    desc && h('p', 'mt-4 text-base leading-relaxed text-stone-600 dark:text-stone-400', desc)
  );

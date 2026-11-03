import { h } from '../core.js';

// 標誌（無狀態，直接回傳節點的函式）
export default () =>
  h('span', 'flex items-center gap-2',
    h('span', 'grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-lg font-black text-white shadow-sm', '拾'),
    h('span', 'leading-tight',
      h('span', 'block text-base font-black tracking-wide', '拾光設計'),
      h('span', 'block text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400', 'Lumio Studio')
    )
  );

import { $, h } from '../core.js';
import { ui } from '../store.js';

export default $.component({
  name: 'DarkToggle',
  view: () =>
    h('button', 'grid h-10 w-10 place-items-center rounded-full text-lg transition hover:bg-stone-100 dark:hover:bg-stone-800')
      .attr({ type: 'button', 'aria-label': ui.dark ? '切換為淺色模式' : '切換為深色模式', title: ui.dark ? '淺色模式' : '深色模式' })
      .text(ui.dark ? '☀️' : '🌙')
      .on('click', () => ui.toggleDark()),
});

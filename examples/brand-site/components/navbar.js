import { $, h, container } from '../core.js';
import { NAV } from '../data.js';
import { router } from '../router.js';
import { ui } from '../store.js';
import Logo from './logo.js';
import buttonLink from './button-link.js';
import DarkToggle from './dark-toggle.js';

export default $.component({
  name: 'Navbar',
  view: () => {
    const isActive = (to) => router.isActive(to, to === '/');
    const desktopLink = ({ to, label }) =>
      $('a').link(to, { router, exact: to === '/' }).text(label).addClass(
        'relative py-2 transition ' +
        (isActive(to)
          ? 'text-stone-900 after:absolute after:inset-x-0 after:-bottom-[1px] after:h-0.5 after:rounded-full after:bg-amber-500 dark:text-white'
          : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white')
      );
    const mobileLink = ({ to, label }) =>
      $('a').link(to, { router, exact: to === '/' }).text(label).addClass(
        'block rounded-lg px-3 py-3 text-base font-medium ' +
        (isActive(to) ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'hover:bg-stone-100 dark:hover:bg-stone-800')
      );

    return h('header', 'sticky top-0 z-40 border-b border-stone-200/70 bg-white/80 backdrop-blur dark:border-stone-800 dark:bg-stone-950/80',
      container('flex h-16 items-center justify-between gap-4',
        $('a').link('/', router).attr('aria-label', '拾光設計首頁').append(Logo()),
        h('nav', 'hidden items-center gap-8 text-sm font-medium md:flex').attr('aria-label', '主選單').append(NAV.map(desktopLink)),
        h('div', 'flex items-center gap-1',
          $(DarkToggle),
          h('span', 'hidden md:inline-block', buttonLink('/contact', '預約諮詢')),
          h('button', 'grid h-10 w-10 place-items-center rounded-full text-xl hover:bg-stone-100 md:hidden dark:hover:bg-stone-800')
            .attr({ type: 'button', 'aria-label': '選單', 'aria-expanded': String(ui.menuOpen) })
            .text(ui.menuOpen ? '✕' : '☰')
            .on('click', () => ui.toggleMenu())
        )
      ),
      // 手機版選單
      ui.menuOpen && h('nav', 'border-t border-stone-200 px-4 pb-4 pt-2 md:hidden dark:border-stone-800')
        .transition('fade')
        .attr('aria-label', '主選單')
        .on('keydown.esc', () => ui.toggleMenu(false))
        .append(NAV.map(mobileLink))
    );
  },
});

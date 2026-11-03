// 共用：juicy.js（ES module 版本）與建立元素的小工具
import $ from '../../dist/juicy.mjs';

export { $ };

// 建立元素並加上 Tailwind class。Tailwind 的 class 含有 : / [ ] 等字元，
// 選擇器語法 $('div.a.b') 無法表示，所以統一用 addClass
export const h = (tag, cls, ...children) => $(tag).addClass(cls || '').append(...children);

// 置中、限制寬度的版面容器
export const container = (cls, ...children) => h('div', 'mx-auto max-w-6xl px-4 sm:px-6 ' + (cls || ''), ...children);

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

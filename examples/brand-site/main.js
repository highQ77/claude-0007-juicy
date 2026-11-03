/*!
 * 拾光設計 Lumio Studio —— juicy.js ＋ Tailwind CSS 形象官網範例（入口）
 *
 * 檔案結構：
 *   core.js          juicy.js 與小工具 h() / container()
 *   data.js          網站內容
 *   store.js         全域狀態（深色模式、選單、提示訊息）
 *   router.js        路由；頁面以 $.import() 延遲載入
 *   components/      共用元件，以 ES module import
 *   pages/           各頁面元件
 *
 * ※ 公司、人物、作品、評價與數據皆為虛構，僅供示範。
 */
import { $, h } from './core.js';
import { router, pages } from './router.js';
import Navbar from './components/navbar.js';
import Footer from './components/footer.js';
import Toast from './components/toast.js';

$.render(() =>
  h('div', 'flex min-h-screen flex-col',
    h('a', 'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow')
      .attr('href', '#main').text('跳到主要內容')
      .on('click.prevent', () => document.getElementById('main').focus()),
    $(Navbar),
    // 每次換頁都換一個 key，讓 main 重新建立並播放進場動畫
    h('main', 'flex-1 animate-page outline-none').id('main').attr('tabindex', '-1').key(router.route.path).append(router.view()),
    $(Footer),
    $(Toast)
  ), '#app');

// 第一個頁面顯示後，趁空檔預先載入其他頁面，之後換頁就不用等
setTimeout(() => Object.values(pages).forEach((p) => p.load().catch(() => {})), 1500);

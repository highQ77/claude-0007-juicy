// 執行：npm i -D jsdom && node test/juicy.test.js
const assert = require('assert');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
const $ = require('../src/juicy.js');

const tick = () => $.nextTick();
const app = () => document.getElementById('app');
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('$("div") 建立虛擬節點，mount 前不產生真實 DOM', () => {
  const c = $('div#main.a.b').css({ color: '#FFCC00' }).text('hi');
  assert.strictEqual(c.vnode.tag, 'div');
  assert.strictEqual(c.vnode.el, null);
  c.mount('#app');
  const el = app().firstChild;
  assert.strictEqual(el.outerHTML, '<div id="main" class="a b" style="color: rgb(255, 204, 0);">hi</div>');
});

test('css 支援物件 / 鍵值 / 數字自動加 px / kebab-case', () => {
  $('p').css({ fontSize: 12, opacity: 0.5 }).css('background-color', 'red').mount('#app');
  const s = app().firstChild.style;
  assert.strictEqual(s.fontSize, '12px');
  assert.strictEqual(s.opacity, '0.5');
  assert.strictEqual(s.backgroundColor, 'red');
});

test('child / end 巢狀鏈式', () => {
  $('ul').child('li').text('a').end().child('li').text('b').end().mount('#app');
  assert.strictEqual(app().innerHTML, '<ul><li>a</li><li>b</li></ul>');
});

test('reactive + computed + watch', async () => {
  const s = $.reactive({ a: 1, list: [1, 2] });
  const sum = $.computed(() => s.a + s.list.length);
  const log = [];
  $.watch(() => s.a, (n, o) => log.push([n, o]));
  assert.strictEqual(sum.value, 3);
  s.a = 5;
  s.list.push(3);
  assert.strictEqual(sum.value, 8);
  await tick();
  assert.deepStrictEqual(log, [[5, 1]]);
});

test('MVVM：資料變動 → 批次 patch，保留原本的 DOM 節點', async () => {
  let renders = 0;
  const vm = $.app({
    data: { count: 0 },
    computed: { double() { return this.count * 2; } },
    methods: { inc() { this.count++; } },
    view(vm) {
      renders++;
      return $('div').append(
        $('span').text(vm.count),
        $('b').text(vm.double),
        $('button').on('click', vm.inc)
      );
    },
  }).mount('#app');
  const span = app().querySelector('span');
  vm.count++;
  vm.count++;
  await tick();
  assert.strictEqual(renders, 2, '同一 tick 只重繪一次');
  assert.strictEqual(app().querySelector('span'), span, '節點被重用');
  assert.strictEqual(span.textContent, '2');
  assert.strictEqual(app().querySelector('b').textContent, '4');
  app().querySelector('button').click();
  await tick();
  assert.strictEqual(span.textContent, '3');
  vm.$unmount();
});

test('雙向綁定 model：input / checkbox / select', async () => {
  const vm = $.app({
    data: { msg: 'hi', ok: false, pick: 'b', n: 0 },
    view() {
      return $('div').append(
        $('input#t').model('msg'),
        $('input#c').attr('type', 'checkbox').model('ok'),
        $('select').model('pick').append(['a', 'b'].map((v) => $('option').attr('value', v).text(v))),
        $('input#n').model('n', { number: true })
      );
    },
  }).mount('#app');
  const input = app().querySelector('#t');
  const cb = app().querySelector('#c');
  const sel = app().querySelector('select');
  assert.strictEqual(input.value, 'hi');
  assert.strictEqual(sel.value, 'b');

  input.value = 'hello';
  input.dispatchEvent(new window.Event('input'));
  assert.strictEqual(vm.msg, 'hello');

  cb.checked = true;
  cb.dispatchEvent(new window.Event('change'));
  assert.strictEqual(vm.ok, true);

  const n = app().querySelector('#n');
  n.value = '42';
  n.dispatchEvent(new window.Event('input'));
  assert.strictEqual(vm.n, 42);

  vm.pick = 'a';
  vm.msg = 'from model';
  await tick();
  assert.strictEqual(sel.value, 'a');
  assert.strictEqual(input.value, 'from model');
  vm.$unmount();
});

test('keyed 列表：重新排序時搬移節點而不是重建', async () => {
  const vm = $.app({
    data: { items: [1, 2, 3] },
    view(vm) {
      return $('ul').each(vm.items, (i) => $('li').key(i).text(i));
    },
  }).mount('#app');
  const [l1, l2, l3] = app().querySelectorAll('li');
  vm.items = [3, 1, 2, 4];
  await tick();
  const lis = [...app().querySelectorAll('li')];
  assert.deepStrictEqual(lis.map((l) => l.textContent), ['3', '1', '2', '4']);
  assert.strictEqual(lis[0], l3);
  assert.strictEqual(lis[1], l1);
  assert.strictEqual(lis[2], l2);
  vm.items.splice(1, 1); // 刪掉 1
  await tick();
  assert.deepStrictEqual([...app().querySelectorAll('li')].map((l) => l.textContent), ['3', '2', '4']);
  vm.$unmount();
});

test('class / style / 事件 在更新時正確移除', async () => {
  let clicks = 0;
  const vm = $.app({
    data: { on: true },
    view(vm) {
      return $('div')
        .addClass({ active: vm.on })
        .when(vm.on, (c) => c.css({ color: 'red' }).on('click', () => clicks++));
    },
  }).mount('#app');
  const el = app().firstChild;
  el.click();
  vm.on = false;
  await tick();
  assert.strictEqual(el.className, '');
  assert.strictEqual(el.style.color, '');
  el.click();
  assert.strictEqual(clicks, 1);
  vm.$unmount();
});

test('patch 移除的節點與 $unmount 也會釋放', async () => {
  const vm = $.app({
    data: { show: true },
    view: (vm) => $('div').append(vm.show && $('button').on('click', () => {}).text('b')),
  }).mount('#app');
  const btn = app().querySelector('button');
  assert.ok(btn._vei.click);
  vm.show = false;
  await tick();
  assert.strictEqual(btn.parentNode, null);
  assert.strictEqual(btn._vei, null);
  const root = app().firstChild;
  vm.$unmount();
  assert.strictEqual(app().innerHTML, '');
  assert.strictEqual(root._vei, null);
});

test('chain.mount 回傳自己；重複 mount 會先釋放舊 DOM', () => {
  let clicks = 0;
  const btn = $('button').text('b').on('click', () => clicks++);
  const card = $('div.card').append(btn);
  assert.strictEqual(card.mount('#app'), card, 'mount 回傳 chain 本身');
  const btnEl = btn.vnode.el;
  card.mount('#app');
  assert.strictEqual(app().innerHTML, '<div class="card"><button>b</button></div>');
  assert.strictEqual(btnEl._vei, null, '舊按鈕監聽已解除');
  btnEl.click();
  app().querySelector('button').click();
  assert.strictEqual(clicks, 1);
});

test('重複 mount 到同一容器會先卸載舊內容；巢狀容器一併卸載', async () => {
  const log = [];
  const slot = $('div.slot');
  $('section').append(slot).mount('#app');
  $.app({
    data: {},
    unmounted: () => log.push('inner unmounted'),
    view: () => $('i').text('inner'),
  }).mount(slot.vnode.el);
  assert.strictEqual(app().innerHTML, '<section><div class="slot"><i>inner</i></div></section>');
  $('p').text('new').mount('#app'); // 取代整個 #app → 巢狀的 app 也被卸載
  assert.deepStrictEqual(log, ['inner unmounted']);
  assert.strictEqual(app().innerHTML, '<p>new</p>');
});

test('router（memory）：切換內容、params / query、404、上一頁', async () => {
  const r = $.router({
    mode: 'memory',
    routes: {
      '/': () => $('h1').text('home'),
      '/user/:id': (route) => $('p').text(`user ${route.params.id} tab=${route.query.tab || ''}`),
      '/docs/*': (route) => $('p').text('docs:' + route.params.pathMatch),
      '*': (route) => $('p').text('404 ' + route.path),
    },
  });
  const h = r.mount('#app');
  assert.strictEqual(app().innerHTML, '<h1>home</h1>');
  r.push('/user/42?tab=posts');
  assert.deepStrictEqual({ ...r.route.params }, { id: '42' }, 'route 同步更新');
  await tick();
  assert.strictEqual(app().innerHTML, '<p>user 42 tab=posts</p>');
  const p = app().firstChild;
  r.push('/user/7');
  await tick();
  assert.strictEqual(app().firstChild, p, '同一路由只 patch，不重建');
  assert.strictEqual(p.textContent, 'user 7 tab=');
  r.push('/docs/a/b');
  await tick();
  assert.strictEqual(app().innerHTML, '<p>docs:a/b</p>');
  r.push('/nope');
  await tick();
  assert.strictEqual(app().innerHTML, '<p>404 /nope</p>');
  r.back();
  r.back();
  await tick();
  assert.strictEqual(app().innerHTML, '<p>user 7 tab=</p>');
  r.forward();
  await tick();
  assert.strictEqual(app().innerHTML, '<p>docs:a/b</p>');
  h.unmount();
  r.stop();
});

test('router：轉址、beforeEach 守衛、afterEach', () => {
  const log = [];
  let loggedIn = false;
  const r = $.router({
    mode: 'memory',
    routes: { '/': () => null, '/old': '/new', '/new': () => null, '/admin': () => null, '/login': () => null, '/locked': () => null },
    beforeEach: (to) => (to.path === '/locked' ? false : to.path === '/admin' && !loggedIn ? '/login' : undefined),
    afterEach: (to, from) => log.push(`${from ? from.path : '-'}→${to.path}`),
  });
  r.push('/old');
  assert.strictEqual(r.route.path, '/new');
  assert.strictEqual(r.push('/locked'), false);
  assert.strictEqual(r.route.path, '/new', '被取消時不切換');
  r.push('/admin');
  assert.strictEqual(r.route.path, '/login');
  loggedIn = true;
  r.push('/admin');
  assert.strictEqual(r.route.path, '/admin');
  assert.deepStrictEqual(log, ['-→/', '/→/new', '/new→/login', '/login→/admin']);
  r.stop();
});

test('router：.link() 點擊切換、active class、修飾鍵不攔截', async () => {
  const r = $.router({ mode: 'memory', routes: { '/': () => $('i').text('h'), '/a': () => $('i').text('a'), '/a/b': () => $('i').text('ab') } });
  const h = $.render(() =>
    $('div').append(
      $('nav').append($('a').link('/', r).text('H'), $('a').link('/a', { router: r, exact: false }).text('A')),
      r.view()
    ), '#app');
  const [home, a] = app().querySelectorAll('a');
  assert.strictEqual(a.getAttribute('href'), '#/a');
  assert.strictEqual(home.className, 'active');
  a.click();
  await tick();
  assert.strictEqual(r.route.path, '/a');
  assert.strictEqual(app().querySelector('i').textContent, 'a');
  assert.strictEqual(home.className, '');
  assert.strictEqual(a.className, 'active');
  r.push('/a/b');
  await tick();
  assert.strictEqual(a.className, 'active', 'exact:false 前綴符合也算');
  const ev = new window.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
  home.dispatchEvent(ev);
  assert.strictEqual(r.route.path, '/a/b', '⌘ 點擊交給瀏覽器（新分頁）');
  h.unmount();
  r.stop();
});

test('router（hash / history）：讀寫網址、回應瀏覽器上一頁', async () => {
  window.history.replaceState(null, '', '/#/b');
  const r = $.router({ routes: { '/a': () => $('p').text('A'), '/b': () => $('p').text('B') } });
  const h = r.mount('#app');
  assert.strictEqual(app().innerHTML, '<p>B</p>', '依初始 hash 顯示');
  r.push('/a');
  assert.strictEqual(window.location.hash, '#/a');
  window.history.replaceState(null, '', '/#/b'); // 模擬使用者改網址
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await tick();
  assert.strictEqual(app().innerHTML, '<p>B</p>');
  h.unmount();
  r.stop();

  window.history.replaceState(null, '', '/app/x?q=1');
  const r2 = $.router({ mode: 'history', base: '/app', routes: { '/x': () => null, '/y/:id': () => null } });
  assert.strictEqual(r2.route.fullPath, '/x?q=1');
  assert.strictEqual(r2.route.query.q, '1');
  r2.push('/y/3');
  assert.strictEqual(window.location.pathname, '/app/y/3');
  assert.strictEqual(r2.href('/y/3'), '/app/y/3');
  r2.stop();
  window.history.replaceState(null, '', '/');
});

test('router（hash）：不允許 pushState 的環境（file://）改用 location.hash', async () => {
  window.history.replaceState(null, '', '/#/a');
  const push = window.history.pushState;
  const replace = window.history.replaceState;
  const deny = () => { throw new window.DOMException('blocked', 'SecurityError'); };
  window.history.pushState = deny;
  window.history.replaceState = deny;
  const r = $.router({ routes: { '/a': () => $('p').text('A'), '/b': () => $('p').text('B') } });
  const h = r.mount('#app');
  assert.strictEqual(r.push('/b'), true);
  assert.strictEqual(window.location.hash, '#/b');
  await tick();
  assert.strictEqual(app().innerHTML, '<p>B</p>');
  r.push('/a', { replace: true });
  assert.strictEqual(window.location.hash, '#/a');
  await tick();
  assert.strictEqual(app().innerHTML, '<p>A</p>');
  window.history.pushState = push;
  window.history.replaceState = replace;
  h.unmount();
  r.stop();
  window.history.replaceState(null, '', '/');
});

test('router 與 $.app 一起用：view 依路由切換且保留 MVVM', async () => {
  const r = $.router({ mode: 'memory', routes: { '/': () => $('p').text('home'), '/count': (route) => null } });
  const vm = $.app({
    data: { n: 1 },
    view: (vm) => $('div').append(
      $('a').link('/count', r).text('count'),
      r.route.path === '/count' ? $('b').text(vm.n) : r.view()
    ),
  }).mount('#app');
  assert.strictEqual(app().innerHTML, '<div><a href="#/count">count</a><p>home</p></div>');
  app().querySelector('a').click();
  vm.n = 5;
  await tick();
  assert.strictEqual(app().innerHTML, '<div><a href="#/count" class="active">count</a><b>5</b></div>');
  vm.$unmount();
  r.stop();
});

test('元件：props / data / emit，父層重繪時保留內部狀態', async () => {
  const log = [];
  const Counter = $.component({
    props: { label: '計數', step: 1 },
    data() { return { count: 0 }; },
    computed: { text() { return `${this.label}: ${this.count}`; } },
    methods: {
      inc() {
        this.count += this.step;
        this.$emit('change', this.count);
      },
    },
    view: (vm) => $('button').text(vm.text).on('click', vm.inc),
  });
  const vm = $.app({
    data: { step: 1, title: 'A', total: 0 },
    view: (vm) => $('div').append(
      $('h1').text(vm.title),
      Counter({ step: vm.step }).on('change', (n) => { vm.total = n; log.push(n); })
    ),
  }).mount('#app');
  const btn = app().querySelector('button');
  assert.strictEqual(btn.textContent, '計數: 0');
  btn.click();
  btn.click();
  await tick();
  assert.strictEqual(btn.textContent, '計數: 2');
  assert.strictEqual(vm.total, 2);
  vm.title = 'B'; // 父層重繪
  await tick();
  assert.strictEqual(app().querySelector('button'), btn, '元件 DOM 不重建');
  assert.strictEqual(btn.textContent, '計數: 2', '內部狀態保留');
  vm.step = 10; // props 變動
  await tick();
  btn.click();
  await tick();
  assert.strictEqual(btn.textContent, '計數: 12');
  assert.deepStrictEqual(log, [1, 2, 12]);
  vm.$unmount();
});

test('元件：children 插槽、class / style / attr 合併到根節點、emits 以外的事件落到根元素', async () => {
  let clicked = 0;
  const Card = $.component({
    props: ['title'],
    emits: ['close'],
    view: (vm, children) => $('div.card').append(
      $('h3').text(vm.title),
      $('div.body').append(children),
      $('button.x').text('×').on('click', () => vm.$emit('close', vm.title))
    ),
  });
  const closed = [];
  const s = $.reactive({ big: true, n: 1 });
  const h = $.render(() =>
    Card({ title: 'Hi' }, $('p').text('內容 ' + s.n))
      .addClass({ big: s.big }).css({ color: 'red' }).attr('data-x', 1)
      .on('close', (t) => closed.push(t))
      .on('click', () => clicked++), '#app');
  const root = app().firstChild;
  assert.strictEqual(root.className, 'card big');
  assert.strictEqual(root.getAttribute('data-x'), '1');
  assert.strictEqual(root.style.color, 'red');
  assert.strictEqual(root.innerHTML, '<h3>Hi</h3><div class="body"><p>內容 1</p></div><button class="x">×</button>');
  root.querySelector('.x').click();
  assert.deepStrictEqual(closed, ['Hi']);
  assert.strictEqual(clicked, 1, '未宣告在 emits 的 click 綁在根元素上（按鈕點擊冒泡）');
  s.big = false;
  s.n = 2;
  await tick();
  assert.strictEqual(app().firstChild, root);
  assert.strictEqual(root.className, 'card');
  assert.strictEqual(root.querySelector('p').textContent, '內容 2', '插槽內容跟著父層更新');
  h.unmount();
});

test('元件：.model() 雙向綁定、名稱註冊 $("tag")、生命週期與巢狀', async () => {
  const log = [];
  $.component('star-rating', {
    props: { value: 0, max: 3 },
    mounted() { log.push('mounted ' + document.contains(this.$el)); },
    updated() { log.push('updated'); },
    unmounted() { log.push('unmounted'); },
    view: (vm) => $('span').each(Array.from({ length: vm.max }), (_, i) =>
      $('i').text(i < vm.value ? '★' : '☆').on('click', () => vm.$emit('input', i + 1))
    ),
  });
  const Panel = $.component({ view: (vm, ch) => $('section').append(ch) });
  const vm = $.app({
    data: { rate: 1, show: true },
    // 插槽內容在父層的 view 裡建立，所以 .model('rate') 綁的是 app 的 rate
    view: (vm) => $('div').append(vm.show && $(Panel).append($('star-rating', { max: 4 }).model('rate')), $('b').text(vm.rate)),
  }).mount('#app');
  assert.strictEqual(app().querySelector('span').textContent, '★☆☆☆');
  assert.deepStrictEqual(log, ['mounted true'], 'mounted 時已在頁面中');
  app().querySelectorAll('i')[2].click();
  await tick();
  assert.strictEqual(vm.rate, 3);
  assert.strictEqual(app().querySelector('span').textContent, '★★★☆');
  assert.strictEqual(app().querySelector('b').textContent, '3');
  vm.show = false;
  await tick();
  assert.deepStrictEqual(log, ['mounted true', 'updated', 'unmounted'], '巢狀元件一起卸載');
  assert.strictEqual(app().innerHTML, '<div><b>3</b></div>');
  vm.$unmount();
});

test('元件：keyed 列表重新排序時保留各自的狀態；props 唯讀', async () => {
  const Item = $.component({
    props: ['name'],
    data: () => ({ clicks: 0 }),
    view: (vm) => $('li').text(`${vm.name}:${vm.clicks}`).on('click', () => vm.clicks++),
  });
  const s = $.reactive({ list: ['a', 'b', 'c'] });
  const h = $.render(() => $('ul').each(s.list, (n) => Item({ name: n }).key(n)), '#app');
  const lis = () => [...app().querySelectorAll('li')];
  lis()[0].click();
  lis()[0].click();
  lis()[2].click();
  await tick();
  const first = lis()[0];
  s.list.reverse();
  await tick();
  assert.deepStrictEqual(lis().map((l) => l.textContent), ['c:1', 'b:0', 'a:2']);
  assert.strictEqual(lis()[2], first, '節點搬移而非重建');
  s.list.splice(1, 1);
  await tick();
  assert.deepStrictEqual(lis().map((l) => l.textContent), ['c:1', 'a:2']);
  h.unmount();

  const warn = console.warn;
  let warned = '';
  console.warn = (m) => (warned = m);
  const Bad = $.component({ props: ['x'], created() { this.x = 2; }, view: (vm) => $('i').text(vm.x) });
  Bad({ x: 1 }).mount('#app');
  console.warn = warn;
  assert.ok(warned.includes('唯讀'));
  assert.strictEqual(app().textContent, '1');
});

test('$.import：函式來源、loading / error / 重試、事件與 props 轉送', async () => {
  let resolve;
  let calls = 0;
  const Lazy = $.import(() => { calls++; return new Promise((r) => (resolve = r)); }, {
    name: 'lazy-hello',
    loading: () => $('em').text('載入中…'),
  });
  const s = $.reactive({ who: 'A' });
  const got = [];
  const h = $.render(() => $('div').append(
    $('lazy-hello', { who: s.who }).addClass('x').on('hi', (v) => got.push(v)),
    Lazy({ who: 'B' })
  ), '#app');
  assert.strictEqual(app().innerHTML, '<div><em class="x">載入中…</em><em>載入中…</em></div>');
  await tick();
  await tick();
  assert.strictEqual(calls, 1, '多個實例只載入一次');
  resolve({ default: { props: ['who'], emits: ['hi'], view: (vm) => $('p').text('hello ' + vm.who).on('click', () => vm.$emit('hi', vm.who)) } });
  await Lazy.load();
  await tick();
  assert.strictEqual(app().innerHTML, '<div><p class="x">hello A</p><p>hello B</p></div>');
  s.who = 'Z';
  await tick();
  await tick();
  assert.strictEqual(app().firstChild.firstChild.textContent, 'hello Z');
  app().firstChild.firstChild.click();
  assert.deepStrictEqual(got, ['Z']);
  h.unmount();

  const err = console.error;
  console.error = () => {};
  let fail = true;
  const Flaky = $.import(() => (fail ? Promise.reject(new Error('404')) : Promise.resolve({ view: () => $('b').text('ok') })), {
    error: (e, retry) => $('button').text('失敗：' + e.message).on('click', retry),
  });
  Flaky().mount('#app');
  await new Promise((r) => setTimeout(r, 0));
  assert.strictEqual(app().textContent, '失敗：404');
  fail = false;
  app().querySelector('button').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.strictEqual(app().innerHTML, '<b>ok</b>');
  console.error = err;
});

test('$.import：以網址載入 ES module（($) => 元件 的寫法）', async () => {
  const src = "export default ($) => $.component({ props: { n: 1 }, view: (vm) => $('b').text('from module ' + vm.n) });";
  const Mod = $.import('data:text/javascript,' + encodeURIComponent(src));
  $.render(() => Mod({ n: 7 }), '#app');
  await Mod.load();
  await tick();
  assert.strictEqual(app().innerHTML, '<b>from module 7</b>');
});

test('i18n：t()、巢狀 key、參數、fallback、找不到時回傳 key', () => {
  const i18n = $.i18n({
    locale: 'zh-TW',
    fallback: 'en',
    messages: {
      en: { hello: 'Hello, {name}!', nav: { home: 'Home', about: 'About' }, onlyEn: 'EN only' },
      zh: { nav: { home: '首頁' } },
      'zh-TW': { hello: '你好，{name}！' },
    },
  });
  assert.strictEqual(i18n.t('hello', { name: 'Ada' }), '你好，Ada！');
  assert.strictEqual(i18n.t('nav.home'), '首頁', 'zh-TW → zh');
  assert.strictEqual(i18n.t('nav.about'), 'About', '→ fallback en');
  assert.strictEqual(i18n.t('onlyEn'), 'EN only');
  assert.strictEqual(i18n.t('nope.key'), 'nope.key');
  assert.strictEqual(i18n.t('nav'), 'nav', '指到整組訊息時回傳 key');
  assert.strictEqual(i18n.t('hello', { who: 1 }), '你好，{name}！', '缺少的參數保留原樣');
  assert.ok(i18n.has('nav.home') && !i18n.has('zzz'));
  i18n.add('en', { 'A.B 原文當 key': 'source text as key' });
  i18n.locale = 'en';
  assert.strictEqual(i18n.t('A.B 原文當 key'), 'source text as key');
  assert.strictEqual($.t('hello', { name: 'Bo' }), 'Hello, Bo!', '$.t 使用最後建立的 i18n');
  const missing = [];
  const j = $.i18n({ locale: 'en', messages: { en: {} }, missing: (k, l) => (missing.push(k + '@' + l), `[${k}]`) });
  assert.strictEqual(j.t('x'), '[x]');
  assert.deepStrictEqual(missing, ['x@en']);
});

test('i18n：複數（| 分段 / Intl.PluralRules 物件）、函式訊息、數字與日期格式', () => {
  const i18n = $.i18n({
    locale: 'en',
    messages: {
      en: {
        apples: 'no apples | one apple | {n} apples',
        cats: 'one cat | {n} cats',
        files: { one: '{n} file', other: '{n} files' },
        rank: { one: '{n}st', two: '{n}nd', few: '{n}rd', other: '{n}th' },
        greet: (p) => (p.hour < 12 ? 'Good morning' : 'Good evening'),
      },
      zh: { apples: '沒有蘋果 | 一顆蘋果 | {n} 顆蘋果' },
    },
  });
  assert.deepStrictEqual([0, 1, 5].map((n) => i18n.t('apples', n)), ['no apples', 'one apple', '5 apples']);
  assert.deepStrictEqual([1, 2].map((n) => i18n.t('cats', { count: n })), ['one cat', '2 cats']);
  assert.deepStrictEqual([1, 3].map((n) => i18n.t('files', n)), ['1 file', '3 files']);
  assert.strictEqual(i18n.t('greet', { hour: 9 }), 'Good morning');
  assert.strictEqual(i18n.t('apples'), 'no apples | one apple | {n} apples', '沒給 n 時不做複數');
  assert.strictEqual(i18n.n(1234567.891), '1,234,567.891');
  assert.strictEqual(i18n.n(9.5, { style: 'currency', currency: 'USD' }), '$9.50');
  assert.strictEqual(i18n.d(new Date(2026, 0, 2), 'medium'), 'Jan 2, 2026');
  i18n.locale = 'zh';
  assert.strictEqual(i18n.t('apples', 2), '2 顆蘋果');
  assert.strictEqual(i18n.d(new Date(2026, 0, 2), 'long'), '2026年1月2日');
});

test('i18n：切換語言時畫面自動更新；.t() 鏈式方法；loaders 非同步載入語系', async () => {
  const i18n = $.i18n({
    locale: 'en',
    messages: { en: { title: 'Hello', count: '{n} item | {n} items' } },
    loaders: { ja: () => Promise.resolve({ default: { title: 'こんにちは', count: '{n} 個' } }) },
  });
  const s = $.reactive({ n: 1 });
  const h = $.render(() => $('div').append($('h1').t('title', null, i18n), $('p').text(i18n.t('count', s.n))), '#app');
  assert.strictEqual(app().innerHTML, '<div><h1>Hello</h1><p>1 item</p></div>');
  const h1 = app().querySelector('h1');
  s.n = 2;
  await tick();
  assert.strictEqual(app().querySelector('p').textContent, '2 items');
  assert.deepStrictEqual(i18n.locales, ['en', 'ja']);
  const p = i18n.setLocale('ja');
  assert.strictEqual(i18n.loading, 'ja');
  assert.strictEqual(i18n.locale, 'en', '載入完成前維持原語言');
  await p;
  await tick();
  assert.strictEqual(app().innerHTML, '<div><h1>こんにちは</h1><p>2 個</p></div>');
  assert.strictEqual(app().querySelector('h1'), h1, '只 patch 文字');
  assert.strictEqual(i18n.loading, null);
  i18n.add('ja', { title: 'やあ' }); // 新增翻譯也會重繪
  await tick();
  assert.strictEqual(h1.textContent, 'やあ');
  h.unmount();
});

test('store：state / getters / actions，全域取得同一實例，畫面自動更新', async () => {
  const cart = $.store('cart-test', {
    state: () => ({ items: [], coupon: 0 }),
    getters: {
      count: (state) => state.items.reduce((n, i) => n + i.qty, 0),
      total(state) { return state.items.reduce((n, i) => n + i.qty * i.price, 0) - this.coupon; },
    },
    actions: {
      add(name, price) {
        const hit = this.items.find((i) => i.name === name);
        if (hit) hit.qty++;
        else this.items.push({ name, price, qty: 1 });
      },
      async checkout() {
        await Promise.resolve();
        const paid = this.total;
        this.$reset();
        return paid;
      },
    },
  });
  assert.strictEqual($.store('cart-test'), cart, '依 id 取得同一個 store');
  assert.strictEqual($.store('cart-test', { state: () => ({}) }), cart, '重複定義回傳既有實例');
  assert.ok($.store.has('cart-test') && $.store.list().includes('cart-test'));
  assert.throws(() => $.store('nope'), /找不到 store/);

  // 兩個獨立的畫面共用同一個 store
  const Badge = $.component({ view: () => $('b').text($.store('cart-test').count) });
  const h = $.render(() => $('div').append(
    $(Badge),
    $('ul').each(cart.items, (i) => $('li').text(`${i.name}×${i.qty}`)),
    $('i').text(cart.total)
  ), '#app');
  cart.add('apple', 10);
  cart.add('apple', 10);
  cart.add('pear', 5);
  await tick();
  assert.strictEqual(app().innerHTML, '<div><b>3</b><ul><li>apple×2</li><li>pear×1</li></ul><i>25</i></div>');
  cart.coupon = 5; // 也可以直接改 state
  await tick();
  assert.strictEqual(app().querySelector('i').textContent, '20');
  const warn = console.warn;
  console.warn = () => {};
  cart.total = 1; // getter 唯讀
  console.warn = warn;
  assert.strictEqual(cart.total, 20);
  assert.strictEqual(await cart.checkout(), 20);
  await tick();
  assert.strictEqual(app().innerHTML, '<div><b>0</b><ul></ul><i>0</i></div>', '$reset 回到初始狀態');
  h.unmount();
  cart.$dispose();
  assert.ok(!$.store.has('cart-test'));
});

test('store：$patch、$state、$subscribe（批次）、$onAction（after / onError）', async () => {
  const s = $.store({
    state: { user: { name: 'A', age: 1 }, tags: ['x'] }, // 物件寫法：$reset 會還原成初始的深層複本
    actions: {
      rename(n) { this.user.name = n; return n.length; },
      fail() { throw new Error('boom'); },
      async later() { await Promise.resolve(); return 'ok'; },
    },
  });
  s.$patch({ user: { age: 2 }, tags: ['y', 'z'] });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s.$state)), { user: { name: 'A', age: 2 }, tags: ['y', 'z'] }, '深層合併、陣列取代');
  s.$patch((st) => st.tags.push('w'));
  assert.deepStrictEqual([...s.tags], ['y', 'z', 'w']);

  const changes = [];
  const unsub = s.$subscribe((state) => changes.push(state.user.name));
  s.user.name = 'B';
  s.user.name = 'C';
  await tick();
  assert.deepStrictEqual(changes, ['C'], '同一 tick 只通知一次');

  const log = [];
  const off = s.$onAction(({ name, args, after, onError }) => {
    log.push(`call ${name}(${args.join()})`);
    after((r) => log.push(`after ${name} → ${r}`));
    onError((e) => log.push(`error ${name}: ${e.message}`));
  });
  assert.strictEqual(s.rename('Dora'), 4);
  assert.throws(() => s.fail(), /boom/);
  assert.strictEqual(await s.later(), 'ok');
  off();
  s.rename('E');
  assert.deepStrictEqual(log, ['call rename(Dora)', 'after rename → 4', 'call fail()', 'error fail: boom', 'call later()', 'after later → ok']);

  s.$state = { user: { name: 'Z', age: 9 } }; // 整個取代
  assert.strictEqual(s.user.name, 'Z');
  assert.ok(!('tags' in s.$state));
  s.$reset();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s.$state)), { user: { name: 'A', age: 1 }, tags: ['x'] });
  unsub();
  s.$dispose();
});

test('store：persist 持久化到 storage（可只存部分路徑）', async () => {
  const mem = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  mem.data.prefs = JSON.stringify({ theme: 'dark', user: { name: 'Saved' } });
  const def = {
    state: () => ({ theme: 'light', user: { name: '', token: '' }, temp: 0 }),
    persist: { key: 'prefs', storage: mem, paths: ['theme', 'user.name'] },
  };
  const a = $.store('prefs-test', def);
  assert.strictEqual(a.theme, 'dark', '啟動時讀回保存的狀態');
  assert.strictEqual(a.user.name, 'Saved');
  a.theme = 'blue';
  a.user.token = 'secret';
  a.temp = 5;
  await tick();
  assert.deepStrictEqual(JSON.parse(mem.data.prefs), { theme: 'blue', user: { name: 'Saved' } }, '只保存指定路徑');
  a.$dispose();
  const b = $.store('prefs-test', def); // 模擬重新整理頁面
  assert.strictEqual(b.theme, 'blue');
  assert.strictEqual(b.user.token, '');
  b.$dispose();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('ref：函式 ref、$refs（app / 元件）、元件 ref 取得 vm、卸載時清除', async () => {
  let inputEl = null;
  const Child = $.component({ data: () => ({ secret: 42 }), view: (vm) => $('i').ref('icon').text(vm.secret) });
  const vm = $.app({
    data: { show: true },
    view: (vm) => $('div').append(
      $('input').ref((el) => (inputEl = el)),
      vm.show && $('b').ref('bold').text('b'),
      $(Child).ref('child')
    ),
  }).mount('#app');
  assert.strictEqual(inputEl, app().querySelector('input'));
  assert.strictEqual(vm.$refs.bold, app().querySelector('b'));
  assert.strictEqual(vm.$refs.child.secret, 42, '元件 ref → vm');
  assert.strictEqual(vm.$refs.child.$refs.icon, app().querySelector('i'), '元件自己的 $refs');
  vm.show = false;
  await tick();
  assert.strictEqual(vm.$refs.bold, undefined, '移除後清除');
  vm.$unmount();
  assert.strictEqual(inputEl, null);
  $('p').ref('outside').mount('#app');
  assert.strictEqual($.refs.outside, app().firstChild, '不在 view 中 → $.refs');
});

test('事件修飾符：prevent / stop / self / once / 按鍵 / 系統鍵 / exact / capture / 自訂事件名稱', async () => {
  const log = [];
  const s = $.reactive({ n: 0 });
  const h = $.render(() => $('div').on('click', () => log.push('div')).append(
    $('a').attr('href', '#x').text(s.n).on('click.prevent.stop', (e) => log.push('a:' + e.defaultPrevented)),
    $('p').on('click.self', () => log.push('p.self')).append($('span').text('child')),
    $('button').on('click.once', () => log.push('once')),
    $('input').on('keydown.enter', () => log.push('enter')).on('keydown.ctrl.s.prevent', () => log.push('ctrl+s'))
      .on('keydown.esc.exact', () => log.push('esc exact')),
    $('section').on('focus.capture', () => log.push('capture')).append($('textarea')),
    $('em').on('bs.modal.show', (e) => log.push(e.type))
  ), '#app');
  const q = (sel) => app().querySelector(sel);
  q('a').click();
  q('span').click();
  q('p').click();
  q('button').click();
  q('button').click();
  s.n++; // 重繪後 once 仍然不會再觸發
  await tick();
  q('button').click();
  const key = (k, o = {}) => q('input').dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  key('Enter');
  key('a');
  key('s');
  key('s', { ctrlKey: true });
  key('Escape', { shiftKey: true });
  key('Escape');
  q('textarea').dispatchEvent(new window.FocusEvent('focus'));
  q('em').dispatchEvent(new window.Event('bs.modal.show'));
  assert.deepStrictEqual(log, ['a:true', 'div', 'p.self', 'div', 'once', 'div', 'div', 'div', 'enter', 'ctrl+s', 'esc exact', 'capture', 'bs.modal.show']);
  h.unmount();

  const got = [];
  const Btn = $.component({ view: (vm) => $('button').on('click', () => vm.$emit('hit', 1)) });
  $(Btn).on('hit.once', (v) => got.push(v)).mount('#app');
  app().querySelector('button').click();
  app().querySelector('button').click();
  assert.deepStrictEqual(got, [1], '元件事件也支援 .once');
});

test('片段：view 回傳多個節點、元件多根節點、keyed 片段搬移', async () => {
  const Pair = $.component({ props: ['k'], view: (vm) => [$('dt').text(vm.k), $('dd').text(vm.k.toUpperCase())] });
  const s = $.reactive({ list: ['a', 'b', 'c'], extra: false });
  const h = $.render(() => [
    $('dl').each(s.list, (k) => Pair({ k }).key(k)),
    s.extra && $('p').text('extra'),
    $.fragment($('i').text('1'), $('i').text('2')),
  ], '#app');
  const text = () => app().textContent;
  assert.strictEqual(text(), 'aAbBcC12');
  const dtA = app().querySelector('dt');
  s.list.reverse();
  s.extra = true;
  await tick();
  assert.strictEqual(text(), 'cCbBaAextra12');
  assert.strictEqual(app().querySelectorAll('dt')[2], dtA, '片段整組搬移，節點沿用');
  s.list.splice(1, 1);
  await tick();
  assert.strictEqual(app().querySelector('dl').innerHTML, '<dt>c</dt><dd>C</dd><dt>a</dt><dd>A</dd>');
  h.unmount();
  assert.strictEqual(app().innerHTML, '');
});

test('Teleport：渲染到其他容器、更新、換目標、隨父層移除', async () => {
  document.body.insertAdjacentHTML('beforeend', '<div id="modal-root"></div><div id="other-root"></div>');
  const s = $.reactive({ open: true, msg: 'hi', to: '#modal-root' });
  const h = $.render(() => $('div.page').append(
    $('p').text('page'),
    s.open && $.teleport(s.to, $('div.modal').text(s.msg))
  ), '#app');
  const root = document.getElementById('modal-root');
  assert.strictEqual(root.innerHTML, '<div class="modal">hi</div>');
  assert.strictEqual(app().querySelector('.modal'), null);
  s.msg = 'updated';
  await tick();
  assert.strictEqual(root.textContent, 'updated');
  s.to = '#other-root';
  await tick();
  assert.strictEqual(root.innerHTML, '');
  assert.strictEqual(document.getElementById('other-root').textContent, 'updated');
  s.open = false;
  await tick();
  assert.strictEqual(document.getElementById('other-root').innerHTML, '');
  s.open = true;
  await tick();
  h.unmount();
  assert.strictEqual(document.getElementById('other-root').innerHTML, '', '父層卸載時一併移除');
});

test('provide / inject：跨層傳值、reactive 值會更新、預設值、別名、$.provide 全域', async () => {
  $.provide('appName', 'juicy');
  const theme = $.reactive({ color: 'red' });
  const Leaf = $.component({
    inject: { c: 'theme', size: { from: 'size', default: 'M' }, name: 'appName', missing: { default: () => 'fallback' } },
    view: (vm) => $('span').text(`${vm.c.color}/${vm.size}/${vm.name}/${vm.missing}`),
  });
  const Middle = $.component({ provide: { size: 'L' }, view: () => $('div').append($(Leaf)) });
  const vm = $.app({
    provide() { return { theme }; },
    view: () => $('section').append($(Middle), $(Leaf)),
  }).mount('#app');
  const spans = () => [...app().querySelectorAll('span')].map((x) => x.textContent);
  assert.deepStrictEqual(spans(), ['red/L/juicy/fallback', 'red/M/juicy/fallback']);
  theme.color = 'blue';
  await tick();
  assert.deepStrictEqual(spans(), ['blue/L/juicy/fallback', 'blue/M/juicy/fallback']);
  vm.$unmount();
});

test('錯誤處理：ErrorBoundary、errorCaptured、$.onError、保留上一次畫面', async () => {
  const errors = [];
  const off = $.onError((err, vm, info) => errors.push(`${info}: ${err.message}`));
  const Bomb = $.component({
    props: ['n'],
    view: (vm) => {
      if (vm.n > 1) throw new Error('boom ' + vm.n);
      return $('b').text('ok ' + vm.n);
    },
  });
  const s = $.reactive({ n: 1 });
  const h = $.render(() => $('div').append(
    $.ErrorBoundary({ fallback: (err, reset) => $('button').text('出錯：' + err.message).on('click', () => { s.n = 1; reset(); }) },
      Bomb({ n: s.n })),
    $('i').text('其他部分正常')
  ), '#app');
  assert.strictEqual(app().textContent, 'ok 1其他部分正常');
  s.n = 2;
  await tick();
  await tick();
  assert.strictEqual(app().textContent, '出錯：boom 2其他部分正常');
  assert.deepStrictEqual(errors, [], 'ErrorBoundary 已處理，不會到 $.onError');
  app().querySelector('button').click();
  await tick();
  await tick();
  assert.strictEqual(app().textContent, 'ok 1其他部分正常', 'reset 後重新渲染');
  h.unmount();

  // 沒有邊界：交給 $.onError；畫面保留上一次的結果；事件處理函式的錯誤也會被接住
  const t = $.reactive({ bad: false });
  const h2 = $.render(() => {
    if (t.bad) throw new Error('render failed');
    return $('button').text('safe').on('click', () => { throw new Error('click failed'); });
  }, '#app');
  t.bad = true;
  await tick();
  assert.strictEqual(app().textContent, 'safe', '保留上一次畫面');
  app().querySelector('button').click();
  assert.deepStrictEqual(errors, ['render: render failed', 'event:click: click failed']);
  h2.unmount();
  off();
});

test('Transition：進場 / 離場 class、等動畫結束才移除、首次渲染預設不跑（appear 可開啟）', async () => {
  const s = $.reactive({ show: false });
  const done = [];
  const h = $.render(() => $('div').append(
    $('p.first').transition({ name: 'pop', appear: true }).text('appear'),
    s.show && $('p.box').transition({ name: 'fade', duration: 30, onAfterEnter: () => done.push('enter'), onAfterLeave: () => done.push('leave') }).text('box')
  ), '#app');
  assert.ok(app().querySelector('.first').classList.contains('pop-enter-from'), 'appear: true 首次也會進場');
  s.show = true;
  await tick();
  const box = app().querySelector('.box');
  assert.deepStrictEqual([...box.classList], ['box', 'fade-enter-from', 'fade-enter-active']);
  await sleep(25);
  assert.ok(box.classList.contains('fade-enter-to') && !box.classList.contains('fade-enter-from'));
  await sleep(60);
  assert.deepStrictEqual([...box.classList], ['box'], '結束後清掉 class');
  s.show = false;
  await tick();
  assert.ok(box.isConnected, '離場動畫期間仍在頁面上');
  assert.ok(box.classList.contains('fade-leave-active'));
  await sleep(90);
  assert.ok(!box.isConnected, '動畫結束才移除');
  assert.deepStrictEqual(done, ['enter', 'leave']);
  h.unmount();
});

test('路由：巢狀路由（outlet）、meta 合併、beforeEnter / beforeLeave、元件當 view', async () => {
  const log = [];
  const UserPage = $.component({ props: ['route'], view: (vm) => $('p').text('user ' + vm.route.params.id) });
  let dirty = false;
  const r = $.router({
    mode: 'memory',
    routes: {
      '/': () => $('h1').text('home'),
      '/admin': {
        meta: { auth: true, title: 'Admin' },
        view: (route, router, outlet) => $('section').append($('h2').text('layout'), outlet || $('i').text('(empty)')),
        beforeEnter: (to) => log.push('enter admin ' + to.path),
        beforeLeave: () => log.push('leave admin'),
        children: {
          '': () => $('p').text('dashboard'),
          'users/:id': { view: UserPage, meta: { title: 'User' } },
          'edit': { view: () => $('form').text('edit') },
        },
      },
    },
  });
  const h = r.mount('#app');
  r.push('/admin');
  await tick();
  assert.strictEqual(app().innerHTML, '<section><h2>layout</h2><p>dashboard</p></section>');
  assert.deepStrictEqual({ ...r.route.meta }, { auth: true, title: 'Admin' });
  const layout = app().firstChild;
  r.push('/admin/users/7');
  await tick();
  assert.strictEqual(app().innerHTML, '<section><h2>layout</h2><p>user 7</p></section>');
  assert.strictEqual(app().firstChild, layout, '切換子頁面時外層 layout 保留');
  assert.deepStrictEqual({ ...r.route.meta }, { auth: true, title: 'User' }, '子路由 meta 覆蓋父層');
  r.push('/admin/users/8');
  await tick();
  assert.strictEqual(app().textContent, 'layoutuser 8');

  // 動態離開確認（例如表單未存檔）
  r.push('/admin/edit');
  const off = r.beforeLeave(() => (dirty ? (log.push('blocked'), false) : undefined));
  dirty = true;
  assert.strictEqual(r.push('/'), false);
  assert.strictEqual(r.route.path, '/admin/edit');
  dirty = false;
  off();
  assert.strictEqual(r.push('/'), true);
  await tick();
  assert.strictEqual(app().innerHTML, '<h1>home</h1>');
  assert.deepStrictEqual(log, ['enter admin /admin', 'blocked', 'leave admin']);
  h.unmount();
  r.stop();
});

test('路由：元件建立期間註冊的 beforeLeave 會在卸載時移除；scrollBehavior 取得儲存的位置', async () => {
  const calls = [];
  const Form = $.component({
    created() { router.beforeLeave(() => (calls.push('guard'), true)); },
    view: () => $('form'),
  });
  const scrolls = [];
  const oldScrollTo = window.scrollTo;
  window.scrollTo = (o) => scrolls.push(o.top);
  const router = $.router({
    mode: 'memory',
    routes: { '/': () => $('p').text('home'), '/form': Form, '/b': () => $('p').text('b') },
    scrollBehavior: (to, from, saved) => saved || { top: 0 },
  });
  const h = router.mount('#app');
  router.push('/form');
  await tick();
  router.push('/b'); // guard 執行，Form 卸載 → guard 移除
  await tick();
  router.push('/');
  await tick();
  assert.deepStrictEqual(calls, ['guard'], '元件卸載後不再執行');
  const setY = (y) => Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  setY(300);
  router.push('/b');
  await sleep(0);
  setY(0);
  router.back(); // 回到 '/'：用儲存的位置
  await sleep(0);
  assert.deepStrictEqual(scrolls, [0, 0, 0, 0, 300]);
  window.scrollTo = oldScrollTo;
  h.unmount();
  router.stop();
});

test('$.resource：追蹤依賴、只採用最後一次結果、中止舊請求、null 不抓、mutate / refetch / error', async () => {
  const s = $.reactive({ id: 1 });
  const pending = {};
  const aborted = [];
  const res = $.resource(() => s.id, (id, { signal }) => new Promise((resolve, reject) => {
    pending[id] = { resolve, reject };
    signal.addEventListener('abort', () => aborted.push(id));
  }));
  assert.strictEqual(res.loading, true);
  s.id = 2;
  await tick();
  pending[2].resolve('user2');
  await sleep(0);
  pending[1].resolve('user1'); // 晚到的舊結果
  await sleep(0);
  assert.strictEqual(res.data, 'user2', '只採用最後一次請求');
  assert.deepStrictEqual(aborted, [1], '舊請求被中止');
  assert.strictEqual(res.loading, false);
  assert.strictEqual(res.ready, true);
  res.mutate((d) => d + '!');
  assert.strictEqual(res.data, 'user2!');
  s.id = null;
  await tick();
  assert.strictEqual(res.loading, false, 'source 為 null 時不抓');
  s.id = 3;
  await tick();
  pending[3].reject(new Error('404'));
  await sleep(0);
  assert.strictEqual(res.error.message, '404');
  const again = res.refetch();
  pending[3].resolve('user3');
  assert.strictEqual(await again, 'user3');
  assert.strictEqual(res.error, null);
  res.stop();

  // 單一函式形式：同步讀到的 reactive 資料就是依賴；在元件中建立時會隨元件停止
  const q = $.reactive({ word: 'a' });
  let calls = 0;
  const Search = $.component({
    data() { return { r: $.resource(() => (calls++, Promise.resolve('result:' + q.word))) }; },
    view: (vm) => $('p').text(vm.r.loading ? '…' : vm.r.data),
  });
  const vm = $.app({ data: { on: true }, view: (vm) => $('div').append(vm.on && $(Search)) }).mount('#app');
  await sleep(0);
  await tick();
  assert.strictEqual(app().textContent, 'result:a');
  q.word = 'b';
  await sleep(0);
  await tick();
  assert.strictEqual(app().textContent, 'result:b');
  vm.on = false;
  await tick();
  q.word = 'c';
  await sleep(0);
  assert.strictEqual(calls, 2, '元件卸載後停止');
  vm.$unmount();
});

test('具名 / 作用域插槽：$slot、$slots、$hasSlot、fallback、插槽內 .model 綁父層', async () => {
  const Table = $.component({
    props: ['rows'],
    view: (vm) => $('div').append(
      $('header').append(vm.$slot('header') || $('b').text('預設標題')),
      $('ul').each(vm.rows, (row, i) => $('li').append(vm.$slot('row', row, i) || String(row))),
      vm.$hasSlot('footer') && $('footer').append(vm.$slot('footer')),
      $('main').append(vm.$slot('default'))
    ),
  });
  const vm = $.app({
    data: { rows: ['a', 'b'], q: '' },
    view: (vm) => $('section').append(
      Table({ rows: vm.rows })
        .slot('header', [$('h3').text('清單'), $('input').model('q')])
        .slot('row', (row, i) => $('span').text(`${i}:${row}:${vm.q}`))
        .append($('p').text('default slot')),
      Table({ rows: [1] })
    ),
  }).mount('#app');
  const [t1, t2] = app().querySelectorAll('section > div');
  assert.strictEqual(t1.querySelector('header').innerHTML, '<h3>清單</h3><input>');
  assert.strictEqual(t1.querySelector('ul').innerHTML, '<li><span>0:a:</span></li><li><span>1:b:</span></li>');
  assert.strictEqual(t1.querySelector('main').innerHTML, '<p>default slot</p>');
  assert.strictEqual(t1.querySelector('footer'), null);
  assert.strictEqual(t2.querySelector('header').innerHTML, '<b>預設標題</b>', 'fallback');
  assert.strictEqual(t2.querySelector('ul').innerHTML, '<li>1</li>');
  const input = t1.querySelector('input');
  input.value = 'x';
  input.dispatchEvent(new window.Event('input'));
  await tick();
  await tick();
  assert.strictEqual(vm.q, 'x', '插槽內的 .model 綁到父層');
  assert.strictEqual(t1.querySelector('li span').textContent, '0:a:x');
  vm.$unmount();
});

test('效能：LIS 讓重新排序的 DOM 搬移最少、markRaw、shallowReactive、memo', async () => {
  const s = $.reactive({ list: [1, 2, 3, 4, 5, 6] });
  const h = $.render(() => $('ul').each(s.list, (n) => $('li').key(n).text(n)), '#app');
  const ul = app().firstChild;
  let moves = 0;
  const orig = ul.insertBefore.bind(ul);
  ul.insertBefore = (a, b) => (moves++, orig(a, b));
  s.list = [6, 1, 2, 3, 4, 5]; // 最後一個移到最前面
  await tick();
  assert.strictEqual(moves, 1, '只搬移 1 個節點');
  moves = 0;
  s.list = [1, 2, 4, 3, 5, 6];
  await tick();
  assert.strictEqual(ul.textContent, '124356');
  assert.strictEqual(moves, 2);
  h.unmount();

  const big = $.markRaw({ deep: { x: 1 } });
  const st = $.reactive({ big, shallow: $.shallowReactive({ a: 1, nested: { b: 1 } }) });
  assert.strictEqual(st.big, big, 'markRaw 物件不會被包裝');
  assert.strictEqual($.toRaw(st.shallow.nested), st.shallow.nested, 'shallowReactive 巢狀不包裝');
  let runs = 0;
  $.effect(() => { runs++; st.shallow.a; st.shallow.nested.b; st.big.deep.x; });
  st.shallow.nested.b = 2;
  st.big.deep.x = 2;
  assert.strictEqual(runs, 1, '巢狀 / markRaw 的變動不會觸發');
  st.shallow.a = 2;
  assert.strictEqual(runs, 2);

  let rendered = 0;
  const m = $.reactive({ items: [{ id: 1, t: 'a' }, { id: 2, t: 'b' }], tick: 0 });
  const h2 = $.render(() => $('ul').append(m.items.map((it) =>
    $('li').key(it.id).memo([it.t]).text((rendered++, it.t))
  )), '#app');
  const before = app().querySelectorAll('li')[0];
  m.items[1].t = 'B';
  await tick();
  assert.strictEqual(app().textContent, 'aB');
  assert.strictEqual(app().querySelectorAll('li')[0], before);
  assert.strictEqual(rendered, 4, '重繪時兩個 li 的 view 都會執行，但第一個 deps 沒變就跳過比對');
  h2.unmount();
});

test('元件：options.name 只是顯示名稱，不會註冊成標籤（避免 name: "Footer" 讓 $("footer") 變成元件）', () => {
  const Footer = $.component({ name: 'Footer', view: () => $('footer').text('site footer') });
  assert.strictEqual(Footer.displayName, 'Footer');
  $(Footer).mount('#app');
  assert.strictEqual(app().innerHTML, '<footer>site footer</footer>', '元件裡的 $("footer") 仍是 HTML 元素');
  const warn = console.warn;
  const warned = [];
  console.warn = (m) => warned.push(m);
  $.component('widget', { view: () => $('i') });
  console.warn = warn;
  assert.ok(warned[0].includes('建議包含 -'), '註冊沒有 - 的名稱時提醒');
});

test('$.fn 外掛擴充', () => {
  $.fn.red = function () { return this.css({ color: 'red' }); };
  $('i').red().text('x').mount('#app');
  assert.strictEqual(app().firstChild.style.color, 'red');
});

(async () => {
  // node test/juicy.test.js router   只執行名稱包含「router」的測試
  const filter = process.argv[2];
  const selected = filter ? tests.filter((t) => t.name.includes(filter)) : tests;
  if (filter && !selected.length) {
    console.log(`沒有名稱包含「${filter}」的測試`);
    process.exit(1);
  }
  let failed = 0;
  for (const t of selected) {
    try {
      await t.fn();
      console.log('✓', t.name);
    } catch (e) {
      failed++;
      console.log('✗', t.name, '\n  ', e.message);
    }
  }
  console.log(`\n${selected.length - failed}/${selected.length} 通過`);
  process.exit(failed ? 1 : 0);
})();

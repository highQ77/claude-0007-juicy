# juicy.js

**中文** | [English](README.en.md)

> 本專案僅為示範用，請勿在正式專案使用。

類 jQuery 的鏈式 API，底層是虛擬 DOM，內建 MVVM（響應式資料 + 雙向綁定）、元件、路由、多語系、全域狀態管理與非同步資料，附 TypeScript 型別。零相依、單一檔案。

完整的互動文件：開啟 `index.html`（側欄可切換中文 / English，或在網址加上 `?lang=en`）。

範例：[examples/](examples/)，例如搭配 Tailwind CSS 的形象官網 [examples/brand-site](examples/brand-site/)（以 ES module 組成，需用 `npm run serve` 開啟；`npm run build:example` 可打包成單一檔案）。

```html
<script src="src/juicy.js"></script>
<script>
  $('div').css({ color: '#FFCC00' }).text('Hello').mount('#app');
</script>
```

也可以用模組匯入，並附有 TypeScript 型別（`types/juicy.d.ts`）：

```js
import $, { reactive, defineStore } from 'juicy';   // ES module（dist/juicy.mjs），不建立全域變數
const $ = require('juicy');                          // CommonJS
```

`dist/juicy.mjs` 由 `npm run build` 從 `src/juicy.js` 產生（只需要維護一個原始檔）。

## 運作原理

```
$('div').css().append()...   →  只建立虛擬節點（純 JS 物件）
             .mount('#app')  →  這時才一次生成真實 DOM
資料變動（MVVM）             →  重新執行 view() 產生新 vnode → diff → 只 patch 有變的地方
```

同一個 tick 內多次修改資料，只會重繪一次（microtask 批次更新）。

## 鏈式 API

| 方法 | 說明 |
| --- | --- |
| `$('div')` / `$('div#id.a.b')` / `$('<div>')` | 建立虛擬節點 |
| `.css({...})` / `.css('color', 'red')` / `.css('color')` | 樣式；數字自動補 `px`，支援 camelCase、kebab-case、`--var` |
| `.attr()` / `.prop()` | HTML 屬性 / DOM property，用法同 `css` |
| `.id()` `.addClass()` `.removeClass()` `.toggleClass()` | `addClass({ active: isOn })` 可條件式加 class |
| `.text()` / `.html()` | 文字 / innerHTML |
| `.append(...子節點)` | 接受 `$()`、字串、陣列（自動攤平）、`null/false`（忽略） |
| `.appendTo(parent)` | 加到父層 |
| `.child('li')` … `.end()` | 進入子元素鏈式操作，`end()` 回到父層 |
| `.each(list, fn)` | 對陣列每項 `append(fn(item, i))` |
| `.when(cond, fn, elseFn)` | 條件式鏈式 |
| `.show(cond)` | false 時 `display:none` |
| `.on('click', fn)` | 事件（可用空白綁多個事件），可加修飾符，見下方「事件修飾符」 |
| `.key(k)` | 列表 key，重新排序時搬移節點而非重建（以 LIS 讓搬移次數最少） |
| `.ref(fn \| 'name')` | 取得真實元素 / 元件 vm，見下方「ref」 |
| `.transition('fade')` | 進場 / 離場動畫，見下方「動畫」 |
| `.slot('name', content \| fn)` | 具名 / 作用域插槽（用在元件上） |
| `.memo([deps])` | deps 不變時跳過子樹比對 |
| `.link('/path', router)` | 路由連結：設定 href、點擊改用 `router.push`、符合目前路由時加 `active` class（見下方「路由」） |
| `.t('key', params)` | 翻譯文字，等同 `.text(i18n.t(...))`（見下方「多語系」） |
| `.model('key', { number, trim, lazy })` | 雙向綁定（input / textarea / select / checkbox / radio） |
| `.mount('#app')` | 產生真實 DOM 並掛載，回傳 chain 本身（已掛載過會先釋放舊 DOM 再搬過去） |

擴充外掛：`$.fn.red = function () { return this.css({ color: 'red' }); }`

### 事件修飾符

```js
$('form').on('submit.prevent', save);                 // preventDefault
$('a').on('click.stop.once', fn);                      // stopPropagation、只觸發一次
$('div').on('click.self', close);                      // 只在事件發生在元素本身時
$('input').on('keydown.enter', add).on('keyup.esc', clear);
$('input').on('keydown.ctrl.s.prevent', save);        // 系統鍵 ctrl / alt / shift / meta；.exact 不能同時按其他系統鍵
$('div').on('scroll.passive', fn).on('focus.capture', fn);
$('div').on('click.right', fn);                        // 滑鼠按鍵 left / middle / right
```

按鍵可用 `.enter` `.esc` `.space` `.tab` `.up` `.down` `.left` `.right` `.delete`，或任何 `e.key`（如 `.a`、`.page-down`）。

## MVVM

```js
const vm = $.app({
  data: { count: 0, name: '' },
  computed: { double() { return this.count * 2; } },
  methods:  { inc() { this.count++; } },
  watch:    { count(n, o) { console.log(o, '→', n); } },
  mounted() {},
  view(vm) {
    return $('div').append(
      $('input').model('name'),
      $('p').text(`Hi ${vm.name}, ${vm.count} × 2 = ${vm.double}`),
      $('button').text('+1').on('click', vm.inc)
    );
  },
}).mount('#app');

vm.count = 10; // 畫面自動更新
```

`vm` 上另有 `$state`、`$el`、`$refs`、`$watch()`、`$nextTick()`、`$provide()`、`$unmount()`；`$.app` 也支援 `provide` / `inject` / `errorCaptured`（與元件相同）。

### 卸載

```js
vm.$unmount();           // 卸載 $.app：停止 watch 並呼叫 unmounted
```

卸載時會移除 DOM、解除所有事件監聽、斷開 vnode ↔ DOM 參照；內部若有元素被當成其他 mount 的容器，也會一併卸載。同一容器重複 mount 會自動先卸載舊內容。

### 不使用 $.app 的底層 API

```js
const state = $.reactive({ n: 0 });
$.render(() => $('h1').text(state.n), '#app'); // 傳函式 = 響應式渲染
state.n++;

$.computed(() => ...)  $.watch(getter, cb, { deep, immediate })  $.effect(fn)  $.nextTick()
```

在 `$.app` 之外做雙向綁定請傳入物件：`.model(state, 'user.name')`。

## 元件

```js
const Counter = $.component('my-counter', {   // 名稱可省略；有名稱時 $('my-counter') 也能建立（名稱要包含 -）
  props: { label: '計數', step: 1 },          // 預設值；也可寫成 ['label', 'step']
  emits: ['change'],                          // 宣告元件事件；其他事件（如 click）會綁到根元素
  data() { return { count: 0 }; },            // 請用函式，每個實例各自一份；this 可讀 props
  computed: { text() { return `${this.label}: ${this.count}`; } },
  methods: { inc() { this.count += this.step; this.$emit('change', this.count); } },
  mounted() {}, updated() {}, unmounted() {},
  view: (vm, children) => $('button').text(vm.text).on('click', vm.inc),  // 單一根節點，或陣列（多個根節點）
});

$('div').append(
  Counter({ step: 2 }).on('change', (n) => console.log(n)),
  $(Counter, { label: 'B' }).addClass('big'),  // class / style / attr 會加到元件根元素
  $('my-counter').key('c'),
).mount('#app');
```

- 父層重繪時只更新變動的 props，元件內部狀態與 DOM 會保留；列表請加 `.key()`。
- props 是唯讀的，要改請 `$emit` 通知父層。
- 插槽：`Card({ title }).append($('p').text('內容'))`，元件以 `view(vm, children)` 或 `vm.$children` 放置。插槽內容在父層建立，其中的 `.model('x')` 綁的是父層資料。
- 雙向綁定：`$('star-rating').model('rate')` 會傳入 `value` prop，元件以 `vm.$emit('input', 新值)` 回報。
- 實例屬性：`$props`、`$children`、`$el`、`$parent`、`$listeners`、`$refs`、`$emit()`、`$slot()` / `$slots` / `$hasSlot()`、`$provide()` / `$inject()`，以及與 `$.app` 相同的 `$watch()`、`$nextTick()`。
- 只有 `$.component('my-tag', options)` 這種寫法會註冊標籤名稱；options 裡的 `name` 只是除錯用的顯示名稱。名稱沒有 `-` 時會提出警告，因為可能和 HTML 標籤衝突（例如註冊成 `footer` 會讓 `$('footer')` 變成元件）。

### 插槽與 provide / inject

```js
const Table = $.component({
  props: ['rows'],
  view: (vm) => $('table').append(
    $('caption').append(vm.$slot('title') || '預設標題'),          // 具名插槽，沒提供時回傳 null
    vm.rows.map((row) => $('tr').append(vm.$slot('row', row))),     // 作用域插槽：把資料交給父層
    vm.$hasSlot('footer') && $('tfoot').append(vm.$slot('footer')),
  ),
});
Table({ rows }).slot('title', $('b').text('成績')).slot('row', (row) => $('td').text(row.name));

// 祖先 provide、任意深度的後代 inject（provide reactive 物件，後代就會跟著更新）
$.app({ data: { theme: { dark: false } }, provide() { return { theme: this.theme }; }, view: ... });
$.component({ inject: ['theme'], view: (vm) => $('button').addClass({ dark: vm.theme.dark }) });
// inject 也可以寫 { color: 'theme' }（別名）或 { size: { from: 'size', default: 'M' } }；全域值用 $.provide(key, value)
```

### 匯入元件

```js
// components/user-card.js
export default ($) => $.component({ props: ['name'], view: (vm) => $('b').text(vm.name) });

// 頁面
const UserCard = $.import('./components/user-card.js', {
  name: 'user-card',                         // 可選：註冊成 $('user-card')
  loading: () => $('span').text('載入中…'),
  error: (err, retry) => $('button').text('重試').on('click', retry),
});
$('div').append(UserCard({ name: 'Ada' })).mount('#app');   // 立即可用，載入完自動換上

$.import(() => import('./user-card.js'));    // 打包工具 / 自訂載入：傳回傳 Promise 的函式
await UserCard.load();                       // 預先載入；UserCard.status() 查詢狀態
```

模組可匯出 `$.component()` 的結果、元件設定物件 `{ view, ... }`，或 `($) => 上述兩者`；用 `export` 選項指定非 default 的匯出名稱。以網址載入時路徑相對於頁面，且頁面必須透過 http(s) 開啟（`file://` 下瀏覽器不允許載入模組）。

## 進階畫面

直接操作真實元素、動畫、多根節點 / 渲染到別處，以及錯誤處理。

### ref

```js
$('input').ref((el) => (input = el));     // 掛載後傳入元素，卸載時傳入 null；用在元件上則是元件的 vm
$('input').ref('name');                   // 存到所在 view 的 vm.$refs.name（不在 view 中則存到 $.refs）
```

### 動畫

```js
$('p').transition('fade')                                  // fade-enter-from / -active / -to，離場為 fade-leave-*
$('p').transition({ name: 'fade', appear: true, duration: 300, onAfterLeave(el) {} })
```

```css
.fade-enter-active, .fade-leave-active { transition: opacity .3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
```

元素會等 CSS transition / animation 結束才真的移除；第一次渲染預設不跑進場動畫（`appear: true` 可開啟）。

### 片段與 Teleport

```js
view: () => [$('dt').text(k), $('dd').text(v)]           // 元件 / view 可以回傳多個根節點
$.fragment($('li'), $('li')).key('group')                 // 明確建立片段
$.teleport('body', $('div.modal').text('對話框'))         // 渲染到別的容器，父層移除時一併移除
```

### 錯誤處理

```js
$.ErrorBoundary({ fallback: (err, reset) => $('button').text('重試').on('click', reset) }, Profile());
$.component({ errorCaptured(err, vm, info) { report(err); return false; }, view: ... }); // 回傳 false 不再往上傳
const off = $.onError((err, vm, info) => monitor.send(err, info));                    // 全域
```

元件的 view、生命週期、事件處理函式或 watch 出錯時，出錯的元件保留上一次的畫面（第一次渲染則是空白），錯誤往上交給祖先的 `errorCaptured`，最後交給 `$.onError`；都沒有處理時印到 console。`info` 是錯誤位置，例如 `'render'`、`'watch'`、`'event:click'`、`'mounted'`。

## 路由

```js
const router = $.router({
  // mode: 'hash'（預設，#/path）| 'history'（需伺服器導回 index.html，可配 base）| 'memory'（不碰網址）
  routes: {
    '/': () => $('h1').text('首頁'),
    '/user/:id': (route) => $('p').text(`使用者 ${route.params.id}，tab=${route.query.tab}`),
    '/docs/*': (route) => $('p').text(route.params.pathMatch),
    '/old': '/new',                         // 字串 = 轉址
    '*': (route) => $('p').text('404'),     // 找不到時，永遠最後比對
  },
  beforeEach(to, from) { if (to.path === '/admin' && !loggedIn) return '/login'; }, // false 取消、字串轉址
  afterEach(to, from) {},
});

$.render(() =>
  $('div').append(
    $('nav').append(
      $('a').link('/').text('首頁'),                         // 預設使用最後建立的 router
      $('a').link('/user/7?tab=posts', router).text('使用者'),
      $('a').link('/docs', { router, exact: false }).text('文件'), // 前綴符合也算 active
    ),
    router.view()                                            // 目前路由的畫面
  ), '#app');
// 只顯示路由畫面時可簡寫成 router.mount('#app')

router.push('/user/1');                // { replace: true } 不新增歷史紀錄
router.back(); router.forward(); router.go(-2);
router.route;                          // reactive：{ path, fullPath, params, query, matched, meta }
router.stop();                         // 停止監聽瀏覽器網址變化
```

`router.route` 是 reactive 物件，所以在 `$.app` 的 `computed` / `watch` / `view` 裡讀它，路由切換時都會自動更新。`.link()` 被按住 ⌘/Ctrl/Shift 點擊時不攔截，保留「新分頁開啟」。hash 模式在直接開啟檔案（`file://`，瀏覽器不允許 `pushState`）時會改用 `location.hash`，一樣可以使用。

### 巢狀路由、meta、守衛與捲動

```js
$.router({
  routes: {
    '/admin': {
      view: (route, router, outlet) => $('div.layout').append(Sidebar(), outlet), // 子頁面以 outlet 傳入，切換時 layout 保留
      meta: { auth: true },                          // 從外到內合併成 route.meta
      beforeEnter: (to, from) => {},                 // 單一路由的守衛
      beforeLeave: (to, from) => {},
      children: {
        '': Dashboard,                               // 元件可以直接當 view（會收到 route prop）
        'users/:id': UserPage,
        'reports': $.import(() => import('./reports.js')),   // 延遲載入的頁面
      },
    },
  },
  beforeEach: (to) => (to.meta.auth && !loggedIn ? '/login' : undefined),
  scrollBehavior: (to, from, saved) => saved || { top: 0 },   // 上一頁時回到原本位置；也可回傳 { el: '#id' }
});

// 元件中註冊「離開前確認」，元件卸載時自動移除
created() { router.beforeLeave(() => !this.dirty || confirm('還沒存檔，確定離開？')); }
```

## 全域狀態

```js
// stores/cart.js —— 定義一次，任何地方 $.store('cart') 都拿到同一個實例
$.store('cart', {
  state: () => ({ items: [], coupon: 0 }),
  getters: {
    count: (state) => state.items.length,
    total(state) { return state.items.reduce((n, i) => n + i.price, 0) - this.coupon; }, // this = store
  },
  actions: {
    add(item) { this.items.push(item); },
    async checkout() { await api.pay(this.total); this.$reset(); },
  },
  persist: { key: 'cart', paths: ['items'] },   // 可選：存到 localStorage（可只存部分欄位）
});

// 任何元件 / 畫面
const cart = $.store('cart');
$('span').text(`🛒 ${cart.count}`);            // 在 view 裡讀取會自動追蹤，store 一變就重繪
cart.add({ name: '咖啡', price: 80 });
cart.coupon = 10;                               // 也可以直接改 state

cart.$patch({ coupon: 0 });                     // 深層合併；或 $patch((state) => { ... })
cart.$reset();                                  // 回到初始狀態
cart.$subscribe((state) => console.log(state)); // 任何變動（同一 tick 只通知一次），回傳取消函式
cart.$onAction(({ name, args, after, onError }) => after((r) => console.log(name, args, r)));
cart.$watch('total', (n, o) => {});
cart.$dispose();                                // 停止訂閱並從全域移除
```

- 同一個 id 再次定義會回傳既有實例；`$.store('id')` 找不到時丟出錯誤。`$.store.has(id)` / `$.store.list()` 可查詢。
- `$.store({ ... })`（不給 id）建立不註冊的 store。
- getters 有快取且唯讀；actions 可以是 async，`this` 為 store。

## 非同步資料

```js
const user = $.resource(() => state.id, (id, { signal }) => fetch(`/api/users/${id}`, { signal }).then((r) => r.json()));
user.data; user.loading; user.error; user.ready;      // 都是 reactive
user.refetch(); user.mutate((u) => ({ ...u, name: 'x' })); user.stop();

$.resource(({ signal }) => fetch(`/api/search?q=${state.q}`, { signal }), { interval: 5000 }); // 只給一個函式：同步讀到的資料就是依賴
```

- `source()` 的值變動時自動重新抓取；舊請求會被中止（AbortSignal），晚到的結果會被忽略，不會有競態問題。值為 `null` / `undefined` / `false` 時不抓。
- 選項：`{ initial, lazy, interval, onSuccess, onError }`。
- 在元件或 `$.app` 的 data / created 中建立時，卸載時自動停止。

## 多語系

```js
const i18n = $.i18n({
  locale: 'zh-TW',                 // 省略時依瀏覽器語言挑選
  fallback: 'en',                  // 找不到翻譯時的備用語言；查詢順序 zh-TW → zh → en → key 本身
  messages: {
    en: {
      hello: 'Hello, {name}!',
      nav: { home: 'Home' },                             // 巢狀 key：t('nav.home')
      cart: 'Cart is empty | 1 item | {n} items',        // 複數：0 | 1 | 其他（2 段 = 單數 | 複數）
      files: { one: '{n} file', other: '{n} files' },    // 或依 Intl.PluralRules 的分類
      greet: (p) => (p.hour < 12 ? 'Good morning' : 'Good evening'), // 函式訊息
    },
    'zh-TW': { hello: '你好，{name}！', nav: { home: '首頁' }, cart: '購物車是空的 | 1 件 | {n} 件' },
  },
  loaders: { ja: () => import('./locales/ja.js') },     // 第一次切換到 ja 時才載入
  missing(key, locale) { console.warn('缺少翻譯', key); }, // 可選
});

i18n.t('hello', { name: 'Ada' });   // 你好，Ada！
i18n.t('cart', 3);                  // 3 件（數字是 { n: 3 } 的簡寫）
i18n.n(1234.5, { style: 'currency', currency: 'TWD' });
i18n.d(new Date(), 'long');         // 依目前語言格式化日期

$.render(() => $('div').append(
  $('h1').t('hello', { name: 'Ada' }),         // 鏈式寫法（使用最後建立的 i18n）
  $('button').text('English').on('click', () => (i18n.locale = 'en')),
), '#app');

await i18n.setLocale('ja');         // 有 loaders 時會先載入；i18n.loading 為載入中的語言
i18n.add('en', { bye: 'Bye' });     // 加入 / 合併翻譯
```

- `i18n.locale` 是 reactive 的：在 `$.render` / `$.app` / 元件的 view 裡呼叫 `t()`，切換語言時畫面自動 patch。
- 找不到翻譯時回傳 key 本身，所以也可以直接用原文當 key（gettext 風格）：`t('儲存')`，英文翻譯寫成 `{ '儲存': 'Save' }`。本專案的文件就是這樣做中英切換（英文字典在 `docs/i18n-en.js`）。
- `$.t(key, params)` 使用最後建立的 i18n；另有 `i18n.has(key)`、`i18n.locales`、`i18n.detect()`。

## 效能

- `$.markRaw(obj)`：標記物件永遠不轉成 reactive（大型唯讀資料、第三方實例）。
- `$.shallowReactive(obj)`：只追蹤第一層屬性。
- `.memo([deps])`：deps 不變時跳過整棵子樹的比對。
- keyed 列表以最長遞增子序列（LIS）找出不必移動的節點：把最後一項移到最前面只會搬移 1 個 DOM 節點。

## 注意

- `.model()` 對 `input` 需要先設 `type`（例如 `.attr('type','checkbox').model('ok')`），因為綁定方式依 type 決定。
- 陣列採粗粒度追蹤：陣列的任何變動都會通知所有讀過它的地方。
- 只有一般物件與陣列會變成響應式；`Map`、`Set`、`Date`、class 實例維持原樣。

## 專案結構

| 路徑 | 內容 |
| --- | --- |
| `src/juicy.js` | 函式庫原始碼（單一 UMD 檔，唯一需要維護的原始檔） |
| `dist/juicy.mjs` | ES module 版本，由 `npm run build` 產生 |
| `types/juicy.d.ts` | TypeScript 型別；`types/test.ts` 為型別測試 |
| `index.html` | 互動文件；英文翻譯在 `docs/i18n-en.js` |
| `examples/` | 範例（見 [examples/README.md](examples/README.md)） |
| `components/` | 互動文件中 `$.import()` 範例載入的元件 |
| `scripts/` | `build.js`（產生 dist）、`build-example.js`（打包範例）、`serve.js`（本機伺服器） |
| `test/` | 單元測試、ESM 測試、文件翻譯與範例測試 |
| `CLAUDE.md` | 給 Claude Code 的專案說明（架構與修改時的注意事項） |

## 開發與測試

```bash
npm install                      # 安裝 jsdom、typescript、esbuild（開發用）
npm test                         # 全部：dist 是否最新、單元測試、ESM、文件中英翻譯與範例、TypeScript 型別
node test/juicy.test.js          # 只跑單元測試
node test/juicy.test.js router   # 只跑名稱包含「router」的測試
node test/docs-i18n.test.js      # 文件的英文翻譯是否齊全、範例在中英文下都能執行
npm run typecheck                # TypeScript 型別檢查
npm run build                    # 修改 src/juicy.js 後重新產生 dist/juicy.mjs
npm run serve                    # 本機伺服器（http://localhost:8080/），範例以 ES module 載入時需要
npm run build:example            # 把 examples/brand-site 打包成 examples/brand-site/dist/app.js
```

修改 `index.html` 的中文文字時，請同時在 `docs/i18n-en.js` 加上英文翻譯（`node test/docs-i18n.test.js` 會列出缺少的項目）。

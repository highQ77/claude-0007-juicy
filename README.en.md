# juicy.js

[中文](README.md) | **English**

> This project is for demonstration only; do not use it in production.

A jQuery-style chaining API on top of a virtual DOM, with built-in MVVM (reactive data + two-way binding), components, routing, i18n, a global store and async data, with TypeScript types. Zero dependencies, a single file.

Interactive docs: open `index.html` (switch between 中文 / English in the sidebar, or add `?lang=en` to the URL).

Examples: [examples/](examples/), e.g. a corporate website built with Tailwind CSS in [examples/brand-site](examples/brand-site/) (made of ES modules, so open it with `npm run serve`; `npm run build:example` bundles it into a single file).

```html
<script src="src/juicy.js"></script>
<script>
  $('div').css({ color: '#FFCC00' }).text('Hello').mount('#app');
</script>
```

It can also be imported as a module, with TypeScript types included (`types/juicy.d.ts`):

```js
import $, { reactive, defineStore } from 'juicy';   // ES module (dist/juicy.mjs), creates no globals
const $ = require('juicy');                          // CommonJS
```

`dist/juicy.mjs` is generated from `src/juicy.js` by `npm run build` (there is only one source file to maintain).

## How it works

```
$('div').css().append()...   →  only builds virtual nodes (plain JS objects)
             .mount('#app')  →  the real DOM is created in one go, only now
data changes (MVVM)          →  view() runs again → new vnodes → diff → patch only what changed
```

Several data changes in the same tick re-render only once (microtask batching).

## Chaining API

| Method | Description |
| --- | --- |
| `$('div')` / `$('div#id.a.b')` / `$('<div>')` | Create a virtual node |
| `.css({...})` / `.css('color', 'red')` / `.css('color')` | Styles; numbers get `px` automatically; supports camelCase, kebab-case, `--var` |
| `.attr()` / `.prop()` | HTML attributes / DOM properties, same usage as `css` |
| `.id()` `.addClass()` `.removeClass()` `.toggleClass()` | `addClass({ active: isOn })` adds classes conditionally |
| `.text()` / `.html()` | Text / innerHTML |
| `.append(...children)` | Accepts `$()`, strings, arrays (flattened), `null/false` (ignored) |
| `.appendTo(parent)` | Append to a parent |
| `.child('li')` … `.end()` | Step into a child element; `end()` returns to the parent |
| `.each(list, fn)` | `append(fn(item, i))` for every item |
| `.when(cond, fn, elseFn)` | Conditional chaining |
| `.show(cond)` | `display:none` when false |
| `.on('click', fn)` | Events (several at once, separated by spaces); supports modifiers, see "Event modifiers" |
| `.key(k)` | List key; reordering moves nodes instead of rebuilding them (LIS keeps moves to a minimum) |
| `.ref(fn \| 'name')` | Get the real element / component vm, see "Refs" |
| `.transition('fade')` | Enter / leave animations, see "Transitions" |
| `.slot('name', content \| fn)` | Named / scoped slots (on components) |
| `.memo([deps])` | Skip diffing the subtree while deps are unchanged |
| `.link('/path', router)` | Router link: sets href, navigates with `router.push` on click, adds the `active` class when it matches (see "Routing") |
| `.t('key', params)` | Translated text, same as `.text(i18n.t(...))` (see "i18n") |
| `.model('key', { number, trim, lazy })` | Two-way binding (input / textarea / select / checkbox / radio) |
| `.mount('#app')` | Create the real DOM and mount it; returns the chain (if already mounted, the old DOM is released first) |

Plugins: `$.fn.red = function () { return this.css({ color: 'red' }); }`

### Event modifiers

```js
$('form').on('submit.prevent', save);                 // preventDefault
$('a').on('click.stop.once', fn);                      // stopPropagation, fire only once
$('div').on('click.self', close);                      // only when the event happens on the element itself
$('input').on('keydown.enter', add).on('keyup.esc', clear);
$('input').on('keydown.ctrl.s.prevent', save);        // system keys ctrl / alt / shift / meta; .exact forbids other system keys
$('div').on('scroll.passive', fn).on('focus.capture', fn);
$('div').on('click.right', fn);                        // mouse buttons left / middle / right
```

Keys: `.enter` `.esc` `.space` `.tab` `.up` `.down` `.left` `.right` `.delete`, or any `e.key` (e.g. `.a`, `.page-down`).

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

vm.count = 10; // the view updates automatically
```

`vm` also has `$state`, `$el`, `$refs`, `$watch()`, `$nextTick()`, `$provide()` and `$unmount()`; `$.app` also supports `provide` / `inject` / `errorCaptured` (same as components).

### Unmounting

```js
vm.$unmount();           // unmount a $.app: stops watchers and calls unmounted
```

Unmounting removes the DOM, detaches every event listener and breaks the vnode ↔ DOM references; any element inside that is itself used as a mount container is unmounted too. Mounting into the same container again unmounts the old content first.

### Low-level API without $.app

```js
const state = $.reactive({ n: 0 });
$.render(() => $('h1').text(state.n), '#app'); // passing a function = reactive rendering
state.n++;

$.computed(() => ...)  $.watch(getter, cb, { deep, immediate })  $.effect(fn)  $.nextTick()
```

For two-way binding outside `$.app`, pass the object: `.model(state, 'user.name')`.

## Components

```js
const Counter = $.component('my-counter', {   // the name is optional; with one, $('my-counter') works too (include a -)
  props: { label: 'Count', step: 1 },         // defaults; or ['label', 'step']
  emits: ['change'],                          // declared component events; others (e.g. click) go to the root element
  data() { return { count: 0 }; },            // use a function so each instance gets its own; this can read props
  computed: { text() { return `${this.label}: ${this.count}`; } },
  methods: { inc() { this.count += this.step; this.$emit('change', this.count); } },
  mounted() {}, updated() {}, unmounted() {},
  view: (vm, children) => $('button').text(vm.text).on('click', vm.inc),  // a single root node, or an array (several roots)
});

$('div').append(
  Counter({ step: 2 }).on('change', (n) => console.log(n)),
  $(Counter, { label: 'B' }).addClass('big'),  // class / style / attr land on the component's root element
  $('my-counter').key('c'),
).mount('#app');
```

- When the parent re-renders only changed props are updated; the component's internal state and DOM are kept. Use `.key()` in lists.
- Props are read-only; use `$emit` to ask the parent to change them.
- Slots: `Card({ title }).append($('p').text('content'))`; the component places them via `view(vm, children)` or `vm.$children`. Slot content is created in the parent, so a `.model('x')` inside it binds to the parent's data.
- Two-way binding: `$('star-rating').model('rate')` passes a `value` prop, and the component reports back with `vm.$emit('input', newValue)`.
- Instance properties: `$props`, `$children`, `$el`, `$parent`, `$listeners`, `$refs`, `$emit()`, `$slot()` / `$slots` / `$hasSlot()`, `$provide()` / `$inject()`, plus `$watch()` and `$nextTick()` as in `$.app`.
- Only the `$.component('my-tag', options)` form registers a tag name; `name` inside the options is just a display name for debugging. Registering a name without a `-` logs a warning, because it may clash with an HTML tag (registering `footer` would turn `$('footer')` into the component).

### Slots and provide / inject

```js
const Table = $.component({
  props: ['rows'],
  view: (vm) => $('table').append(
    $('caption').append(vm.$slot('title') || 'Default title'),     // named slot; null when not provided
    vm.rows.map((row) => $('tr').append(vm.$slot('row', row))),     // scoped slot: hand data to the parent
    vm.$hasSlot('footer') && $('tfoot').append(vm.$slot('footer')),
  ),
});
Table({ rows }).slot('title', $('b').text('Scores')).slot('row', (row) => $('td').text(row.name));

// an ancestor provides, descendants at any depth inject (provide a reactive object so they update)
$.app({ data: { theme: { dark: false } }, provide() { return { theme: this.theme }; }, view: ... });
$.component({ inject: ['theme'], view: (vm) => $('button').addClass({ dark: vm.theme.dark }) });
// inject also accepts { color: 'theme' } (alias) or { size: { from: 'size', default: 'M' } }; global values via $.provide(key, value)
```

### Importing components

```js
// components/user-card.js
export default ($) => $.component({ props: ['name'], view: (vm) => $('b').text(vm.name) });

// page
const UserCard = $.import('./components/user-card.js', {
  name: 'user-card',                         // optional: register as $('user-card')
  loading: () => $('span').text('Loading…'),
  error: (err, retry) => $('button').text('Retry').on('click', retry),
});
$('div').append(UserCard({ name: 'Ada' })).mount('#app');   // usable immediately, swapped in once loaded

$.import(() => import('./user-card.js'));    // bundlers / custom loading: a function returning a Promise
await UserCard.load();                       // preload; UserCard.status() reports the state
```

A module may export the result of `$.component()`, a component options object `{ view, ... }`, or `($) => either of those`; use the `export` option for a non-default export. URLs are resolved relative to the page, and the page must be served over http(s) (browsers do not load modules from `file://`).

## Advanced rendering

Working with real elements, animations, multiple roots / rendering elsewhere, and error handling.

### Refs

```js
$('input').ref((el) => (input = el));     // receives the element after mount, null on unmount; the vm when used on a component
$('input').ref('name');                   // stored as vm.$refs.name of the enclosing view ($.refs outside any view)
```

### Transitions

```js
$('p').transition('fade')                                  // fade-enter-from / -active / -to, fade-leave-* on leave
$('p').transition({ name: 'fade', appear: true, duration: 300, onAfterLeave(el) {} })
```

```css
.fade-enter-active, .fade-leave-active { transition: opacity .3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
```

Elements are only removed once the CSS transition / animation has finished; the first render skips the enter animation by default (enable it with `appear: true`).

### Fragments and Teleport

```js
view: () => [$('dt').text(k), $('dd').text(v)]           // components / views can return several root nodes
$.fragment($('li'), $('li')).key('group')                 // create a fragment explicitly
$.teleport('body', $('div.modal').text('Dialog'))         // render into another container; removed with its parent
```

### Error handling

```js
$.ErrorBoundary({ fallback: (err, reset) => $('button').text('Retry').on('click', reset) }, Profile());
$.component({ errorCaptured(err, vm, info) { report(err); return false; }, view: ... }); // false stops propagation
const off = $.onError((err, vm, info) => monitor.send(err, info));                    // global
```

When a component's view, lifecycle hook, event handler or watcher throws, the failing component keeps its previous view (blank on the first render), the error goes up to ancestors' `errorCaptured` and finally to `$.onError`; if nothing handles it, it is logged to the console. `info` says where it happened, e.g. `'render'`, `'watch'`, `'event:click'`, `'mounted'`.

## Routing

```js
const router = $.router({
  // mode: 'hash' (default, #/path) | 'history' (server must send every path to index.html; pairs with base) | 'memory' (never touches the URL)
  routes: {
    '/': () => $('h1').text('Home'),
    '/user/:id': (route) => $('p').text(`User ${route.params.id}, tab=${route.query.tab}`),
    '/docs/*': (route) => $('p').text(route.params.pathMatch),
    '/old': '/new',                         // string = redirect
    '*': (route) => $('p').text('404'),     // not found; always matched last
  },
  beforeEach(to, from) { if (to.path === '/admin' && !loggedIn) return '/login'; }, // false cancels, a string redirects
  afterEach(to, from) {},
});

$.render(() =>
  $('div').append(
    $('nav').append(
      $('a').link('/').text('Home'),                          // uses the last created router by default
      $('a').link('/user/7?tab=posts', router).text('User'),
      $('a').link('/docs', { router, exact: false }).text('Docs'), // prefix match also counts as active
    ),
    router.view()                                             // the view for the current route
  ), '#app');
// to show only the route view: router.mount('#app')

router.push('/user/1');                // { replace: true } adds no history entry
router.back(); router.forward(); router.go(-2);
router.route;                          // reactive: { path, fullPath, params, query, matched, meta }
router.stop();                         // stop listening to browser URL changes
```

`router.route` is a reactive object, so reading it in a `$.app`'s `computed` / `watch` / `view` updates automatically on navigation. `.link()` does not intercept ⌘/Ctrl/Shift-clicks, so "open in new tab" still works. When the page is opened directly from disk (`file://`, where browsers block `pushState`), hash mode falls back to `location.hash` and keeps working.

### Nested routes, meta, guards and scrolling

```js
$.router({
  routes: {
    '/admin': {
      view: (route, router, outlet) => $('div.layout').append(Sidebar(), outlet), // child page arrives as outlet; the layout is kept
      meta: { auth: true },                          // merged from outer to inner into route.meta
      beforeEnter: (to, from) => {},                 // per-route guards
      beforeLeave: (to, from) => {},
      children: {
        '': Dashboard,                               // a component can be the view directly (it gets a route prop)
        'users/:id': UserPage,
        'reports': $.import(() => import('./reports.js')),   // lazily loaded page
      },
    },
  },
  beforeEach: (to) => (to.meta.auth && !loggedIn ? '/login' : undefined),
  scrollBehavior: (to, from, saved) => saved || { top: 0 },   // restore the position on back; { el: '#id' } works too
});

// register a "confirm before leaving" in a component; removed automatically on unmount
created() { router.beforeLeave(() => !this.dirty || confirm('Unsaved changes, leave anyway?')); }
```

## Global state

```js
// stores/cart.js: define once; $.store('cart') returns the same instance anywhere
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
  persist: { key: 'cart', paths: ['items'] },   // optional: save to localStorage (optionally only some fields)
});

// any component / view
const cart = $.store('cart');
$('span').text(`🛒 ${cart.count}`);            // reads inside a view are tracked; the view re-renders on change
cart.add({ name: 'Coffee', price: 80 });
cart.coupon = 10;                               // state can also be changed directly

cart.$patch({ coupon: 0 });                     // deep merge; or $patch((state) => { ... })
cart.$reset();                                  // back to the initial state
cart.$subscribe((state) => console.log(state)); // any change (at most once per tick); returns an unsubscribe function
cart.$onAction(({ name, args, after, onError }) => after((r) => console.log(name, args, r)));
cart.$watch('total', (n, o) => {});
cart.$dispose();                                // stop subscriptions and remove it from the registry
```

- Defining the same id again returns the existing instance; `$.store('id')` throws if it does not exist. Query with `$.store.has(id)` / `$.store.list()`.
- `$.store({ ... })` (no id) creates an unregistered store.
- Getters are cached and read-only; actions may be async, with `this` as the store.

## Async data

```js
const user = $.resource(() => state.id, (id, { signal }) => fetch(`/api/users/${id}`, { signal }).then((r) => r.json()));
user.data; user.loading; user.error; user.ready;      // all reactive
user.refetch(); user.mutate((u) => ({ ...u, name: 'x' })); user.stop();

$.resource(({ signal }) => fetch(`/api/search?q=${state.q}`, { signal }), { interval: 5000 }); // single function: data read synchronously are the dependencies
```

- Refetches automatically when `source()` changes; older requests are aborted (AbortSignal) and late results ignored, so there are no races. Nothing is fetched while the value is `null` / `undefined` / `false`.
- Options: `{ initial, lazy, interval, onSuccess, onError }`.
- Created in a component's or `$.app`'s data / created, it stops automatically on unmount.

## i18n

```js
const i18n = $.i18n({
  locale: 'zh-TW',                 // picked from the browser language when omitted
  fallback: 'en',                  // used when a translation is missing; lookup: zh-TW → zh → en → the key itself
  messages: {
    en: {
      hello: 'Hello, {name}!',
      nav: { home: 'Home' },                             // nested key: t('nav.home')
      cart: 'Cart is empty | 1 item | {n} items',        // plurals: 0 | 1 | other (2 parts = singular | plural)
      files: { one: '{n} file', other: '{n} files' },    // or Intl.PluralRules categories
      greet: (p) => (p.hour < 12 ? 'Good morning' : 'Good evening'), // function message
    },
    'zh-TW': { hello: '你好，{name}！', nav: { home: '首頁' }, cart: '購物車是空的 | 1 件 | {n} 件' },
  },
  loaders: { ja: () => import('./locales/ja.js') },     // loaded the first time ja is selected
  missing(key, locale) { console.warn('missing translation', key); }, // optional
});

i18n.t('hello', { name: 'Ada' });   // 你好，Ada！
i18n.t('cart', 3);                  // 3 件 (a number is shorthand for { n: 3 })
i18n.n(1234.5, { style: 'currency', currency: 'TWD' });
i18n.d(new Date(), 'long');         // date formatted for the current locale

$.render(() => $('div').append(
  $('h1').t('hello', { name: 'Ada' }),         // chained form (uses the last created i18n)
  $('button').text('English').on('click', () => (i18n.locale = 'en')),
), '#app');

await i18n.setLocale('ja');         // loads via loaders first; i18n.loading is the locale being loaded
i18n.add('en', { bye: 'Bye' });     // add / merge translations
```

- `i18n.locale` is reactive: call `t()` inside a `$.render` / `$.app` / component view and the view patches itself when the language changes.
- A missing translation returns the key itself, so the source text can be the key (gettext style): `t('儲存')` with the English dictionary `{ '儲存': 'Save' }`. That is how this project's docs switch between Chinese and English (the English dictionary is `docs/i18n-en.js`).
- `$.t(key, params)` uses the last created i18n; there are also `i18n.has(key)`, `i18n.locales` and `i18n.detect()`.

## Performance

- `$.markRaw(obj)`: never make the object reactive (large read-only data, third-party instances).
- `$.shallowReactive(obj)`: track only top-level properties.
- `.memo([deps])`: skip diffing the whole subtree while deps are unchanged.
- Keyed lists use the longest increasing subsequence (LIS) to find nodes that need not move: moving the last item to the front moves just 1 DOM node.

## Notes

- For `input`, set `type` before `.model()` (e.g. `.attr('type','checkbox').model('ok')`), because the binding depends on the type.
- Arrays are tracked coarsely: any change to an array notifies everything that read it.
- Only plain objects and arrays become reactive; `Map`, `Set`, `Date` and class instances are left as they are.

## Project structure

| Path | Contents |
| --- | --- |
| `src/juicy.js` | Library source (a single UMD file, the only source file to maintain) |
| `dist/juicy.mjs` | ES module build, generated by `npm run build` |
| `types/juicy.d.ts` | TypeScript types; `types/test.ts` holds type tests |
| `index.html` | Interactive docs; English translations in `docs/i18n-en.js` |
| `examples/` | Examples (see [examples/README.md](examples/README.md)) |
| `components/` | Component loaded by the `$.import()` demo in the interactive docs |
| `scripts/` | `build.js` (generates dist), `build-example.js` (bundles the example), `serve.js` (local server) |
| `test/` | Unit tests, ESM tests, docs translation and demo tests |
| `CLAUDE.md` | Project notes for Claude Code (architecture and things to watch when changing code) |

## Development and tests

```bash
npm install                      # installs jsdom, typescript, esbuild (development only)
npm test                         # everything: dist freshness, unit tests, ESM, docs translations and demos, TypeScript types
node test/juicy.test.js          # unit tests only
node test/juicy.test.js router   # only tests whose name contains "router"
node test/docs-i18n.test.js      # docs translations are complete and demos run in both languages
npm run typecheck                # TypeScript type check
npm run build                    # regenerate dist/juicy.mjs after changing src/juicy.js
npm run serve                    # local server (http://localhost:8080/), needed by the module-based examples
npm run build:example            # bundle examples/brand-site into examples/brand-site/dist/app.js
```

When changing Chinese text in `index.html`, add the English translation to `docs/i18n-en.js` as well (`node test/docs-i18n.test.js` lists what is missing).

// 型別測試：npm run typecheck（tsc 只做檢查，不輸出檔案）
// 標記 @ts-expect-error 的那一行必須是型別錯誤，否則 tsc 會失敗
import $, { reactive, computed, watch, defineStore, resource, createRouter, createI18n, Chain, Store } from './juicy';

// 鏈式 API
const c: Chain = $('div#app.box')
  .css({ color: 'red', fontSize: 12 })
  .attr('data-x', 1)
  .addClass({ active: true })
  .on('click.prevent', (e) => e.preventDefault())
  .ref((el) => el)
  .transition({ name: 'fade', duration: 200 })
  .append($('span').text('hi'), 'text', [1, 2], null, false);
c.mount('#app');
const color = $('p').css('color');
// @ts-expect-error mount 需要容器
c.mount();

// 響應式
const state = reactive({ n: 1, list: [] as string[] });
const double = computed(() => state.n * 2);
const n: number = double.value;
const stop: () => void = watch(() => state.n, (v, old) => v + (old ?? 0));
stop();
// @ts-expect-error computed（唯讀）不能寫入
double.value = 3;

// 元件
const Counter = $.component('my-counter', {
  props: { step: 1 },
  emits: ['change'],
  data: () => ({ count: 0 }),
  methods: {
    inc() {
      this.count += this.step;
      this.$emit('change', this.count);
    },
  },
  view: (vm, children) => $('button').text(vm.count).on('click', vm.inc).append(children),
});
Counter({ step: 2 }).on('change', (v: number) => v);
$(Counter, { step: 3 }).key('a');
const Lazy = $.import(() => import('./juicy'), { name: 'lazy-x', loading: () => $('i') });
Lazy.load().then((f) => f());

// 全域狀態：state / getters / actions 都有型別
const cart = defineStore('cart', {
  state: () => ({ items: [] as { name: string; price: number }[], coupon: 0 }),
  getters: {
    count: (s) => s.items.length,
    total(s): number {
      return s.items.reduce((a, i) => a + i.price, 0) - this.coupon;
    },
  },
  actions: {
    add(name: string, price: number) {
      this.items.push({ name, price });
      return this.count;
    },
  },
});
const count: number = cart.count;
const total: number = cart.total;
const newCount: number = cart.add('coffee', 80);
cart.$patch({ coupon: 5 });
cart.$patch((s) => s.items.pop());
// @ts-expect-error add 需要 (string, number)
cart.add(1);
// @ts-expect-error 不存在的欄位
cart.nope;
const again = $.store<Store<{ items: unknown[] }>>('cart');
again.items.length;

// 非同步資料
const user = resource(() => state.n, (id, { signal }) => fetch(`/u/${id}`, { signal }).then((r) => r.json() as Promise<{ name: string }>));
const name: string | undefined = user.data?.name;
user.refetch();

// 路由
const router = createRouter({
  mode: 'memory',
  routes: {
    '/': () => $('h1'),
    '/old': '/new',
    '/admin': { meta: { auth: true }, view: (route, r, outlet) => $('div').append(outlet), children: { '': Counter, ':id': () => $('p') } },
  },
  beforeEach: (to) => (to.meta.auth ? '/login' : undefined),
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
});
const ok: boolean = router.push('/admin/1');
$('a').link('/admin', { router, exact: false });

// 多語系
const i18n = createI18n({ locale: 'en', messages: { en: { hi: 'Hi {name}', items: 'one | {n} items' } } });
const s1: string = i18n.t('hi', { name: 'Ada' });
const s2: string = i18n.t('items', 3);
i18n.locale = 'zh';
$('h1').t('hi', { name: 'Bo' }, i18n);

// 其他
$.render(() => [$('a'), $.fragment($('b')), $.teleport('body', $('div.modal'))], '#app');
$.ErrorBoundary({ fallback: (err: Error, reset: () => void) => $('p').text(err.message) }, Counter());
const off = $.onError((err, vm, info) => console.log(info));
off();
$.provide('theme', reactive({ dark: false }));

export { color, n, count, total, newCount, name, ok, s1, s2 };

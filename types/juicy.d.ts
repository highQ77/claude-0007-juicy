// juicy.js 型別定義
//   import $, { reactive, defineStore } from 'juicy'
//   或以 <script> 載入時使用全域 juicy / $（見檔案最後的 export as namespace）

/* ---------------------------------------------------------------- 虛擬節點與子節點 */

export interface VNode {
  tag: unknown;
  key?: unknown;
  el: Node | null;
  children: VNode[];
  [k: string]: unknown;
}

/** 可以放進 .append() / view 回傳值的東西 */
export type Child = Chain | VNode | string | number | boolean | null | undefined | readonly Child[];

type StyleValue = string | number | null | false | undefined;
type AttrValue = string | number | boolean | null | undefined;

export interface ModelOptions {
  /** 轉成數字 */
  number?: boolean;
  /** 去除前後空白 */
  trim?: boolean;
  /** 改用 change 事件同步 */
  lazy?: boolean;
}

export interface TransitionOptions {
  /** class 前綴，預設 'j'：產生 j-enter-from / j-enter-active / j-enter-to / j-leave-* */
  name?: string;
  /** 第一次渲染也跑進場動畫 */
  appear?: boolean;
  /** 動畫時間（毫秒）；省略時從 CSS 的 transition / animation 推算 */
  duration?: number;
  onBeforeEnter?(el: Element): void;
  onAfterEnter?(el: Element): void;
  onBeforeLeave?(el: Element): void;
  onAfterLeave?(el: Element): void;
}

export interface LinkOptions {
  router?: Router;
  /** false：前綴符合也算 active */
  exact?: boolean;
  activeClass?: string;
}

/* ---------------------------------------------------------------- 鏈式物件 */

export declare class Chain {
  constructor(vnode: VNode, parent?: Chain | null);
  readonly vnode: VNode;

  css(styles: Record<string, StyleValue>): this;
  css(name: string, value: StyleValue): this;
  css(name: string): StyleValue;
  attr(attrs: Record<string, AttrValue>): this;
  attr(name: string, value: AttrValue): this;
  attr(name: string): AttrValue;
  prop(props: Record<string, unknown>): this;
  prop(name: string, value: unknown): this;
  prop(name: string): unknown;
  id(id: string): this;
  addClass(...names: Array<string | Record<string, unknown>>): this;
  removeClass(...names: string[]): this;
  toggleClass(name: string, force?: boolean): this;
  text(text: unknown): this;
  html(html: string): this;

  append(...children: Child[]): this;
  appendTo(parent: Chain): this;
  child(selector: string): Chain;
  end(): Chain;
  each<T>(list: readonly T[] | null | undefined, fn: (item: T, index: number) => Child): this;
  when(cond: unknown, fn: (chain: this) => void, elseFn?: (chain: this) => void): this;
  show(cond: unknown): this;

  /**
   * 事件，可加修飾符：'submit.prevent'、'click.stop.once'、'keydown.enter'、'keydown.ctrl.s'、
   * 'click.self'、'scroll.passive'、'focus.capture'、'click.ctrl.exact'
   */
  on(events: string, handler?: (this: Element, event: any, ...args: any[]) => unknown): this;
  key(key: string | number | symbol): this;
  /** 函式：掛載時取得元素（元件則為 vm），卸載時為 null；字串：存到所在 view 的 vm.$refs */
  ref(ref: string | ((el: any) => void)): this;
  /** deps 不變時跳過這棵子樹的比對 */
  memo(deps: unknown): this;
  transition(transition?: string | TransitionOptions): this;
  /** 具名 / 作用域插槽（用在元件上） */
  slot(name: string, content: Child | ((...args: any[]) => Child)): this;
  link(to: string, router?: Router | LinkOptions): this;
  model(path: string, options?: ModelOptions): this;
  model(target: object, path: string, options?: ModelOptions): this;
  t(key: string, params?: TranslateParams | null, i18n?: I18n): this;

  toVNode(): VNode;
  mount(container: string | Element): this;
}

/* ---------------------------------------------------------------- 響應式 */

export declare function reactive<T extends object>(obj: T): T;
export declare function shallowReactive<T extends object>(obj: T): T;
export declare function markRaw<T extends object>(obj: T): T;
export declare function toRaw<T>(obj: T): T;

export interface Effect {
  run(): unknown;
  stop(): void;
}
export declare function effect(fn: () => unknown, options?: { lazy?: boolean; scheduler?: (e: Effect) => void }): Effect;

export interface ComputedRef<T> {
  readonly value: T;
}
export interface WritableComputedRef<T> {
  value: T;
}
export declare function computed<T>(getter: () => T): ComputedRef<T>;
export declare function computed<T>(options: { get: () => T; set: (v: T) => void }): WritableComputedRef<T>;

export interface WatchOptions {
  deep?: boolean;
  immediate?: boolean;
}
export declare function watch<T>(source: () => T, cb: (value: T, old: T | undefined) => void, options?: WatchOptions): () => void;
export declare function watch<T extends object>(source: T, cb: (value: T, old: T | undefined) => void, options?: WatchOptions): () => void;
export declare function nextTick(): Promise<void>;
export declare function nextTick<T>(fn: () => T): Promise<T>;

/* ---------------------------------------------------------------- 渲染 */

export interface RenderHandle {
  readonly el: Element;
  root(): VNode | null;
  update(): void;
  stop(): void;
  unmount(): void;
}
export declare function render(source: Child | (() => Child), container: string | Element): RenderHandle;
export declare function fragment(...children: Child[]): Chain;
export declare function teleport(to: string | Element, ...children: Child[]): Chain;
export declare function text(text: unknown): VNode;

/* ---------------------------------------------------------------- MVVM 與元件 */

/** vm 上內建的屬性與方法 */
export interface VMBuiltins {
  readonly $state: Record<string, any>;
  readonly $el: Node | null;
  readonly $refs: Record<string, any>;
  $nextTick: typeof nextTick;
  $watch<T>(source: string | ((this: VM) => T), cb: (value: T, old: T | undefined) => void, options?: WatchOptions): () => void;
  $provide(key: string | symbol, value: unknown): void;
}
export interface AppVM extends VMBuiltins {
  $unmount(): void;
}
export interface ComponentVM extends VMBuiltins {
  readonly $props: Record<string, any>;
  readonly $children: VNode[];
  readonly $listeners: Record<string, Function[]>;
  readonly $parent: VM | null;
  readonly $slots: Record<string, (...args: any[]) => VNode[] | null>;
  $slot(name: string, ...args: any[]): VNode[] | null;
  $hasSlot(name: string): boolean;
  $emit(event: string, ...args: any[]): void;
  $inject<T = unknown>(key: string | symbol, fallback?: T | (() => T)): T;
}
/** view / methods / computed 中的 this 與 vm：data、props、computed、methods、inject 都掛在上面 */
export type VM = ComponentVM & AppVM & Record<string, any>;

type InjectOption = string[] | Record<string, string | { from?: string; default?: unknown }>;
type WatchOption = ((this: VM, value: any, old: any) => void) | ({ handler: (this: VM, value: any, old: any) => void } & WatchOptions);

interface BaseOptions {
  data?: Record<string, any> | ((this: VM, vm: VM) => Record<string, any>);
  computed?: Record<string, ((this: VM, vm: VM) => any) | { get(this: VM, vm: VM): any; set(this: VM, v: any): void }>;
  methods?: Record<string, (this: VM, ...args: any[]) => any>;
  watch?: Record<string, WatchOption>;
  provide?: Record<string | symbol, unknown> | ((this: VM, vm: VM) => Record<string | symbol, unknown>);
  inject?: InjectOption;
  created?(this: VM, vm: VM): void;
  mounted?(this: VM, vm: VM): void;
  unmounted?(this: VM, vm: VM): void;
  /** 子元件出錯時呼叫；回傳 false 表示已處理，不再往上傳 */
  errorCaptured?(this: VM, err: unknown, vm: VM | undefined, info: string): boolean | void;
}

export interface AppOptions extends BaseOptions {
  view(this: VM, vm: VM): Child;
}
export interface App {
  readonly vm: VM;
  mount(container: string | Element): VM;
}
export declare function app(options: AppOptions): App;

export interface ComponentOptions extends BaseOptions {
  /** 除錯用的顯示名稱（不會註冊；要用 $('my-tag') 建立請寫 $.component('my-tag', options)） */
  name?: string;
  /** 預設值物件，或名稱陣列 */
  props?: Record<string, unknown> | string[];
  /** 宣告元件事件；其他事件會綁到根元素 */
  emits?: string[];
  updated?(this: VM, vm: VM): void;
  view(this: VM, vm: VM, children: VNode[]): Child;
}

export interface ComponentFactory {
  (props?: Record<string, any> | null, ...children: Child[]): Chain;
  (...children: Child[]): Chain;
  /** 直接當路由 view 使用時（router 會傳入 route） */
  (route: Route, router: Router, outlet: Chain | VNode | null): Chain;
  readonly def: unknown;
  readonly displayName: string;
}
export interface AsyncComponent extends ComponentFactory {
  load(): Promise<ComponentFactory>;
  status(): 'idle' | 'loading' | 'ready' | 'error';
}
export declare function component(options: ComponentOptions): ComponentFactory;
export declare function component(name: string, options: ComponentOptions): ComponentFactory;

export interface ImportOptions {
  /** 註冊成 $('name') */
  name?: string;
  /** 匯出名稱，預設 'default' */
  export?: string;
  loading?(): Child;
  error?(err: unknown, retry: () => void): Child;
  /** 立即開始載入 */
  eager?: boolean;
}
type ModuleLike = ComponentFactory | ComponentOptions | (($: JuicyStatic) => ComponentFactory | ComponentOptions) | Record<string, any>;
declare function importComponent(source: string | (() => Promise<ModuleLike> | ModuleLike), options?: string | ImportOptions): AsyncComponent;

/** 內建錯誤邊界：ErrorBoundary({ fallback: (err, reset) => ... }, ...children) */
export declare const ErrorBoundary: ComponentFactory;
export declare function onError(handler: (err: unknown, vm: VM | undefined, info: string) => void): () => boolean;
export declare function provide(key: string | symbol, value: unknown): void;
export declare function inject<T = unknown>(key: string | symbol, fallback?: T | (() => T)): T;
export declare const refs: Record<string, any>;

/* ---------------------------------------------------------------- 路由 */

export interface Route {
  readonly path: string;
  readonly fullPath: string;
  readonly params: Record<string, string>;
  readonly query: Record<string, string>;
  /** 符合的路由樣式（巢狀路由為完整路徑） */
  readonly matched: string | null;
  /** 從外到內合併的 meta */
  readonly meta: Record<string, any>;
}
/** 回傳 false 取消、字串轉址，其他值放行 */
export type NavigationGuard = (to: Route, from: Route | null) => boolean | string | void | undefined;
/** view 函式；元件（ComponentFactory）也可以直接當 view，會收到 route prop 與 outlet children */
export type RouteView = (route: Route, router: Router, outlet: Chain | VNode | null) => Child;
export interface RouteRecord {
  view?: RouteView | string;
  redirect?: string | ((to: Route) => string);
  meta?: Record<string, any>;
  beforeEnter?: NavigationGuard;
  beforeLeave?: NavigationGuard;
  children?: RouteMap;
}
export type RouteMap = Record<string, RouteView | string | RouteRecord>;
export interface ScrollPosition {
  left?: number;
  top?: number;
  el?: string | Element;
  behavior?: 'auto' | 'smooth';
}
export interface RouterOptions {
  routes: RouteMap;
  mode?: 'hash' | 'history' | 'memory';
  base?: string;
  /** memory 模式的起始路徑 */
  initial?: string;
  beforeEach?: NavigationGuard;
  afterEach?(to: Route, from: Route | null): void;
  scrollBehavior?(to: Route, from: Route | null, saved: ScrollPosition | null): ScrollPosition | false | void | Promise<ScrollPosition | false | void>;
}
export declare class Router {
  constructor(options: RouterOptions);
  readonly route: Route;
  readonly mode: 'hash' | 'history' | 'memory';
  push(to: string, options?: { replace?: boolean }): boolean;
  back(): void;
  forward(): void;
  go(n: number): void;
  href(to: string): string;
  isActive(to: string, exact?: boolean): boolean;
  resolve(to: string): Route & { record: unknown };
  /** 註冊離開目前頁面前的確認；在元件建立期間呼叫時，元件卸載會自動移除 */
  beforeLeave(guard: NavigationGuard): () => boolean;
  view(): Child;
  mount(container: string | Element): RenderHandle;
  stop(): void;
}
export declare function router(options: RouterOptions): Router;

/* ---------------------------------------------------------------- 多語系 */

export type TranslateParams = Record<string, unknown> | number;
export type Message = string | ((params: Record<string, any>, i18n: I18n) => string) | { [k: string]: Message };
export type Messages = Record<string, Message>;
export interface I18nOptions {
  locale?: string;
  fallback?: string;
  messages?: Record<string, Messages>;
  loaders?: Record<string, (locale: string) => Promise<Messages | { default: Messages }> | Messages>;
  missing?(key: string, locale: string): string | void;
}
export declare class I18n {
  constructor(options?: I18nOptions);
  locale: string;
  readonly loading: string | null;
  readonly locales: string[];
  messages: Record<string, Messages>;
  t(key: string, params?: TranslateParams | null): string;
  has(key: string, locale?: string): boolean;
  setLocale(locale: string): Promise<string>;
  add(locale: string, messages: Messages): this;
  n(value: number, options?: Intl.NumberFormatOptions): string;
  d(value: Date | number | string, options?: Intl.DateTimeFormatOptions | 'short' | 'medium' | 'long' | 'full'): string;
  detect(available?: string[]): string;
}
export declare function i18n(options?: I18nOptions): I18n;
export declare function t(key: string, params?: TranslateParams | null): string;

/* ---------------------------------------------------------------- 全域狀態 */

type GetterReturns<G> = { readonly [K in keyof G]: G[K] extends (...args: any[]) => infer R ? R : never };
export interface StoreAPI<S> {
  readonly $id: string | null;
  $state: S;
  $patch(partial: DeepPartial<S> | ((state: S) => void)): this;
  $reset(): this;
  $subscribe(cb: (state: S, store: this) => void, options?: { immediate?: boolean }): () => void;
  $onAction(listener: (ctx: {
    name: string;
    args: any[];
    store: unknown;
    after(fn: (result: any) => void): void;
    onError(fn: (err: unknown) => void): void;
  }) => void): () => boolean;
  $watch<T>(source: string | ((store: this) => T), cb: (value: T, old: T | undefined) => void, options?: WatchOptions): () => void;
  $dispose(): void;
}
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends any[] ? T[K] : DeepPartial<T[K]>) : T[K] };
export type Store<S, G = {}, A = {}> = S & GetterReturns<G> & A & StoreAPI<S>;
export interface PersistOptions {
  key?: string;
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  /** 只保存這些路徑，例如 ['theme', 'user.name'] */
  paths?: string[];
}
type GettersTree<S> = Record<string, (state: S, store: any) => any>;
export interface StoreOptions<S, G, A> {
  state?: S | (() => S);
  getters?: G & ThisType<Store<S, G, A>> & GettersTree<S>;
  actions?: A & ThisType<Store<S, G, A>>;
  persist?: string | boolean | PersistOptions;
}
export interface StoreStatic {
  <S extends object, G extends Record<string, (state: S, store: any) => any> = {}, A extends Record<string, (...args: any[]) => any> = {}>(
    id: string,
    options: StoreOptions<S, G, A>
  ): Store<S, G, A>;
  <S extends object, G extends Record<string, (state: S, store: any) => any> = {}, A extends Record<string, (...args: any[]) => any> = {}>(
    options: StoreOptions<S, G, A>
  ): Store<S, G, A>;
  /** 取得已註冊的 store */
  <T = Store<any, any, any>>(id: string): T;
  has(id: string): boolean;
  list(): string[];
}
export declare const store: StoreStatic;

/* ---------------------------------------------------------------- 非同步資料 */

export interface Resource<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly loading: boolean;
  /** 至少成功載入過一次 */
  readonly ready: boolean;
  /** 最近一次請求 */
  readonly promise?: Promise<T | undefined>;
  refetch(): Promise<T | undefined>;
  mutate(value: T | ((prev: T | undefined) => T)): void;
  stop(): void;
}
export interface ResourceOptions<T> {
  initial?: T;
  /** 不自動抓取，等 refetch() */
  lazy?: boolean;
  /** 輪詢間隔（毫秒） */
  interval?: number;
  onSuccess?(data: T): void;
  onError?(err: unknown): void;
}
export interface FetchContext {
  signal?: AbortSignal;
  /** 上一次的資料 */
  previous?: unknown;
}
export declare function resource<K, T>(
  source: () => K | null | undefined | false,
  fetcher: (key: K, ctx: FetchContext) => T | Promise<T>,
  options?: ResourceOptions<T>
): Resource<T>;
export declare function resource<T>(fetcher: (ctx: FetchContext) => T | Promise<T>, options?: ResourceOptions<T>): Resource<T>;

/* ---------------------------------------------------------------- $ 本體 */

export interface JuicyStatic {
  /** $('div') / $('div#id.a.b') / $('<p>') / $('my-component', props) */
  (selector: string, props?: Record<string, any>): Chain;
  (component: ComponentFactory, props?: Record<string, any>): Chain;
  (chain: Chain): Chain;

  /** 外掛：$.fn.myMethod = function () { return this; } */
  fn: Chain;
  Chain: typeof Chain;
  Router: typeof Router;
  I18n: typeof I18n;
  version: string;
  refs: Record<string, any>;

  text: typeof text;
  reactive: typeof reactive;
  shallowReactive: typeof shallowReactive;
  markRaw: typeof markRaw;
  toRaw: typeof toRaw;
  effect: typeof effect;
  computed: typeof computed;
  watch: typeof watch;
  nextTick: typeof nextTick;
  render: typeof render;
  fragment: typeof fragment;
  teleport: typeof teleport;
  app: typeof app;
  component: typeof component;
  import: typeof importComponent;
  router: typeof router;
  i18n: typeof i18n;
  t: typeof t;
  store: StoreStatic;
  resource: typeof resource;
  ErrorBoundary: ComponentFactory;
  onError: typeof onError;
  provide: typeof provide;
  inject: typeof inject;
}

declare const $: JuicyStatic;
export default $;
export { $, importComponent };
export declare const createApp: typeof app;
export declare const defineComponent: typeof component;
export declare const createRouter: typeof router;
export declare const createI18n: typeof i18n;
export declare const defineStore: StoreStatic;
export declare const createResource: typeof resource;

/** 以 <script> 載入時的全域名稱 */
export as namespace juicy;

/*!
 * juicy.js — 類 jQuery 鏈式 API + 虛擬 DOM + MVVM
 *
 *   $('div').css({ color: '#FFCC00' }).text('hello').mount('#app')
 *
 * 架構：
 *   1. 響應式系統  reactive / effect / computed / watch（Proxy 依賴收集）
 *   2. 鏈式建構器  $('tag') 只產生「虛擬節點」，不碰真實 DOM
 *   3. 渲染器      所有鏈式運算結束後，才由 createEl / patch 一次產生或更新真實 DOM
 *   4. MVVM        $.app({ data, computed, methods, watch, view }) 資料變動 → 重新 view → diff → patch
 *   5. 元件        $.component({ props, data, view }) 可重複使用、有自己狀態的區塊；$.import() 從檔案匯入
 *   6. 路由        $.router({ routes }) 依網址切換內容（hash / history / memory 模式）
 *   7. 多語系      $.i18n({ locale, messages }) 翻譯、複數、數字 / 日期格式；切換語言時畫面自動更新
 *   8. 全域狀態    $.store('id', { state, getters, actions }) 跨元件共用的狀態，可訂閱、重設、持久化
 *   9. 非同步資料  $.resource(fetcher) 自動追蹤依賴重新抓取，提供 data / loading / error，只採用最後一次請求
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else {
    const lib = factory();
    root.juicy = lib;
    root.$ = lib;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ================================================================
   * 1. 響應式系統
   * ================================================================ */
  const RAW = Symbol('raw');
  const SKIP = Symbol('skip'); // markRaw() 標記：永遠不轉成 reactive
  const ITERATE = Symbol('iterate');
  const targetMap = new WeakMap(); // target -> Map(key -> Set(effect))
  const proxyMap = new WeakMap(); // raw -> proxy
  const shallowMap = new WeakMap(); // raw -> shallow proxy
  const effectStack = [];
  let activeEffect = null;

  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObject = (v) => v !== null && typeof v === 'object';
  const toRaw = (v) => (isObject(v) && v[RAW]) || v;

  function track(target, key) {
    if (!activeEffect) return;
    let deps = targetMap.get(target);
    if (!deps) targetMap.set(target, (deps = new Map()));
    let dep = deps.get(key);
    if (!dep) deps.set(key, (dep = new Set()));
    if (!dep.has(activeEffect)) {
      dep.add(activeEffect);
      activeEffect.deps.push(dep);
    }
  }

  function trigger(target, ...keys) {
    const deps = targetMap.get(target);
    if (!deps) return;
    const toRun = new Set();
    keys.forEach((k) => {
      const dep = deps.get(k);
      if (dep) dep.forEach((e) => e !== activeEffect && toRun.add(e));
    });
    toRun.forEach((e) => (e.scheduler ? e.scheduler(e) : e.run()));
  }

  function isPlain(obj) {
    if (Array.isArray(obj)) return true;
    const proto = Object.getPrototypeOf(obj);
    return proto === Object.prototype || proto === null;
  }

  // 標記物件永遠不轉成 reactive（大型資料、第三方實例、DOM 元素等），回傳物件本身
  function markRaw(obj) {
    if (isObject(obj)) Object.defineProperty(obj, SKIP, { value: true, configurable: true });
    return obj;
  }
  // 只追蹤第一層屬性；巢狀物件原樣回傳（不深層包裝）
  function shallowReactive(obj) {
    return reactive(obj, true);
  }

  function reactive(obj, shallow) {
    if (!isObject(obj) || obj[RAW] || obj[SKIP] || !isPlain(obj)) return obj;
    const map = shallow ? shallowMap : proxyMap;
    const existing = map.get(obj);
    if (existing) return existing;
    const isArr = Array.isArray(obj);

    const proxy = new Proxy(obj, {
      get(t, k, r) {
        if (k === RAW) return t;
        const v = Reflect.get(t, k, r);
        if (typeof k === 'symbol') return v;
        track(t, isArr ? ITERATE : k); // 陣列採粗粒度追蹤：任何變動都通知
        return shallow ? v : reactive(v);
      },
      set(t, k, v, r) {
        const had = hasOwn(t, k);
        const old = t[k];
        const raw = toRaw(v);
        const ok = Reflect.set(t, k, raw, r);
        if (isArr) {
          // push 會先設定新索引、再設定 length（值已相同），只觸發一次
          if (!had || !Object.is(old, raw)) trigger(t, ITERATE);
        } else if (!had) trigger(t, k, ITERATE);
        else if (!Object.is(old, raw)) trigger(t, k);
        return ok;
      },
      deleteProperty(t, k) {
        const had = hasOwn(t, k);
        const ok = Reflect.deleteProperty(t, k);
        if (had && ok) trigger(t, k, ITERATE);
        return ok;
      },
      has(t, k) {
        if (typeof k !== 'symbol') track(t, isArr ? ITERATE : k);
        return Reflect.has(t, k);
      },
      ownKeys(t) {
        track(t, ITERATE);
        return Reflect.ownKeys(t);
      },
    });
    map.set(obj, proxy);
    return proxy;
  }

  function cleanup(e) {
    e.deps.forEach((dep) => dep.delete(e));
    e.deps.length = 0;
  }

  function effect(fn, options = {}) {
    const e = {
      deps: [],
      active: true,
      scheduler: options.scheduler,
      run() {
        if (!e.active) return fn();
        cleanup(e);
        effectStack.push(activeEffect);
        activeEffect = e;
        try {
          return fn();
        } finally {
          activeEffect = effectStack.pop();
        }
      },
      stop() {
        if (e.active) {
          cleanup(e);
          e.active = false;
        }
      },
    };
    if (!options.lazy) e.run();
    return e;
  }

  // ---- 非同步批次更新：同一個 tick 內多次修改只重繪一次 ----
  const queue = new Set();
  const resolved = Promise.resolve();
  let flushPromise = null;

  function queueJob(job) {
    queue.add(job);
    if (!flushPromise) flushPromise = resolved.then(flushJobs);
  }
  function flushJobs() {
    try {
      queue.forEach((job) => {
        queue.delete(job);
        job();
      });
    } finally {
      flushPromise = null;
    }
  }
  function nextTick(fn) {
    const p = flushPromise || resolved;
    return fn ? p.then(fn) : p;
  }

  function computed(getterOrOptions) {
    const getter = typeof getterOrOptions === 'function' ? getterOrOptions : getterOrOptions.get;
    const setter = typeof getterOrOptions === 'function' ? null : getterOrOptions.set;
    const holder = {};
    let value;
    let dirty = true;
    const e = effect(getter, {
      lazy: true,
      scheduler() {
        if (!dirty) {
          dirty = true;
          trigger(holder, 'value');
        }
      },
    });
    return {
      get value() {
        if (dirty) {
          value = e.run();
          dirty = false;
        }
        track(holder, 'value');
        return value;
      },
      set value(v) {
        if (!setter) throw new Error('[juicy] computed 是唯讀的');
        setter(v);
      },
    };
  }

  function traverse(v, seen = new Set()) {
    if (!isObject(v) || seen.has(v)) return v;
    seen.add(v);
    for (const k in v) traverse(v[k], seen);
    return v;
  }

  function watch(source, cb, { immediate = false, deep = false } = {}) {
    const getter = typeof source === 'function' ? source : () => source;
    const deepMode = deep || typeof source !== 'function';
    let old;
    const job = () => {
      const nv = e.run();
      if (deepMode || !Object.is(nv, old)) {
        const prev = old;
        old = nv;
        cb(nv, prev);
      }
    };
    const e = effect(deepMode ? () => traverse(getter()) : getter, {
      lazy: true,
      scheduler: () => queueJob(job),
    });
    if (immediate) job();
    else old = e.run();
    return () => e.stop();
  }

  /* ================================================================
   * 2. 虛擬節點 + 鏈式建構器
   * ================================================================ */
  const TEXT = Symbol('text');
  const FRAGMENT = Symbol('fragment'); // 多個節點、沒有外層元素；以兩個空文字節點標記範圍
  const TELEPORT = Symbol('teleport'); // 子節點渲染到別的容器（例如 body）
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const EMPTY = { attrs: {}, props: {}, style: {}, classes: {}, on: {} };
  let currentVM = null; // $.app / 元件 的 view() 執行期間指向目前的 vm，供 .model('key') 使用
  let currentRefs = null; // 目前 view 的 $refs，供 .ref('name') 使用
  const globalRefs = {}; // 不在任何 view 中使用 .ref('name') 時存到 $.refs

  function createVNode(tag) {
    // owner：建立這個節點的元件（事件處理函式出錯時往上找 errorCaptured）
    return { tag, key: undefined, attrs: {}, props: {}, style: {}, classes: {}, on: {}, children: [], el: null, owner: currentInstance };
  }
  function textVNode(t) {
    return { tag: TEXT, key: undefined, text: String(t), el: null };
  }

  // 支援 'div'、'<div>'、'div#id.a.b'、'#id'（預設 div）
  function parseSelector(sel) {
    sel = sel.trim().replace(/^</, '').replace(/\/?>$/, '');
    const m = sel.match(/^[a-zA-Z][\w-]*/);
    const vnode = createVNode(m ? m[0] : 'div');
    sel.slice(m ? m[0].length : 0).replace(/([#.])([\w-]+)/g, (_, type, name) => {
      if (type === '#') vnode.attrs.id = name;
      else vnode.classes[name] = true;
    });
    return vnode;
  }

  function flatten(list, out = []) {
    list.forEach((x) => (Array.isArray(x) ? flatten(x, out) : out.push(x)));
    return out;
  }

  function toVNode(x) {
    if (x == null || typeof x === 'boolean') return null;
    if (x instanceof Chain) return x.vnode;
    if (typeof x === 'string' || typeof x === 'number') return textVNode(x);
    if (Array.isArray(x)) {
      // 根節點是陣列 → 片段（view 可以回傳多個節點）
      const v = createVNode(FRAGMENT);
      v.children = flatten(x).map(toVNode).filter(Boolean);
      return v;
    }
    if (isObject(x) && 'tag' in x) return x; // 已是 vnode
    throw new TypeError('[juicy] 無法當作子節點: ' + x);
  }

  const getPath = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const keys = String(p).split('.');
    const last = keys.pop();
    keys.reduce((a, k) => a[k], o)[last] = v;
  }

  // 讓 css/attr/prop 共用「物件 / 鍵值 / 讀取」三種呼叫方式
  function kv(chain, bag, name, value) {
    if (isObject(name)) {
      Object.assign(bag, name);
      return chain;
    }
    if (value === undefined) return bag[name];
    bag[name] = value;
    return chain;
  }

  class Chain {
    constructor(vnode, parent) {
      this.vnode = vnode;
      this._parent = parent || null;
    }

    css(name, value) { return kv(this, this.vnode.style, name, value); }
    attr(name, value) { return kv(this, this.vnode.attrs, name, value); }
    prop(name, value) { return kv(this, this.vnode.props, name, value); }

    id(v) {
      this.vnode.attrs.id = v;
      return this;
    }

    // addClass('a b') / addClass('a', 'b') / addClass({ active: isActive })
    addClass(...names) {
      const c = this.vnode.classes;
      names.forEach((n) => {
        if (isObject(n)) Object.keys(n).forEach((k) => (c[k] = !!n[k]));
        else String(n).split(/\s+/).filter(Boolean).forEach((k) => (c[k] = true));
      });
      return this;
    }
    removeClass(...names) {
      names.forEach((n) => String(n).split(/\s+/).forEach((k) => delete this.vnode.classes[k]));
      return this;
    }
    toggleClass(name, force) {
      const c = this.vnode.classes;
      c[name] = force === undefined ? !c[name] : !!force;
      return this;
    }

    text(t) {
      this.vnode.children = [textVNode(t == null ? '' : t)];
      delete this.vnode.props.innerHTML;
      return this;
    }
    html(h) {
      this.vnode.children = [];
      this.vnode.props.innerHTML = String(h);
      return this;
    }

    // append($('span'), 'text', [ ... ], null) —— 陣列會攤平，null/false 會忽略
    append(...kids) {
      flatten(kids).forEach((k) => {
        const v = toVNode(k);
        if (v) this.vnode.children.push(v);
      });
      return this;
    }
    appendTo(parent) {
      parent.append(this);
      this._parent = parent;
      return this;
    }
    // 建立子元素並「進入」它；用 end() 回到父層
    child(sel) {
      const c = new Chain(selectorVNode(sel), this);
      this.vnode.children.push(c.vnode);
      return c;
    }
    end() {
      return this._parent || this;
    }

    each(list, fn) {
      (list || []).forEach((item, i) => this.append(fn(item, i)));
      return this;
    }
    when(cond, fn, elseFn) {
      if (cond) fn(this);
      else if (elseFn) elseFn(this);
      return this;
    }
    show(cond) {
      if (!cond) this.vnode.style.display = 'none';
      return this;
    }

    /**
     * 事件，可加修飾符：
     *   .on('submit.prevent', fn)  .on('click.stop.once', fn)  .on('click.self', fn)
     *   .on('keydown.enter', fn)   .on('keydown.ctrl.s.prevent', fn)  .on('keyup.esc', fn)
     *   .on('click.right', fn)     .on('scroll.passive', fn)  .on('focus.capture', fn)  .on('click.ctrl.exact', fn)
     */
    on(events, handler) {
      const v = this.vnode;
      const forComp = isComp(v.tag);
      events.split(/\s+/).filter(Boolean).forEach((spec) => {
        const { key, fn } = parseEvent(spec, handler, forComp);
        (v.on[key] || (v.on[key] = [])).push(fn);
      });
      return this;
    }

    key(k) {
      this.vnode.key = k;
      return this;
    }

    /**
     * 取得真實元素（或元件的 vm）：
     *   .ref((el) => (input = el))   掛載時傳入元素，卸載時傳入 null
     *   .ref('input')                存到所在 view 的 vm.$refs.input（不在 view 中則存到 $.refs）
     */
    ref(r) {
      this.vnode.ref = r;
      if (typeof r === 'string') this.vnode.refs = currentRefs || globalRefs;
      return this;
    }

    // deps 與上次相同時跳過整棵子樹的比對（效能最佳化；子樹內的事件處理函式也沿用舊的）
    memo(deps) {
      this.vnode.memo = Array.isArray(deps) ? deps : [deps];
      return this;
    }

    /**
     * 進場 / 離場動畫：.transition('fade') 或 .transition({ name, appear, duration, onAfterEnter, onAfterLeave })
     * 會依序加上 fade-enter-from / fade-enter-active / fade-enter-to（離場為 leave-*），等 CSS transition 結束才移除元素
     */
    transition(t) {
      this.vnode.transition = t || 'j';
      return this;
    }

    /**
     * 具名 / 作用域插槽（用在元件上）：
     *   Card().slot('header', $('h3').text('標題'))
     *   List({ items }).slot('item', (item, i) => $('li').text(item.name))   元件內以 vm.$slot('item', item, i) 呼叫
     */
    slot(name, content) {
      const v = this.vnode;
      if (!v.slots) v.slots = {};
      v.slots[name] = { content, vm: currentVM, refs: currentRefs };
      return this;
    }

    /**
     * 路由連結：設定 href、點擊時改用 router.push（不重新載入頁面），目前路由符合時加上 active class
     *   $('a').link('/about')                    使用最後建立的 router
     *   $('a').link('/about', router)
     *   $('a').link('/user', { router, exact: false, activeClass: 'on' })  exact:false = 前綴符合也算
     */
    link(to, opts) {
      opts = opts instanceof Router ? { router: opts } : opts || {};
      const r = opts.router || currentRouter;
      if (!r) throw new Error('[juicy] link() 需要先建立 $.router()');
      this.vnode.attrs.href = r.href(to);
      this.on('click', (e) => {
        if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 保留「新分頁開啟」
        e.preventDefault();
        r.push(to);
      });
      if (r.isActive(to, opts.exact !== false)) this.addClass(opts.activeClass || 'active');
      return this;
    }

    /**
     * 雙向綁定
     *   .model('msg')                在 $.app 的 view 裡使用，綁到 vm.msg
     *   .model(state, 'user.name')   綁到任意 reactive 物件
     *   選項：{ number, trim, lazy }
     */
    model(target, path, opts) {
      if (typeof target === 'string') {
        opts = path;
        path = target;
        target = currentVM;
      }
      if (!target) throw new Error('[juicy] model() 需要 reactive 物件，或在 $.app 的 view 中使用');
      opts = opts || {};
      const v = this.vnode;
      const type = String(v.attrs.type || '').toLowerCase();
      const val = getPath(target, path);

      if (isComp(v.tag)) {
        // 元件的雙向綁定：傳入 value prop，元件以 vm.$emit('input', 新值) 回報
        v.props.value = val;
        this.on('input', (nv) => setPath(target, path, nv));
      } else if (v.tag === 'input' && type === 'checkbox') {
        v.props.checked = !!val;
        this.on('change', (e) => setPath(target, path, e.target.checked));
      } else if (v.tag === 'input' && type === 'radio') {
        v.props.checked = String(val) === String(v.attrs.value);
        this.on('change', (e) => e.target.checked && setPath(target, path, v.attrs.value));
      } else {
        v.props.value = val == null ? '' : String(val);
        const evt = v.tag === 'select' || opts.lazy ? 'change' : 'input';
        this.on(evt, (e) => {
          let nv = e.target.value;
          if (opts.trim) nv = nv.trim();
          if (opts.number && nv !== '' && !isNaN(nv)) nv = Number(nv);
          setPath(target, path, nv);
        });
      }
      return this;
    }

    // 翻譯文字：$('h1').t('hello', { name })，等同 .text(i18n.t(...))；第三個參數可指定 i18n 實例
    t(key, params, i18n) {
      const i = i18n || currentI18n;
      return this.text(i ? i.t(key, params) : key);
    }

    toVNode() { return this.vnode; }

    // 運算結束：轉成真實 DOM 掛上去。已掛載過會先釋放舊 DOM 再搬到新容器。回傳自己
    mount(container) {
      const v = this.vnode;
      if (v.el) {
        const handle = v.el.parentNode && v.el.parentNode._juicy;
        if (handle && handle.root() === v) handle.unmount();
        else destroy(v, true, true);
      }
      render(this, container);
      return this;
    }
  }

  /* ================================================================
   * 3. 渲染器：vnode -> 真實 DOM，以及新舊 vnode 的 diff / patch
   * ================================================================ */
  const UNITLESS = /^(opacity|z-?index|font-?weight|line-?height|flex|flex-?grow|flex-?shrink|order|zoom)$/i;

  function setStyle(el, k, v) {
    if (v == null || v === false) v = '';
    else if (typeof v === 'number' && !UNITLESS.test(k)) v += 'px';
    if (k.includes('-')) el.style.setProperty(k, v);
    else el.style[k] = v;
  }

  function classString(v) {
    return Object.keys(v.classes).filter((k) => v.classes[k]).join(' ');
  }

  // ---- 事件修飾符 ----
  const EVENT_MODS = new Set(['prevent', 'stop', 'self', 'once', 'capture', 'passive', 'ctrl', 'alt', 'shift', 'meta', 'exact', 'left', 'middle', 'right']);
  const SYS_KEYS = ['ctrl', 'alt', 'shift', 'meta'];
  const KEY_ALIAS = {
    enter: ['Enter'], esc: ['Escape', 'Esc'], escape: ['Escape', 'Esc'], space: [' ', 'Spacebar'], tab: ['Tab'],
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], delete: ['Delete', 'Backspace'],
  };
  const matchKey = (key, m) =>
    KEY_ALIAS[m] ? KEY_ALIAS[m].includes(key) : String(key || '').toLowerCase() === m.replace(/-/g, '');

  // 'click.prevent.stop' → { key: 'click'（加上 ~capture 等原生選項）, fn: 套用修飾符的處理函式 }
  function parseEvent(spec, handler, forComp) {
    const parts = spec.split('.');
    let type = parts.shift();
    const isKey = /^key/.test(type);
    // 不是修飾符的後綴視為事件名稱的一部分，例如自訂事件 'bs.modal.show'
    if (!isKey) while (parts.length && !EVENT_MODS.has(parts[0])) type += '.' + parts.shift();
    if (!parts.length) return { key: type, fn: handler };
    const has = (m) => parts.includes(m);
    const keyMods = isKey ? parts.filter((m) => !EVENT_MODS.has(m) || m === 'left' || m === 'right') : [];
    let spent = false;
    const fn = function (e) {
      const isDom = !forComp && e && typeof e === 'object' && 'target' in e;
      if (isDom) {
        if (has('self') && e.target !== e.currentTarget) return;
        for (const k of SYS_KEYS) if (has(k) && !e[k + 'Key']) return;
        if (has('exact') && SYS_KEYS.some((k) => !has(k) && e[k + 'Key'])) return;
        if (isKey) {
          if (keyMods.length && !keyMods.some((m) => matchKey(e.key, m))) return;
        } else if ('button' in e && ((has('left') && e.button !== 0) || (has('middle') && e.button !== 1) || (has('right') && e.button !== 2))) {
          return;
        }
        if (has('prevent')) e.preventDefault();
        if (has('stop')) e.stopPropagation();
      } else if (forComp && has('once')) {
        if (spent) return;
        spent = true;
      }
      return handler && handler.apply(this, arguments);
    };
    const native = forComp ? [] : ['capture', 'passive', 'once'].filter(has);
    return { key: native.length ? type + '~' + native.join('~') : type, fn };
  }
  const eventInfo = (k) => {
    const [type, ...o] = k.split('~');
    return { type, capture: o.includes('capture'), passive: o.includes('passive'), once: o.includes('once') };
  };

  function patchProps(el, o, n) {
    el._owner = n.owner || null;
    // attributes
    for (const k in o.attrs) if (!(k in n.attrs)) el.removeAttribute(k);
    for (const k in n.attrs) {
      const val = n.attrs[k];
      if (val === o.attrs[k]) continue;
      if (val == null || val === false) el.removeAttribute(k);
      else el.setAttribute(k, val === true ? '' : val);
    }
    // class
    const oc = classString(o);
    const nc = classString(n);
    if (oc !== nc) nc ? el.setAttribute('class', nc) : el.removeAttribute('class');
    // style
    for (const k in o.style) if (!(k in n.style)) setStyle(el, k, '');
    for (const k in n.style) if (n.style[k] !== o.style[k]) setStyle(el, k, n.style[k]);
    // events：每種事件只綁一個 invoker，更新時只換掉 handler 陣列
    const vei = el._vei || (el._vei = {});
    for (const k in n.on) {
      if (vei[k]) {
        if (!vei[k].spent) vei[k].fns = n.on[k];
      } else {
        const info = eventInfo(k);
        const invoker = (e) => {
          if (invoker.spent) return;
          if (info.once) invoker.spent = true; // .once：每個元素只觸發一次（重繪也不會重新綁定）
          const fns = invoker.fns;
          for (let i = 0; i < fns.length; i++) {
            try {
              fns[i].call(el, e);
            } catch (err) {
              handleError(err, el._owner, `event:${info.type}`);
            }
          }
        };
        invoker.fns = n.on[k];
        vei[k] = invoker;
        el.addEventListener(info.type, invoker, { capture: info.capture, passive: info.passive });
      }
    }
    for (const k in vei) {
      if (!(k in n.on)) {
        const info = eventInfo(k);
        el.removeEventListener(info.type, vei[k], info.capture);
        delete vei[k];
      }
    }
    // DOM properties（value / checked / innerHTML ...）—— 和真實 DOM 比對，避免游標跳動
    for (const k in o.props) if (!(k in n.props)) el[k] = typeof el[k] === 'boolean' ? false : '';
    for (const k in n.props) {
      const val = n.props[k];
      if (k === 'innerHTML') {
        if (val !== o.props.innerHTML) el.innerHTML = val;
      } else if (k === 'value') {
        if (el.value !== String(val)) el.value = val;
      } else if (el[k] !== val) el[k] = val;
    }
  }

  // ---- ref ----
  function setRef(v, value) {
    const r = v.ref;
    if (!r) return;
    if (typeof r === 'function') {
      try {
        r(value);
      } catch (err) {
        handleError(err, v.owner, 'ref');
      }
    } else if (v.refs) {
      if (value == null) {
        if (v.refs[r] === v.refValue) delete v.refs[r]; // 只清除自己設定的值（新節點可能已經接手）
      } else {
        v.refs[r] = value;
      }
      v.refValue = value;
    }
  }

  // ---- 進場 / 離場動畫 ----
  let initialRender = false; // 第一次掛載時不跑進場動畫（除非 appear: true）
  const raf = (fn) =>
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => requestAnimationFrame(fn)) : setTimeout(fn, 16);
  const transitionOpts = (t) => (typeof t === 'string' ? { name: t } : t || {});

  function onTransitionEnd(el, t, done) {
    let finished = false;
    let timer = null;
    const end = (e) => {
      if (finished || (e && e.target !== el)) return;
      finished = true;
      el.removeEventListener('transitionend', end);
      el.removeEventListener('animationend', end);
      clearTimeout(timer);
      done();
    };
    el.addEventListener('transitionend', end);
    el.addEventListener('animationend', end);
    let ms = t.duration;
    if (ms == null) {
      const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : {};
      const toMs = (s) => Math.max(0, ...String(s || '0s').split(',').map((x) => parseFloat(x) * (/ms/.test(x) ? 1 : 1000) || 0));
      ms = Math.max(toMs(cs.transitionDuration) + toMs(cs.transitionDelay), toMs(cs.animationDuration) + toMs(cs.animationDelay));
    }
    timer = setTimeout(end, ms + 20); // 保險：沒有 transitionend（例如沒寫 CSS）時也會結束
  }

  function enter(v, el) {
    const t = transitionOpts(v.transition);
    if (initialRender && !t.appear) return;
    const n = t.name || 'j';
    el.classList.add(`${n}-enter-from`, `${n}-enter-active`);
    if (t.onBeforeEnter) t.onBeforeEnter(el);
    raf(() => {
      el.classList.remove(`${n}-enter-from`);
      el.classList.add(`${n}-enter-to`);
      onTransitionEnd(el, t, () => {
        el.classList.remove(`${n}-enter-active`, `${n}-enter-to`);
        if (t.onAfterEnter) t.onAfterEnter(el);
      });
    });
  }

  function leave(v, el, remove) {
    const t = transitionOpts(v.transition);
    const n = t.name || 'j';
    el.classList.remove(`${n}-enter-from`, `${n}-enter-active`, `${n}-enter-to`);
    el.classList.add(`${n}-leave-from`, `${n}-leave-active`);
    if (t.onBeforeLeave) t.onBeforeLeave(el);
    raf(() => {
      el.classList.remove(`${n}-leave-from`);
      el.classList.add(`${n}-leave-to`);
      onTransitionEnd(el, t, () => {
        remove();
        el.classList.remove(`${n}-leave-active`, `${n}-leave-to`);
        if (t.onAfterLeave) t.onAfterLeave(el);
      });
    });
  }

  // ---- vnode 在 DOM 中的節點（片段、元件可能對應多個節點；Teleport 在原位只留一個佔位節點） ----
  function firstNode(v) {
    return v.comp ? firstNode(v.comp.subTree) : v.el;
  }
  function hostNodes(v, out = []) {
    if (v.comp) return v.comp.subTree ? hostNodes(v.comp.subTree, out) : out;
    if (v.tag === FRAGMENT) {
      if (v.el) out.push(v.el);
      v.children.forEach((c) => hostNodes(c, out));
      if (v.anchor) out.push(v.anchor);
      return out;
    }
    if (v.el) out.push(v.el);
    return out;
  }
  function moveNodes(v, parent, ref) {
    hostNodes(v).forEach((node) => parent.insertBefore(node, ref));
  }
  const removeNode = (node) => node && node.parentNode && node.parentNode.removeChild(node);

  function createEl(v, isSvg) {
    if (isComp(v.tag)) return mountComponent(v, isSvg);
    if (v.tag === TEXT) return (v.el = document.createTextNode(v.text));
    if (v.tag === FRAGMENT) {
      const frag = document.createDocumentFragment();
      v.el = frag.appendChild(document.createTextNode(''));
      v.children.forEach((c) => frag.appendChild(createEl(c, isSvg)));
      v.anchor = frag.appendChild(document.createTextNode(''));
      return frag;
    }
    if (v.tag === TELEPORT) {
      v.el = document.createTextNode(''); // 原位置的佔位節點
      const target = (v.target = resolveEl(v.props.to));
      v.anchor = target.appendChild(document.createTextNode(''));
      v.children.forEach((c) => target.insertBefore(createEl(c, isSvg), v.anchor));
      return v.el;
    }
    isSvg = isSvg || v.tag === 'svg';
    const el = (v.el = isSvg ? document.createElementNS(SVG_NS, v.tag) : document.createElement(v.tag));
    if (v.props.innerHTML == null) {
      const childSvg = isSvg && v.tag !== 'foreignObject';
      v.children.forEach((c) => el.appendChild(createEl(c, childSvg)));
    }
    patchProps(el, EMPTY, v); // props 在子節點之後設定（<select> 的 value 需要 option 已存在）
    if (v.ref) postQueue.push(() => v.el === el && setRef(v, el)); // 等整棵樹放進頁面後才設定 ref
    if (v.transition) enter(v, el);
    return el;
  }

  // 釋放節點：解除事件監聽、（可選）從 DOM 移除，並斷開 vnode ↔ DOM 的互相參照，讓 GC 可以回收
  //   keepTree = true 時保留虛擬樹（之後可再 mount）
  function destroy(v, detach, keepTree) {
    if (!v) return;
    if (v.comp) return unmountComponent(v, detach, keepTree);
    if (v.tag === FRAGMENT) {
      v.children.forEach((c) => destroy(c, detach, keepTree));
      if (detach) {
        removeNode(v.el);
        removeNode(v.anchor);
      }
      v.el = v.anchor = null;
      if (!keepTree) v.children = [];
      return;
    }
    if (v.tag === TELEPORT) {
      v.children.forEach((c) => destroy(c, true, keepTree)); // 子節點在別的容器裡，一定要移除
      removeNode(v.anchor);
      if (detach) removeNode(v.el);
      v.el = v.anchor = v.target = null;
      if (!keepTree) v.children = [];
      return;
    }
    if (v.children) v.children.forEach((c) => destroy(c, false, keepTree));
    const el = v.el;
    if (el) {
      setRef(v, null);
      if (el._juicy) el._juicy.unmount(); // 這個元素被當成其他 mount 的容器：一併卸載
      if (el._vei) {
        for (const k in el._vei) el.removeEventListener(eventInfo(k).type, el._vei[k], eventInfo(k).capture);
        el._vei = null;
      }
      if (detach && el.parentNode) {
        if (v.transition) leave(v, el, () => removeNode(el));
        else el.parentNode.removeChild(el);
      }
    }
    v.el = null;
    if (keepTree) return;
    if (v.children) v.children = [];
    if (v.on) v.on = {};
  }

  const sameNode = (a, b) => a.tag === b.tag && a.key === b.key;
  const sameDeps = (a, b) => a.length === b.length && a.every((x, i) => Object.is(x, b[i]));

  function patch(o, n, isSvg) {
    if (o === n) return;
    if (n.memo && o.memo && sameNode(o, n) && sameDeps(o.memo, n.memo)) {
      Object.assign(n, o); // deps 沒變：沿用整棵舊的子樹
      if (n.comp) n.comp.vnode = n;
      return;
    }
    if (!sameNode(o, n)) {
      const first = firstNode(o);
      const parent = first && first.parentNode;
      const node = createEl(n, isSvg);
      if (parent) parent.insertBefore(node, first);
      destroy(o, true);
      return;
    }
    if (isComp(n.tag)) return updateComponent(o, n);
    if (n.tag === FRAGMENT) {
      n.el = o.el;
      n.anchor = o.anchor;
      patchChildren(o.el.parentNode, o.children, n.children, isSvg, o.anchor);
      return;
    }
    if (n.tag === TELEPORT) {
      n.el = o.el;
      n.anchor = o.anchor;
      n.target = o.target;
      const target = resolveEl(n.props.to);
      if (target !== o.target) {
        // 目標容器變了：把子節點搬過去
        n.target = target;
        o.children.forEach((c) => moveNodes(c, target, null));
        target.appendChild(n.anchor);
      }
      patchChildren(n.target, o.children, n.children, isSvg, n.anchor);
      return;
    }
    const el = (n.el = o.el);
    if (n.tag === TEXT) {
      if (o.text !== n.text) el.nodeValue = n.text;
      return;
    }
    isSvg = isSvg || n.tag === 'svg';
    if (n.props.innerHTML == null) {
      const hadHtml = o.props.innerHTML != null;
      if (hadHtml) el.innerHTML = '';
      patchChildren(el, hadHtml ? [] : o.children, n.children, isSvg && n.tag !== 'foreignObject');
    }
    patchProps(el, o, n);
    if (o.ref && o.ref !== n.ref) setRef(o, null);
    setRef(n, el);
  }

  // 最長遞增子序列：回傳 arr 中構成 LIS 的索引（-1 代表新節點，略過）
  function lis(arr) {
    const tails = [];
    const prev = new Array(arr.length);
    arr.forEach((v, i) => {
      if (v < 0) return;
      let lo = 0;
      let hi = tails.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[tails[mid]] < v) lo = mid + 1;
        else hi = mid;
      }
      prev[i] = lo > 0 ? tails[lo - 1] : -1;
      tails[lo] = i;
    });
    const out = new Set();
    for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) out.add(i);
    return out;
  }

  /**
   * 子節點比對：有 key 依 key 配對（可搬移、保留狀態），沒 key 依順序配對。
   * 以 LIS 找出「不必移動」的節點，其餘才搬移，讓 DOM 操作最少。
   * anchor：子節點範圍的結尾（片段 / Teleport 用），元素則為 null
   */
  function patchChildren(parent, oldCh, newCh, isSvg, anchor = null) {
    const byKey = new Map();
    const byObj = new Map();
    const unkeyed = [];
    oldCh.forEach((c, i) => {
      byObj.set(c, i);
      if (c.key != null) byKey.set(c.key, i);
      else unkeyed.push(i);
    });
    const used = new Array(oldCh.length).fill(false);
    const sources = new Array(newCh.length).fill(-1); // 每個新節點對應的舊索引
    let u = 0;
    newCh.forEach((n, i) => {
      let oi = byObj.get(n); // 同一個 vnode 物件（例如插槽內容）直接沿用
      if (oi === undefined || used[oi]) {
        if (n.key != null) oi = byKey.get(n.key);
        else {
          while (u < unkeyed.length && used[unkeyed[u]]) u++;
          oi = unkeyed[u++];
        }
      }
      if (oi !== undefined && !used[oi] && sameNode(oldCh[oi], n)) {
        used[oi] = true;
        sources[i] = oi;
      }
    });

    const inNew = new Set(newCh);
    oldCh.forEach((o, i) => !used[i] && !inNew.has(o) && destroy(o, true));
    newCh.forEach((n, i) => sources[i] >= 0 && patch(oldCh[sources[i]], n, isSvg));

    const stable = lis(sources);
    let next = anchor;
    for (let i = newCh.length - 1; i >= 0; i--) {
      const n = newCh[i];
      if (sources[i] < 0) parent.insertBefore(createEl(n, isSvg), next);
      else if (!stable.has(i)) moveNodes(n, parent, next);
      next = firstNode(n) || next;
    }
  }

  function resolveEl(c) {
    const el = typeof c === 'string' ? document.querySelector(c) : c;
    if (!el) throw new Error('[juicy] 找不到掛載容器: ' + c);
    return el;
  }

  /**
   * render(chain, container)       靜態：渲染一次
   * render(() => chain, container) 響應式：函式內讀到的 reactive 資料變動時自動 diff + patch
   *   view 可以回傳陣列（多個根節點）
   */
  function render(source, container, owner) {
    const el = resolveEl(container);
    if (el._juicy) el._juicy.unmount(); // 容器裡已有 juicy 內容：先卸載釋放
    let prev = null;
    const update = () => {
      renderDepth++;
      const wasInitial = initialRender;
      const prevInst = currentInstance;
      initialRender = !prev;
      if (owner) currentInstance = owner; // $.app：畫面中的元件以 app 為 parent（provide / errorCaptured）
      try {
        let next;
        try {
          next = toVNode(typeof source === 'function' ? source() : source) || textVNode('');
        } catch (err) {
          handleError(err, owner, 'render');
          if (prev) return; // 保留目前畫面
          next = textVNode('');
        }
        if (!prev) {
          el.innerHTML = '';
          el.appendChild(createEl(next, false));
        } else {
          patch(prev, next, false);
        }
        prev = next;
      } finally {
        initialRender = wasInitial;
        currentInstance = prevInst;
        renderDepth--;
      }
      flushPost(); // 元件的 mounted / updated：等整棵樹放進頁面後才呼叫
    };
    const reactiveMode = typeof source === 'function';
    const e = reactiveMode ? effect(update, { scheduler: () => queueJob(e.run) }) : null;
    if (!reactiveMode) update();
    const handle = {
      el,
      root: () => prev,
      update: reactiveMode ? e.run : update,
      stop: reactiveMode ? e.stop : () => {},
      unmount() {
        if (el._juicy === handle) el._juicy = null;
        if (e) e.stop();
        const root = prev;
        prev = null;
        destroy(root, true, true);
      },
    };
    el._juicy = handle;
    return handle;
  }

  /* ================================================================
   * 4. MVVM
   * ================================================================ */

  // ---- 錯誤處理：往上找元件的 errorCaptured，最後交給 $.onError；都沒有就印到 console ----
  //   info：錯誤發生的位置，例如 'render'、'setup'、'watch'、'ref'、'event:click'、生命週期名稱（'mounted' 等）
  const errorHandlers = new Set();
  function handleError(err, inst, info) {
    for (let i = inst && inst.parent; i; i = i.parent) {
      const hook = i.def && i.def.opts.errorCaptured;
      if (!hook || i.dead) continue;
      try {
        if (hook.call(i.vm, err, inst && inst.vm, info) === false) return; // 回傳 false：錯誤已處理，不再往上傳
      } catch (e2) {
        console.error('[juicy] errorCaptured 發生錯誤：', e2);
      }
    }
    if (errorHandlers.size) {
      errorHandlers.forEach((h) => {
        try {
          h(err, inst && inst.vm, info);
        } catch (e2) {
          console.error('[juicy] $.onError 處理函式發生錯誤：', e2);
        }
      });
    } else {
      console.error(`[juicy] ${info} 發生錯誤：`, err);
    }
  }
  function onError(fn) {
    errorHandlers.add(fn);
    return () => errorHandlers.delete(fn);
  }
  function callHook(inst, name) {
    const hook = inst.def.opts[name];
    if (!hook) return;
    try {
      hook.call(inst.vm, inst.vm);
    } catch (err) {
      handleError(err, inst, name);
    }
  }

  // ---- provide / inject：沿著元件樹往下傳值，不必一層層傳 props ----
  const rootProvides = Object.create(null); // $.provide() 設定的全域值
  let setupInstance = null; // 正在建立中的元件 / app（$.resource 等會在它卸載時自動停止）
  function injectValue(inst, key, fallback) {
    const src = inst && inst.parent ? inst.parent.provides : rootProvides;
    if (key in src) return src[key];
    return typeof fallback === 'function' ? fallback() : fallback;
  }
  function applyProvide(inst, opts) {
    if (!opts.provide) return;
    Object.assign(inst.provides, typeof opts.provide === 'function' ? opts.provide.call(inst.vm, inst.vm) : opts.provide);
  }

  // $.app 與元件共用：建立 vm（data / props / inject / computed / methods / watch）
  //   special：額外的 $ 開頭屬性，值為 getter；inst：所屬的元件 / app（錯誤處理與 inject 用）
  function createVM(opts, props, special, inst) {
    const methods = {};
    const computeds = {};
    const injected = {};
    const stops = [];
    let state = null;
    const isProp = (k) => !!props && typeof k === 'string' && hasOwn(toRaw(props), k);
    const safe = (fn, info) => (...args) => {
      try {
        return fn(...args);
      } catch (err) {
        handleError(err, inst, info);
      }
    };

    const vm = new Proxy(
      {},
      {
        get(_, k) {
          if (k === '$state') return state;
          if (k === '$props') return props;
          if (k === '$nextTick') return nextTick;
          if (k === '$watch') {
            return (src, cb, o) => {
              const stop = watch(typeof src === 'string' ? () => getPath(vm, src) : src.bind(vm), safe(cb.bind(vm), 'watch'), o);
              stops.push(stop);
              return stop;
            };
          }
          if (special && hasOwn(special, k)) return special[k]();
          if (hasOwn(methods, k)) return methods[k];
          if (hasOwn(computeds, k)) return computeds[k].value;
          if (isProp(k)) return props[k];
          if (hasOwn(injected, k)) return injected[k];
          return state ? state[k] : undefined;
        },
        set(_, k, v) {
          if (hasOwn(computeds, k)) computeds[k].value = v;
          else if (isProp(k)) console.warn(`[juicy] props 是唯讀的（${String(k)}），請用 $emit 通知父層修改`);
          else if (hasOwn(injected, k)) console.warn(`[juicy] inject 的值（${String(k)}）是唯讀的；要修改請 provide 一個 reactive 物件`);
          else state[k] = v;
          return true;
        },
        has(_, k) {
          return hasOwn(methods, k) || hasOwn(computeds, k) || isProp(k) || hasOwn(injected, k) || (!!state && k in state);
        },
      }
    );

    // inject: ['theme'] 或 { color: 'theme' } 或 { color: { from: 'theme', default: 'red' } }
    if (opts.inject) {
      const list = Array.isArray(opts.inject) ? opts.inject.map((k) => [k, k]) : Object.entries(opts.inject);
      list.forEach(([local, cfg]) => {
        const c = typeof cfg === 'string' ? { from: cfg } : cfg || {};
        injected[local] = injectValue(inst, c.from || local, c.default);
      });
    }

    // data 為函式時可讀到 props / inject：data() { return { count: this.start } }
    state = reactive((typeof opts.data === 'function' ? opts.data.call(vm, vm) : opts.data) || {});

    Object.keys(opts.methods || {}).forEach((k) => (methods[k] = opts.methods[k].bind(vm)));

    Object.keys(opts.computed || {}).forEach((k) => {
      const def = opts.computed[k];
      computeds[k] =
        typeof def === 'function'
          ? computed(() => def.call(vm, vm))
          : computed({ get: () => def.get.call(vm, vm), set: (v) => def.set.call(vm, v) });
    });

    Object.keys(opts.watch || {}).forEach((k) => {
      const w = opts.watch[k];
      const handler = typeof w === 'function' ? w : w.handler;
      stops.push(watch(() => getPath(vm, k), safe(handler.bind(vm), 'watch'), typeof w === 'function' ? {} : w));
    });

    return { vm, stops };
  }

  function createApp(options) {
    const opts = options || {};
    if (typeof opts.view !== 'function') throw new Error('[juicy] $.app 需要 view(vm) 函式');
    let renderer = null;
    // app 也是一個「實例」：元件的 parent 鏈最上層，提供 provide / errorCaptured / $refs
    const appInst = { def: { name: 'App', opts }, parent: null, vm: null, refs: {}, cleanups: [], dead: false,
      provides: Object.create(rootProvides) };
    const prevSetup = setupInstance;
    setupInstance = appInst;
    let vm;
    let stops;
    try {
      ({ vm, stops } = createVM(opts, null, {
        $el: () => renderer && renderer.el,
        $unmount: () => unmount,
        $refs: () => appInst.refs,
        $provide: () => (key, value) => (appInst.provides[key] = value),
      }, appInst));
      appInst.vm = vm;
      applyProvide(appInst, opts);
    } finally {
      setupInstance = prevSetup;
    }

    let appHandle = null;
    function unmount() {
      if (!renderer) return;
      appInst.dead = true;
      appInst.cleanups.forEach((f) => f());
      stops.forEach((s) => s());
      stops.length = 0;
      const r = renderer;
      renderer = null;
      if (r.el._juicy === appHandle) r.el._juicy = null;
      r.unmount();
      callHook(appInst, 'unmounted');
    }

    callHook(appInst, 'created');

    return {
      vm,
      mount(container) {
        renderer = render(() => {
          const prev = [currentVM, currentInstance, currentRefs];
          currentVM = vm;
          currentInstance = appInst;
          currentRefs = appInst.refs;
          try {
            return opts.view.call(vm, vm);
          } finally {
            [currentVM, currentInstance, currentRefs] = prev;
          }
        }, container, appInst);
        // 讓同一容器重新 mount 時也會停止 watch 並呼叫 unmounted
        appHandle = { el: renderer.el, root: renderer.root, unmount };
        renderer.el._juicy = appHandle;
        callHook(appInst, 'mounted');
        return vm;
      },
    };
  }

  /* ================================================================
   * 5. 元件
   *   const Counter = $.component('my-counter', { props, data, computed, methods, watch, emits, view })
   *   使用：Counter({ start: 1 }) / $(Counter, { start: 1 }) / $('my-counter').prop('start', 1)
   *   每個實例有自己的狀態與 render effect：父層重繪時只更新 props，元件內部狀態會保留
   * ================================================================ */
  const COMP = Symbol('component');
  const registry = Object.create(null); // 名稱 -> 元件定義，讓 $('my-counter') 也能建立元件
  const isComp = (t) => !!t && (typeof t === 'object' || typeof t === 'function') && t[COMP] === true;
  let currentInstance = null;
  let renderDepth = 0;
  const postQueue = [];

  function flushPost() {
    if (renderDepth) return;
    while (postQueue.length) postQueue.shift()();
  }

  function selectorVNode(sel) {
    const vnode = parseSelector(sel);
    const def = registry[vnode.tag.toLowerCase()];
    if (def) vnode.tag = def;
    return vnode;
  }

  function propDefaults(opts) {
    const p = opts.props;
    if (!p) return {};
    if (Array.isArray(p)) return Object.fromEntries(p.map((k) => [k, undefined]));
    return p;
  }

  /**
   * $.component('my-tag', options)  定義並註冊，之後 $('my-tag') 也能建立
   * $.component(options)            只定義不註冊；options.name 僅作為除錯用的顯示名稱
   */
  function defineComponent(name, opts) {
    let register = null;
    if (typeof name === 'string') register = name;
    else if (opts === undefined) opts = name;
    if (opts && opts.def && isComp(opts.def)) return opts; // 已經是元件
    if (!opts || typeof opts.view !== 'function') throw new Error('[juicy] $.component 需要 view(vm, children) 函式');
    const def = { [COMP]: true, name: register || opts.name || 'Anonymous', opts };
    // Counter({ props }, ...children)：第一個參數若不是一般物件，視為子節點
    const factory = (props, ...children) => {
      const v = createVNode(def);
      if (props != null && isObject(props) && isPlain(props) && !Array.isArray(props) && !('tag' in props)) Object.assign(v.props, props);
      else if (props != null) children.unshift(props);
      const c = new Chain(v);
      if (children.length) c.append(...children);
      return c;
    };
    factory.def = def;
    factory.displayName = def.name;
    def.factory = factory;
    if (register) {
      // 名稱沒有 - 時可能和 HTML 標籤相同（例如 'footer'），會讓 $('footer') 變成這個元件
      if (!register.includes('-')) console.warn(`[juicy] 元件名稱「${register}」建議包含 -（例如 my-${register.toLowerCase()}），避免與 HTML 標籤衝突`);
      registry[register.toLowerCase()] = def;
    }
    return factory;
  }

  // ---- 插槽 ----
  const normalizeSlot = (x) => flatten([x]).map(toVNode).filter(Boolean);
  function renderSlot(inst, name, args) {
    const v = inst.vnode;
    const s = v.slots && v.slots[name];
    if (!s) return name === 'default' && v.children.length ? v.children : null;
    if (typeof s.content !== 'function') return normalizeSlot(s.content);
    // 作用域插槽在父層的範圍執行：裡面的 .model('x') / .ref('x') 綁到父層
    const prev = [currentVM, currentRefs];
    currentVM = s.vm;
    currentRefs = s.refs;
    try {
      return normalizeSlot(s.content(...args));
    } finally {
      [currentVM, currentRefs] = prev;
    }
  }
  function slotNames(inst) {
    const v = inst.vnode;
    const names = Object.keys(v.slots || {});
    if (v.children.length && !names.includes('default')) names.push('default');
    return names;
  }

  // 呼叫元件的 view，並把元件上的 class / style / attr / transition（以及未在 emits 宣告的事件）合併到根節點
  function renderRoot(inst) {
    const v = inst.vnode;
    const vm = inst.vm;
    let root = toVNode(inst.def.opts.view.call(vm, vm, v.children)) || textVNode('');
    const emits = inst.def.opts.emits;
    const fallOn = {};
    if (Array.isArray(emits)) for (const k in v.on) if (!emits.includes(eventInfo(k).type)) fallOn[k] = v.on[k];
    const has = (o) => Object.keys(o).length > 0;
    const mergeable = typeof root.tag === 'string' || isComp(root.tag); // 片段 / 文字沒有單一根元素可合併
    if (mergeable && (has(v.attrs) || has(v.classes) || has(v.style) || has(fallOn) || v.transition)) {
      const on = { ...root.on };
      for (const k in fallOn) on[k] = (on[k] || []).concat(fallOn[k]);
      root = {
        ...root,
        attrs: { ...root.attrs, ...v.attrs },
        classes: { ...root.classes, ...v.classes },
        style: { ...root.style, ...v.style },
        on,
        transition: v.transition || root.transition,
      };
    }
    return root;
  }

  // 元件根節點換了真實元素時，往上同步「以這個元件為根」的父元件
  function syncEl(inst) {
    let i = inst;
    i.vnode.el = i.subTree.el;
    while (i.parent && i.parent.subTree === i.vnode) {
      i.parent.vnode.el = i.vnode.el;
      i = i.parent;
    }
  }

  function mountComponent(v, isSvg) {
    const def = v.tag;
    const opts = def.opts;
    const parent = currentInstance;
    const props = reactive({ ...propDefaults(opts), ...v.props });
    const inst = { def, vnode: v, props, parent, subTree: null, mounted: false, dead: false, refs: {}, cleanups: [], stops: [],
      provides: Object.create(parent ? parent.provides : rootProvides) };
    v.comp = inst;
    const prevSetup = setupInstance;
    setupInstance = inst;
    try {
      const { vm, stops } = createVM(opts, props, {
        $el: () => inst.vnode.el,
        $children: () => inst.vnode.children,
        $listeners: () => inst.vnode.on,
        $vnode: () => inst.vnode,
        $parent: () => inst.parent && inst.parent.vm,
        $refs: () => inst.refs,
        $slots: () => Object.fromEntries(slotNames(inst).map((n) => [n, (...args) => renderSlot(inst, n, args)])),
        $slot: () => (name, ...args) => renderSlot(inst, name, args),
        $hasSlot: () => (name) => slotNames(inst).includes(name),
        $provide: () => (key, value) => (inst.provides[key] = value),
        $inject: () => (key, fallback) => injectValue(inst, key, fallback),
        $emit: () => (name, ...args) =>
          (inst.vnode.on[name] || []).forEach((f) => {
            try {
              f.apply(inst.vm, args);
            } catch (err) {
              handleError(err, inst, `event:${name}`);
            }
          }),
      }, inst);
      inst.vm = vm;
      inst.stops = stops;
      applyProvide(inst, opts);
    } catch (err) {
      handleError(err, inst, 'setup'); // data() / inject 等出錯：這個元件渲染成空白
    } finally {
      setupInstance = prevSetup;
    }
    if (inst.vm) {
      const prevSetup2 = setupInstance;
      setupInstance = inst;
      callHook(inst, 'created');
      setupInstance = prevSetup2;
    }

    const run = () => {
      if (inst.dead) return;
      renderDepth++;
      const prev = [currentInstance, currentVM, currentRefs];
      currentInstance = inst;
      currentVM = inst.vm;
      currentRefs = inst.refs;
      try {
        let next;
        try {
          next = inst.vm ? renderRoot(inst) : textVNode('');
        } catch (err) {
          handleError(err, inst, 'render');
          next = inst.subTree ? null : textVNode(''); // 已有畫面：保留；第一次：渲染成空白
        }
        if (next) {
          if (!inst.subTree) inst.node = createEl(next, isSvg);
          else patch(inst.subTree, next, isSvg);
          inst.subTree = next;
          syncEl(inst);
        }
      } finally {
        [currentInstance, currentVM, currentRefs] = prev;
        renderDepth--;
      }
      const hook = inst.mounted ? 'updated' : 'mounted';
      inst.mounted = true;
      if (opts[hook]) postQueue.push(() => !inst.dead && callHook(inst, hook));
      flushPost();
    };
    inst.effect = effect(run, { scheduler: () => queueJob(inst.effect.run) });
    if (v.ref) postQueue.push(() => v.comp === inst && setRef(v, inst.vm));
    const node = inst.node;
    inst.node = null;
    return node;
  }

  function updateComponent(o, n) {
    const inst = (n.comp = o.comp);
    n.el = o.el;
    o.comp = null;
    if (!inst) return;
    inst.vnode = n;
    if (o.ref && o.ref !== n.ref) setRef(o, null);
    setRef(n, inst.vm);
    // 更新 props：只有值真的變了才會觸發元件重繪
    const next = { ...propDefaults(inst.def.opts), ...n.props };
    const raw = toRaw(inst.props);
    for (const k in raw) if (!(k in next)) delete inst.props[k];
    for (const k in next) if (!Object.is(raw[k], toRaw(next[k]))) inst.props[k] = next[k];
    // 子節點 / 插槽或要合併到根節點的屬性每次都是新的，交給元件重繪比對
    const has = (x) => !!x && Object.keys(x).length > 0;
    if (n.children.length || o.children.length || has(n.slots) || has(o.slots) || has(n.attrs) || has(o.attrs) ||
        has(n.classes) || has(o.classes) || has(n.style) || has(o.style) ||
        (Array.isArray(inst.def.opts.emits) && (has(n.on) || has(o.on)))) {
      queueJob(inst.effect.run);
    }
  }

  function unmountComponent(v, detach, keepTree) {
    const inst = v.comp;
    setRef(v, null);
    v.comp = null;
    v.el = null;
    inst.dead = true;
    inst.effect.stop();
    inst.cleanups.forEach((f) => f());
    inst.stops.forEach((s) => s());
    destroy(inst.subTree, detach, keepTree);
    if (inst.vm) callHook(inst, 'unmounted');
  }

  /**
   * 匯入元件：回傳一個「立即可用」的元件，載入完成前顯示 loading，完成後自動換成真正的元件
   *   $.import('./components/card.js')                 網址：以 import() 載入 ES module（相對於頁面網址）
   *   $.import(() => import('./card.js'))               函式：回傳 Promise（打包工具 / 自訂載入）
   *   $.import(src, { name, export, loading, error })   name 註冊成 $('name')；export 指定匯出名稱（預設 default）
   * 模組可匯出：$.component() 的結果、元件設定物件 { view, ... }，或 ($) => 上述兩者（不依賴全域 $）
   */
  const moduleCache = new Map();
  function toFactory(x, name, depth = 0) {
    if (x && x.def && isComp(x.def)) return x;
    if (isComp(x)) return x.factory;
    if (typeof x === 'function' && depth < 3) return toFactory(x($), name, depth + 1);
    if (x && typeof x.view === 'function') return name ? defineComponent(name, x) : defineComponent(x);
    throw new Error('[juicy] 匯入的內容不是元件');
  }

  function importComponent(source, options) {
    const o = typeof options === 'string' ? { name: options } : options || {};
    const st = reactive({ status: 'idle', error: null });
    let factory = null;
    let promise = null;

    const load = () => {
      if (promise) return promise;
      st.status = 'loading';
      let p;
      if (typeof source === 'function') p = Promise.resolve().then(source);
      else {
        const url = typeof document !== 'undefined' ? new URL(source, document.baseURI).href : source;
        if (!moduleCache.has(url)) moduleCache.set(url, import(url));
        p = moduleCache.get(url);
      }
      promise = p.then((m) => {
        const picked = m && !(typeof m.view === 'function') && (o.export || 'default') in m ? m[o.export || 'default'] : m;
        factory = toFactory(picked);
        if (o.name) registry[o.name.toLowerCase()] = Async.def; // 模組若自己註冊同名元件，名稱仍指向這個匯入元件
        st.status = 'ready';
        return factory;
      }).catch((err) => {
        st.error = err;
        st.status = 'error';
        promise = null; // 下次渲染可重試
        console.error('[juicy] 元件載入失敗：', source, err);
        throw err;
      });
      return promise;
    };

    const Async = defineComponent(o.name, {
      view(vm, children) {
        const status = st.status;
        if (status === 'ready') {
          const props = {};
          Object.keys(vm.$props).forEach((k) => (props[k] = vm.$props[k]));
          const c = factory(props, ...children);
          c.vnode.slots = vm.$vnode.slots; // 具名 / 作用域插槽也轉過去
          // 事件、.model() 轉給真正的元件（呼叫時才讀取，父層換了 handler 也會用到最新的）
          Object.keys(vm.$listeners).forEach((k) =>
            c.on(k, function (...args) { (vm.$listeners[k] || []).forEach((f) => f.apply(this, args)); })
          );
          return c;
        }
        if (status === 'error') return o.error ? o.error(st.error, () => { st.status = 'idle'; load().catch(() => {}); }) : null;
        if (status === 'idle') Promise.resolve().then(() => load().catch(() => {}));
        return o.loading ? o.loading() : null;
      },
    });
    Async.load = load; // 預先載入：await Comp.load()
    Async.status = () => st.status;
    if (o.eager) load().catch(() => {});
    return Async;
  }

  /* ================================================================
   * 6. 路由
   *   routes: {
   *     '/': view,                                   view(route, router, outlet) 回傳 $() 鏈，或直接給元件
   *     '/old': '/new',                              字串 = 轉址
   *     '/admin': { view: Layout, meta: { auth: true }, beforeEnter, beforeLeave,
   *                 children: { '': Dashboard, 'users/:id': UserPage } },   巢狀：子頁面以 outlet 傳給 Layout
   *     '*': view,                                   找不到時（永遠最後比對）
   *   }
   * ================================================================ */
  let currentRouter = null; // 最後建立的 router，供 .link() 預設使用

  function compileRoute(pattern) {
    const keys = [];
    if (pattern === '*') return { re: /^/, keys };
    const src = pattern
      .replace(/\/+$/, '')
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\/:(\w+)/g, (_, k) => (keys.push(k), '/([^/]+)'))
      .replace(/\/\*$/, () => (keys.push('pathMatch'), '(?:/(.*))?'));
    return { re: new RegExp('^' + src + '/?$'), keys };
  }

  function parsePath(full) {
    full = String(full || '/');
    const qi = full.indexOf('?');
    const path = '/' + (qi < 0 ? full : full.slice(0, qi)).replace(/^\/+/, '');
    const query = {};
    if (qi >= 0) new URLSearchParams(full.slice(qi + 1)).forEach((v, k) => (query[k] = v));
    return { path, query, fullPath: qi < 0 ? path : path + full.slice(qi) };
  }

  const joinPath = (base, p) => (p.startsWith('/') ? p : (base.replace(/\/+$/, '') + '/' + p).replace(/\/+$/, '') || '/');
  const routeDef = (v) => (typeof v === 'function' || typeof v === 'string' ? { view: v } : v || {});

  // 把巢狀 routes 攤平成可比對的清單；每筆記錄保留從最外層到自己的 chain
  function flattenRoutes(routes, base, parents, out) {
    Object.keys(routes || {}).forEach((key) => {
      const def = routeDef(routes[key]);
      const pattern = key === '*' && !base ? '*' : joinPath(base || '/', key);
      const chain = [...parents, { def, pattern }];
      if (def.children) flattenRoutes(def.children, pattern, chain, out); // 子路由先比對（'' 子路由優先於父層本身）
      out.push({ pattern, def, chain, ...compileRoute(pattern) });
    });
    return out;
  }

  class Router {
    constructor(options) {
      const opts = options || {};
      this.mode = opts.mode || 'hash';
      this.base = (opts.base || '').replace(/\/+$/, '');
      this.guard = opts.beforeEach;
      this.after = opts.afterEach;
      this.scrollBehavior = opts.scrollBehavior;
      this.records = flattenRoutes(opts.routes, '', [], []);
      this.records.sort((a, b) => (a.pattern === '*') - (b.pattern === '*')); // '*' 永遠最後比對
      this.memory = [opts.initial || '/'];
      this.memIndex = 0;
      this._leaveGuards = new Set();
      this._positions = new Map(); // 歷史紀錄 id -> 捲動位置
      this._seq = 0;
      this._entry = 0;
      this._current = null;
      // 目前路由（reactive）：view / computed / watch 讀它就會在切換時自動更新
      this.route = reactive({ path: '', fullPath: '', params: {}, query: {}, matched: null, meta: {} });

      this._onPop = () => {
        if (this._read() !== this.route.fullPath) this._go(this._read(), true, true);
      };
      if (this.mode !== 'memory') {
        window.addEventListener('popstate', this._onPop);
        if (this.mode === 'hash') window.addEventListener('hashchange', this._onPop);
      }
      currentRouter = this;
      this._go(this._read(), true, true);
    }

    _read() {
      if (this.mode === 'memory') return this.memory[this.memIndex];
      const loc = window.location;
      if (this.mode === 'hash') return loc.hash.slice(1) || '/';
      const p = loc.pathname.startsWith(this.base) ? loc.pathname.slice(this.base.length) : loc.pathname;
      return (p || '/') + loc.search;
    }

    // 目前這筆歷史紀錄的 id（用來記住捲動位置）
    _entryId() {
      if (this.mode === 'memory') return this.memIndex;
      const st = window.history.state;
      if (st && st.juicyId) return st.juicyId;
      const id = ++this._seq + '-' + Date.now();
      try {
        window.history.replaceState({ ...(st || {}), juicyId: id }, '');
      } catch (e) {
        /* 無法寫入歷史紀錄 */
      }
      return id;
    }

    _write(fullPath, replace) {
      if (this.mode === 'memory') {
        if (replace) this.memory[this.memIndex] = fullPath;
        else this.memory.splice(++this.memIndex, Infinity, fullPath);
        return;
      }
      if (this._read() === fullPath) return;
      const href = this.href(fullPath);
      try {
        const id = replace ? this._entryId() : ++this._seq + '-' + Date.now();
        window.history[replace ? 'replaceState' : 'pushState']({ juicyId: id }, '', href);
      } catch (err) {
        // 直接開啟檔案（file://）時瀏覽器不允許 pushState；hash 模式改用 location.hash（會觸發 hashchange，但路由已是新的，會被忽略）
        if (this.mode !== 'hash') throw err;
        if (replace) window.location.replace(href);
        else window.location.hash = href.slice(1);
      }
    }

    // 依路徑找出符合的路由（不會導航）
    resolve(to) {
      const loc = parsePath(to);
      for (const r of this.records) {
        const m = r.re.exec(loc.path);
        if (!m) continue;
        const params = {};
        r.keys.forEach((k, i) => (params[k] = m[i + 1] == null ? '' : decodeURIComponent(m[i + 1])));
        const meta = Object.assign({}, ...r.chain.map((c) => c.def.meta || {})); // 子路由的 meta 覆蓋父層
        return { ...loc, params, matched: r.pattern, meta, record: r };
      }
      return { ...loc, params: {}, matched: null, meta: {}, record: null };
    }

    // 註冊離開目前頁面前的確認（例如表單未存檔）；回傳 false 取消、字串轉址。
    // 在元件建立期間呼叫時，元件卸載會自動移除。回傳移除函式
    beforeLeave(fn) {
      this._leaveGuards.add(fn);
      const remove = () => this._leaveGuards.delete(fn);
      if (setupInstance) setupInstance.cleanups.push(remove);
      return remove;
    }

    // external = 網址已由瀏覽器改變（上一頁 / 手動改網址 / 初始載入）
    _go(to, replace, external, hops = 0) {
      if (hops > 10) throw new Error('[juicy] 路由轉址次數過多：' + to);
      const target = this.resolve(to);
      const rec = target.record;
      const redirect = rec && (typeof rec.def.view === 'string' ? rec.def.view : rec.def.redirect);
      if (redirect) return this._go(typeof redirect === 'function' ? redirect(target) : redirect, true, false, hops + 1);

      const from = this._current ? { ...toRaw(this.route) } : null;
      const toR = { path: target.path, fullPath: target.fullPath, params: target.params, query: target.query, matched: target.matched, meta: target.meta };
      const oldChain = this._current ? this._current.chain.map((c) => c.def) : [];
      const newChain = rec ? rec.chain.map((c) => c.def) : [];

      // 守衛順序：離開（動態註冊的 → 舊頁面獨有的 beforeLeave）→ beforeEach → 進入（新頁面獨有的 beforeEnter）
      const guards = [];
      if (from && from.fullPath !== toR.fullPath) {
        this._leaveGuards.forEach((g) => guards.push(g)); // 元件註冊的（最內層）先執行
        oldChain.filter((d) => d.beforeLeave && !newChain.includes(d)).reverse().forEach((d) => guards.push(d.beforeLeave));
      }
      if (this.guard) guards.push(this.guard);
      newChain.filter((d) => d.beforeEnter && !oldChain.includes(d)).forEach((d) => guards.push(d.beforeEnter));
      for (const g of guards) {
        const res = g(toR, from);
        if (res === false) {
          if (external && from && this.mode !== 'memory') this._write(from.fullPath, true); // 取消：把網址還原
          return false;
        }
        if (typeof res === 'string' && parsePath(res).fullPath !== target.fullPath) return this._go(res, true, false, hops + 1);
      }

      // 記住離開前的捲動位置
      if (from && typeof window !== 'undefined') this._positions.set(this._entry, { left: window.scrollX || 0, top: window.scrollY || 0 });
      if (!external || hops) this._write(target.fullPath, replace);
      this._entry = this._entryId();
      this._current = rec;
      Object.assign(this.route, toR);
      if (this.after) this.after(toR, from);
      this._scroll(toR, from, external && from ? this._positions.get(this._entry) || null : null);
      return true;
    }

    // scrollBehavior(to, from, savedPosition) → { left, top } | { el: '#id' } | false（可回傳 Promise）
    _scroll(to, from, saved) {
      if (!this.scrollBehavior || !from) return;
      Promise.resolve(this.scrollBehavior(to, from, saved))
        .then((pos) => nextTick().then(() => pos))
        .then((pos) => {
          if (!pos) return;
          try {
            if (pos.el) {
              const el = typeof pos.el === 'string' ? document.querySelector(pos.el) : pos.el;
              if (el) el.scrollIntoView({ behavior: pos.behavior });
            } else {
              window.scrollTo({ left: pos.left || 0, top: pos.top || 0, behavior: pos.behavior });
            }
          } catch (e) {
            /* 不支援捲動的環境 */
          }
        });
    }

    push(to, opts) { return this._go(to, !!(opts && opts.replace), false); }
    go(n) {
      if (this.mode !== 'memory') return window.history.go(n);
      const i = Math.max(0, Math.min(this.memory.length - 1, this.memIndex + n));
      if (i === this.memIndex) return;
      const prev = this.memIndex;
      this.memIndex = i;
      if (!this._go(this.memory[i], true, true)) this.memIndex = prev;
    }
    back() { return this.go(-1); }
    forward() { return this.go(1); }

    href(to) {
      const p = parsePath(to).fullPath;
      return this.mode === 'history' ? this.base + p : '#' + p;
    }
    isActive(to, exact = true) {
      const p = parsePath(to).path.replace(/\/+$/, '') || '/';
      const cur = this.route.path.replace(/\/+$/, '') || '/';
      return exact || p === '/' ? cur === p : cur === p || cur.startsWith(p + '/');
    }

    // 目前路由對應的畫面；巢狀路由由內而外組合：內層畫面當作 outlet 傳給外層
    view() {
      this.route.fullPath; // 建立依賴：任何導航都重繪
      const rec = this._current;
      if (!rec) return null;
      let outlet = null;
      for (let i = rec.chain.length - 1; i >= 0; i--) {
        const v = rec.chain[i].def.view;
        if (typeof v !== 'function') continue; // 沒有 view 的父層：直接把 outlet 往外傳
        outlet = v.def && isComp(v.def)
          ? v({ route: this.route }, ...(outlet ? [outlet] : [])) // 元件：route 當 prop、outlet 當 children
          : v(this.route, this, outlet);
      }
      return outlet;
    }
    // 掛到容器：路由切換時自動 diff + patch，回傳 $.render 的 handle
    mount(container) {
      return render(() => this.view(), container);
    }
    // 停止監聽瀏覽器網址變化
    stop() {
      window.removeEventListener('popstate', this._onPop);
      window.removeEventListener('hashchange', this._onPop);
      if (currentRouter === this) currentRouter = null;
    }
  }

  /* ================================================================
   * 7. 多語系
   *   const i18n = $.i18n({ locale: 'zh-TW', fallback: 'en', messages: { en: {...}, 'zh-TW': {...} } })
   *   i18n.t('cart.items', { n: 3 })   i18n.locale = 'en'（reactive：讀過 t() 的畫面會自動重繪）
   * ================================================================ */
  let currentI18n = null; // 最後建立的 i18n，供 $.t() / .t() 預設使用

  function lookupMessage(msgs, key) {
    if (!msgs) return undefined;
    if (hasOwn(msgs, key)) return msgs[key]; // 平面 key（也允許 key 本身含 . 或是原文）
    if (key.indexOf('.') < 0) return undefined;
    return key.split('.').reduce((a, k) => (a != null && typeof a === 'object' && hasOwn(a, k) ? a[k] : undefined), msgs);
  }

  const isPluralForm = (m) =>
    (typeof m === 'string' && m.includes('|')) ||
    (isObject(m) && !Array.isArray(m) && ('other' in m || 'one' in m || 'zero' in m));

  class I18n {
    constructor(options) {
      const o = options || {};
      this.messages = {};
      Object.keys(o.messages || {}).forEach((l) => (this.messages[l] = o.messages[l]));
      this.loaders = o.loaders || {};
      this.fallback = o.fallback || null;
      this.missing = o.missing || null;
      this._state = reactive({ locale: o.locale || this.detect(), rev: 0, loading: null });
      currentI18n = this;
    }

    // 依瀏覽器語言挑選最接近的已知語系
    detect(available) {
      const list = available || [...Object.keys(this.messages), ...Object.keys(this.loaders)];
      const prefs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
      for (const p of prefs.filter(Boolean)) {
        const hit = list.find((l) => l.toLowerCase() === p.toLowerCase()) ||
          list.find((l) => l.split('-')[0].toLowerCase() === p.split('-')[0].toLowerCase());
        if (hit) return hit;
      }
      return this.fallback || list[0] || 'en';
    }

    get locale() { return this._state.locale; }
    set locale(l) { this.setLocale(l); }
    get loading() { return this._state.loading; }
    get locales() { return [...new Set([...Object.keys(this.messages), ...Object.keys(this.loaders)])]; }

    // 切換語言；若該語系尚未載入且有 loaders，會先非同步載入。回傳 Promise
    setLocale(l) {
      const st = this._state;
      if (!this.messages[l] && this.loaders[l]) {
        st.loading = l;
        return Promise.resolve()
          .then(() => this.loaders[l](l))
          .then((m) => {
            this.add(l, m && m.default && Object.keys(m).length === 1 ? m.default : m);
            if (st.loading === l) {
              st.locale = l;
              st.loading = null;
            }
            return l;
          })
          .catch((err) => {
            if (st.loading === l) st.loading = null;
            throw err;
          });
      }
      st.loading = null;
      st.locale = l;
      return Promise.resolve(l);
    }

    // 加入 / 合併翻譯
    add(locale, msgs) {
      this.messages[locale] = { ...(this.messages[locale] || {}), ...(msgs || {}) };
      this._state.rev++;
      return this;
    }

    // 查詢順序：zh-TW → zh → fallback → fallback 的語言
    _chain(locale) {
      const out = [];
      const push = (l) => l && !out.includes(l) && out.push(l);
      push(locale);
      push(locale && locale.split('-')[0]);
      push(this.fallback);
      push(this.fallback && this.fallback.split('-')[0]);
      return out;
    }

    _find(key, locale) {
      for (const l of this._chain(locale)) {
        const m = lookupMessage(this.messages[l], key);
        if (m !== undefined) return { msg: m, locale: l };
      }
      return null;
    }

    has(key, locale) {
      this._state.rev;
      return !!this._find(key, locale || this._state.locale);
    }

    /**
     * t('hello', { name: 'Ada' })    'Hello, {name}!'
     * t('items', 3) / t('items', { n: 3 })
     *   'no items | one item | {n} items'（2 段：單數 | 複數；3 段：0 | 1 | 其他）
     *   或 { zero, one, two, few, many, other }（依 Intl.PluralRules）
     * 訊息也可以是函式：(params, i18n) => string
     * 找不到時呼叫 missing(key, locale)，否則回傳 key 本身
     */
    t(key, params) {
      const st = this._state;
      st.rev; // 建立依賴：加入翻譯時也會重繪
      const locale = st.locale;
      if (typeof params === 'number') params = { n: params, count: params };
      const found = this._find(key, locale);
      let msg;
      let used = locale;
      if (found) {
        msg = found.msg;
        used = found.locale;
      } else {
        const r = this.missing ? this.missing(key, locale) : undefined;
        if (r !== undefined) return r;
        msg = key;
      }
      if (typeof msg === 'function') return String(msg(params || {}, this));
      const n = params && (params.n != null ? params.n : params.count);
      if (n != null) params = { n, count: n, ...params }; // {n} 與 {count} 互為別名
      if (n != null && isPluralForm(msg)) msg = this._plural(msg, Number(n), used);
      if (isObject(msg)) return key; // 指到的是一整組訊息
      msg = String(msg);
      return params ? msg.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m)) : msg;
    }

    _plural(msg, n, locale) {
      let cat = 'other';
      try { cat = new Intl.PluralRules(locale).select(n); } catch (e) { cat = n === 1 ? 'one' : 'other'; }
      if (typeof msg === 'string') {
        const parts = msg.split('|').map((x) => x.trim());
        if (parts.length === 2) return parts[n === 1 || (cat === 'one' && n !== 0) ? 0 : 1];
        return parts[n === 0 ? 0 : n === 1 || cat === 'one' ? 1 : Math.min(2, parts.length - 1)];
      }
      if (n === 0 && msg.zero != null) return msg.zero;
      return msg[cat] != null ? msg[cat] : msg.other != null ? msg.other : msg.one;
    }

    // 數字 / 日期格式化（Intl），依目前語系
    n(value, opts) {
      return new Intl.NumberFormat(this._state.locale, opts).format(value);
    }
    d(value, opts) {
      if (typeof opts === 'string') opts = { dateStyle: opts }; // 'short' | 'medium' | 'long' | 'full'
      return new Intl.DateTimeFormat(this._state.locale, opts).format(value instanceof Date ? value : new Date(value));
    }
  }

  /* ================================================================
   * 8. 全域狀態管理
   *   const cart = $.store('cart', {
   *     state: () => ({ items: [] }),
   *     getters: { total: (state) => state.items.length },
   *     actions: { add(item) { this.items.push(item); } },
   *     persist: 'cart',            // 可選：存到 localStorage
   *   });
   *   任何地方 $.store('cart') 取得同一個實例；在 view 裡讀取 cart.items / cart.total 會自動追蹤
   * ================================================================ */
  const storeRegistry = new Map();

  function cloneData(v) {
    v = toRaw(v);
    try {
      return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
    } catch (e) {
      return JSON.parse(JSON.stringify(v));
    }
  }

  // 深層合併一般物件（陣列與其他值直接取代）
  function mergeInto(target, src) {
    Object.keys(src || {}).forEach((k) => {
      const v = src[k];
      const cur = toRaw(target)[k];
      if (isObject(v) && !Array.isArray(v) && isPlain(v) && isObject(cur) && !Array.isArray(cur) && isPlain(cur)) mergeInto(target[k], v);
      else target[k] = v;
    });
  }

  function pickPaths(obj, paths) {
    const out = {};
    paths.forEach((p) => {
      const v = getPath(obj, p);
      if (v === undefined) return;
      const keys = String(p).split('.');
      const last = keys.pop();
      keys.reduce((a, k) => (a[k] = isObject(a[k]) ? a[k] : {}), out)[last] = v;
    });
    return out;
  }

  function createStore(id, options) {
    const o = options || {};
    const initial = typeof o.state === 'function' ? o.state : (() => { const snap = cloneData(o.state || {}); return () => cloneData(snap); })();
    const state = reactive(initial());
    const getters = {};
    const actions = {};
    const actionListeners = new Set();
    const stops = [];
    let disposed = false;

    const store = new Proxy({}, {
      get(_, k) {
        switch (k) {
          case '$id': return id;
          case '$state': return state;
          case '$patch': return patch;
          case '$reset': return reset;
          case '$subscribe': return subscribe;
          case '$onAction': return onAction;
          case '$watch': return (src, cb, opts) => {
            const stop = watch(typeof src === 'string' ? () => getPath(store, src) : () => src(store), cb, opts);
            stops.push(stop);
            return stop;
          };
          case '$dispose': return dispose;
        }
        if (hasOwn(actions, k)) return actions[k];
        if (hasOwn(getters, k)) return getters[k].value;
        return state[k];
      },
      set(_, k, v) {
        if (k === '$state') {
          replaceState(v);
        } else if (hasOwn(getters, k)) {
          console.warn(`[juicy] store「${id}」的 getter「${String(k)}」是唯讀的`);
        } else {
          state[k] = v;
        }
        return true;
      },
      has(_, k) {
        return hasOwn(actions, k) || hasOwn(getters, k) || k in state;
      },
      ownKeys() {
        return [...Reflect.ownKeys(toRaw(state)), ...Object.keys(getters), ...Object.keys(actions)];
      },
      getOwnPropertyDescriptor(_, k) {
        return { enumerable: true, configurable: true, value: store[k] };
      },
    });

    function replaceState(next) {
      const raw = toRaw(state);
      Object.keys(raw).forEach((k) => !(k in next) && delete state[k]);
      Object.assign(state, next);
    }
    // $patch({ a: 1, user: { name } })：深層合併；$patch((state) => { ... })：一次修改多個欄位
    function patch(partial) {
      if (typeof partial === 'function') partial(state);
      else mergeInto(state, partial);
      return store;
    }
    function reset() {
      replaceState(initial());
      return store;
    }
    // 狀態有任何（深層）變動時呼叫 cb(state)；同一個 tick 內多次修改只通知一次。回傳取消函式
    function subscribe(cb, opts) {
      const stop = watch(() => state, () => cb(state, store), { deep: true, immediate: !!(opts && opts.immediate) });
      stops.push(stop);
      return stop;
    }
    // 監聽 action 呼叫：listener({ name, args, store, after(fn), onError(fn) })。回傳取消函式
    function onAction(listener) {
      actionListeners.add(listener);
      return () => actionListeners.delete(listener);
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      stops.forEach((s) => s());
      stops.length = 0;
      actionListeners.clear();
      if (id && storeRegistry.get(id) === store) storeRegistry.delete(id);
    }

    Object.keys(o.getters || {}).forEach((k) => {
      const g = o.getters[k];
      getters[k] = computed(() => g.call(store, state, store));
    });

    Object.keys(o.actions || {}).forEach((name) => {
      const fn = o.actions[name];
      actions[name] = function (...args) {
        const afters = [];
        const errors = [];
        actionListeners.forEach((l) => l({ name, args, store, after: (f) => afters.push(f), onError: (f) => errors.push(f) }));
        const done = (r) => (afters.forEach((f) => f(r)), r);
        const failed = (err) => {
          errors.forEach((f) => f(err));
          throw err;
        };
        let result;
        try {
          result = fn.apply(store, args);
        } catch (err) {
          failed(err);
        }
        return result && typeof result.then === 'function' ? result.then(done, failed) : done(result);
      };
    });

    // 持久化：persist: 'key' 或 { key, storage, paths: ['user.name', 'theme'] }
    if (o.persist) {
      const p = typeof o.persist === 'string' ? { key: o.persist } : o.persist === true ? {} : o.persist;
      const key = p.key || 'juicy-store-' + (id || 'anonymous');
      let storage = p.storage;
      try {
        if (!storage && typeof localStorage !== 'undefined') storage = localStorage;
      } catch (e) {
        storage = null; // 被封鎖的瀏覽器環境
      }
      if (storage) {
        try {
          const saved = storage.getItem(key);
          if (saved) mergeInto(state, JSON.parse(saved));
        } catch (e) {
          console.warn(`[juicy] store「${id}」無法讀取保存的狀態`, e);
        }
        const snapshot = () => (p.paths ? pickPaths(toRaw(state), p.paths) : toRaw(state));
        stops.push(watch(() => (p.paths ? p.paths.map((x) => getPath(state, x)) : state), () => {
          try {
            storage.setItem(key, JSON.stringify(snapshot()));
          } catch (e) {
            console.warn(`[juicy] store「${id}」無法保存狀態`, e);
          }
        }, { deep: true }));
      }
    }

    return store;
  }

  /**
   * $.store('cart', options)  定義並註冊；同一個 id 再次定義會回傳已存在的實例
   * $.store('cart')           取得已註冊的 store（不存在時丟出錯誤）
   * $.store(options)          建立不註冊的 store
   */
  function defineStore(id, options) {
    if (typeof id !== 'string') return createStore(null, id);
    if (storeRegistry.has(id)) return storeRegistry.get(id);
    if (!options) throw new Error(`[juicy] 找不到 store「${id}」，請先用 $.store('${id}', { state, ... }) 定義`);
    const store = createStore(id, options);
    storeRegistry.set(id, store);
    return store;
  }
  defineStore.has = (id) => storeRegistry.has(id);
  defineStore.list = () => [...storeRegistry.keys()];

  /* ================================================================
   * 9. 非同步資料
   *   const user = $.resource(() => state.id, (id, { signal }) => fetch(`/api/users/${id}`, { signal }).then((r) => r.json()))
   *   user.data / user.loading / user.error / user.refetch() / user.mutate(v) / user.stop()
   *   source 的值變動時自動重新抓取；舊請求會被中止（AbortSignal），晚到的結果也會被忽略
   * ================================================================ */
  function createResource(source, fetcher, options) {
    if (typeof fetcher !== 'function') {
      options = fetcher;
      fetcher = source;
      source = null; // 單一函式：fetcher 同步讀到的 reactive 資料就是依賴
    }
    const o = options || {};
    let seq = 0;
    let ctrl = null;
    let stopped = false;
    let timer = null;
    let e = null;
    let stopWatch = null;

    const r = reactive({
      data: o.initial,
      error: null,
      loading: false,
      ready: false, // 至少成功載入過一次
      refetch: () => refetch(),
      mutate: (v) => {
        const next = typeof v === 'function' ? v(raw.data) : v;
        raw.data = undefined; // 先清掉，確保即使是同一個物件也會觸發更新
        r.data = next;
      },
      stop: () => stop(),
    });
    const raw = toRaw(r);

    const run = (key) => {
      if (stopped) return Promise.resolve(raw.data);
      const id = ++seq;
      if (ctrl) ctrl.abort();
      ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (source && (key == null || key === false)) {
        // source 回傳 null / undefined / false：先不抓
        r.loading = false;
        return Promise.resolve(raw.data);
      }
      r.loading = true;
      r.error = null;
      let p;
      try {
        const args = { signal: ctrl && ctrl.signal, previous: raw.data };
        p = Promise.resolve(source ? fetcher(key, args) : fetcher(args));
      } catch (err) {
        p = Promise.reject(err);
      }
      const done = p.then(
        (d) => {
          if (id !== seq || stopped) return raw.data; // 已有更新的請求：忽略這個結果
          r.data = d;
          r.loading = false;
          r.ready = true;
          if (o.onSuccess) o.onSuccess(d);
          return d;
        },
        (err) => {
          if (id !== seq || stopped || (err && err.name === 'AbortError')) return raw.data;
          r.error = err;
          r.loading = false;
          if (o.onError) o.onError(err);
          return raw.data;
        }
      );
      raw.promise = done;
      return done;
    };

    function refetch() {
      if (source) return run(source());
      return e ? (e.run(), raw.promise) : run();
    }
    function stop() {
      stopped = true;
      if (ctrl) ctrl.abort();
      if (e) e.stop();
      if (stopWatch) stopWatch();
      clearInterval(timer);
    }

    if (source) {
      stopWatch = watch(source, (key) => run(key), { immediate: !o.lazy });
    } else {
      e = effect(() => run(), { lazy: true, scheduler: () => queueJob(e.run) });
      if (!o.lazy) e.run();
    }
    if (o.interval) timer = setInterval(() => !raw.loading && refetch(), o.interval); // 輪詢
    if (setupInstance) setupInstance.cleanups.push(stop); // 在元件 / app 建立期間呼叫：卸載時自動停止
    return r;
  }

  // 內建的錯誤邊界：子元件出錯時顯示 fallback(error, reset)，不影響頁面其他部分
  const ErrorBoundary = defineComponent({
    name: 'ErrorBoundary',
    props: { fallback: null, onError: null },
    data: () => ({ error: null }),
    errorCaptured(err, vm, info) {
      this.error = markRaw(err instanceof Error ? err : new Error(String(err)));
      if (this.onError) this.onError(err, info);
      return false;
    },
    view: (vm, children) => {
      if (!vm.error) return children;
      const reset = () => (vm.error = null);
      return vm.fallback
        ? vm.fallback(vm.error, reset)
        : $('div').attr('role', 'alert').css({ color: 'crimson' }).text('⚠ ' + vm.error.message);
    },
  });

  /* ================================================================
   * 對外 API
   * ================================================================ */
  function $(sel, props) {
    if (sel instanceof Chain) return sel;
    if (typeof sel === 'function' && sel.def && isComp(sel.def)) return sel(props); // $(Counter, { start: 1 })
    if (isComp(sel)) return sel.factory(props);
    if (typeof sel !== 'string') throw new TypeError('[juicy] $() 需要標籤字串，例如 $("div")');
    const c = new Chain(selectorVNode(sel));
    if (props && isComp(c.vnode.tag)) Object.assign(c.vnode.props, props); // $('my-counter', { start: 1 })
    return c;
  }

  $.fn = Chain.prototype; // 外掛擴充：$.fn.myMethod = function () { ...; return this; }
  $.Chain = Chain;
  $.text = textVNode;
  $.reactive = (obj) => reactive(obj);
  $.shallowReactive = shallowReactive;
  $.markRaw = markRaw;
  $.toRaw = toRaw;
  $.effect = effect;
  $.computed = computed;
  $.watch = watch;
  $.nextTick = nextTick;
  $.render = render;
  $.app = createApp;
  $.component = defineComponent;
  $.import = importComponent;
  $.router = (options) => new Router(options);
  $.i18n = (options) => new I18n(options);
  $.I18n = I18n;
  $.t = (key, params) => (currentI18n ? currentI18n.t(key, params) : key);
  $.store = defineStore;
  $.resource = createResource;
  $.fragment = (...children) => new Chain(createVNode(FRAGMENT)).append(...children);
  $.teleport = (to, ...children) => {
    const c = new Chain(createVNode(TELEPORT));
    c.vnode.props.to = to;
    return c.append(...children);
  };
  $.ErrorBoundary = ErrorBoundary;
  $.onError = onError;
  $.refs = globalRefs;
  // 在元件 / app 建立期間（data、created）呼叫時作用在該元件，否則為全域
  $.provide = (key, value) => ((setupInstance ? setupInstance.provides : rootProvides)[key] = value);
  $.inject = (key, fallback) => (setupInstance ? injectValue(setupInstance, key, fallback) : key in rootProvides ? rootProvides[key] : typeof fallback === 'function' ? fallback() : fallback);
  $.Router = Router;
  $.version = '0.1.0';

  return $;
});

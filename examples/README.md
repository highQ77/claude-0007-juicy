# 範例 Examples

> 本專案僅為示範用，請勿在正式專案使用。

| 範例 | 說明 |
| --- | --- |
| [brand-site](brand-site/) | 形象官網：juicy.js ＋ Tailwind CSS，元件與頁面拆成獨立檔案以 import 載入，多頁面路由、作品集篩選、聯絡表單驗證、深色模式 |

## brand-site：形象官網

虛構的設計工作室「拾光設計 Lumio Studio」的官網，包含首頁、關於我們、服務、作品集（含作品內頁）與聯絡我們。

### 開啟方式

元件與頁面都是 ES module，瀏覽器只允許透過 http(s) 載入模組，**直接雙擊 `index.html`（file://）無法執行**。請在專案資料夾啟動本機伺服器：

```bash
npm run serve        # 內建的簡易伺服器，不需安裝套件
```

再開啟 <http://localhost:8080/examples/brand-site/>（需要網路連線以載入 Tailwind CSS 與字型）。也可以用其他靜態伺服器，例如 `npx serve .`，但伺服器的根目錄必須是專案資料夾，因為範例會載入 `../../dist/juicy.mjs`。

路由使用 hash 模式（網址像 `#/about`），伺服器不需要額外設定。

### 檔案結構

```
brand-site/
├── index.html          載入 Tailwind CSS 與入口 main.js（type="module"）
├── main.js             入口：組合版面並掛載
├── core.js             匯入 juicy.js（dist/juicy.mjs），提供 h() / container() 小工具
├── data.js             網站內容（服務、作品、團隊……）
├── store.js            全域狀態：深色模式、手機選單、提示訊息
├── router.js           路由；每個頁面以 $.import() 延遲載入
├── components/         共用元件，以 ES module import
│   ├── navbar.js  footer.js  toast.js  dark-toggle.js
│   ├── work-card.js  count-up.js  call-to-action.js
│   └── logo.js  button-link.js  section-heading.js   （無狀態，直接回傳節點的函式）
└── pages/              頁面元件，第一次進入該頁時才載入
    ├── home.js  about.js  services.js  work.js  work-detail.js  contact.js
    └── not-found.js
```

### 匯入元件的兩種方式

**共用元件（導覽列、頁尾……每頁都會用到）：以 ES module 直接 import**

```js
// components/footer.js
import { $, h } from '../core.js';
export default $.component({ name: 'Footer', view: () => h('footer', 'border-t ...', '...') });

// main.js
import Footer from './components/footer.js';
$.render(() => h('div', '', $(Footer)), '#app');
```

**頁面：以 `$.import()` 延遲載入**，載入中顯示骨架畫面，失敗時可重試；第一個頁面顯示後，其他頁面會在背景預先載入：

```js
// router.js
const page = (load) => $.import(load, { loading, error });
export const pages = {
  home: page(() => import('./pages/home.js')),
  work: page(() => import('./pages/work.js')),
  // ...
};
$.router({ routes: { '/': { view: pages.home, meta: { title: '' } }, ... } });

// main.js：趁空檔預先載入
setTimeout(() => Object.values(pages).forEach((p) => p.load()), 1500);
```

每個模組都從 `core.js` 取得同一個 `$`，所以元件、路由與 store 共用同一個 juicy.js 實例。

> 元件設定中的 `name`（例如 `name: 'Footer'`）只是除錯用的顯示名稱。要用 `$('site-footer')` 這種標籤名稱建立元件，請寫 `$.component('site-footer', options)`，名稱要包含 `-`，避免和 HTML 標籤衝突。

### 打包成單一 JS

```bash
npm install              # 第一次使用時安裝 esbuild
npm run build:example
```

會產生：

```
brand-site/dist/
├── app.js        main.js 與所有 components / pages / juicy.js 合併、壓縮成的單一檔案（約 78 KB）
├── app.js.map    source map：瀏覽器開發者工具中仍可看到原始檔案
└── index.html    與原本相同，但改為 <script src="app.js">
```

- 打包設定在 `scripts/build-example.js`（esbuild，IIFE 格式）。
- 頁面原本以 `$.import(() => import('./pages/xxx.js'))` 延遲載入，打包後會併入同一個檔案，`$.import` 照常運作，只是不再分檔下載。
- 打包後不再使用 ES module，所以 `dist/index.html` **可以直接雙擊開啟**（file://），也可以把整個 `dist` 資料夾放到任何靜態主機。
- 修改原始碼後需要重新執行 `npm run build:example`；`dist` 是產生出來的檔案，不要直接修改。
- Tailwind CSS 仍由 CDN 在瀏覽器中產生。若要完全離線或正式上線，請另外用 Tailwind CLI 產生 CSS 檔（見下方「搭配 Tailwind 的寫法」）。

### 用到的 juicy.js 功能

| 功能 | 用在哪裡 |
| --- | --- |
| `$.component` | 導覽列、頁尾、作品卡片、數字動畫、各個頁面 |
| `$.import` | 頁面延遲載入、骨架畫面、載入失敗重試、預先載入 |
| `$.router` | hash 模式路由；元件直接當頁面、`meta.title` 設定頁面標題、`/work/:id` 作品內頁、`scrollBehavior` 換頁回到頂端、`.link()` 導覽連結 |
| `$.store` | 深色模式（`persist` 存到 localStorage）、手機選單開關、提示訊息 |
| `$.resource` | 首頁「最新消息」：載入中骨架畫面、重新整理 |
| `.model()` | 聯絡表單的文字欄位、下拉選單、單選按鈕、核取方塊 |
| 事件修飾符 | 表單 `submit.prevent`、手機選單 `keydown.esc` |
| `$.teleport` | 提示訊息渲染到 `body` |
| `.transition()` | 手機選單、作品篩選、常見問題展開 |

### 搭配 Tailwind 的寫法

Tailwind 的 class 含有 `:`、`/`、`[ ]` 等字元，無法用 `$('div.a.b')` 選擇器語法表示，範例中統一用 `core.js` 的小工具加上 class：

```js
const h = (tag, cls, ...children) => $(tag).addClass(cls || '').append(...children);

h('button', 'rounded-full bg-stone-900 px-6 py-3 text-white hover:bg-stone-700 dark:bg-white', '送出')
  .on('click', submit);
```

條件式的 class 直接用字串組合，例如 `'px-4 ' + (active ? 'bg-stone-900 text-white' : 'bg-stone-100')`。

**正式專案：** Play CDN 會在瀏覽器中即時產生 CSS，只適合範例與原型。正式專案請改用 [Tailwind CLI](https://tailwindcss.com/docs/installation) 或打包工具，並把 `examples/brand-site/**/*.js` 加入 `content` 設定，讓 Tailwind 掃描 JS 中用到的 class。

※ 公司、人物、作品、評價與數據皆為虛構。

---

**English:** run `npm run build:example` to bundle `main.js`, all components and pages, and juicy.js into a single minified file, `brand-site/dist/app.js` (with `app.js.map` and a `dist/index.html` that loads it). The bundle is a classic script, so `dist/index.html` can be opened directly from disk. `brand-site` is a corporate website for a fictional design studio, built with juicy.js and Tailwind CSS (Play CDN). Components and pages live in separate ES module files: shared components are imported with `import`, and pages are lazy-loaded with `$.import()` (with a loading skeleton, retry on failure, and background preloading). Because browsers only load modules over http(s), run `npm run serve` in the project folder and open <http://localhost:8080/examples/brand-site/>; opening `index.html` directly from disk does not work. Tailwind classes contain characters such as `:` and `/`, so classes are added with `addClass` through the `h(tag, classes, ...children)` helper in `core.js`. For production, generate the CSS with the Tailwind CLI instead of the Play CDN.

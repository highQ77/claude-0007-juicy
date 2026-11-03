# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

juicy.js：類 jQuery 鏈式 API ＋ 虛擬 DOM ＋ MVVM 的單檔函式庫（含元件、路由、i18n、store、resource）。零相依。**本專案僅為示範用**。程式註解、文件與介面文字以繁體中文為主。

## 指令

```bash
npm install                          # devDependencies：jsdom（測試）、typescript（型別檢查）、esbuild（打包範例）
npm test                             # 全部：dist 是否最新 → 單元測試 → ESM → 文件翻譯與範例 → 型別檢查
node test/juicy.test.js              # 只跑單元測試
node test/juicy.test.js router       # 只跑名稱包含「router」的測試（名稱為中文，可用中文關鍵字）
node test/esm.test.mjs               # dist/juicy.mjs 的匯出與 package.json exports
node test/docs-i18n.test.js          # index.html 的英文翻譯是否齊全、48 個範例在中英文下都能執行
npm run typecheck                    # tsc -p types（types/juicy.d.ts ＋ types/test.ts 型別測試）
npm run build                        # 由 src/juicy.js 產生 dist/juicy.mjs（node scripts/build.js --check 只檢查）
npm run build:example                # 把 examples/brand-site 打包成 examples/brand-site/dist/app.js
npm run serve                        # 本機靜態伺服器 http://localhost:8080/（examples 以 ES module 載入時需要）
```

沒有設定 linter / formatter。

## 修改 src/juicy.js 後一定要做

- **重新產生 dist**：`npm run build`。`dist/juicy.mjs` 是產生的檔案（`npm test` 第一步會檢查是否一致），不要手改。
- **新增公開 API** 時，要同時改這幾處：
  - `src/juicy.js` 檔尾「對外 API」區塊（`$.xxx = ...`）
  - `scripts/build.js` 的 `named` / `aliases` 清單（ESM 具名匯出）
  - `types/juicy.d.ts`（`JuicyStatic` 與具名匯出）；需要時在 `types/test.ts` 加型別測試，`@ts-expect-error` 用來確認錯誤用法會被擋下
- `scripts/build.js` 是用字串切出 UMD 包裝中的 factory（從 `function () {\n  'use strict';` 到最後的 `});`），所以 `src/juicy.js` 開頭的 UMD 包裝形狀不要改。

## 架構（src/juicy.js）

單一 UMD 檔，依序分成 1–9 節（響應式 → 鏈式建構器 → 渲染器 → MVVM → 元件 → 路由 → 多語系 → store → resource），最後是「對外 API」。重點是幾個跨章節的機制：

- **鏈式物件只建立 vnode**：`$('div')` 回傳 `Chain`，`chain.vnode.tag` 可能是標籤字串、`TEXT` / `FRAGMENT` / `TELEPORT`（Symbol），或元件定義物件（`isComp(tag)`）。真實 DOM 只在 `render()`（`chain.mount` / `$.render` / `$.app` / `router.mount` 都走它）的 `createEl` / `patch` 中產生。
- **更新流程**：`render()` 把 view 包在 `effect` 裡；reactive 資料變動 → `queueJob`（microtask 批次）→ 重新執行 view → `patch`。陣列是粗粒度追蹤（`ITERATE`），任何變動都通知所有讀過它的地方。
- **diff**：`patchChildren` 以「結尾 anchor ＋ 由後往前插入」的方式工作，用 LIS 決定哪些節點不必搬移。片段 / 元件可能對應多個 DOM 節點，搬移與定位一律用 `hostNodes()` / `firstNode()`，不要直接用 `vnode.el`。
- **渲染期間的全域變數**（view 中的 API 靠它們運作，新增功能時要注意保存 / 還原）：
  - `currentInstance`：目前元件 / app 實例；也決定新元件的 `parent`（provide/inject、errorCaptured 都沿著它往上找）。`render(source, container, owner)` 會在整個更新期間設定 owner，`$.app` 靠這個成為最上層實例。
  - `currentVM`：`.model('key')`、`.slot()` 綁定的 vm；作用域插槽執行時會切回「提供插槽的父層」的 vm。
  - `currentRefs`：`.ref('name')` 寫入的 `$refs`。
  - `setupInstance`：元件 / app 建立期間（data、created）指向該實例；`$.resource`、`router.beforeLeave`、`$.provide` / `$.inject` 用它在卸載時自動清理或決定作用範圍。
- **生命週期時機**：`mounted` / `updated` 與 mount 時的 ref 設定放進 `postQueue`，等最外層 render 結束（`renderDepth === 0`）才由 `flushPost()` 執行，確保元素已在頁面中。
- **元件**：每個元件 vnode 有自己的實例（`vnode.comp`）與 render effect；父層重繪時 `updateComponent` 只更新變動的 props。`renderRoot` 把元件上的 class / style / attr / transition（以及未在 `emits` 宣告的事件）合併到單一根元素。只有 `$.component('my-tag', opts)` 會註冊標籤名稱；`opts.name` 只是顯示名稱（曾因 `name: 'Footer'` 讓 `$('footer')` 無限遞迴）。
- **錯誤**：view / 生命週期 / 事件 / watch 的例外都交給 `handleError(err, inst, info)` → 祖先的 `errorCaptured` → `$.onError` → `console.error`，不會往呼叫端丟出；出錯的元件保留上一次畫面。`info` 是 `'render'`、`'watch'`、`'event:click'` 這類代碼。
- **路由**：`flattenRoutes` 把巢狀 routes 攤平，每筆記錄保留從外到內的 `chain`；`view()` 由內而外組合，內層畫面以 `outlet` 傳給外層。元件可直接當 view（收到 `route` prop）。hash 模式在不允許 `pushState` 的環境（`file://`）會改用 `location.hash`。

## 互動文件 index.html

- 文件頁本身也是用 juicy.js 建的。內容都在 `const sections = [...]`：每節有 `group`、`title`、`intro`、`api`、`demos`；範例是 `code(el, log)` 函式，頁面以 `fn.toString()` 顯示原始碼並實際執行（可編輯）。範例的 key 是 `${sec.id}-${i}`。
- **中英雙語**：中文原文就是 key。介面文字在頁面中的 `doc` i18n（`ui.*` / `hero.*`），章節內容與範例程式碼中的字串 / 註解的英文翻譯在 `docs/i18n-en.js`（`content` / `code`）。英文模式下範例程式碼只替換字串與 `//` 註解後，以 `new Function('el', 'log', code)` 執行，所以：
  - 範例程式碼只能使用 `$`、`el`、`log`，不能引用 `<script>` 中的其他變數；中文只能出現在字串或 `//` 註解裡。
  - 新增或修改任何中文文字後，要在 `docs/i18n-en.js` 加上對應翻譯；`node test/docs-i18n.test.js` 會列出缺少的項目。範例中本身就是資料的中文（例如 i18n 範例的訊息）在 `code` 中對應到自己即可。同一段中文在不同地方需要不同英文時，換一個寫法避開。
- `index.html` 的 `<script>` 中不能出現字面上的 `</script>`，要寫成 `<\/script>`。

## 範例 examples/brand-site

形象官網範例（Tailwind CSS 以 Play CDN 載入）。元件在 `components/`（ES `import`）、頁面在 `pages/`（`router.js` 以 `$.import(() => import(...))` 延遲載入）；所有模組都從 `core.js` 取得同一個 `$`（`../../dist/juicy.mjs`），所以改了函式庫要先 `npm run build`。原始碼需要透過 http 開啟（`npm run serve`）；`dist/` 是 `npm run build:example` 產生的單一檔案版本，可直接開啟。Tailwind 的 class 含 `:` `/` `[ ]`，不能寫在 `$('div.a.b')` 選擇器中，一律用 `core.js` 的 `h(tag, classes, ...children)`（內部是 `addClass`）。

## 文件同步

- `README.md`（中文）與 `README.en.md`（英文）逐段對應（標題與段落順序、行號一致），修改其中一份時另一份要同步。章節順序與 `index.html` 的分組相同：建立畫面 → MVVM → 元件 → 進階畫面 → 路由 → 全域狀態 → 非同步資料 → 多語系 → 效能 → 注意 → 專案結構 → 開發與測試。
- 「本專案僅為示範用，請勿在正式專案使用。」這句聲明出現在 `README.md` / `README.en.md` 開頭、`index.html` 首頁介紹（`hero.lead`，英文在 `docs/i18n-en.js`）與 `examples/README.md`，修改時要一致。
- API 有變動時，`README*`、`index.html` 的章節（與 `docs/i18n-en.js` 翻譯）、`types/juicy.d.ts` 通常都要一起更新；範例用法變動時更新 `examples/README.md`。

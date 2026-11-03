// 檢查 ES module 版本與 CommonJS 版本，以及 package.json 的 exports 設定
// 執行：node test/esm.test.mjs
import assert from 'assert';
import { createRequire } from 'module';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="app"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const require = createRequire(import.meta.url);
let failed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log('✓', name);
  } catch (e) {
    failed++;
    console.log('✗', name, '\n  ', e.message);
  }
};

const esm = await import('../dist/juicy.mjs');

await check('ESM：default 匯出與具名匯出', () => {
  const $ = esm.default;
  assert.strictEqual(typeof $, 'function');
  assert.strictEqual(esm.$, $);
  for (const k of ['reactive', 'computed', 'watch', 'render', 'component', 'router', 'i18n', 'store', 'resource', 'fragment', 'teleport']) {
    assert.strictEqual(esm[k], $[k], k);
  }
  assert.strictEqual(esm.createApp, $.app);
  assert.strictEqual(esm.defineComponent, $.component);
  assert.strictEqual(esm.importComponent, $.import);
  assert.strictEqual(esm.defineStore, $.store);
  assert.strictEqual(esm.version, $.version);
});

await check('ESM：不會建立全域 $ / juicy', () => {
  assert.strictEqual(globalThis.$, undefined);
  assert.strictEqual(globalThis.juicy, undefined);
});

await check('ESM：可以正常渲染', async () => {
  const { default: $, reactive, nextTick } = esm;
  const s = reactive({ n: 1 });
  $.render(() => $('p').text(s.n), '#app');
  s.n = 2;
  await nextTick();
  assert.strictEqual(document.getElementById('app').innerHTML, '<p>2</p>');
});

await check('package.json exports：import "juicy" / require("juicy")', async () => {
  const viaImport = await import('juicy');
  assert.strictEqual(viaImport.default.version, esm.version);
  const viaRequire = require('juicy');
  assert.strictEqual(typeof viaRequire, 'function');
  assert.strictEqual(viaRequire.version, esm.version);
});

console.log(failed ? `\n${failed} 項失敗` : '\nESM 全部通過');
process.exit(failed ? 1 : 0);

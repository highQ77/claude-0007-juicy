// 由 src/juicy.js（UMD）產生 ES module 版本 dist/juicy.mjs
//   node scripts/build.js           產生
//   node scripts/build.js --check   檢查 dist 是否與原始碼一致（不一致時 exit 1，用於測試 / CI）
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcFile = path.join(root, 'src/juicy.js');
const outFile = path.join(root, 'dist/juicy.mjs');
const src = fs.readFileSync(srcFile, 'utf8');

// 取出 UMD 包裝裡的 factory 函式本體
const startMarker = "function () {\n  'use strict';";
const start = src.indexOf(startMarker);
const end = src.lastIndexOf('});');
if (start < 0 || end < start) throw new Error('找不到 src/juicy.js 的 UMD factory');
const factory = src.slice(start, end + 1);
const header = src.slice(0, src.indexOf('(function (root, factory)')).trim();

// 具名匯出：與 $ 上的同名屬性相同，另提供常見的別名
const named = [
  'reactive', 'shallowReactive', 'markRaw', 'toRaw', 'effect', 'computed', 'watch', 'nextTick',
  'render', 'fragment', 'teleport', 'text', 'app', 'component', 'router', 'i18n', 'store', 'resource',
  't', 'provide', 'inject', 'onError', 'refs', 'ErrorBoundary', 'Chain', 'Router', 'I18n', 'fn', 'version',
];
const aliases = {
  createApp: 'app',
  defineComponent: 'component',
  importComponent: 'import',
  createRouter: 'router',
  createI18n: 'i18n',
  defineStore: 'store',
  createResource: 'resource',
};

const out = `${header.replace('juicy.js —', 'juicy.js (ES module) —')}
// 此檔案由 scripts/build.js 從 src/juicy.js 產生，請勿直接修改
const $ = (${factory})();

export default $;
export { $ };
export const {
  ${named.join(',\n  ')},
} = $;
${Object.entries(aliases).map(([alias, key]) => `export const ${alias} = $.${key};`).join('\n')}
`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  if (current !== out) {
    console.error('✗ dist/juicy.mjs 與 src/juicy.js 不一致，請執行 npm run build');
    process.exit(1);
  }
  console.log('✓ dist/juicy.mjs 已是最新');
} else {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, out);
  console.log('✓ 已產生 dist/juicy.mjs');
}

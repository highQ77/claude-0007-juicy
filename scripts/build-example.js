// 把 examples/brand-site 打包成單一 JS：examples/brand-site/dist/app.js
//   npm run build:example
//
// - 以 esbuild 從 main.js 開始，把 core / data / store / router / components / pages
//   與 juicy.js（dist/juicy.mjs）全部合併、壓縮成一個檔案（IIFE 格式，一般 <script> 即可載入）
// - 頁面原本以 $.import(() => import('./pages/xxx.js')) 延遲載入；打包時 import() 會被併入同一個檔案，
//   $.import 照常運作（只是不再分檔下載）
// - 同時產生 dist/index.html（改為載入 app.js），因為不再使用 ES module，直接開啟檔案（file://）就能執行
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const siteDir = path.join(root, 'examples/brand-site');
const outDir = path.join(siteDir, 'dist');

(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = await esbuild.build({
    entryPoints: [path.join(siteDir, 'main.js')],
    outfile: path.join(outDir, 'app.js'),
    bundle: true,
    format: 'iife', // 不需要 type="module"
    minify: true,
    sourcemap: true, // app.js.map：在瀏覽器開發者工具中仍可看到原始檔案
    target: ['es2020'],
    legalComments: 'none',
    metafile: true,
    logLevel: 'warning',
  });

  // index.html：把 ES module 入口換成打包後的 app.js
  const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  const entry = /<!--[^>]*-->\s*<script type="module" src="main\.js"><\/script>/;
  if (!entry.test(html)) throw new Error('index.html 中找不到 <script type="module" src="main.js">');
  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    html.replace(entry, '<!-- 打包後的單一檔案（由 npm run build:example 產生） -->\n  <script src="app.js"></script>')
  );

  const size = (f) => (fs.statSync(path.join(outDir, f)).size / 1024).toFixed(1) + ' KB';
  const inputs = Object.keys(result.metafile.inputs).length;
  console.log(`✓ 已合併 ${inputs} 個檔案 → examples/brand-site/dist/app.js（${size('app.js')}）`);
  console.log('✓ examples/brand-site/dist/index.html（可直接開啟，或 npm run serve 後開啟 /examples/brand-site/dist/）');
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

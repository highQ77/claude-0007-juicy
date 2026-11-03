// 檢查文件頁（index.html）的英文翻譯是否齊全，並確認中英兩種語言下所有範例都能執行
// 執行：node test/docs-i18n.test.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '..');
const CJK = /[　-鿿＀-￯]/;
// 與 index.html 的 translateCode 相同：找出字串與 // 註解
const TOKEN = /(\/\/[^\n]*)|(`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")/g;

function load(lang) {
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const inline = (f) => () => '<script>' + fs.readFileSync(path.join(root, f), 'utf8') + '</script>';
  html = html
    .replace('<script src="src/juicy.js"></script>', inline('src/juicy.js'))
    .replace('<script src="docs/i18n-en.js"></script>', inline('docs/i18n-en.js'));
  const errors = [];
  const virtualConsole = new VirtualConsole().on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM(html, {
    url: 'http://localhost/index.html?lang=' + lang,
    runScripts: 'dangerously',
    virtualConsole,
    beforeParse(w) {
      w.IntersectionObserver = class { observe() {} disconnect() {} };
      w.console.error = () => {};
    },
  });
  return { w: dom.window, errors };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let failed = 0;
  const fail = (msg) => {
    failed++;
    console.log('✗', msg);
  };

  // 1. 每段有中文的章節文字、範例字串與註解都要有英文翻譯
  const { w } = load('zh');
  const dict = w.JUICY_DOC_EN;
  const missingProse = [];
  const missingCode = [];
  const checkProse = (s) => s && CJK.test(s) && !(s in dict.content) && missingProse.push(s);
  w.eval('sections').forEach((sec) => {
    checkProse(sec.group);
    checkProse(sec.title);
    checkProse(sec.intro);
    (sec.api || []).forEach(([a, b]) => { checkProse(a); checkProse(b); });
    sec.demos.forEach((d) => {
      checkProse(d.title);
      checkProse(d.desc);
      const src = w.eval('source')(d.code);
      let m;
      while ((m = TOKEN.exec(src))) {
        if (!CJK.test(m[0])) continue;
        const key = m[1] ? m[1].replace(/^\/\/\s?/, '') : m[2].slice(1, -1);
        if (!(key in dict.code)) missingCode.push(`${d.title}: ${key}`);
      }
      if (CJK.test(src.replace(TOKEN, ''))) fail(`範例「${d.title}」的中文出現在字串 / 註解以外，無法翻譯`);
    });
  });
  if (missingProse.length) fail('缺少章節文字的英文翻譯：\n   ' + missingProse.join('\n   '));
  else console.log('✓ 章節文字都有英文翻譯');
  if (missingCode.length) fail('缺少範例程式碼的英文翻譯：\n   ' + missingCode.join('\n   '));
  else console.log('✓ 範例程式碼的字串與註解都有英文翻譯');

  // 2. 兩種語言下所有範例都能執行（import-0 會故意失敗一次，import-1 需要 http 伺服器）
  for (const lang of ['zh', 'en']) {
    const { w: win, errors } = load(lang);
    await sleep(100);
    const doc = win.document;
    const broken = [...doc.querySelectorAll('.log')]
      .filter((l) => l.textContent.includes('❌') && l.id !== 'l-import-0')
      .map((l) => `${l.id}: ${l.textContent}`);
    if (errors.length || broken.length) fail(`[${lang}] 範例執行失敗：\n   ` + [...errors, ...broken].join('\n   '));
    else console.log(`✓ [${lang}] ${doc.querySelectorAll('.demo').length} 個範例都能執行`);
    win.close();
  }

  console.log(failed ? `\n${failed} 項失敗` : '\n全部通過');
  process.exit(failed ? 1 : 0);
})();

// 簡易靜態伺服器（不需安裝任何套件），讓瀏覽器可以用 ES module 載入範例與文件
//   npm run serve                → http://localhost:8080/
//   PORT=3000 npm run serve
// 只供本機開發使用
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.env.PORT) || 8080;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

http
  .createServer((req, res) => {
    let file;
    try {
      file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    } catch (e) {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (!file.startsWith(root)) {
      res.writeHead(403).end('Forbidden'); // 不允許讀取專案資料夾以外的檔案
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('找不到：' + req.url);
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`juicy.js 本機伺服器：http://localhost:${port}/`);
    console.log(`  文件      http://localhost:${port}/index.html`);
    console.log(`  形象官網  http://localhost:${port}/examples/brand-site/`);
  });

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };
http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, content) => {
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    // Safari pide los vídeos por rangos y no los reproduce si recibe el archivo entero.
    const range = !error && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, content.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), content.length - 1) : content.length - 1;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${content.length}` });
      res.end(content.subarray(start, end + 1));
      return;
    }
    res.writeHead(error ? 404 : 200, headers);
    res.end(error ? 'Not found' : content);
  });
}).listen(8083, '127.0.0.1', () => console.log('Sterk: http://127.0.0.1:8083'));

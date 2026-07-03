const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');
const fleet = require('../data/fleet.json');

const PORT = 3000;
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  const { pathname, query } = parse(req.url, true);

  if (pathname === '/api/fleet') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ vessels: fleet.vessels, routeKeys: Object.keys(fleet.routes) }));
    return;
  }

  if (pathname === '/api/route') {
    const voyage = query.voyage || '';
    const ports = voyage.split('→').map(s => s.replace(/^Last:\s*/i, '').trim());
    const routeKey = ports.join('->');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ voyage, routeKey, points: fleet.routes[routeKey] || [], fromCache: false }));
    return;
  }

  const filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});

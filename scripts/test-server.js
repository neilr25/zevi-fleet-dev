const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');
const fleetHandler = require('../api/fleet');
const routeHandler = require('../api/route');
const alertsHandler = require('../api/alerts');
const vesselHandler = require('../api/vessel/[id]');
const deploymentHandler = require('../api/deployment/[id]');

const PORT = 3000;
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json'
};

function serveHandler(req, res, handler) {
  res.setHeader = function(name, value) { this._headers = this._headers || {}; this._headers[name] = value; };
  res.status = function(code) { this.statusCode = code; return this; };
  res.json = function(obj) {
    this._headers = this._headers || {};
    Object.entries(this._headers).forEach(([k, v]) => this.setHeader(k, v));
    this.writeHead(this.statusCode || 200, { 'Content-Type': 'application/json' });
    this.end(JSON.stringify(obj));
    return this;
  };
  res.end = function(data) {
    if (!this.headersSent) {
      this._headers = this._headers || {};
      Object.entries(this._headers).forEach(([k, v]) => this.setHeader(k, v));
      this.writeHead(this.statusCode || 200, { 'Content-Type': 'application/json' });
    }
    if (data) this.write(data);
    require('http').ServerResponse.prototype.end.call(this);
  };
  handler(req, res);
}

const server = http.createServer((req, res) => {
  const { pathname } = parse(req.url, true);

  if (pathname === '/api/fleet') return serveHandler(req, res, fleetHandler);
  if (pathname === '/api/route') return serveHandler(req, res, routeHandler);
  if (pathname === '/api/alerts') return serveHandler(req, res, alertsHandler);
  if (pathname.startsWith('/api/vessel/')) return serveHandler(req, res, vesselHandler);
  if (pathname.startsWith('/api/deployment/')) return serveHandler(req, res, deploymentHandler);

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

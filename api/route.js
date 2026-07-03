const fleet = require('../data/fleet.json');
const { parse } = require('url');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { query } = parse(req.url, true);
  const voyage = query.voyage || '';
  const ports = voyage.split('→').map(s => s.replace(/^Last:\s*/i, '').trim());
  const routeKey = ports.join('->');
  const points = fleet.silver.routes[routeKey] || [];

  res.status(200).json({
    voyage,
    routeKey,
    points,
    fromCache: false
  });
};

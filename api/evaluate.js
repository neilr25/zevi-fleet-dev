const { evaluateProspect, dwtBand } = require('./_lib/commercial');

// GET /api/evaluate?type=Bulk%20Carrier&dwt=85000&name=MV+Example
// Returns a PROVISIONAL performance estimate for an arbitrary vessel
// (no deployment, no telemetry). This is the pre-deployment prediction
// pathway: estimate now, verify after installation.
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const type = url.searchParams.get('type') || 'Bulk Carrier';
  const dwt = parseInt(url.searchParams.get('dwt'), 10);
  const name = url.searchParams.get('name') || null;

  if (!dwt || dwt < 1000 || dwt > 500000) {
    res.status(400).json({ error: 'dwt must be between 1,000 and 500,000' });
    return;
  }

  const evaluation = evaluateProspect({ type, dwt });

  res.status(200).json({
    name,
    type,
    dwt,
    dwtBand: dwtBand(dwt),
    ...evaluation,
    note: 'Provisional estimate — not admissible for PAYS invoicing, guarantees, or regulatory filings.'
  });
};

const fleet = require('../data/fleet.json');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const alerts = fleet.bronze.events
    .filter(e => e.type === 'DiagnosticEvent')
    .map(e => {
      const vessel = fleet.silver.vessels.find(v => v.id === e.vesselId);
      const component = fleet.silver.components.find(c => c.id === e.componentId);
      return {
        id: e.id,
        ts: e.ts,
        vesselId: e.vesselId,
        vesselName: vessel ? vessel.name : 'Unknown',
        deploymentId: e.deploymentId,
        severity: e.severity || 'Attention',
        component: component ? component.name : 'System',
        faultCode: e.faultCode,
        anomalyScore: e.anomalyScore,
        action: e.action,
        qualityFlag: e.qualityFlag,
        timestamp: e.ts ? new Date(e.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Just now'
      };
    })
    .sort((a, b) => b.ts.localeCompare(a.ts));

  res.status(200).json({ alerts });
};

const fleet = require('../../data/fleet.json');
const { parse } = require('url');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pathname } = parse(req.url, true);
  const id = pathname.split('/').pop();
  const deployment = fleet.silver.deployments.find(d => d.id === id);
  if (!deployment) {
    res.status(404).json({ error: 'Deployment not found' });
    return;
  }

  const vessel = fleet.silver.vessels.find(v => v.id === deployment.vesselId) || null;
  const contract = fleet.silver.contracts.find(c => c.id === deployment.contractId) || null;
  const units = fleet.silver.fastRigUnits.filter(u => u.deploymentId === deployment.id);
  const components = fleet.silver.components.filter(c => c.deploymentId === deployment.id);
  const sensors = fleet.silver.sensors.filter(s => s.deploymentId === deployment.id);
  const voyages = fleet.silver.voyages.filter(v => v.deploymentId === deployment.id);
  const events = fleet.bronze.events.filter(e => e.deploymentId === deployment.id);
  const products = fleet.gold.performanceProducts.filter(p => p.deploymentId === deployment.id);
  const invoices = fleet.gold.paysInvoices.filter(i => i.deploymentId === deployment.id);

  res.status(200).json({
    deployment,
    vessel,
    contract,
    units,
    components,
    sensors,
    voyages,
    events,
    products,
    invoices
  });
};

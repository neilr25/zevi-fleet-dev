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
  const vessel = fleet.silver.vessels.find(v => v.id === id || v.id === `V${String(id).padStart(2, '0')}`);
  if (!vessel) {
    res.status(404).json({ error: 'Vessel not found' });
    return;
  }

  const deployment = fleet.silver.deployments.find(d => d.vesselId === vessel.id) || null;
  const contract = fleet.silver.contracts.find(c => c.vesselId === vessel.id) || null;
  const units = fleet.silver.fastRigUnits.filter(u => u.vesselId === vessel.id);
  const components = fleet.silver.components.filter(c => c.vesselId === vessel.id);
  const sensors = fleet.silver.sensors.filter(s => s.vesselId === vessel.id);
  const voyage = fleet.silver.voyages
    .filter(v => v.vesselId === vessel.id)
    .sort((a, b) => (b.departureDate || '').localeCompare(a.departureDate || ''))[0] || null;
  const products = fleet.gold.performanceProducts
    .filter(p => p.vesselId === vessel.id)
    .sort((a, b) => b.period.localeCompare(a.period));
  const latestProduct = products[0] || null;
  const events = fleet.bronze.events
    .filter(e => e.vesselId === vessel.id)
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const invoices = fleet.gold.paysInvoices.filter(i => i.vesselId === vessel.id);

  res.status(200).json({
    vessel,
    deployment,
    contract,
    units,
    components,
    sensors,
    voyage,
    products,
    latestProduct,
    events,
    invoices
  });
};

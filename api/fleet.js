const fleet = require('../data/fleet.json');

function numericId(vesselId) {
  return parseInt(vesselId.replace(/^V0?/, ''), 10);
}

function getLatestProduct(vesselId) {
  const products = fleet.gold.performanceProducts
    .filter(p => p.vesselId === vesselId)
    .sort((a, b) => b.period.localeCompare(a.period));
  return products[0] || null;
}

function getLatestDiagnostic(vesselId) {
  const events = fleet.bronze.events
    .filter(e => e.vesselId === vesselId && e.type === 'DiagnosticEvent')
    .sort((a, b) => b.ts.localeCompare(a.ts));
  return events[0] || null;
}

function getCurrentVoyage(vesselId) {
  const voyages = fleet.silver.voyages
    .filter(v => v.vesselId === vesselId)
    .sort((a, b) => (b.departureDate || '').localeCompare(a.departureDate || ''));
  return voyages[0] || null;
}

function getDeployment(vesselId) {
  return fleet.silver.deployments.find(d => d.vesselId === vesselId) || null;
}

function getContract(vesselId) {
  return fleet.silver.contracts.find(c => c.vesselId === vesselId) || null;
}

function deriveStatus(vesselId, deployment, product, diagnostic) {
  if (!deployment) return 'blue';
  if (deployment.status === 'Unknown') return 'grey';
  if (diagnostic && diagnostic.severity === 'Critical') return 'red';
  if (diagnostic && diagnostic.severity === 'Amber') return 'amber';
  const id = numericId(vesselId);
  if (id === 6) return 'cyan'; // route advice
  if (id === 7) return 'amber'; // CII backsliding
  if (product && product.variancePct < -0.5) return 'amber';
  return 'green';
}

function deriveTrust(scenarioType) {
  return scenarioType === 'verified' ? 'verified' : 'provisional';
}

function deriveFlatVessel(vessel) {
  const deployment = getDeployment(vessel.id);
  const contract = getContract(vessel.id);
  const product = getLatestProduct(vessel.id);
  const diagnostic = getLatestDiagnostic(vessel.id);
  const voyage = getCurrentVoyage(vessel.id);
  const id = numericId(vessel.id);

  const status = deriveStatus(vessel.id, deployment, product, diagnostic);
  const isProspect = status === 'blue';
  const isOffline = status === 'grey';
  const sailing = voyage && voyage.status === 'in_progress' && !isProspect && !isOffline;
  const atPort = voyage && (voyage.progress < 0.05 || voyage.progress > 0.95) && !isProspect && !isOffline;

  let reason;
  if (isProspect) reason = 'Prospect, prediction ready';
  else if (isOffline) reason = 'No telemetry 18h';
  else if (status === 'red') reason = diagnostic ? `${diagnostic.faultCode} ${diagnostic.action || 'anomaly'}` : 'Critical alert';
  else if (status === 'amber') reason = id === 7 ? 'CII D, target C' : (product && product.variancePct < 0 ? `Savings ${product.fuelSavingPct}% vs ${contract ? contract.guaranteeFloorPct : 5}% guarantee` : 'Attention required');
  else if (status === 'cyan') reason = 'Live voyage advice';
  else reason = `Savings ${product ? product.fuelSavingPct : 5}%, all verified`;

  const savings = product ? `${product.fuelSavingPct}%` : '—';
  const guarantee = contract ? `${contract.guaranteeFloorPct}%` : '—';
  const variance = product ? `${product.variancePct > 0 ? '+' : ''}${product.variancePct}%` : '—';
  const cii = isProspect ? '—' : (id === 7 ? 'D' : String.fromCharCode(66 + (id % 3)));
  const ciiTarget = isProspect ? '—' : (id === 7 ? 'C' : 'B');
  const co2 = product ? `${product.co2ReductionPct}%` : '—';
  const contractType = contract ? contract.type : 'Prospect';
  const nextInvoice = contract ? contract.nextInvoiceDate : '—';
  const voyagesReady = contract ? contract.voyagesReady : 0;
  const deploy = deployment ? deployment.status : 'None';
  const hours = deployment ? deployment.operatingHours.toLocaleString() : '0';
  const perfTrust = product ? deriveTrust(product.scenarioType) : (isProspect ? 'provisional' : 'nodata');
  const cbmTrust = diagnostic ? deriveTrust(diagnostic.qualityFlag) : (isProspect ? 'provisional' : 'verified');
  const compTrust = product ? deriveTrust(product.scenarioType) : (isProspect ? 'provisional' : 'nodata');
  const contractTrust = product ? deriveTrust(product.scenarioType) : (isProspect ? 'provisional' : 'nodata');

  let alert = null;
  let alertData = null;
  if (diagnostic && (status === 'red' || status === 'amber')) {
    const component = fleet.silver.components.find(c => c.id === diagnostic.componentId);
    alert = `${diagnostic.faultCode} ${component ? component.name : 'system'} anomaly`;
    alertData = {
      component: component ? component.name : 'System',
      fault: diagnostic.faultCode,
      score: String(diagnostic.anomalyScore),
      rul: component ? `${component.rulDays} days` : '—',
      stock: '2 in Rotterdam',
      action: diagnostic.action || 'Investigate'
    };
  } else if (status === 'cyan') {
    alert = 'Route advice available';
    alertData = {
      component: 'Route',
      fault: 'ADV-001',
      score: '0.34',
      rul: '—',
      stock: '—',
      action: 'Deviate 12nm north, save 0.8t fuel'
    };
  }

  return {
    id,
    name: vessel.name,
    imo: vessel.imo,
    type: vessel.type,
    status,
    sailing,
    atPort,
    reason,
    savings,
    guarantee,
    variance,
    cii,
    ciiTarget,
    co2,
    contract: contractType,
    nextInvoice,
    voyagesReady,
    deploy,
    hours,
    perfTrust,
    cbmTrust,
    compTrust,
    contractTrust,
    alert,
    alertData,
    lat: voyage ? voyage.lat : 0,
    lon: voyage ? voyage.lon : 0,
    heading: voyage ? voyage.heading : 0,
    voyage: voyage ? `${voyage.departure} → ${voyage.destination}` : ''
  };
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const vessels = fleet.silver.vessels.map(deriveFlatVessel);
  res.status(200).json({
    vessels,
    routeKeys: Object.keys(fleet.silver.routes)
  });
};

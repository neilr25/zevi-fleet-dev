const fleet = require('../data/fleet.json');
const { dwtBand, deployedRoi, evaluateProspect } = require('./_lib/commercial');

function numericId(vesselId) {
  return parseInt(vesselId.replace(/^V0?/, ''), 10);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function getDeployment(vesselId) {
  return fleet.silver.deployments.find(d => d.vesselId === vesselId) || null;
}

function getContract(vesselId) {
  return fleet.silver.contracts.find(c => c.vesselId === vesselId) || null;
}

function getUnits(vesselId) {
  return fleet.silver.fastRigUnits.filter(u => u.vesselId === vesselId);
}

function getComponents(vesselId) {
  return fleet.silver.components.filter(c => c.vesselId === vesselId);
}

function getSensors(vesselId) {
  return fleet.silver.sensors.filter(s => s.vesselId === vesselId);
}

function getVoyages(vesselId) {
  return fleet.silver.voyages
    .filter(v => v.vesselId === vesselId)
    .sort((a, b) => (b.departureDate || '').localeCompare(a.departureDate || ''));
}

function getCurrentVoyage(vesselId) {
  return getVoyages(vesselId).find(v => v.current) || getVoyages(vesselId)[0] || null;
}

function bearing(a, b) {
  const toRad = Math.PI / 180;
  const lat1 = a[0] * toRad;
  const lat2 = b[0] * toRad;
  const dLon = (b[1] - a[1]) * toRad;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const theta = Math.atan2(y, x);
  return (theta * 180 / Math.PI + 360) % 360;
}

function headingAlongRoute(routeKey, progress) {
  const points = fleet.silver.routes[routeKey] || [];
  if (points.length < 2) return 0;
  const total = points.length - 1;
  const idx = Math.min(Math.floor(progress * total), total - 1);
  return Math.round(bearing(points[idx], points[idx + 1]));
}

function eexi(vessel) {
  const sizeFactor = vessel.dwt / 100000;
  const baseline = round2(vessel.sfofBaseline * sizeFactor * 0.42 + (vessel.type === 'Bulk Carrier' ? 0.5 : 0.3));
  const id = numericId(vessel.id);
  const improvement = round2(baseline * (0.15 + (id % 5) * 0.02)); // 15-23%
  const requiredLimit = round2(baseline * 0.80); // IMO-style 20% reduction
  const withFastRig = round2(baseline - improvement);
  return {
    baseline,
    withFastRig,
    improvement,
    status: withFastRig <= requiredLimit ? 'Compliant' : 'Review required',
    requiredLimit
  };
}

function getLatestProduct(vesselId) {
  return fleet.gold.performanceProducts
    .filter(p => p.vesselId === vesselId)
    .sort((a, b) => b.period.localeCompare(a.period))[0] || null;
}

function getLatestDiagnostic(vesselId) {
  return fleet.bronze.events
    .filter(e => e.vesselId === vesselId && e.type === 'DiagnosticEvent')
    .sort((a, b) => b.ts.localeCompare(a.ts))[0] || null;
}

function getEvents(vesselId) {
  return fleet.bronze.events.filter(e => e.vesselId === vesselId);
}

function formatHours(n) {
  return n.toLocaleString();
}

function healthStage(health) {
  if (health > 90) return 'Steady state';
  if (health > 75) return 'Monitor';
  return 'Plan renewal';
}

function residualValue(health) {
  return `${Math.round(health * 0.85)}%`;
}

function statusText(status) {
  return status === 'Normal' ? 'Normal' : status === 'Alert' ? 'Alert' : 'Attention';
}

function transmissionClass(cls) {
  return cls || 'L2';
}

function buildDetails(vessel) {
  const deployment = getDeployment(vessel.id);
  const contract = getContract(vessel.id);
  const units = getUnits(vessel.id);
  const components = getComponents(vessel.id);
  const sensors = getSensors(vessel.id);
  const voyage = getCurrentVoyage(vessel.id);
  const voyages = getVoyages(vessel.id);
  const historicalVoyages = voyages.filter(v => !v.current);
  const product = getLatestProduct(vessel.id);
  const diagnostic = getLatestDiagnostic(vessel.id);
  const events = getEvents(vessel.id);
  const id = numericId(vessel.id);

  const isProspect = !deployment;

  const fastRigUnits = units.map(unit => {
    const unitComponents = components.filter(c => c.unitId === unit.id);
    const unitSensors = sensors.filter(s => s.unitId === unit.id);
    const unitHealth = unitComponents.length
      ? Math.round(unitComponents.reduce((sum, c) => sum + c.health, 0) / unitComponents.length)
      : 100;

    return {
      serialNumber: unit.serialNumber,
      configuration: `${unit.configuration} · Unit ${unit.unitLetter}`,
      buildDate: unit.buildDate,
      lifecycleStage: healthStage(unitHealth),
      residualValue: residualValue(unitHealth),
      components: unitComponents.map(c => ({
        type: c.type,
        name: c.name,
        health: c.health,
        hours: formatHours(c.operatingHours),
        rul: c.rulDisplay
      })),
      sensors: unitSensors.map(s => ({
        type: s.type,
        name: s.name,
        status: statusText(s.status),
        lastReading: '2 min ago',
        transmission: transmissionClass(s.transmissionClass)
      }))
    };
  });

  const avgHealth = components.length
    ? Math.round(components.reduce((sum, c) => sum + c.health, 0) / components.length)
    : 100;

  const details = {
    deploymentId: deployment ? deployment.id : 'DEP-PROSPECT-000',
    deploymentStatus: deployment ? deployment.status : 'Prospect',
    installDate: deployment ? deployment.installDate : '—',
    commissioningDate: deployment ? deployment.commissioningDate : '—',
    fastRigUnits: isProspect ? [] : fastRigUnits,
    vessel: {
      flag: vessel.flag,
      yearBuilt: vessel.yearBuilt,
      dwt: vessel.dwt,
      lengthOverall: vessel.lengthOverall,
      beam: vessel.beam,
      propulsion: vessel.propulsion,
      sfof: vessel.sfofBaseline
    },
    eexi: isProspect ? null : eexi(vessel),
    contract: contract ? (() => {
      const roi = deployedRoi({
        dwt: vessel.dwt,
        unitCount: units.length || 1,
        contract,
        fuelSavingPct: product ? product.fuelSavingPct : 5
      });
      return {
        contractId: contract.id,
        type: contract.type,
        startDate: contract.startDate,
        endDate: contract.endDate,
        paysRate: `${Math.round(contract.paysRate * 100)}% of verified savings`,
        guaranteeFloor: `${contract.guaranteeFloorPct}%`,
        nextInvoiceDate: contract.nextInvoiceDate,
        voyagesReady: contract.voyagesReady,
        dataTrust: product ? product.scenarioType : 'provisional',
        annualSavingsValueUsd: roi.annualSavingsValueUsd,
        annualFeeUsd: roi.annualFeeUsd,
        roiMultiple: roi.roiMultiple,
        netAnnualBenefitUsd: roi.netAnnualBenefitUsd
      };
    })() : null,
    voyage: voyage ? {
      voyageId: voyage.id,
      source: voyage.source,
      departure: voyage.departure,
      destination: voyage.destination,
      eta: voyage.etaDate ? `${voyage.etaDate.split('T')[0].split('-')[2]} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(voyage.etaDate.split('-')[1])-1]}` : 'TBC',
      distanceRemaining: `${Math.round((1 - voyage.progress) * 3000)} nm`,
      speed: `${voyage.speedKnots} kt`
    } : null,
    historicalVoyages: isProspect ? [] : historicalVoyages.map(v => ({
      voyageId: v.id,
      route: `${v.departure} → ${v.destination}`,
      departureDate: v.departureDate,
      etaDate: v.etaDate,
      status: v.status,
      fuelSavedTonnes: v.fuelSavedTonnes,
      co2SavedTonnes: v.co2SavedTonnes
    })),
    performanceMetrics: isProspect ? null : {
      avgThrust: `${120 + (id % 5) * 4} kN`,
      peakPower: `${400 + (id % 3) * 30} kW`,
      powerContribution: `${10 + (id % 4) * 0.8}%`,
      loadBandHours: 1000 + id * 120,
      fuelFlow: `${22 + (id % 5) * 0.6} t/d`
    },
    cii: isProspect ? null : {
      currentRating: id === 7 ? 'D' : String.fromCharCode(66 + (id % 3)),
      targetRating: id === 7 ? 'C' : 'B',
      operationalCarbonIntensity: `${7 + (id % 5) * 0.2} g CO₂/t·nm`,
      requiredAttained: `${10 + (id % 4) * 0.2} g CO₂/t·nm`,
      verifiedDataPct: product && product.scenarioType === 'verified' ? '100%' : '65%'
    },
    cbm: isProspect ? null : {
      healthScore: avgHealth,
      lastDiagnostic: diagnostic ? '2 min ago' : '12h ago',
      edgeEvaluated: true,
      openFaults: diagnostic ? (diagnostic.severity === 'Critical' ? 1 : 0) : 0,
      rulSummary: avgHealth > 90 ? 'All components > 12 months' : 'Review short-RUL items'
    },
    events: isProspect ? null : {
      sensorReadings24h: 8000 + id * 120,
      controlEvents24h: 8 + id,
      diagnosticEvents24h: diagnostic ? 1 : 0,
      downtimeHours30d: 0
    }
  };

  return details;
}

function deriveFlatVessel(vessel) {
  const deployment = getDeployment(vessel.id);
  const contract = getContract(vessel.id);
  const product = getLatestProduct(vessel.id);
  const diagnostic = getLatestDiagnostic(vessel.id);
  const voyage = getCurrentVoyage(vessel.id);
  const voyages = getVoyages(vessel.id);
  const historicalVoyages = voyages.filter(v => !v.current);
  const id = numericId(vessel.id);

  const isProspect = !deployment;
  const isOffline = deployment && deployment.status === 'Unknown';

  const currentPower = isProspect ? 0 : Math.round((400 + (id % 3) * 30) * (0.6 + (voyage ? voyage.speedKnots / 20 : 0.5)));
  const fuelSaved = isProspect ? 0 : historicalVoyages.reduce((sum, v) => sum + (v.fuelSavedTonnes || 0), 0);
  const co2Saved = isProspect ? 0 : historicalVoyages.reduce((sum, v) => sum + (v.co2SavedTonnes || 0), 0);

  const status = (() => {
    if (isProspect) return 'blue';
    if (isOffline) return 'grey';
    if (diagnostic && diagnostic.severity === 'Critical') return 'red';
    if (diagnostic && diagnostic.severity === 'Amber') return 'amber';
    if (id === 6) return 'cyan';
    if (id === 7) return 'amber';
    if (product && product.variancePct < -0.5) return 'amber';
    return 'green';
  })();

  const sailing = voyage && voyage.status === 'in_progress' && !isProspect && !isOffline;
  const atPort = voyage && (voyage.progress < 0.05 || voyage.progress > 0.95) && !isProspect && !isOffline;

  let reason;
  if (isProspect) reason = 'Prospect, prediction ready';
  else if (isOffline) reason = 'No telemetry 18h';
  else if (status === 'red') reason = diagnostic ? `${diagnostic.faultCode} ${diagnostic.action || 'anomaly'}` : 'Critical alert';
  else if (status === 'amber') reason = id === 7 ? 'CII D, target C' : (product && product.variancePct < 0 ? `Savings ${product.fuelSavingPct}% vs ${contract ? contract.guaranteeFloorPct : 5}% guarantee` : 'Attention required');
  else if (status === 'cyan') reason = 'Live voyage advice';
  else reason = `Savings ${product ? product.fuelSavingPct : 5}%, all verified`;

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
      action: 'Slow to 11.5 kt for 06:00–12:00 arrival window, save 0.8 t fuel'
    };
  }

  const roi = (!isProspect && contract) ? deployedRoi({
    dwt: vessel.dwt,
    unitCount: getUnits(vessel.id).length || 1,
    contract,
    fuelSavingPct: product ? product.fuelSavingPct : 5
  }) : null;

  const evaluation = isProspect ? evaluateProspect({ type: vessel.type, dwt: vessel.dwt }) : null;

  return {
    id,
    name: vessel.name,
    imo: vessel.imo,
    type: vessel.type,
    dwt: vessel.dwt,
    dwtBand: dwtBand(vessel.dwt),
    status,
    sailing,
    atPort,
    reason,
    roiMultiple: roi ? roi.roiMultiple : null,
    evaluation,
    savings: product ? `${product.fuelSavingPct}%` : '—',
    guarantee: contract ? `${contract.guaranteeFloorPct}%` : '—',
    variance: product ? `${product.variancePct > 0 ? '+' : ''}${product.variancePct}%` : '—',
    cii: isProspect ? '—' : (id === 7 ? 'D' : String.fromCharCode(66 + (id % 3))),
    ciiTarget: isProspect ? '—' : (id === 7 ? 'C' : 'B'),
    co2: product ? `${product.co2ReductionPct}%` : '—',
    contract: contract ? contract.type : 'Prospect',
    nextInvoice: contract ? contract.nextInvoiceDate : '—',
    voyagesReady: contract ? contract.voyagesReady : 0,
    deploy: deployment ? deployment.status : 'None',
    hours: deployment ? deployment.operatingHours.toLocaleString() : '0',
    perfTrust: product ? (product.scenarioType === 'verified' ? 'verified' : 'provisional') : (isProspect ? 'provisional' : 'nodata'),
    cbmTrust: diagnostic ? (diagnostic.qualityFlag === 'verified' ? 'verified' : 'provisional') : (isProspect ? 'provisional' : 'verified'),
    compTrust: product ? (product.scenarioType === 'verified' ? 'verified' : 'provisional') : (isProspect ? 'provisional' : 'nodata'),
    contractTrust: product ? (product.scenarioType === 'verified' ? 'verified' : 'provisional') : (isProspect ? 'provisional' : 'nodata'),
    alert,
    alertData,
    lat: voyage ? voyage.lat : 0,
    lon: voyage ? voyage.lon : 0,
    heading: voyage ? headingAlongRoute(voyage.routeKey, voyage.progress) : 0,
    voyage: voyage ? `${voyage.departure} → ${voyage.destination}` : '',
    currentPower,
    fuelSaved: round2(fuelSaved),
    co2Saved: round2(co2Saved),
    details: buildDetails(vessel)
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

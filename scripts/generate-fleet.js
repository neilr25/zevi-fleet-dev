const fs = require('fs');
const path = require('path');

const SEED = 42;

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);

function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function pickWeighted(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}
function randInt(min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function round2(n) { return Math.round(n * 100) / 100; }
function pad2(n) { return String(n).padStart(2, '0'); }
function formatDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatDateTime(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}Z`;
}
function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
function hoursAgo(h) {
  const d = new Date();
  d.setUTCMinutes(d.getUTCMinutes() - h * 60);
  return d;
}
function interpolateRoute(points, f) {
  if (points.length < 2) return points[0] ? points[0].slice() : [0, 0];
  f = Math.max(0, Math.min(1, f));
  const total = points.length - 1;
  const idx = Math.floor(f * total);
  const local = f * total - idx;
  const a = points[idx];
  const b = points[idx + 1] || a;
  return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local];
}

const VESSEL_NAMES = [
  'MV Atlantic Star', 'MV Pacific Star', 'MV Nordic Wind', 'MV Southern Cross',
  'MV Ocean Breeze', 'MV Trade Wind', 'MV Aurora', 'MV Horizon', 'MV Zephyr', 'MV Calypso'
];
const TYPES = ['Bulk Carrier', 'Container', 'Tanker', 'RoRo'];
const FLAGS = ['Liberia', 'Marshall Is.', 'Panama', 'Singapore', 'Malta', 'Greece', 'Norway', 'UK', 'Hong Kong', 'Cyprus'];
const PORTS = [
  ['Rotterdam', 'New York'], ['Shanghai', 'Long Beach'], ['Cape Town', 'Singapore'],
  ['Algeciras', 'Genoa'], ['Mombasa', 'Rotterdam'], ['Fujairah', 'Rotterdam'],
  ['Singapore', 'Colombo'], ['Reykjavik', 'Halifax'], ['Felixstowe', 'Hamburg'],
  ['Felixstowe', 'New York']
];
const ROUTE_KEYS = PORTS.map(p => `${p[0]}->${p[1]}`);
const TRANSMISSION_CLASSES = ['L1', 'L2', 'L3'];
const TRANSMISSION_WEIGHTS = [0.15, 0.7, 0.15];

const COMPONENT_TEMPLATES = [
  { type: 'HPU', name: 'HPU accumulator', baseHealth: 96, rulYears: 18, rulUnit: 'years' },
  { type: 'Slew', name: 'Slew drive', baseHealth: 94, rulYears: 15, rulUnit: 'years' },
  { type: 'Wing', name: 'Main wing set', baseHealth: 92, rulYears: 20, rulUnit: 'years' },
  { type: 'Flap', name: 'Flap actuators', baseHealth: 95, rulYears: 10, rulUnit: 'years' },
  { type: 'Lock', name: 'Locking mechanism', baseHealth: 98, rulYears: 15, rulUnit: 'years' },
  { type: 'Luff', name: 'Luffing mechanism', baseHealth: 93, rulYears: 12, rulUnit: 'years' }
];

const SENSOR_TEMPLATES = [
  { type: 'Pressure', name: 'HPU pressure', componentType: 'HPU' },
  { type: 'Vibration', name: 'Wing vibration', componentType: 'Wing' },
  { type: 'Load', name: 'Wing load cell', componentType: 'Wing' },
  { type: 'Wind', name: 'Anemometer', componentType: 'Wing' },
  { type: 'Position', name: 'GPS/position', componentType: 'Slew' },
  { type: 'Temperature', name: 'Hydraulic temp', componentType: 'HPU' },
  { type: 'Current', name: 'Slew motor current', componentType: 'Slew' }
];

const FAULT_CODES = {
  HPU: ['HPU-014', 'HPU-027', 'HPU-031', 'HPU-042'],
  Slew: ['SLW-092', 'SLW-103', 'SLW-118'],
  Wing: ['WNG-004', 'WNG-017', 'WNG-055'],
  Flap: ['FLP-031', 'FLP-044'],
  Lock: ['LCK-012'],
  Luff: ['LUF-021']
};

const STOCK_PARTS = {
  'HPU accumulator': { stock: 2, leadDays: 23 },
  'Slew bearing seal': { stock: 4, leadDays: 114 },
  'Flap sensor': { stock: 7, leadDays: 57 },
  'Hydraulic pump': { stock: 1, leadDays: 45 },
  'Wing load cell': { stock: 3, leadDays: 38 },
  'Luffing actuator': { stock: 2, leadDays: 62 }
};

const BASELINE_FUEL_TONNES_PER_YEAR = {
  'Bulk Carrier': 4200,
  'Container': 5100,
  'Tanker': 4800,
  'RoRo': 3600
};

const PAY_RATE = 0.80;

const existingRoutes = require('../data/fleet.json').silver?.routes || require('../data/fleet.json').routes || {};

const data = {
  meta: {
    modelVersion: 'v16',
    generatedAt: formatDateTime(new Date()),
    seed: SEED,
    vesselCount: 10,
    deploymentCount: 0,
    routeCount: ROUTE_KEYS.length
  },
  silver: {
    vessels: [],
    deployments: [],
    fastRigUnits: [],
    components: [],
    sensors: [],
    contracts: [],
    voyages: [],
    routes: existingRoutes
  },
  bronze: { events: [] },
  gold: { performanceProducts: [], paysInvoices: [] }
};

let deploymentCounter = 1;
let unitCounter = 1;
let componentCounter = 1;
let sensorCounter = 1;
let voyageCounter = 1;
let eventCounter = 1;
let productCounter = 1;
let invoiceCounter = 1;

for (let i = 0; i < 10; i++) {
  const id = i + 1;
  const name = VESSEL_NAMES[i];
  const type = pickWeighted([
    { value: 'Bulk Carrier', weight: 4 },
    { value: 'Container', weight: 3 },
    { value: 'Tanker', weight: 2 },
    { value: 'RoRo', weight: 1 }
  ]);
  const flag = FLAGS[i];
  const yearBuilt = 2012 + (i % 7);
  const dwt = { 'Bulk Carrier': 85000, 'Container': 145000, 'Tanker': 160000, 'RoRo': 47000 }[type];
  const lengthOverall = { 'Bulk Carrier': 235, 'Container': 335, 'Tanker': 250, 'RoRo': 180 }[type];
  const beam = { 'Bulk Carrier': 38, 'Container': 42, 'Tanker': 44, 'RoRo': 32 }[type];
  const sfofBaseline = { 'Bulk Carrier': 165, 'Container': 155, 'Tanker': 158, 'RoRo': 175 }[type];

  const vessel = {
    id: `V${String(id).padStart(2, '0')}`,
    imo: String(9000000 + randInt(100000, 999999)),
    name,
    type,
    flag,
    yearBuilt,
    dwt,
    lengthOverall,
    beam,
    propulsion: 'Single screw, slow-speed diesel',
    sfofBaseline
  };
  data.silver.vessels.push(vessel);

  const isProspect = i === 2; // MV Nordic Wind as prospect
  const isOffline = i === 8; // MV Zephyr as offline

  if (!isProspect) {
    const contractType = pickWeighted([
      { value: 'PAYS', weight: 6 },
      { value: 'Lease', weight: 2 },
      { value: 'Prospect', weight: isProspect ? 10 : 0 }
    ]);

    const contract = {
      id: `CTR-${String(id).padStart(3, '0')}`,
      vesselId: vessel.id,
      type: contractType,
      startDate: '2023-04-08',
      endDate: '2028-04-07',
      paysRate: PAY_RATE,
      guaranteeFloorPct: round2(5.0 + (i % 3) * 0.5),
      nextInvoiceDate: formatDate(daysAgo(randInt(-14, 14))),
      voyagesReady: isOffline ? 0 : randInt(0, 2)
    };
    data.silver.contracts.push(contract);

    const deployment = {
      id: `DEP-${String(deploymentCounter++).padStart(3, '0')}`,
      vesselId: vessel.id,
      contractId: contract.id,
      status: isOffline ? 'Unknown' : 'Active',
      installDate: '2023-03-12',
      commissioningDate: '2023-04-08',
      operatingHours: isOffline ? 0 : randInt(180, 7050)
    };
    data.silver.deployments.push(deployment);

    const unitCount = isOffline ? 0 : randInt(1, 4);
    for (let u = 0; u < unitCount; u++) {
      const unitLetter = String.fromCharCode(65 + u);
      const unit = {
        id: `FR-${String(unitCounter++).padStart(3, '0')}`,
        serialNumber: `FR-${String(id).padStart(4, '0')}-${vessel.imo.slice(-3)}-${unitLetter}`,
        configuration: pick(['Mark IV 4-wing', 'Mark V 6-wing']),
        buildDate: `${2018 + randInt(0, 5)}-${pad2(randInt(1, 12))}`,
        deploymentId: deployment.id,
        vesselId: vessel.id,
        unitLetter,
        wingCount: 4,
        status: isOffline ? 'offline' : 'active'
      };
      data.silver.fastRigUnits.push(unit);

      for (const tpl of COMPONENT_TEMPLATES) {
        const healthJitter = randInt(-8, 4);
        const health = Math.max(0, Math.min(100, tpl.baseHealth + healthJitter));
        const degradation = (100 - health) / 100;
        const rulDays = Math.floor(tpl.rulYears * 365 * (1 - degradation * 0.6));
        const component = {
          id: `CMP-${String(componentCounter++).padStart(3, '0')}`,
          unitId: unit.id,
          deploymentId: deployment.id,
          vesselId: vessel.id,
          type: tpl.type,
          name: `${tpl.name} ${unitLetter}`,
          health,
          operatingHours: deployment.operatingHours,
          rulDays,
          rulDisplay: rulDays > 365 ? `${Math.round(rulDays / 365)} ${tpl.rulUnit}` : `${rulDays} days`,
          status: health > 90 ? 'Normal' : health > 75 ? 'Attention' : 'Alert',
          lastServiceDate: formatDate(daysAgo(randInt(30, 180)))
        };
        data.silver.components.push(component);

        for (const senTpl of SENSOR_TEMPLATES.filter(s => s.componentType === tpl.type)) {
          const sensorStatus = component.status === 'Alert' && senTpl.type === 'Pressure' ? 'Alert' : 'Normal';
          const sensor = {
            id: `SEN-${String(sensorCounter++).padStart(4, '0')}`,
            componentId: component.id,
            unitId: unit.id,
            deploymentId: deployment.id,
            vesselId: vessel.id,
            type: senTpl.type,
            name: `${senTpl.name} ${unitLetter}`,
            status: sensorStatus,
            lastReadingTs: formatDateTime(hoursAgo(sensorStatus === 'Alert' ? 2 : 0.5)),
            transmissionClass: TRANSMISSION_CLASSES[TRANSMISSION_WEIGHTS.findIndex((w, idx) => {
              let sum = 0;
              for (let k = 0; k <= idx; k++) sum += TRANSMISSION_WEIGHTS[k];
              return rng() <= sum;
            })],
            value: round2(rng() * 100)
          };
          data.silver.sensors.push(sensor);
        }
      }
    }

    const routeIdx = i % PORTS.length;
    const [departure, destination] = PORTS[routeIdx];
    const routeKey = `${departure}->${destination}`;
    const routePoints = existingRoutes[routeKey] || [];
    const progress = rng() * 0.7 + 0.15;
    const [lat, lon] = routePoints.length ? interpolateRoute(routePoints, progress) : [0, 0];

    const voyage = {
      id: `VY-${String(voyageCounter++).padStart(3, '0')}`,
      deploymentId: deployment.id,
      vesselId: vessel.id,
      routeKey,
      departure,
      destination,
      departureDate: formatDate(daysAgo(randInt(5, 20))),
      etaDate: formatDate(daysAgo(-randInt(5, 12))),
      status: isOffline ? 'unknown' : 'in_progress',
      source: 'live_ship',
      lat,
      lon,
      heading: Math.floor(rng() * 360),
      speedKnots: round2(10 + rng() * 6),
      progress,
      current: true
    };
    data.silver.voyages.push(voyage);

    const historicalRouteKeys = Object.keys(existingRoutes).filter(k => k !== routeKey).slice(0, randInt(3, 5));
    for (const histRouteKey of historicalRouteKeys) {
      const [histDep, histDest] = histRouteKey.split('->');
      const histPoints = existingRoutes[histRouteKey] || [];
      const histProgress = 1;
      const [histLat, histLon] = histPoints.length ? interpolateRoute(histPoints, histProgress) : [0, 0];
      const histDepartureDate = formatDate(daysAgo(randInt(60, 180)));
      const histEtaDate = formatDate(daysAgo(randInt(30, 59)));
      data.silver.voyages.push({
        id: `VY-${String(voyageCounter++).padStart(3, '0')}`,
        deploymentId: deployment.id,
        vesselId: vessel.id,
        routeKey: histRouteKey,
        departure: histDep,
        destination: histDest,
        departureDate: histDepartureDate,
        etaDate: histEtaDate,
        status: 'completed',
        source: 'live_ship',
        lat: histLat,
        lon: histLon,
        heading: Math.floor(rng() * 360),
        speedKnots: round2(10 + rng() * 6),
        progress: histProgress,
        current: false,
        fuelSavedTonnes: round2(rng() * 50 + 20),
        co2SavedTonnes: round2(rng() * 150 + 60)
      });
    }

    // Events
    const eventCount = isOffline ? randInt(2, 5) : randInt(20, 45);
    for (let e = 0; e < eventCount; e++) {
      const eventType = pickWeighted([
        { value: 'SensorReading', weight: 70 },
        { value: 'DiagnosticEvent', weight: 15 },
        { value: 'ControlEvent', weight: 10 },
        { value: 'DowntimeEvent', weight: 5 }
      ]);
      const event = {
        id: `EVT-${String(eventCounter++).padStart(5, '0')}`,
        ts: formatDateTime(hoursAgo(rng() * 24 * 14)),
        deploymentId: deployment.id,
        vesselId: vessel.id,
        type: eventType,
        sourceSystem: pick(['edge_rt', 'shore_pipeline', 'manual_entry']),
        qualityFlag: rng() > 0.7 ? 'verified' : 'provisional',
        value: round2(rng() * 100)
      };
      if (eventType === 'DiagnosticEvent') {
        const comp = pick(data.silver.components.filter(c => c.vesselId === vessel.id));
        if (comp) {
          event.componentId = comp.id;
          event.faultCode = pick(FAULT_CODES[comp.type] || ['GEN-001']);
          event.anomalyScore = id === 2 ? round2(0.82 + rng() * 0.1) : id === 1 ? round2(0.65 + rng() * 0.1) : round2(0.5 + rng() * 0.45);
          event.severity = id === 2 ? 'Critical' : id === 1 ? 'Amber' : 'Attention';
          event.action = `Inspect ${comp.name.toLowerCase()} within ${randInt(3, 14)} days`;
          event.rulDays = comp.rulDays;
          if (id === 2 || id === 1) event.ts = formatDateTime(hoursAgo(rng() * 6));
        }
      }
      data.bronze.events.push(event);
    }

    // Performance products (Gold)
    for (let m = 0; m < 3; m++) {
      const monthDate = new Date();
      monthDate.setUTCMonth(monthDate.getUTCMonth() - m);
      const guarantee = contract.guaranteeFloorPct;
      const saving = id === 1 ? round2(guarantee - 0.8) : round2(guarantee + (rng() - 0.5) * 2.5);
      const variance = round2(saving - guarantee);
      const co2 = round2(saving * 1.8 + (rng() - 0.5) * 1.5);
      const verified = rng() > 0.25; // 75% verified
      const product = {
        id: `PP-${String(productCounter++).padStart(4, '0')}`,
        deploymentId: deployment.id,
        vesselId: vessel.id,
        period: `${monthDate.getFullYear()}-${pad2(monthDate.getMonth() + 1)}`,
        calcMethodVersion: 'v2.3',
        scenarioType: verified ? 'verified' : 'provisional',
        fuelSavingPct: saving,
        co2ReductionPct: co2,
        variancePct: variance,
        computedAt: formatDateTime(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)),
        validFrom: `${monthDate.getFullYear()}-${pad2(monthDate.getMonth() + 1)}-01`,
        validTo: null,
        inputSnapshotRef: `snap-${vessel.id}-${monthDate.getFullYear()}${pad2(monthDate.getMonth() + 1)}`
      };
      data.gold.performanceProducts.push(product);

      if (verified && m === 0) {
        const baselineFuel = BASELINE_FUEL_TONNES_PER_YEAR[type] / 12;
        const fuelSaved = baselineFuel * (saving / 100);
        const fuelPriceUsd = 650;
        const savingUsd = fuelSaved * fuelPriceUsd;
        const amountGbp = Math.round(savingUsd * 0.78 * PAY_RATE / 1000) * 1000;
        const invoice = {
          id: `INV-${String(invoiceCounter++).padStart(4, '0')}`,
          contractId: contract.id,
          deploymentId: deployment.id,
          vesselId: vessel.id,
          productId: product.id,
          period: product.period,
          amountGbp,
          scenarioType: 'verified',
          status: 'issued'
        };
        data.gold.paysInvoices.push(invoice);
      }
    }
  } else {
    // Prospect vessel: no deployment, contract, etc.
    const routeIdx = i % PORTS.length;
    const [departure, destination] = PORTS[routeIdx];
    const routeKey = `${departure}->${destination}`;
    const routePoints = existingRoutes[routeKey] || [];
    const [lat, lon] = routePoints.length ? interpolateRoute(routePoints, 0.1) : [0, 0];
    const voyage = {
      id: `VY-${String(voyageCounter++).padStart(3, '0')}`,
      deploymentId: null,
      vesselId: vessel.id,
      routeKey,
      departure,
      destination,
      departureDate: null,
      etaDate: null,
      status: 'predicted',
      source: 'simulation',
      lat,
      lon,
      heading: Math.floor(rng() * 360),
      speedKnots: round2(10 + rng() * 6),
      progress: 0.1
    };
    data.silver.voyages.push(voyage);
  }
}

data.meta.deploymentCount = data.silver.deployments.length;

fs.writeFileSync(path.join(__dirname, '..', 'data', 'fleet.json'), JSON.stringify(data, null, 2));
console.log(`Generated data/fleet.json with ${data.silver.vessels.length} vessels, ${data.silver.deployments.length} deployments, ${data.silver.fastRigUnits.length} units, ${data.silver.components.length} components, ${data.silver.sensors.length} sensors, ${data.silver.voyages.length} voyages, ${data.bronze.events.length} events, ${data.gold.performanceProducts.length} performance products, ${data.gold.paysInvoices.length} invoices.`);

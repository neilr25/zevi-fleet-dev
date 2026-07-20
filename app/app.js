  function makeFastRigUnit(s, idx, unitCount) {
    const healthScore = s.status === 'red' ? 62 : s.status === 'amber' ? 78 : s.status === 'cyan' ? 85 : s.status === 'grey' ? 0 : 94;
    const unitLetter = String.fromCharCode(65 + idx);
    const baseSerial = `FR-${String(s.id).padStart(4, '0')}-${s.imo.slice(-3)}`;
    const serial = unitCount > 1 ? `${baseSerial}-${unitLetter}` : baseSerial;
    const config = ['Mark IV 4-wing', 'Mark V 6-wing', 'Mark IV 4-wing', 'Mark V 6-wing', 'Mark IV 4-wing', 'Mark V 6-wing', 'Mark IV 4-wing', 'Mark IV 4-wing', 'Mark V 6-wing', 'Mark IV 4-wing'][s.id - 1];
    const buildDate = ['2022-08', '2023-01', '2022-11', '2023-04', '2023-06', '2022-12', '2023-02', '2023-05', '2022-09', '2023-07'][s.id - 1];
    const lifecycleStage = s.hours === '0' ? 'Commissioned' : parseInt(s.hours.replace(/,/g, '')) < 500 ? 'Early operation' : 'Steady state';
    const residualValue = ['82%', '79%', '84%', '77%', '81%', '80%', '83%', '78%', '85%', '76%'][s.id - 1];
    const unitOffset = unitCount > 1 ? ` · Unit ${unitLetter}` : '';
    return {
      serialNumber: serial,
      configuration: config + unitOffset,
      buildDate: buildDate,
      lifecycleStage: lifecycleStage,
      residualValue: residualValue,
      components: [
        { type: 'HPU', name: `HPU ${unitLetter}`, health: healthScore, hours: s.hours, rul: s.status === 'red' ? '41 days' : '14 months' },
        { type: 'Wing', name: `Main wing set ${unitLetter}`, health: s.status === 'red' ? 88 : 94, hours: s.hours, rul: '18 years' },
        { type: 'Slew', name: `Slew drive ${unitLetter}`, health: s.status === 'red' ? 85 : 92, hours: s.hours, rul: '12 years' },
        { type: 'Flap', name: `Flap actuators ${unitLetter}`, health: 91, hours: s.hours, rul: '9 years' },
        { type: 'Lock', name: `Locking mechanism ${unitLetter}`, health: 96, hours: s.hours, rul: '15 years' }
      ],
      sensors: [
        { type: 'Pressure', name: `HPU pressure ${unitLetter}`, status: s.status === 'red' ? 'Alert' : 'Normal', lastReading: '2 min ago', transmission: 'L1' },
        { type: 'Vibration', name: `Wing vibration ${unitLetter}`, status: 'Normal', lastReading: '2 min ago', transmission: 'L2' },
        { type: 'Load', name: `Wing load cell ${unitLetter}`, status: 'Normal', lastReading: '2 min ago', transmission: 'L2' },
        { type: 'Wind', name: `Anemometer ${unitLetter}`, status: 'Normal', lastReading: '2 min ago', transmission: 'L2' },
        { type: 'Position', name: `GPS/position ${unitLetter}`, status: s.status === 'grey' ? 'Offline' : 'Normal', lastReading: s.status === 'grey' ? '18h ago' : '2 min ago', transmission: 'L2' }
      ]
    };
  }

  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }

  // Deterministic per-ship operational data: counterfactual baselines, CalculationEngine
  // versioning, event timelines, derived FastFix/invoice/report content. Seeded by ship id
  // so every render of the same vessel is identical.
  function makeOpsData(s, unitCount) {
    const rng = mulberry32(s.id * 7919 + 13);
    const pick = arr => arr[Math.floor(rng() * arr.length)];
    const savingsPct = s.savings && s.savings !== '—' ? parseFloat(s.savings) : null;
    const guaranteePct = s.guarantee && s.guarantee !== '—' ? parseFloat(s.guarantee) : null;
    const fuelFlows = [24.2, 31.5, 28.0, 26.1, 21.8, 30.2, 29.4, 25.5, 32.1, 22.4];
    const actualFuelTd = fuelFlows[s.id - 1];
    const baselineFuelTd = savingsPct ? +(actualFuelTd / (1 - savingsPct / 100)).toFixed(1) : null;

    // Variance attribution: split variance (actual - expected) into driver buckets that sum correctly.
    const expectedPct = guaranteePct || savingsPct;
    const variancePp = savingsPct && expectedPct ? +(savingsPct - expectedPct).toFixed(2) : null;
    let varianceBreakdown = null;
    if (variancePp !== null) {
      const drivers = ['weather', 'route', 'crew', 'hull', 'model'];
      const weights = [0.4, 0.25, 0.1, 0.15, 0.1].map(w => w * (0.6 + rng() * 0.8));
      const total = weights.reduce((a, b) => a + b, 0);
      varianceBreakdown = {};
      drivers.forEach((d, i) => { varianceBreakdown[d] = +((variancePp * weights[i] / total)).toFixed(2); });
    }

    // Gold-layer calculation versioning (v17.1 CalculationEngine fields)
    const verified = s.perfTrust === 'verified';
    const calculation = {
      methodVersion: 'savings-calc v3.2.1',
      inputSnapshotRef: `snap-${s.imo}-20260715`,
      computedAt: `2026-07-${String(10 + Math.floor(rng() * 6)).padStart(2, '0')} 0${Math.floor(rng() * 9)}:${String(Math.floor(rng() * 60)).padStart(2, '0')} UTC`,
      scenarioType: verified ? 'verified' : 'provisional',
      validFrom: '2026-07-01',
      validTo: '2026-07-31',
      baselineSource: verified ? 'hindcast (L3 batch)' : 'realtime (L2 telemetry)',
      fidelity: verified ? 'batch_verified' : 'rt_provisional'
    };
    const provisionalReason = verified ? null :
      s.perfTrust === 'nodata' ? 'No telemetry for 18h — awaiting reconnection' :
      'L2 telemetry (provisional) — L3 batch verification due 04:00 UTC';

    // Voyage source vocabulary per data model: actual/forecast/hindcast/historic/simulation
    const voyageSource = s.status === 'blue' ? 'forecast' : s.status === 'grey' ? 'historical' : verified ? 'actual' : 'actual';

    // EventLayer timeline (append-only audit trail), most recent first
    const eventTypes = [
      { type: 'savings_calc', lane: 'Gold', fidelity: verified ? 'verified' : 'provisional', msg: `Savings calculation ${calculation.methodVersion} completed` },
      { type: 'sensor_batch', lane: 'L3', fidelity: 'verified', msg: `Bulk sensor batch uploaded (${(8000 + Math.floor(rng() * 6000)).toLocaleString()} readings)` },
      { type: 'control_event', lane: 'L0', fidelity: 'verified', msg: `Wing trim adjusted by crew (${pick(['auto', 'manual', 'scheduled'])})` },
      { type: 'diagnostic_event', lane: 'L1', fidelity: 'provisional', msg: s.status === 'red' ? `CBM rule CbM-HPU-014 fired: ${s.alert}` : 'CBM rule scan: no anomalies' },
      { type: 'sensor_stream', lane: 'L2', fidelity: 'provisional', msg: 'Telemetry downsample sync (5 min aggregates)' },
      { type: 'savings_calc', lane: 'Gold', fidelity: 'provisional', msg: 'Provisional savings estimate refreshed' },
      { type: 'downtime', lane: 'L2', fidelity: 'verified', msg: s.id % 3 === 0 ? 'Rig parked 2.1h (heavy weather precaution)' : 'No downtime recorded' }
    ];
    const now = new Date('2026-07-17T12:00:00Z');
    const eventTimeline = eventTypes.map((e, i) => {
      const t = new Date(now.getTime() - (i * 3.7 + rng() * 2) * 3600000);
      return { ts: t.toISOString().slice(5, 16).replace('T', ' '), ...e };
    });

    // PAYS invoices derived from savings + dwt
    const dwt = s.dwt || 100000;
    const rate = 0.8;
    const invoices = savingsPct ? [
      { voyage: `VY-${s.imo}-2041`, date: '2026-06-15', savingsTd: +((baselineFuelTd - actualFuelTd) * 14).toFixed(1), amount: Math.round((baselineFuelTd - actualFuelTd) * 14 * 620 * rate), trust: 'verified' },
      { voyage: `VY-${s.imo}-2038`, date: '2026-05-28', savingsTd: +((baselineFuelTd - actualFuelTd) * 12).toFixed(1), amount: Math.round((baselineFuelTd - actualFuelTd) * 12 * 610 * rate), trust: 'verified' },
      { voyage: `VY-${s.imo}-2045`, date: '2026-07-01', savingsTd: +((baselineFuelTd - actualFuelTd) * 6).toFixed(1), amount: Math.round((baselineFuelTd - actualFuelTd) * 6 * 630 * rate), trust: 'provisional' }
    ] : [];

    // FastFix board derived from ship status
    const fixBoard = {
      open: s.status === 'red' ? [{ id: s.alertData.fault, sev: 'red', note: s.alertData.component }] : s.status === 'amber' ? [{ id: `SVC-${s.imo.slice(-3)}-07`, sev: 'amber', note: 'Scheduled inspection' }] : [],
      scheduled: [{ id: `Slew-${90 + s.id}`, sev: 'amber', note: `${pick(['Rotterdam', 'Singapore', 'Hamburg'])} ${2 + Math.floor(rng() * 6)}d` }],
      inProgress: s.status === 'green' ? [{ id: `Flap-${30 + s.id}`, sev: 'green', note: 'sensor swap' }] : [],
      closed: [{ id: `Wing-00${s.id}`, sev: 'green', note: 'NDT passed' }]
    };
    const rulList = s.details && s.details.fastRigUnits && s.details.fastRigUnits.length
      ? s.details.fastRigUnits[0].components.map(c => ({ name: c.name, rul: c.rul, pct: s.status === 'red' && c.type === 'HPU' ? 92 : 15 + Math.floor(rng() * 50) }))
      : [];
    const partsStock = [
      { part: 'HPU accumulator', stock: s.id % 2 === 0 ? 2 : 1, lead: '3d' },
      { part: 'Slew bearing seal', stock: s.id % 3 === 0 ? 1 : 4, lead: '14d' },
      { part: 'Flap sensor', stock: 5, lead: '7d' }
    ];

    // FastReport techno-economics derived from savings + dwt + fuel price
    const fuelPrice = 620;
    const annualSavingsT = savingsPct ? (baselineFuelTd - actualFuelTd) * 320 : 0;
    const annualSavingsVal = annualSavingsT * fuelPrice;
    const rigCapex = unitCount * 1100000;
    const paybackYears = annualSavingsVal > 0 ? +(rigCapex / annualSavingsVal).toFixed(1) : null;
    const npv10 = annualSavingsVal > 0 ? Math.round(annualSavingsVal * 6.4 - rigCapex) : null;
    const co2AvoidedYr = Math.round(annualSavingsT * 3.15);
    const report = {
      paybackYears, npv10, co2AvoidedYr, annualSavingsT: +annualSavingsT.toFixed(0), fuelPrice,
      designBaseline: {
        validationRef: `ITTC-V-2023-${String(s.id).padStart(2, '0')}`,
        polarRef: `POLAR-${unitCount > 2 ? 'MKV6' : 'MKIV4'}-v7.2`,
        designVersion: 'Design v14.3',
        correlation: `${(91 + rng() * 6).toFixed(1)}%`
      }
    };

    // Historical voyages with counterfactual rows
    const routes = (s.voyage || '').includes('→') ? [s.voyage] : [];
    const otherRoutes = ['Rotterdam → New York', 'Singapore → Colombo', 'Algeciras → Genoa', 'Mombasa → Rotterdam'];
    const historicalVoyages = Array.from({ length: 4 }, (_, i) => {
      const route = routes[0] && i === 0 ? routes[0] : pick(otherRoutes);
      const vPct = savingsPct ? +(savingsPct + (rng() - 0.5) * 1.4).toFixed(1) : null;
      const days = 10 + Math.floor(rng() * 8);
      return {
        voyageId: `VY-${s.imo}-${2045 - i * 3}`,
        date: `2026-0${6 - Math.floor(i / 2)}-${String(28 - i * 6).padStart(2, '0')}`,
        route,
        days,
        savingsPct: vPct,
        baselineTd: baselineFuelTd,
        actualTd: vPct ? +(baselineFuelTd * (1 - vPct / 100)).toFixed(1) : null,
        trust: i === 0 && !verified ? 'provisional' : 'verified'
      };
    });

    // Alert provenance (edge-evaluated CBM per Purdue separation)
    const alertProvenance = s.alert ? {
      evaluatedAt: 'edge',
      subtype: s.status === 'cyan' ? 'route_advice' : 'cbm_alert',
      modelVersion: s.status === 'cyan' ? 'route-opt v1.8.2' : 'cbm-rul v2.4.0',
      lane: s.status === 'cyan' ? 'L2' : 'L1',
      shoreRole: 'advisory only — shore cannot command the rig'
    } : null;

    const verifiedStatement = verified ? {
      statementId: `VS-${s.imo}-2026H1`,
      period: '2026-01-01 → 2026-06-30',
      outputRef: calculation.inputSnapshotRef,
      hash: '0x' + Array.from({ length: 8 }, () => '0123456789abcdef'[Math.floor(rng() * 16)]).join(''),
      signedBy: 'R. Okafor (Verification Lead)',
      signedAt: '2026-07-04 09:12 UTC'
    } : null;
    const fuelEuBalanceT = Math.round((rng() - 0.45) * 380);
    const fuelEU = {
      balanceT: fuelEuBalanceT,
      penaltyEst: fuelEuBalanceT < 0 ? Math.round(Math.abs(fuelEuBalanceT) * 240) : 0,
      status: fuelEuBalanceT >= 0 ? 'none' : 'estimated',
      year: 2026,
      verified: s.compTrust === 'verified'
    };
    const ciiBelowTarget = s.cii !== '—' && s.ciiTarget !== '—' && s.cii > s.ciiTarget;
    const correctiveAction = ciiBelowTarget ? {
      actionId: `CA-${s.imo}-001`,
      trigger: 'cii_below_target',
      description: `Reduce average speed 0.5 kt on next two voyages and connect shore power at all berth calls.`,
      dueDate: '2026-09-30',
      status: 'open',
      evidenceRequired: true
    } : null;
    const flagList = ['Liberia', 'Marshall Is.', 'Panama', 'Singapore', 'Malta', 'Greece', 'Norway', 'UK', 'Hong Kong', 'Cyprus'];
    const flag = flagList[s.id - 1];
    const allocated = 3800 + Math.floor(rng() * 2200);
    const surrendered = Math.floor(allocated * (0.3 + rng() * 0.4));
    const etsAccount = (s.contract !== 'Prospect' && s.cii !== '—') ? {
      scheme: flag === 'UK' ? 'UK ETS' : 'EU ETS',
      holder: `${s.name.replace(/^MV\s+/, '')} Maritime Ltd`,
      allocationYear: 2026,
      allocated,
      surrendered,
      remaining: allocated - surrendered
    } : null;

    return { baselineFuelTd, actualFuelTd, expectedPct, variancePp, varianceBreakdown, calculation, provisionalReason, voyageSource, eventTimeline, invoices, fixBoard, rulList, partsStock, report, historicalVoyages, alertProvenance, verifiedStatement, fuelEU, correctiveAction, etsAccount };
  }

  async function loadFleetData() {
    try {
      const res = await fetch('/api/fleet');
      if (!res.ok) return false;
      const data = await res.json();
      if (!Array.isArray(data.vessels) || data.vessels.length === 0) return false;
      ships = data.vessels;
      return true;
    } catch (e) {
      console.warn('API load failed, using fallback:', e);
      return false;
    }
  }

  async function initApp() {
  ships.forEach(s => {
    if (s.details) {
      // API already provided details; still build the operational layer so
      // Performance/Commercial/FastFix tabs have counterfactual data to render.
      const apiUnits = s.details.fastRigUnits ? s.details.fastRigUnits.length : 0;
      if (!s.ops) s.ops = makeOpsData(s, apiUnits);
      return;
    }
    const isProspect = s.contract === 'Prospect';
    const isActive = s.deploy === 'Active';
    const hasRig = isActive && !isProspect;
    const unitCount = hasRig ? ([2, 4, 1, 3, 2, 4, 2, 3, 0, 2][s.id - 1]) : 0;
    const healthScore = s.status === 'red' ? 62 : s.status === 'amber' ? 78 : s.status === 'cyan' ? 85 : s.status === 'grey' ? 0 : 94;
    s.details = {
      deploymentId: isProspect ? null : `DEP-${s.imo}-001`,
      deploymentStatus: isProspect ? 'Prospect' : s.deploy,
      installDate: isProspect ? null : '12 Mar 2023',
      commissioningDate: isProspect ? null : '08 Apr 2023',
      fastRigUnits: hasRig ? Array.from({ length: unitCount }, (_, i) => makeFastRigUnit(s, i, unitCount)) : [],
      vessel: {
        flag: ['Liberia', 'Marshall Is.', 'Panama', 'Singapore', 'Malta', 'Greece', 'Norway', 'UK', 'Hong Kong', 'Cyprus'][s.id - 1],
        yearBuilt: 2012 + (s.id % 7),
        dwt: [85000, 145000, 160000, 95000, 47000, 138000, 115000, 82000, 152000, 42000][s.id - 1],
        lengthOverall: [235, 335, 250, 245, 180, 330, 270, 230, 340, 175][s.id - 1],
        beam: [38, 42, 44, 39, 32, 43, 45, 38, 44, 31][s.id - 1],
        propulsion: 'Single screw, slow-speed diesel',
        sfof: [165, 155, 158, 162, 175, 156, 160, 164, 154, 178][s.id - 1]
      },
      contract: isProspect ? null : {
        contractId: `CTR-${s.imo}-001`,
        type: s.contract,
        startDate: '08 Apr 2023',
        endDate: '07 Apr 2028',
        paysRate: '80% of verified savings',
        guaranteeFloor: s.guarantee,
        nextInvoiceDate: s.nextInvoice,
        voyagesReady: s.voyagesReady,
        dataTrust: s.contractTrust
      },
      voyage: isProspect ? null : {
        voyageId: `VY-${s.imo}-${Math.floor(1000 + Math.random() * 9000)}`,
        source: 'live_ship',
        departure: s.voyage.split(' → ')[0],
        destination: s.voyage.split(' → ')[1],
        eta: '14:30 UTC',
        distanceRemaining: [1800, 4200, 2200, 3500, 900, 3100, 2800, 1500, 2600, 1100][s.id - 1] + ' nm',
        speed: [11.5, 12.8, 11.2, 12.5, 14.2, 13.0, 12.1, 11.8, 13.5, 15.0][s.id - 1] + ' kt'
      },
      performanceMetrics: hasRig ? {
        avgThrust: [128, 156, 134, 162, 118, 148, 142, 130, 150, 124][s.id - 1] + ' kN',
        peakPower: [420, 510, 450, 530, 390, 480, 470, 430, 500, 410][s.id - 1] + ' kW',
        powerContribution: [12.4, 14.2, 11.8, 15.1, 10.9, 13.6, 13.2, 12.1, 14.5, 11.2][s.id - 1] + '%',
        loadBandHours: [1240, 1980, 0, 1520, 1890, 980, 2450, 1180, 45, 95][s.id - 1],
        fuelFlow: [24.2, 31.5, 28.0, 26.1, 21.8, 30.2, 29.4, 25.5, 32.1, 22.4][s.id - 1] + ' t/d'
      } : null,
      cii: s.cii === '—' ? null : {
        currentRating: s.cii,
        targetRating: s.ciiTarget,
        operationalCarbonIntensity: [7.2, 6.1, 8.4, 6.8, 5.9, 6.5, 7.8, 6.9, 6.3, 7.1][s.id - 1] + ' g CO₂/t·nm',
        requiredAttained: [10.2, 8.9, 11.5, 9.8, 8.2, 9.2, 10.8, 9.6, 9.0, 9.9][s.id - 1] + ' g CO₂/t·nm',
        verifiedDataPct: s.compTrust === 'verified' ? '100%' : '34%'
      },
      cbm: hasRig ? {
        healthScore: healthScore,
        lastDiagnostic: s.status === 'grey' ? '18h ago' : '2 min ago',
        edgeEvaluated: true,
        openFaults: s.status === 'red' ? 1 : 0,
        rulSummary: s.status === 'red' ? 'HPU: 41 days' : 'All components > 12 months'
      } : null,
      events: isProspect ? null : {
        sensorReadings24h: [8400, 12400, 0, 9800, 11200, 13200, 14600, 8900, 0, 7200][s.id - 1],
        controlEvents24h: [12, 18, 0, 15, 14, 20, 22, 13, 0, 11][s.id - 1],
        diagnosticEvents24h: s.status === 'red' ? 3 : s.status === 'amber' ? 1 : 0,
        downtimeHours30d: [0, 2.5, 0, 0, 0.3, 0, 1.2, 0, 0, 0][s.id - 1]
      }
    };
    s.ops = makeOpsData(s, unitCount);
  });

  const statusVarMap = { green: '--status-green', amber: '--status-amber', red: '--status-red', blue: '--status-blue', cyan: '--status-cyan', grey: '--status-grey' };
  const statusColors = { green: '#10B981', amber: '#F59E0B', red: '#EF4444', blue: '#6366F1', cyan: '#06B6D4', grey: '#64748B' };
  function refreshStatusColors() {
    const style = getComputedStyle(document.body);
    Object.keys(statusVarMap).forEach(key => {
      statusColors[key] = style.getPropertyValue(statusVarMap[key]).trim() || statusColors[key];
    });
  }
  refreshStatusColors();
  const statusLabels = { green: 'Nominal', amber: 'Attention', red: 'Critical', blue: 'Prospect', cyan: 'Advice', grey: 'Offline' };
  const badgeHtml = { verified: '<span class="badge badge-verified">Verified</span>', provisional: '<span class="badge badge-provisional">Provisional</span>', nodata: '<span class="badge badge-disabled">No data</span>' };

  const DIRECTIONS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  function degToCompass(deg) { return DIRECTIONS[Math.round(deg / 22.5) % 16]; }
  function generateWeather(s) {
    const seed = Math.abs(Math.round((s.lat * 1000 + s.lon * 100 + s.id * 37) % 100000));
    const rng = mulberry32(seed);
    const windSpeed = Math.round(8 + rng() * 34);
    const windDirDeg = Math.round(rng() * 360);
    const windDir = degToCompass(windDirDeg);
    const seaState = windSpeed < 12 ? 'Calm' : windSpeed < 22 ? 'Slight' : windSpeed < 32 ? 'Moderate' : windSpeed < 42 ? 'Rough' : 'High';
    const icon = windSpeed > 35 ? 'storm' : windSpeed > 28 ? 'rain' : Math.abs(s.lat) > 60 ? 'snow' : rng() > 0.5 ? 'cloudy' : 'sunny';
    const alert = windSpeed >= 34 || seaState === 'High';
    return { windSpeed, windDirDeg, windDir, seaState, icon, alert };
  }
  ships.forEach(s => { s.weather = generateWeather(s); });

  const WEATHER_ICONS = {
    sunny: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    cloudy: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"><path d="M17.5 19a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.2 8.6 4 4 0 0 0 6.5 19h11z"/></svg>',
    rain: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--weather-wind)" stroke-width="2" stroke-linecap="round"><path d="M17.5 15a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.2 4.6 4 4 0 0 0 6.5 15h11z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></svg>',
    storm: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--weather-rough)" stroke-width="2" stroke-linecap="round"><path d="M17.5 13a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.2 2.6 4 4 0 0 0 6.5 13h11z"/><path d="M12 12l-2 5h3l-2 5"/></svg>',
    snow: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M4 6l16 12M20 6L4 18M8 4l4 3 4-3M8 20l4-3 4 3"/></svg>'
  };
  function weatherIcon(key) { return WEATHER_ICONS[key] || WEATHER_ICONS.cloudy; }

  const windArrowSVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="22" x2="12" y2="2"/><polyline points="5 9 12 2 19 9"/></svg>`;
  let weatherLayerVisible = false;
  let windLayerMarkers = [];
  function toggleWeatherLayer() {
    weatherLayerVisible = !weatherLayerVisible;
    const btn = document.getElementById('weatherToggle');
    if (btn) { btn.textContent = weatherLayerVisible ? 'Hide wind layer' : 'Show wind layer'; btn.classList.toggle('active', weatherLayerVisible); }
    windLayerMarkers.forEach(m => map.removeLayer(m));
    windLayerMarkers = [];
    if (weatherLayerVisible) {
      ships.forEach(s => {
        const marker = L.marker([s.lat, s.lon], {
          icon: L.divIcon({
            className: 'weather-overlay-marker',
            html: `<div class="wind-arrow" style="transform:rotate(${s.weather.windDirDeg}deg);">${windArrowSVG}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(map);
        windLayerMarkers.push(marker);
      });
    }
  }
  const KPI_ICONS = {
    fuel: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.7s6 6.6 6 11.3a6 6 0 1 1-12 0C6 9.3 12 2.7 12 2.7z"/></svg>',
    co2: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21c0-9 5-14 14-14 0 9-5 14-14 14z"/><path d="M5 21c3.5-6.5 7.5-9.5 11-11"/></svg>',
    power: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
    saving: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/></svg>'
  };
  let prevKpiValues = null;
  function animateKpiValue(el, from, to, fmt, duration) {
    if (from === to || !isFinite(from) || !isFinite(to)) { el.textContent = fmt(to); return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function renderFleetSummary() {
    const filtered = isFilterActive();
    const set = filtered ? applyFilters(ships) : ships;
    const totalFuel = set.reduce((sum, s) => sum + (s.fuelSaved || 0), 0);
    const totalCo2 = set.reduce((sum, s) => sum + (s.co2Saved || 0), 0);
    const totalPower = set.reduce((sum, s) => sum + (s.currentPower || 0), 0);
    const savingsVals = set.map(s => s.savings).filter(v => v && v !== '—' && !isNaN(parseFloat(v))).map(v => parseFloat(v));
    const avgSaving = savingsVals.length ? savingsVals.reduce((a, b) => a + b, 0) / savingsVals.length : 0;
    const next = { fuel: totalFuel, co2: totalCo2, power: totalPower, saving: avgSaving };
    const prev = prevKpiValues || { fuel: 0, co2: 0, power: 0, saving: 0 };
    prevKpiValues = next;
    const kpi = (key, label, emphasis) => `
      <div class="kpi-card${emphasis ? ' kpi-emphasis' : ''}">
        <div class="kpi-head"><span class="kpi-icon">${KPI_ICONS[key]}</span><span class="kpi-label">${label}</span></div>
        <div class="kpi-value" data-kpi="${key}"></div>
      </div>`;
    const roleKpiOrder = {
      all: ['fuel', 'co2', 'power', 'saving'],
      service: ['power', 'saving', 'fuel', 'co2'],
      tech: ['co2', 'saving', 'fuel', 'power'],
      commercial: ['fuel', 'saving', 'co2', 'power'],
      owner: ['fuel', 'saving', 'co2', 'power']
    }[typeof currentRole !== 'undefined' ? currentRole : 'all'] || ['fuel', 'co2', 'power', 'saving'];
    const kpiLabels = { fuel: 'Fuel saved', co2: 'CO₂ saved', power: 'Power now', saving: 'Avg saving' };
    document.getElementById('statsBar').innerHTML = `
      <div class="stats-title">Fleet performance${filtered ? ' <span class="kpi-filtered-note">· filtered</span>' : ''}</div>
      ${roleKpiOrder.map((k, i) => kpi(k, kpiLabels[k], i === 0)).join('')}
    `;
    const bar = document.getElementById('statsBar');
    animateKpiValue(bar.querySelector('[data-kpi="fuel"]'), prev.fuel, next.fuel, v => v.toFixed(1) + ' t', 350);
    animateKpiValue(bar.querySelector('[data-kpi="co2"]'), prev.co2, next.co2, v => Math.round(v).toLocaleString() + ' t', 350);
    animateKpiValue(bar.querySelector('[data-kpi="power"]'), prev.power, next.power, v => Math.round(v).toLocaleString() + ' kW', 350);
    animateKpiValue(bar.querySelector('[data-kpi="saving"]'), prev.saving, next.saving, v => (next.saving || savingsVals.length ? v.toFixed(1) + '%' : '—'), 350);
  }

  function renderHistoricalVoyages(s) {
    const el = document.getElementById('historicalVoyages');
    if (!el) return;
    const opsVoyages = s.ops && s.ops.historicalVoyages ? s.ops.historicalVoyages : null;
    if (opsVoyages && opsVoyages.length) {
      el.innerHTML = opsVoyages.map(v => `
        <div class="historic-route-row">
          <div class="historic-route-route">${v.route} ${badgeHtml[v.trust] || ''}</div>
          <div class="historic-route-stats">
            <span class="mono">${v.date} · ${v.days} days</span>
            <span class="historic-route-saved mono">${v.savingsPct !== null ? v.savingsPct + '% saving' : 'no data'}${v.baselineTd ? ` · ${v.actualTd} vs ${v.baselineTd} t/d baseline` : ''}</span>
          </div>
        </div>
      `).join('');
      return;
    }
    if (!s.details || !s.details.historicalVoyages || s.details.historicalVoyages.length === 0) {
      el.innerHTML = '<div class="historic-route-placeholder">No recent voyage history.</div>';
      return;
    }
    const rows = s.details.historicalVoyages.map(v => `
      <div class="historic-route-row">
        <div class="historic-route-route">${v.route}</div>
        <div class="historic-route-stats">
          <span>${v.departureDate} → ${v.etaDate}</span>
          <span class="historic-route-saved">${v.fuelSavedTonnes.toFixed(1)} t fuel · ${v.co2SavedTonnes.toFixed(0)} t CO₂ saved</span>
        </div>
      </div>
    `).join('');
    el.innerHTML = rows;
  }

  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }

  function toRad(deg) { return deg * Math.PI / 180; }
  function toDeg(rad) { return rad * 180 / Math.PI; }
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function greatCirclePoint(lat1, lon1, lat2, lon2, f) {
    const lat1r = toRad(lat1), lon1r = toRad(lon1), lat2r = toRad(lat2), lon2r = toRad(lon2);
    const d = Math.acos(Math.sin(lat1r) * Math.sin(lat2r) + Math.cos(lat1r) * Math.cos(lat2r) * Math.cos(lon2r - lon1r));
    if (Math.abs(d) < 1e-10) return [lat1, lon1];
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1r) * Math.cos(lon1r) + B * Math.cos(lat2r) * Math.cos(lon2r);
    const y = A * Math.cos(lat1r) * Math.sin(lon1r) + B * Math.cos(lat2r) * Math.sin(lon2r);
    const z = A * Math.sin(lat1r) + B * Math.sin(lat2r);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lon = toDeg(Math.atan2(y, x));
    return [lat, lon];
  }
  function bearing(lat1, lon1, lat2, lon2) {
    const lat1r = toRad(lat1), lat2r = toRad(lat2), dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(lat2r);
    const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  function extractPorts(voyageString) {
    if (!voyageString || typeof voyageString !== 'string') return null;
    const m = voyageString.match(/([A-Za-z\s]+)\s*\u2192\s*([A-Za-z\s]+)/);
    if (!m) return null;
    return [m[1].trim().replace(/^Last:\s*/i, ''), m[2].trim()];
  }
  function normalizePort(name) {
    return name.toLowerCase().replace(/[^a-z]/g, '');
  }
  function portHash(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
    return Math.abs(h);
  }
  function generateFallbackPort(name, role) {
    const h = portHash(name);
    const baseLat = (h % 140) - 70;
    const baseLon = ((h >> 8) % 360) - 180;
    const jitter = 6;
    return [baseLat + (role === 'departure' ? -jitter : jitter), baseLon + ((h >> 16) % jitter * 2 - jitter)];
  }

  const PORT_COORDINATES = {
    'liverpool': [53.4, -3.0],
    'baltimore': [39.3, -76.6],
    'shanghai': [31.2, 121.5],
    'longbeach': [33.7, -118.2],
    'capetown': [-33.9, 18.4],
    'singapore': [1.3, 103.8],
    'algeciras': [36.1, -5.5],
    'genoa': [44.4, 8.9],
    'mombasa': [-4.1, 39.6],
    'rotterdam': [51.9, 4.1],
    'fujairah': [25.1, 56.3],
    'hamburg': [53.5, 9.9],
    'colombo': [6.9, 79.9],
    'reykjavik': [64.1, -21.9],
    'halifax': [44.6, -63.6]
  };
  function lookupPortCoords(name) {
    const key = normalizePort(name);
    if (PORT_COORDINATES[key]) return PORT_COORDINATES[key];
    return null;
  }

  function setRouteLoading(loading) {
    const card = document.querySelector('#lens-optimise .card');
    if (card) card.classList.toggle('route-loading', loading);
    const routeName = document.getElementById('routeName');
    if (loading) {
      routeName.textContent = 'Fetching live route…';
      document.getElementById('routeDistance').textContent = '—';
      document.getElementById('routeEta').textContent = '—';
      document.getElementById('routeSpeed').textContent = '—';
      document.getElementById('routeStatus').textContent = '—';
      document.getElementById('routeType').textContent = 'Loading…';
    }
  }

  function generateRoute(s) {
    const voyage = s.details && s.details.voyage;
    let ports = voyage ? [voyage.departure, voyage.destination] : extractPorts(s.voyage);
    if (!ports) ports = ['Predicted start', 'Predicted end'];
    const departure = ports[0] || 'Start';
    const destination = ports[1] || 'End';
    const staticKey = `${departure}->${destination}`;
    const staticPoints = STATIC_ROUTES[staticKey];

    let start, end, points;
    if (staticPoints) {
      points = staticPoints.slice();
      start = points[0].slice();
      end = points[points.length - 1].slice();
    } else {
      start = lookupPortCoords(departure) || generateFallbackPort(departure, 'departure');
      end = lookupPortCoords(destination) || generateFallbackPort(destination, 'destination');
      const waypoints = 8 + Math.floor((s.id * 73) % 8);
      points = [];
      for (let i = 0; i <= waypoints; i++) {
        const f = i / waypoints;
        const [lat, lon] = greatCirclePoint(start[0], start[1], end[0], end[1], f);
        const curve = Math.sin(f * Math.PI) * ((s.id % 2 === 0 ? 1 : -1) * (2 + (s.id % 5) * 0.5));
        const brg = bearing(start[0], start[1], end[0], end[1]);
        const offsetLat = curve * Math.cos(toRad(brg + 90)) / 111;
        const offsetLon = curve * Math.sin(toRad(brg + 90)) / (111 * Math.cos(toRad(lat)));
        points.push([lat + offsetLat, lon + offsetLon]);
      }
    }

    const shipPos = [s.lat, s.lon];
    let inserted = false;
    if (s.sailing) {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < points.length - 1; i++) {
        const d = haversineDistance(points[i][0], points[i][1], shipPos[0], shipPos[1]) +
                  haversineDistance(shipPos[0], shipPos[1], points[i + 1][0], points[i + 1][1]) -
                  haversineDistance(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      if (bestIdx >= 0) { points.splice(bestIdx + 1, 0, shipPos); inserted = true; }
    }

    let totalDistanceNm = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistanceNm += haversineDistance(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]) / 1.852;
    }
    const speedKts = voyage ? parseFloat(voyage.speed) || 12 : 12;
    const hours = totalDistanceNm / speedKts;
    const eta = voyage ? voyage.eta : `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h`;
    const routeType = s.status === 'blue' ? 'predicted' : s.perfTrust === 'provisional' ? 'provisional' : 'verified-recent';
    return {
      type: routeType,
      points,
      departure,
      destination,
      start,
      end,
      shipInserted: inserted,
      distanceNm: Math.round(totalDistanceNm),
      eta,
      speed: speedKts + ' kt'
    };
  }
  ships.forEach(s => { s.route = generateRoute(s); });

  const shipSVGs = {
    default: `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.55)"/></filter>
      </defs>
      <circle cx="22" cy="22" r="20" fill="rgba(0,0,0,0.42)" stroke="currentColor" stroke-width="2.5" opacity="0.95"/>
      <line x1="22" y1="22" x2="22" y2="2" stroke="currentColor" stroke-width="2" opacity="0.9"/>
      <path d="M22 3 L19 9 L25 9 Z" fill="currentColor"/>
      <path d="M22 8 L19.8 13.5 L18.5 20 L18.5 29 Q18.5 33.5 22 33.5 Q25.5 33.5 25.5 29 L25.5 20 L24.2 13.5 Z" fill="white" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
      <rect x="20.2" y="25" width="3.6" height="3.4" fill="currentColor" rx="0.5"/>
      <line x1="20" y1="21" x2="24" y2="21" stroke="currentColor" stroke-width="1.2"/>
    </svg>`
  };

  // Single-world map: lock panning/zoom so users never see duplicated ship markers
  // or routes across the antimeridian/world copies.
  const map = L.map('map', {
    center: [20, 10],
    zoom: 3,
    zoomControl: false,
    minZoom: 2,
    maxBounds: [[-85, -1080], [85, 1080]],
    maxBoundsViscosity: 1.0,
    worldCopyJump: true
  });
  // minZoom formula: world width (256*2^z) must cover the container, or wrapped tiles show duplicate worlds.
  function applyMinZoom() {
    const w = map.getContainer().clientWidth;
    if (!w) return;
    const z = Math.max(2, Math.ceil(Math.log2(w / 256)));
    if (z !== map.getMinZoom()) {
      map.setMinZoom(z);
      if (map.getZoom() < z) map.setView(map.getCenter(), z, { animate: false });
    }
  }
  requestAnimationFrame(() => { map.invalidateSize(); applyMinZoom(); });
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { map.invalidateSize(); applyMinZoom(); }, 150);
  });
  let currentTileLayer = null;
  function refreshTileLayer() {
    const isLight = document.body.classList.contains('light-mode');
    const url = isLight
      ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    if (currentTileLayer) map.removeLayer(currentTileLayer);
    currentTileLayer = L.tileLayer(url, { attribution: '&copy; CARTO' }).addTo(map);
  }
  refreshTileLayer();
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  function shipIcon(s, state, filterDim) {
    const colour = statusColors[s.status];
    const pulse = (s.status === 'red' || s.status === 'cyan') ? 'pulse' : '';
    const glow = (s.status === 'red' || s.status === 'cyan') ? 'filter: url(#glow);' : '';
    const scale = state === 'selected' ? 'scale(1.35)' : 'scale(1)';
    const dim = state === 'dimmed' ? 'filter: grayscale(1) opacity(0.35);' : '';
    const z = state === 'selected' ? 'z-index: 1000;' : '';
    return L.divIcon({
      html: `<div class="${pulse}" style="width:44px;height:44px;transform:rotate(${s.heading}deg) ${scale};color:${colour};${glow}${dim}${z}">${shipSVGs.default}</div><div class="ship-marker-label">${s.name.replace(/^MV\s+/, '')}</div>`,
      iconSize: [44, 44], className: 'ship-marker' + (filterDim ? ' marker-dim' : ''), iconAnchor: [22, 22]
    });
  }

  const markers = [];
  ships.forEach(s => {
    const marker = L.marker([s.lat, s.lon], { icon: shipIcon(s) });
    marker.ship = s;
    marker.bindTooltip(`<b>${s.name}</b><br>${s.type}<br>${statusLabels[s.status]}<br><span class="weather-tooltip">${weatherIcon(s.weather.icon)} ${s.weather.windSpeed} kt ${s.weather.windDir}</span>`, { permanent: false, direction: 'top', className: 'ship-tooltip' });
    marker.on('click', (e) => { L.DomEvent.stopPropagation(e); openShip(s); });
    marker.on('mouseover', () => syncRowHover(s.id, true));
    marker.on('mouseout', () => syncRowHover(s.id, false));
    marker.addTo(map);
    markers.push(marker);
  });

  // Shared selection state (declared before route context so initial render can read selectedShip safely)
  let selectedShip = null;
  let routeLayers = [];
  let routeMarkers = [];

  // Filter state (declared before route context because renderRouteContext calls applyFilters)
  function emptyFilterState() {
    return { search: '', statuses: [], types: [], bands: [], contracts: [], trusts: [], alerts: [] };
  }
  let filterState = emptyFilterState();
  // Role state (declared early because renderFleetSummary reads it during initial view setup)
  let currentRole = localStorage.getItem('fastFleet_role') || 'all';

  // Triple-offset unwrapped routes: continuous across the dateline; dynamic minZoom guarantees only one copy is ever in view.
  function unwrapRoute(points) {
    if (!points || points.length < 2) return points || [];
    let offset = 0;
    const out = [[points[0][0], points[0][1]]];
    for (let i = 1; i < points.length; i++) {
      const lat = points[i][0], lon = points[i][1];
      const rawDelta = lon - (out[i - 1][1] - offset);
      if (rawDelta > 180) offset -= 360;
      else if (rawDelta < -180) offset += 360;
      out.push([lat, lon + offset]);
    }
    return out;
  }
  function addWrappedPolylines(points, options) {
    const un = unwrapRoute(points);
    return [-360, 0, 360].map(dx =>
      L.polyline(un.map(([lat, lon]) => [lat, lon + dx]), options).addTo(map)
    );
  }

  // Route context: all active voyages drawn faintly; dimmed when filtered out or another ship is selected
  const contextRoutes = new Map(); // ship.id -> L.polyline
  function renderRouteContext() {
    const activeIds = new Set(applyFilters(ships).map(s => s.id));
    const hasSelection = !!selectedShip;
    ships.forEach(s => {
      const ports = extractPorts(s.voyage);
      const key = ports ? ports.join('->') : null;
      const pts = key ? STATIC_ROUTES[key] : null;
      if (!pts) {
        if (contextRoutes.has(s.id)) { map.removeLayer(contextRoutes.get(s.id)); contextRoutes.delete(s.id); }
        return;
      }
      const isMatch = activeIds.has(s.id);
      const isSelected = hasSelection && selectedShip.id === s.id;
      const isDimmed = hasSelection && !isSelected; // another ship selected
      const isFilteredOut = !isMatch;
      const isLight = document.body.classList.contains('light-mode');
      const baseColor = isLight ? 'rgba(2,132,199,1)' : 'rgba(56,189,248,1)'; // --weather-wind solid
      const dimColor = isLight ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.22)';
      const offColor = isLight ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.08)';
      let color, opacity, weight, dashArray;
      if (isSelected) {
        // strong accent when this ship is selected; showRoutes overlay will paint the status route anyway,
        // but keep context line visible underneath at medium weight so the network is readable
        color = baseColor; opacity = 0.55; weight = 2.5; dashArray = '4 6';
      } else if (isDimmed || isFilteredOut) {
        color = isFilteredOut ? offColor : dimColor; opacity = 1; weight = 1.5; dashArray = '3 5';
      } else {
        color = baseColor; opacity = 0.45; weight = 2; dashArray = '4 6';
      }
      const existing = contextRoutes.get(s.id);
      if (existing) existing.forEach(l => map.removeLayer(l));
      contextRoutes.set(s.id, addWrappedPolylines(pts, { color, weight, opacity, dashArray, interactive: false }));
    });
    // remove any stale routes
    for (const [id, lines] of contextRoutes) {
      if (!ships.some(s => s.id === id)) { lines.forEach(l => map.removeLayer(l)); contextRoutes.delete(id); }
    }
  }
  renderRouteContext();

  // First-run affordance: pulse the Wizards dropdown until it's opened once
  if (!localStorage.getItem('zevi.wizardsSeen')) { const ws = document.getElementById('wizardSelect'); if (ws) ws.classList.add('pulse-attention'); }

  // ===== View modes: map | list (list replaces the canvas, Leaflet state preserved) =====
  let viewMode = 'map';
  function defaultViewMode() { return window.innerWidth <= 768 ? 'list' : 'map'; }
  function setViewMode(mode, skipHash) {
    viewMode = mode === 'list' ? 'list' : 'map';
    localStorage.setItem('zevi.viewMode', viewMode);
    document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewMode));
    const isList = viewMode === 'list';
    document.getElementById('listView').style.display = isList ? 'flex' : 'none';
    document.getElementById('map').style.visibility = isList ? 'hidden' : 'visible';
    const windBtn = document.getElementById('weatherToggle');
    if (windBtn) windBtn.style.display = isList ? 'none' : '';
    if (!isList) map.invalidateSize();
    refreshFleetViews(skipHash);
  }

  // ===== Unified filter system (single filterState + applyFilters for list, markers, table, KPIs) =====
  const STATUS_LIST = ['green', 'amber', 'red', 'blue', 'cyan', 'grey'];
  const DWT_BAND_LIST = ['<10k', '10k–50k', '50k–80k', '80k–120k', '120k–200k', '>200k'];
  const CONTRACT_LIST = ['PAYS', 'Lease', 'Prospect'];
  const TRUST_LIST = [['verified', 'Verified'], ['provisional', 'Provisional'], ['nodata', 'No data']];
  const ALERT_LIST = [['any', 'Any'], ['critical', 'Critical'], ['route', 'Route advice'], ['none', 'None']];

  function getAlertType(s) {
    if (s.status === 'red') return 'Critical';
    if (s.status === 'amber') return 'Attention';
    if (s.status === 'cyan') return 'Route Update';
    if (s.status === 'grey') return 'Offline';
    return 'No alert';
  }

  function isFilterActive() {
    return !!(filterState.search || filterState.statuses.length || filterState.types.length || filterState.bands.length || filterState.contracts.length || filterState.trusts.length || filterState.alerts.length);
  }
  function applyFilters(list) {
    return list.filter(s => {
      if (filterState.search) {
        const q = filterState.search.toLowerCase();
        if (!((s.name || '').toLowerCase().includes(q) || String(s.imo || '').includes(q))) return false;
      }
      if (filterState.statuses.length && !filterState.statuses.includes(s.status)) return false;
      if (filterState.types.length && !filterState.types.includes(s.type)) return false;
      if (filterState.bands.length && !filterState.bands.includes(s.dwtBand || '—')) return false;
      if (filterState.contracts.length && !filterState.contracts.includes(s.contract)) return false;
      if (filterState.trusts.length && !filterState.trusts.includes(s.perfTrust || 'nodata')) return false;
      if (filterState.alerts.length) {
        const at = getAlertType(s);
        const hit = filterState.alerts.some(a =>
          a === 'any' ? at !== 'No alert' :
          a === 'critical' ? at === 'Critical' :
          a === 'route' ? at === 'Route Update' :
          a === 'none' ? at === 'No alert' : false);
        if (!hit) return false;
      }
      return true;
    });
  }
  function toggleFilterValue(group, value) {
    const arr = filterState[group];
    if (!arr) return;
    const i = arr.indexOf(value);
    if (i >= 0) arr.splice(i, 1); else arr.push(value);
    refreshFleetViews();
  }
  function removeFilterChip(group, value) {
    if (group === 'search') {
      filterState.search = '';
      document.getElementById('nameFilter').value = '';
    } else if (filterState[group]) {
      filterState[group] = filterState[group].filter(v => v !== value);
    }
    refreshFleetViews();
  }
  function clearAllFilters() {
    filterState = emptyFilterState();
    document.getElementById('nameFilter').value = '';
    refreshFleetViews();
  }
  function toggleFiltersSection() {
    const body = document.getElementById('filtersBody');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    document.getElementById('filterChevron').textContent = open ? '▸' : '▾';
  }

  function updateMarkerStyles() {
    const ids = new Set(applyFilters(ships).map(s => s.id));
    markers.forEach(m => {
      const state = selectedShip ? (m.ship.id === selectedShip.id ? 'selected' : 'dimmed') : null;
      m.setIcon(shipIcon(m.ship, state, !ids.has(m.ship.id)));
    });
    renderRouteContext();
  }
  function updateMarkers() {
    // All markers stay on the map; non-matching vessels are dimmed via CSS class.
    markers.forEach(m => { if (!map.hasLayer(m)) m.addTo(map); });
    updateMarkerStyles();
  }
  // Filter pill groups (status pills use status triplets; others are plain pills)
  function renderFilterControls() {
    const pill = (group, value, label, mono) =>
      `<span class="filter-pill ${filterState[group].includes(value) ? 'active' : ''} ${mono ? 'mono' : ''}" onclick="toggleFilterValue('${group}', '${value}')">${label}</span>`;
    document.getElementById('filterStatus').innerHTML = STATUS_LIST.map(st =>
      `<span class="status-pill ${st} ${filterState.statuses.includes(st) ? '' : 'pill-off'}" onclick="toggleFilterValue('statuses', '${st}')">${statusLabels[st]}</span>`).join('');
    document.getElementById('filterType').innerHTML = [...new Set(ships.map(s => s.type))].sort().map(t => pill('types', t, t)).join('');
    document.getElementById('filterBand').innerHTML = DWT_BAND_LIST.map(b => pill('bands', b, b, true)).join('');
    document.getElementById('filterContract').innerHTML = CONTRACT_LIST.map(c => pill('contracts', c, c)).join('');
    document.getElementById('filterTrust').innerHTML = TRUST_LIST.map(([v, label]) => pill('trusts', v, label)).join('');
    document.getElementById('filterAlerts').innerHTML = ALERT_LIST.map(([v, label]) => pill('alerts', v, label)).join('');
  }

  // Active filters as removable chips + clear all
  function renderFilterChips() {
    const chips = [];
    if (filterState.search) chips.push({ group: 'search', value: filterState.search, label: `“${filterState.search}”` });
    filterState.statuses.forEach(v => chips.push({ group: 'statuses', value: v, label: statusLabels[v] || v }));
    filterState.types.forEach(v => chips.push({ group: 'types', value: v, label: v }));
    filterState.bands.forEach(v => chips.push({ group: 'bands', value: v, label: v }));
    filterState.contracts.forEach(v => chips.push({ group: 'contracts', value: v, label: v }));
    filterState.trusts.forEach(v => chips.push({ group: 'trusts', value: v, label: (TRUST_LIST.find(t => t[0] === v) || [v, v])[1] }));
    filterState.alerts.forEach(v => chips.push({ group: 'alerts', value: v, label: (ALERT_LIST.find(t => t[0] === v) || [v, v])[1] }));
    const el = document.getElementById('filterChips');
    if (!chips.length) { el.innerHTML = ''; return; }
    el.innerHTML = chips.map(c =>
      `<span class="filter-chip">${c.label}<button class="filter-chip-x" onclick="removeFilterChip('${c.group}', '${c.value}')">×</button></span>`).join('') +
      `<button class="ghost-link filter-clear-all" onclick="clearAllFilters()">Clear all</button>`;
  }

  // Left-panel ship list: same selection behavior as a marker click, driven by applyFilters
  // Single refresh pipeline: every consumer of the fleet reads applyFilters
  function refreshFleetViews(skipHash) {
    renderFilterControls();
    renderFilterChips();
    const filtered = applyFilters(ships);
    document.getElementById('filterLiveCount').innerHTML = `<span class="mono">${filtered.length}</span> of <span class="mono">${ships.length}</span> vessels`;
    updateMarkers();
    renderFleetSummary();
    renderListView();
    if (!skipHash) updateHash();
  }

  // Saved filter presets (localStorage 'zevi.filterPresets')
  const PRESET_KEY = 'zevi.filterPresets';
  function getFilterPresets() {
    try { const p = JSON.parse(localStorage.getItem(PRESET_KEY)); return Array.isArray(p) ? p : null; } catch (e) { return null; }
  }
  function savePresetList(list) { localStorage.setItem(PRESET_KEY, JSON.stringify(list)); }
  function seedFilterPresets() {
    if (getFilterPresets() === null) {
      savePresetList([
        { name: 'Attention needed', filterState: Object.assign(emptyFilterState(), { statuses: ['red', 'amber'] }) },
        { name: 'Prospects', filterState: Object.assign(emptyFilterState(), { statuses: ['blue'] }) },
        { name: 'PAYS verified', filterState: Object.assign(emptyFilterState(), { contracts: ['PAYS'], trusts: ['verified'] }) }
      ]);
    }
  }
  function renderPresetSelect() {
    const presets = getFilterPresets() || [];
    document.getElementById('presetSelect').innerHTML =
      '<option value="">Load preset…</option>' + presets.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
  }
  function loadFilterPreset(name) {
    if (!name) return;
    const p = (getFilterPresets() || []).find(x => x.name === name);
    if (!p) return;
    filterState = Object.assign(emptyFilterState(), JSON.parse(JSON.stringify(p.filterState)));
    document.getElementById('nameFilter').value = filterState.search || '';
    refreshFleetViews();
  }
  function saveFilterPreset() {
    const name = prompt('Preset name:');
    if (!name) return;
    const presets = getFilterPresets() || [];
    const idx = presets.findIndex(x => x.name === name);
    const entry = { name, filterState: JSON.parse(JSON.stringify(filterState)) };
    if (idx >= 0) presets[idx] = entry; else presets.push(entry);
    savePresetList(presets);
    renderPresetSelect();
    document.getElementById('presetSelect').value = name;
  }
  function deleteFilterPreset() {
    const name = document.getElementById('presetSelect').value;
    if (!name) return;
    savePresetList((getFilterPresets() || []).filter(x => x.name !== name));
    renderPresetSelect();
  }

  // URL-hash sharing: #view=list&status=red,amber&type=Container&...
  function updateHash() {
    const parts = ['view=' + viewMode];
    if (filterState.search) parts.push('q=' + encodeURIComponent(filterState.search));
    if (filterState.statuses.length) parts.push('status=' + filterState.statuses.join(','));
    if (filterState.types.length) parts.push('type=' + filterState.types.map(encodeURIComponent).join(','));
    if (filterState.bands.length) parts.push('band=' + filterState.bands.map(encodeURIComponent).join(','));
    if (filterState.contracts.length) parts.push('contract=' + filterState.contracts.map(encodeURIComponent).join(','));
    if (filterState.trusts.length) parts.push('trust=' + filterState.trusts.join(','));
    if (filterState.alerts.length) parts.push('alerts=' + filterState.alerts.join(','));
    history.replaceState(null, '', location.pathname + location.search + '#' + parts.join('&'));
  }
  function applyHash() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return null;
    const params = {};
    h.split('&').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx > 0) params[pair.slice(0, idx)] = decodeURIComponent(pair.slice(idx + 1));
    });
    const list = (key, valid) => (params[key] ? params[key].split(',').filter(v => !valid || valid.includes(v)) : []);
    filterState.search = params.q || '';
    filterState.statuses = list('status', STATUS_LIST);
    filterState.types = list('type');
    filterState.bands = list('band', DWT_BAND_LIST);
    filterState.contracts = list('contract', CONTRACT_LIST);
    filterState.trusts = list('trust', ['verified', 'provisional', 'nodata']);
    filterState.alerts = list('alerts', ['any', 'critical', 'route', 'none']);
    document.getElementById('nameFilter').value = filterState.search;
    return params.view === 'list' || params.view === 'map' ? params.view : null;
  }

  // ===== List view (sortable table; row click = marker-click selection) =====
  const LIST_COLS = [
    { key: 'name', label: 'Name', hideable: false },
    { key: 'type', label: 'Type', hideable: false },
    { key: 'dwt', label: 'DWT', hideable: true },
    { key: 'dwtBand', label: 'DWT band', hideable: true },
    { key: 'status', label: 'Status', hideable: false },
    { key: 'savings', label: 'Savings', hideable: false },
    { key: 'trust', label: 'Trust', hideable: false },
    { key: 'payback', label: 'Payback', hideable: true },
    { key: 'npv', label: 'NPV 10yr', hideable: true },
    { key: 'voyage', label: 'Voyage', hideable: true },
    { key: 'contract', label: 'Contract', hideable: true }
  ];
  let listSort = { key: 'name', dir: 1 };
  let listCols = { dwt: true, dwtBand: true, payback: true, npv: true, voyage: true, contract: true };
  try { Object.assign(listCols, JSON.parse(localStorage.getItem('zevi.listCols') || '{}')); } catch (e) {}
  function sortListBy(key) {
    if (listSort.key === key) listSort.dir *= -1;
    else listSort = { key, dir: 1 };
    renderListView();
  }
  function listSortValue(s) {
    switch (listSort.key) {
      case 'name': return (s.name || '').toLowerCase();
      case 'type': return (s.type || '').toLowerCase();
      case 'dwt': return s.dwt !== null && s.dwt !== undefined ? s.dwt : -Infinity;
      case 'dwtBand': return s.dwtBand || '';
      case 'status': return s.status || '';
      case 'savings': return s.savings && s.savings !== '—' ? parseFloat(s.savings) : -Infinity;
      case 'trust': return s.perfTrust || '';
      case 'payback': return s.ops && s.ops.report && s.ops.report.paybackYears !== null ? s.ops.report.paybackYears : Infinity;
      case 'npv': return s.ops && s.ops.report && s.ops.report.npv10 !== null ? s.ops.report.npv10 : -Infinity;
      case 'voyage': return (s.voyage || '').toLowerCase();
      case 'contract': return s.contract || '';
      default: return '';
    }
  }
  function currentListRows() {
    return applyFilters(ships).slice().sort((a, b) => {
      const va = listSortValue(a), vb = listSortValue(b);
      if (va < vb) return -1 * listSort.dir;
      if (va > vb) return 1 * listSort.dir;
      return 0;
    });
  }
  function listCellHtml(s, key) {
    switch (key) {
      case 'name': return `<td>${s.name}</td>`;
      case 'type': return `<td>${s.type}</td>`;
      case 'dwt': return `<td class="mono">${s.dwt !== null && s.dwt !== undefined ? s.dwt.toLocaleString() : '—'}</td>`;
      case 'dwtBand': return `<td class="mono">${s.dwtBand || '—'}</td>`;
      case 'status': return `<td><span class="status-pill ${s.status}">${statusLabels[s.status] || s.status}</span></td>`;
      case 'savings': return `<td class="mono">${s.savings || '—'}</td>`;
      case 'trust': return `<td>${badgeHtml[s.perfTrust] || badgeHtml.nodata}</td>`;
      case 'payback': return `<td class="mono">${s.ops && s.ops.report && s.ops.report.paybackYears ? s.ops.report.paybackYears + ' yr' : '—'}</td>`;
      case 'npv': return `<td class="mono">${s.ops && s.ops.report && s.ops.report.npv10 ? '£' + (s.ops.report.npv10 / 1e6).toFixed(2) + 'M' : '—'}</td>`;
      case 'voyage': return `<td>${s.voyage || '—'}</td>`;
      case 'contract': return `<td>${s.contract || '—'}</td>`;
      default: return '<td>—</td>';
    }
  }
  function renderListView() {
    if (viewMode !== 'list') return;
    const rows = currentListRows();
    const vals = rows.map(s => s.savings).filter(v => v && v !== '—' && !isNaN(parseFloat(v))).map(v => parseFloat(v));
    const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) + '%' : '—';
    const withAlerts = rows.filter(s => getAlertType(s) !== 'No alert').length;
    document.getElementById('listSummary').innerHTML =
      `<span class="mono">${rows.length}</span> vessels · avg saving <span class="mono">${avg}</span> · <span class="mono">${withAlerts}</span> with alerts`;
    document.getElementById('listEmpty').style.display = rows.length ? 'none' : 'block';
    document.getElementById('listTableWrap').style.display = rows.length ? '' : 'none';
    const visibleCols = LIST_COLS.filter(c => !c.hideable || listCols[c.key] !== false);
    const arrow = k => listSort.key === k ? (listSort.dir === 1 ? ' ▲' : ' ▼') : '';
    document.getElementById('listTable').innerHTML = `
      <thead><tr>${visibleCols.map(c => `<th onclick="sortListBy('${c.key}')">${c.label}${arrow(c.key)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(s => `
        <tr data-ship-id="${s.id}" onclick="openShipById(${s.id})" onmouseenter="syncMarkerHover(${s.id}, true)" onmouseleave="syncMarkerHover(${s.id}, false)">
          ${visibleCols.map(c => listCellHtml(s, c.key)).join('')}
        </tr>`).join('')}</tbody>`;
  }

  // Column show/hide (persisted)
  function toggleColumnMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('columnMenu');
    if (menu.style.display === 'block') { menu.style.display = 'none'; return; }
    menu.innerHTML = LIST_COLS.filter(c => c.hideable).map(c =>
      `<label class="column-menu-item"><input type="checkbox" ${listCols[c.key] !== false ? 'checked' : ''} onchange="setListColumn('${c.key}', this.checked)"> ${c.label}</label>`).join('');
    menu.style.display = 'block';
    setTimeout(() => document.addEventListener('click', closeColumnMenuOnOutside), 0);
  }
  function closeColumnMenuOnOutside(e) {
    const menu = document.getElementById('columnMenu');
    if (!menu.contains(e.target)) {
      menu.style.display = 'none';
      document.removeEventListener('click', closeColumnMenuOnOutside);
    }
  }
  function setListColumn(key, visible) {
    listCols[key] = visible;
    localStorage.setItem('zevi.listCols', JSON.stringify(listCols));
    renderListView();
  }

  // CSV export: current filtered + sorted rows, UTF-8 BOM for Excel
  function exportFleetCsv() {
    const trustLabel = t => t === 'verified' ? 'Verified' : t === 'provisional' ? 'Provisional' : 'No data';
    const esc = v => {
      v = v === null || v === undefined ? '' : String(v);
      return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const lines = [['name', 'imo', 'type', 'dwt', 'dwtBand', 'status', 'savings', 'trust', 'voyage', 'contract'].join(',')];
    currentListRows().forEach(s => {
      lines.push([
        s.name, s.imo, s.type, s.dwt !== null && s.dwt !== undefined ? s.dwt : '', s.dwtBand || '—',
        statusLabels[s.status] || s.status, s.savings || '—', trustLabel(s.perfTrust), s.voyage || '', s.contract || ''
      ].map(esc).join(','));
    });
    const now = new Date();
    const stamp = '' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fast-fleet-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // Row <-> marker hover sync
  function syncMarkerHover(id, on) {
    const m = markers.find(m => m.ship.id === id);
    const el = m && m.getElement ? m.getElement() : null;
    if (el) el.classList.toggle('marker-sync', on);
  }
  function syncRowHover(id, on) {
    const row = document.querySelector(`#listTable tr[data-ship-id="${id}"]`);
    if (row) row.classList.toggle('row-hover', on);
  }
  function openShipById(id) {
    const s = ships.find(x => x.id === id);
    if (s) openShip(s);
  }

  const themeToggle = document.getElementById('themeToggle');
  function updateThemeUI() {
    const isLight = document.body.classList.contains('light-mode');
    themeToggle.textContent = isLight ? '☀️' : '🌙';
    refreshStatusColors();
    refreshTileLayer();
    updateMarkerStyles();
    if (selectedShip && document.getElementById('lens-optimise').classList.contains('active')) {
      showRoutes(selectedShip);
    }
  }
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('fastFleetTheme', isLight ? 'light' : 'dark');
    updateThemeUI();
  });
  const savedTheme = localStorage.getItem('fastFleetTheme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
  }
  updateThemeUI();

  // Init filters (hash > localStorage > breakpoint default), then render everything once.
  seedFilterPresets();
  renderPresetSelect();
  const hashView = applyHash();
  document.getElementById('nameFilter').addEventListener('input', (e) => {
    filterState.search = e.target.value.trim();
    refreshFleetViews();
  });
  // Shared-link paste into an open tab: re-parse on hashchange (replaceState never fires this)
  window.addEventListener('hashchange', () => {
    const v = applyHash();
    if (v) setViewMode(v, true); else refreshFleetViews(true);
  });
  const storedView = localStorage.getItem('zevi.viewMode');
  const initialView = hashView || (storedView === 'list' || storedView === 'map' ? storedView : defaultViewMode());
  setViewMode(initialView, true);

  const tabTitles = {
    overview: 'Wind as a Service',
    performance: 'Performance',
    details: 'Ship details',
    fix: 'Condition & maintenance',
    commercial: 'Commercial',
    regs: 'Compliance',
    optimise: 'Route',
    scenarios: 'What-if planning'
  };

  function computeHeadline(s) {
    const role = document.getElementById('roleSelect').value;
    if (s.status === 'grey') return { text: 'No telemetry for 18 hours', status: 'grey', action: 'Investigate data gap', lens: 'fix' };
    if (s.status === 'blue') return { text: `Predicted ${s.savings} fuel saving on typical route`, status: 'blue', action: 'Build business case', lens: 'performance' };
    if ((role === 'tech' || role === 'owner') && s.status === 'amber' && s.cii !== '—') return { text: `CII rating ${s.cii} · target ${s.ciiTarget} · compliance at risk`, status: 'amber', action: 'Open Compliance', lens: 'regs' };
    if (role === 'commercial' && s.status === 'blue') return { text: `Predicted ${s.savings} saving · no contract in place`, status: 'blue', action: 'Build business case', lens: 'performance' };
    if (s.status === 'red') return { text: `${s.alert} · RUL ${s.alertData.rul}`, status: 'red', action: 'Create work order', lens: 'fix' };
    if (s.status === 'cyan') return { text: `Live route advice: ${s.alertData.action}`, status: 'cyan', action: 'Endorse recommendation', lens: 'optimise' };
    if (s.status === 'amber') return { text: `Savings ${s.savings} vs ${s.guarantee} guarantee · variance ${s.variance}`, status: 'amber', action: 'Investigate variance', lens: 'performance' };
    if (s.voyagesReady > 0 && (role === 'all' || role === 'commercial' || role === 'owner')) return { text: `${s.voyagesReady} voyage ready for PAYS invoicing · verified`, status: 'green', action: 'Preview invoice', lens: 'commercial' };
    return { text: `Savings ${s.savings} vs ${s.guarantee} guarantee · all systems nominal`, status: 'green', action: 'View performance', lens: 'performance' };
  }

  function sparkline(values, colourClass) {
    return `<div class="sparkline">${values.map(v => `<div class="sparkbar ${colourClass}" style="height:${v}%"></div>`).join('')}</div>`;
  }

  function renderPerformance(s) {
    const el = document.getElementById('performanceContent');
    if (!el) return;
    const o = s.ops || {};
    const calc = o.calculation || {};
    const rep = o.report || {};
    const pct = t => (t === null || t === undefined) ? '—' : t + '%';
    const td = v => (v === null || v === undefined) ? '—' : v + ' t/d';
    const money = n => (n === null || n === undefined || isNaN(n)) ? '—' : '£' + Math.round(n).toLocaleString();
    const trustBadge = badgeHtml[s.perfTrust] || badgeHtml.nodata;
    const reasonAttr = o.provisionalReason ? ` data-tooltip="${o.provisionalReason}"` : '';

    if (s.contract === 'Prospect') {
      el.innerHTML = `
        <div class="card">
          <div class="metric"><div class="metric-value green">${s.savings}</div><div class="metric-label">Predicted fuel saving <span class="tooltip"${reasonAttr}>${trustBadge}</span></div></div>
          <div class="metric"><div class="metric-value amber">±1.1%</div><div class="metric-label">95% confidence</div></div>
          <div class="mini-list-item"><span>Simulations</span><span class="mono">1,247</span></div>
          <div class="mini-list-item"><span>Baseline source</span><span class="mono">${calc.baselineSource || 'hindcast'}</span></div>
        </div>
        <div class="card">
          <div class="panel-title" style="margin-top:0">Savings distribution</div>
          <div style="height:52px;background:linear-gradient(90deg,var(--red),var(--amber),var(--green),var(--green));border-radius:var(--radius-sm);position:relative;margin:8px 0;">
            <div style="position:absolute;left:64%;top:0;bottom:0;width:2px;background:var(--text);"></div>
          </div>
          <div class="mini-list-item"><span>Mean</span><span class="mono green">${s.savings}</span></div>
          <div class="mini-list-item"><span>P10 / P90</span><span class="mono">4.2% / 8.1%</span></div>
        </div>
        <div class="alert alert-amber"><div class="alert-icon">i</div><div class="alert-text">Provisional estimate — not admissible for PAYS invoicing, guarantees, or regulatory filings.</div></div>
        <button class="btn" onclick="selectTab('commercial')">Build business case</button>`;
      return;
    }

    const breakdownRows = o.varianceBreakdown ? Object.entries(o.varianceBreakdown).map(([k, v]) => {
      const width = Math.min(100, Math.abs(v) / 1.5 * 100);
      const cls = v >= 0 ? 'green' : 'red';
      const sign = v >= 0 ? '+' : '';
      return `<div class="mini-list-item"><span style="text-transform:capitalize;">${k}</span><span class="mono ${cls}">${sign}${v}%</span></div>
        <div class="progress-bar"><div class="progress-fill ${cls === 'green' ? '' : 'red'}" style="width:${width}%;${v < 0 ? 'background:var(--red);' : ''}"></div></div>`;
    }).join('') : '';

    el.innerHTML = `
      <div class="card">
        <div class="mini-list-item" style="font-weight:700;"><span>Fuel saving (counterfactual)</span><span class="tooltip"${reasonAttr}>${trustBadge}</span></div>
        <div class="metric" style="margin-top:6px;"><div class="metric-value green">${s.savings}</div><div class="metric-label">actual vs baseline · ${td(o.actualFuelTd)} of ${td(o.baselineFuelTd)}</div></div>
        <div class="baseline-compare">
          <div class="baseline-bar-row"><span class="baseline-bar-label">Baseline</span><div class="baseline-bar-track"><div class="baseline-bar baseline" style="width:100%"></div></div><span class="mono">${td(o.baselineFuelTd)}</span></div>
          <div class="baseline-bar-row"><span class="baseline-bar-label">Actual</span><div class="baseline-bar-track"><div class="baseline-bar actual" style="width:${o.baselineFuelTd ? (o.actualFuelTd / o.baselineFuelTd * 100).toFixed(0) : 0}%"></div></div><span class="mono">${td(o.actualFuelTd)}</span></div>
        </div>
        <div class="mini-list-item"><span>Expected (guarantee)</span><span class="mono">${pct(o.expectedPct)}</span></div>
        <div class="mini-list-item"><span>Variance (actual − expected)</span><span class="mono ${o.variancePp >= 0 ? 'green' : 'red'}">${o.variancePp >= 0 ? '+' : ''}${o.variancePp}%</span></div>
      </div>
      ${breakdownRows ? `<div class="card"><div class="panel-title" style="margin-top:0">Variance attribution</div>${breakdownRows}</div>` : ''}
      ${(() => {
        const rows = ships.filter(x => x.ops && x.ops.variancePp !== null && x.ops.variancePp !== undefined)
          .sort((a, b) => b.ops.variancePp - a.ops.variancePp);
        if (!rows.length) return '';
        const maxAbs = Math.max(...rows.map(x => Math.abs(x.ops.variancePp)), 0.5);
        const bars = rows.map(x => {
          const v = x.ops.variancePp;
          const w = Math.abs(v) / maxAbs * 50;
          const isCur = x.id === s.id;
          return `<div class="fleet-var-row${isCur ? ' current' : ''}">
            <span class="fleet-var-name">${x.name.replace(/^MV\s+/, '')}</span>
            <span class="fleet-var-track"><span class="fleet-var-zero"></span><span class="fleet-var-bar ${v >= 0 ? 'pos' : 'neg'}" style="${v >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%`}"></span></span>
            <span class="mono ${v >= 0 ? 'green' : 'red'}" style="width:52px;text-align:right;">${v >= 0 ? '+' : ''}${v}%</span>
          </div>`;
        }).join('');
        return `<div class="card"><div class="panel-title" style="margin-top:0">Fleet variance (actual − expected)</div>${bars}</div>`;
      })()}
      <div class="card">
        <div class="panel-title" style="margin-top:0">Calculation provenance</div>
        <div class="mini-list-item"><span>Method</span><span class="mono">${calc.methodVersion}</span></div>
        <div class="mini-list-item"><span>Input snapshot</span><span class="mono">${calc.inputSnapshotRef}</span></div>
        <div class="mini-list-item"><span>Computed</span><span class="mono">${calc.computedAt}</span></div>
        <div class="mini-list-item"><span>Scenario type</span><span class="mono">${calc.scenarioType}</span></div>
        <div class="mini-list-item"><span>Fidelity</span><span class="mono">${calc.fidelity}</span></div>
        <div class="mini-list-item"><span>Valid</span><span class="mono">${calc.validFrom} → ${calc.validTo}</span></div>
      </div>
      <div class="card">
        <div class="panel-title" style="margin-top:0">Techno-economic case</div>
        <div class="metric"><div class="metric-value green">${rep.paybackYears ? rep.paybackYears + ' yr' : '—'}</div><div class="metric-label">Payback</div></div>
        <div class="metric"><div class="metric-value green">${money(rep.npv10)}</div><div class="metric-label">NPV (10 yr)</div></div>
        <div class="metric"><div class="metric-value green">${rep.co2AvoidedYr ? rep.co2AvoidedYr.toLocaleString() + ' t' : '—'}</div><div class="metric-label">CO₂ avoided / yr</div></div>
        <div class="mini-list-item"><span>Design baseline</span><span class="mono">${rep.designBaseline.polarRef}</span></div>
        <div class="mini-list-item"><span>Validation</span><span class="mono">${rep.designBaseline.validationRef} · ${rep.designBaseline.correlation} corr.</span></div>
      </div>
      <button class="btn secondary" onclick="selectTab('commercial')">View contract & invoices</button>`;
  }

  function renderCommercial(s) {
    const el = document.getElementById('commercialContent');
    if (!el) return;
    const o = s.ops || {};
    const rep = o.report || {};
    const money = n => (n === null || n === undefined || isNaN(n)) ? '—' : '£' + Math.round(n).toLocaleString();

    if (s.contract === 'Prospect') {
      el.innerHTML = `
        <div class="card">
          <div class="mini-list-item"><span>Contract type</span><span>Prospect — no contract in place</span></div>
          <div class="mini-list-item"><span>Prediction</span><span class="green">${s.savings}</span> ${badgeHtml[s.perfTrust]}</div>
          <div class="mini-list-item"><span>Est. payback</span><span class="mono">${rep.paybackYears ? rep.paybackYears + ' yr' : '—'}</span></div>
          <div class="mini-list-item"><span>Est. NPV (10 yr)</span><span class="mono">${money(rep.npv10)}</span></div>
        </div>
        <button class="btn" onclick="alert('Contract draft generated from business case')">Convert to contract draft</button>`;
      return;
    }

    const invoiceRows = (o.invoices || []).map(inv => `
      <div class="invoice-row${inv.trust === 'provisional' ? ' disabled' : ''}">
        <div><span class="checkbox${inv.trust === 'verified' ? ' checked' : ''}">${inv.trust === 'verified' ? '✓' : ''}</span>${inv.voyage} · ${inv.date} ${badgeHtml[inv.trust]}</div>
        <div class="${inv.trust === 'verified' ? 'green' : 'amber'} mono">${money(inv.amount)}</div>
      </div>`).join('');
    const totalVerified = (o.invoices || []).filter(i => i.trust === 'verified').reduce((a, i) => a + i.amount, 0);
    const c = s.details && s.details.contract;

    el.innerHTML = `
      <div class="card">
        <div class="mini-list-item" style="font-weight:700;"><span>Contract</span><span>${badgeHtml[s.contractTrust]}</span></div>
        <div class="mini-list-item"><span>Type</span><span>${s.contract}</span></div>
        <div class="mini-list-item"><span>PAYS rate</span><span class="mono">${c ? c.paysRate : '—'}</span></div>
        <div class="mini-list-item"><span>Guarantee floor</span><span class="mono">${s.guarantee}</span></div>
        <div class="mini-list-item"><span>Period</span><span class="mono">${c ? c.startDate + ' → ' + c.endDate : '—'}</span></div>
        <div class="mini-list-item"><span>Next invoice</span><span class="mono">${s.nextInvoice}</span></div>
        <div class="mini-list-item"><span>Est. annual value</span><span class="mono green">${money(rep.annualSavingsT * rep.fuelPrice)}</span></div>
      </div>
      <div class="card">
        <div class="panel-title" style="margin-top:0">PAYS invoices</div>
        ${invoiceRows || '<div style="font-size:12px;color:var(--muted);">No voyages recorded yet.</div>'}
        <div class="mini-list-item" style="margin-top:10px;border-top:1px solid var(--border);font-weight:700;">
          <span>Total verified</span><span class="mono green">${money(totalVerified)}</span>
        </div>
      </div>
      <div class="alert alert-amber"><div class="alert-icon">!</div><div class="alert-text">Provisional voyages are excluded from invoicing until batch verification (L3).</div></div>
      ${o.verifiedStatement ? `
      <div class="card">
        <div class="mini-list-item" style="font-weight:700;"><span>Verified statement</span><span class="badge badge-verified">Verified</span></div>
        <div class="mini-list-item"><span>Statement ID</span><span class="mono">${o.verifiedStatement.statementId}</span></div>
        <div class="mini-list-item"><span>Period</span><span class="mono">${o.verifiedStatement.period}</span></div>
        <div class="mini-list-item"><span>Output ref</span><span class="mono">${o.verifiedStatement.outputRef}</span></div>
        <div class="mini-list-item"><span>Hash</span><span class="mono">${o.verifiedStatement.hash}…</span></div>
        <div class="mini-list-item"><span>Signed</span><span class="mono">${o.verifiedStatement.signedBy} · ${o.verifiedStatement.signedAt}</span></div>
      </div>` : ''}
      <button class="btn" onclick="alert('Verified invoice generated')">Generate verified invoice</button>`;
  }

  function renderRegs(s) {
    const ciiVal = document.getElementById('regsCiiValue');
    if (!ciiVal) return;
    const c = s.details && s.details.cii;
    ciiVal.textContent = s.cii === '—' ? '—' : s.cii;
    document.getElementById('regsCiiTarget').textContent = s.ciiTarget;
    document.getElementById('regsCo2').textContent = s.co2;
    document.getElementById('regsVerified').textContent = c ? c.verifiedDataPct : '—';
    const eexi = s.details && s.details.eexi;
    document.getElementById('eexiValue').textContent = eexi ? eexi.withFastRig : '—';
    document.getElementById('eexiBaseline').textContent = eexi ? eexi.baseline : '—';
    document.getElementById('eexiLimit').textContent = eexi ? eexi.requiredLimit : '—';
    document.getElementById('eexiImprovement').textContent = eexi ? '-' + eexi.improvement + ' g/t·nm' : '—';
    document.getElementById('eexiStatus').textContent = eexi ? eexi.status : '—';
    const extras = document.getElementById('regsExtras');
    if (!extras) return;
    const o = s.ops || {};
    let html = '';
    if (o.correctiveAction) {
      html += `
        <div class="card" style="border-left:3px solid var(--amber);">
          <div class="mini-list-item" style="font-weight:700;"><span>Corrective action (SEEMP III)</span><span class="badge badge-provisional">${o.correctiveAction.status}</span></div>
          <div class="mini-list-item"><span>Action ID</span><span class="mono">${o.correctiveAction.actionId}</span></div>
          <div class="mini-list-item"><span>Trigger</span><span class="mono">${o.correctiveAction.trigger} (${s.cii} vs target ${s.ciiTarget})</span></div>
          <div style="font-size:11px;color:var(--muted);margin:6px 0 2px;">Plan</div>
          <div style="font-size:11px;line-height:1.4;">${o.correctiveAction.description}</div>
          <div class="mini-list-item"><span>Due</span><span class="mono">${o.correctiveAction.dueDate}</span></div>
          <div class="mini-list-item"><span>Closure</span><span>requires evidence document</span></div>
        </div>`;
    }
    if (o.fuelEU) {
      const f = o.fuelEU;
      html += `
        <div class="card">
          <div class="mini-list-item" style="font-weight:700;"><span>FuelEU Maritime ${f.year}</span><span class="badge ${f.verified ? 'badge-verified' : 'badge-provisional'}">${f.verified ? 'Verified' : 'Provisional'}</span></div>
          <div class="mini-list-item"><span>Compliance balance</span><span class="mono ${f.balanceT >= 0 ? 'green' : 'red'}">${f.balanceT >= 0 ? '+' : ''}${f.balanceT} t CO₂e</span></div>
          <div class="mini-list-item"><span>Penalty exposure (est.)</span><span class="mono ${f.penaltyEst > 0 ? 'amber' : ''}">${f.penaltyEst > 0 ? '€' + f.penaltyEst.toLocaleString() : '—'}</span></div>
          <div class="mini-list-item"><span>Penalty status</span><span class="mono">${f.status}</span></div>
        </div>`;
    }
    if (o.etsAccount) {
      const a = o.etsAccount;
      html += `
        <div class="card">
          <div class="mini-list-item" style="font-weight:700;"><span>${a.scheme} account</span><span class="mono" style="color:var(--muted);">read-only tracking</span></div>
          <div class="mini-list-item"><span>Holder</span><span>${a.holder}</span></div>
          <div class="mini-list-item"><span>Allocation year</span><span class="mono">${a.allocationYear}</span></div>
          <div class="mini-list-item"><span>Allocated</span><span class="mono">${a.allocated.toLocaleString()} t</span></div>
          <div class="mini-list-item"><span>Surrendered</span><span class="mono">${a.surrendered.toLocaleString()} t</span></div>
          <div class="mini-list-item"><span>Remaining</span><span class="mono ${a.remaining > 0 ? 'green' : 'red'}">${a.remaining.toLocaleString()} t</span></div>
        </div>`;
    }
    extras.innerHTML = html;
  }

  function renderFixBoard(s) {
    const o = s.ops || {};
    const board = o.fixBoard || { open: [], scheduled: [], inProgress: [], closed: [] };
    const card = c => `<div class="kanban-card" onclick="openWorkOrderFromBoard('${c.id}')">${c.id}<br><span class="${c.sev === 'red' ? 'red' : c.sev === 'amber' ? 'amber' : 'green'}">${c.sev === 'red' ? 'Critical' : c.sev === 'amber' ? 'Amber' : 'Green'}</span><br>${c.note}</div>`;
    const setCol = (id, items) => { const el = document.getElementById(id); if (el) el.innerHTML = items.length ? items.map(card).join('') : '<div style="font-size:11px;color:var(--muted);padding:6px;">None</div>'; };
    setCol('fixBoardOpen', board.open);
    setCol('fixBoardScheduled', board.scheduled);
    setCol('fixBoardProgress', board.inProgress);
    setCol('fixBoardClosed', board.closed);

    const rulEl = document.getElementById('fixRulList');
    if (rulEl) rulEl.innerHTML = (o.rulList || []).map(r => `
      <div class="mini-list-item"><span>${r.name}</span><span class="${r.pct > 80 ? 'red' : 'green'}">${r.rul}</span></div>
      <div class="progress-bar"><div class="progress-fill ${r.pct > 80 ? 'red' : ''}" style="width:${r.pct}%"></div></div>`).join('') || '<div style="font-size:12px;color:var(--muted);">No components.</div>';

    const partsEl = document.getElementById('fixPartsList');
    if (partsEl) partsEl.innerHTML = `<table><tr><th>Part</th><th>Stock</th><th>Lead</th></tr>${(o.partsStock || []).map(p =>
      `<tr><td>${p.part}</td><td class="${p.stock > 1 ? 'green' : 'amber'}">${p.stock}</td><td>${p.lead}</td></tr>`).join('')}</table>`;

    const histEl = document.getElementById('fixHistoryList');
    if (histEl) {
      const rngHist = mulberry32(s.id * 331 + 7);
      const items = ['Wing NDT', 'HPU filter', 'Slew bearing', 'Flap actuator test'];
      histEl.innerHTML = items.map((it, i) => `<div class="mini-list-item"><span>2026-0${5 - Math.floor(i / 2)}-${String(28 - i * 6 - Math.floor(rngHist() * 5)).padStart(2, '0')}</span><span>${it}</span></div>`).join('');
    }
    const certEl = document.getElementById('fixCertList');
    if (certEl) {
      const due = s.status === 'amber' || s.status === 'red';
      certEl.innerHTML = `
        <div class="mini-list-item"><span>HPU service</span><span class="green">Within 2 yr</span></div>
        <div class="mini-list-item"><span>Slew bearing inspect</span><span class="${due ? 'amber' : 'green'}">${due ? 'Due in 45d' : 'Within 1 yr'}</span></div>
        <div class="mini-list-item"><span>E-stop test</span><span class="green">Within 1 yr</span></div>
        <div class="mini-list-item"><span>Load test</span><span class="green">Within 5 yr</span></div>`;
    }
  }

  function openShip(s) {
    selectedShip = s;
    clearRoutes();
    updateMarkerStyles();
    // Route tab's fitBounds takes over when the user opens it.
    map.flyTo([s.lat, s.lon], map.getZoom(), { animate: true, duration: 0.7 });
    document.getElementById('shipName').textContent = s.name;
    document.getElementById('shipMeta').textContent = `${s.imo} · ${s.type}`;
    document.getElementById('deployStatus').textContent = s.deploy;
    document.getElementById('opHours').textContent = s.hours;
    document.getElementById('curVoyage').textContent = s.voyage;
    document.getElementById('position').textContent = `${s.lat.toFixed(1)}°, ${Math.abs(s.lon).toFixed(1)}° ${s.lon > 0 ? 'E' : 'W'}`;

    renderDetails(s);

    const w = s.weather;
    document.getElementById('shipWeatherIcon').innerHTML = weatherIcon(w.icon);
    document.getElementById('shipWeatherPosition').textContent = `${s.lat.toFixed(1)}°, ${Math.abs(s.lon).toFixed(1)}° ${s.lon > 0 ? 'E' : 'W'}`;
    document.getElementById('shipWeatherWind').textContent = `${w.windSpeed} kt`;
    document.getElementById('shipWeatherDir').textContent = w.windDir;
    const seaEl = document.getElementById('shipWeatherSea');
    seaEl.textContent = w.seaState;
    seaEl.className = 'weather-card-value ' + (w.seaState === 'High' || w.seaState === 'Rough' ? 'weather-rough' : 'weather-calm');

    renderHistoricalVoyages(s);

    const headline = computeHeadline(s);
    const headlineEl = document.getElementById('headline');
    headlineEl.className = 'headline ' + headline.status;
    headlineEl.innerHTML = `
      <div class="headline-status">${statusLabels[s.status]}${headline.status === 'red' || headline.status === 'amber' ? ' · requires action' : ''}</div>
      <div class="headline-text">${headline.text}</div>
      <div class="headline-action">
        <button class="btn" onclick="headlineAction()">${headline.action}</button>
      </div>`;

    document.getElementById('perfValue').textContent = s.status === 'blue' ? s.savings : s.savings + ' vs ' + s.guarantee;
    document.getElementById('perfCaption').textContent = s.perfTrust === 'verified' ? 'verified saving' : 'predicted saving';
    document.getElementById('perfBadge').innerHTML = badgeHtml[s.perfTrust];
    document.getElementById('perfSpark').innerHTML = sparkline([40, 55, 50, 60, 58, 62, 54], s.perfTrust === 'verified' ? '' : 'amber');

    document.getElementById('cbmValue').textContent = s.alert ? (s.status === 'cyan' ? 'Advice' : 'Alert') : 'Healthy';
    document.getElementById('cbmCaption').textContent = s.alert ? (s.status === 'cyan' ? 'route recommendation' : s.alertData.component) : 'no active alerts';
    document.getElementById('cbmBadge').innerHTML = badgeHtml[s.cbmTrust];
    document.getElementById('cbmSpark').innerHTML = s.status === 'red' ? sparkline([20, 35, 45, 55, 70, 82, 88], 'red') : sparkline([30, 25, 20, 15, 10, 5, 2], '');

    document.getElementById('compValue').textContent = s.cii === '—' ? 'No data' : s.cii + ' / ' + s.ciiTarget;
    document.getElementById('compCaption').textContent = 'CII rating / target';
    document.getElementById('compBadge').innerHTML = badgeHtml[s.compTrust];
    document.getElementById('compSpark').innerHTML = sparkline([60, 55, 50, 45, 40, 35, 30], s.cii === 'D' ? 'red' : '');

    document.getElementById('contractValue').textContent = s.contract === 'Prospect' ? 'No contract' : s.contract;
    document.getElementById('contractCaption').textContent = s.contract === 'Prospect' ? 'build business case' : s.voyagesReady + ' voyage ready';
    document.getElementById('contractBadge').innerHTML = badgeHtml[s.contractTrust];
    document.getElementById('contractSpark').innerHTML = sparkline([10, 25, 35, 45, 55, 65, 70], '');

    renderPerformance(s);
    renderCommercial(s);
    renderRegs(s);
    renderFixBoard(s);

    const cbmContent = document.getElementById('cbmContent');
    const prov = s.ops && s.ops.alertProvenance;
    const provRow = prov ? `<div class="mini-list-item"><span>Evaluated</span><span class="mono" style="color:var(--cyan);">${prov.evaluatedAt} · ${prov.subtype} · ${prov.modelVersion}</span></div>` : '';
    if (s.alert && s.alertData) {
      cbmContent.innerHTML = `
        <div class="alert"><div class="alert-icon">!</div><div class="alert-text">${s.alert}</div></div>
        <div class="card">
          <div class="mini-list-item"><span>Component</span><span>${s.alertData.component}</span></div>
          <div class="mini-list-item"><span>Fault code</span><span>${s.alertData.fault}</span></div>
          <div class="mini-list-item"><span>Anomaly score</span><span class="amber">${s.alertData.score}</span></div>
          <div class="mini-list-item"><span>RUL estimate</span><span>${s.alertData.rul}</span></div>
          <div class="mini-list-item"><span>Parts in stock</span><span class="green">${s.alertData.stock}</span></div>
          ${provRow}
        </div>
        <div class="rig-schematic">[Interactive rig schematic]</div>
        <button class="btn" onclick="openWorkOrder()">Create work order</button>`;
      document.getElementById('fixCreateBtn').style.display = 'block';
    } else if (s.status === 'cyan') {
      cbmContent.innerHTML = `
        <div class="alert alert-amber"><div class="alert-icon">i</div><div class="alert-text">Live route advice: ${s.alertData.action}</div></div>
        <div class="rig-schematic">[Live voyage map + weather overlay]</div>
        <button class="btn" onclick="showLens('optimise')">Review recommendation</button>`;
      document.getElementById('fixCreateBtn').style.display = 'none';
    } else {
      cbmContent.innerHTML = `
        <div class="card">
          <div class="mini-list-item"><span>Wing state</span><span>Deployed</span></div>
          <div class="mini-list-item"><span>Thrust estimate</span><span>128 kN</span></div>
          <div class="mini-list-item"><span>Power contribution</span><span class="green">12.4%</span></div>
          <div class="mini-list-item"><span>Load band</span><span>Band 3</span></div>
        </div>
        <div class="rig-schematic">[Interactive rig schematic]</div>
        <div style="font-size:12px;color:var(--muted);">No active alerts.</div>`;
      document.getElementById('fixCreateBtn').style.display = 'none';
    }

    document.getElementById('shipPanel').classList.add('open');
    document.getElementById('topbarTitle').innerHTML = tabTitles.overview + ' <span style="color:var(--muted);font-weight:400;">· ' + s.name + '</span>';
    selectTab('overview');
  }

  function showRoutes(s) {
    clearRoutes();
    if (!s || !s.route) return;
    const r = s.route;
    const routeColor = statusColors[s.status] || statusColors.cyan;
    addWrappedPolylines(r.points, {
      color: routeColor,
      opacity: 0.95,
      weight: 4,
      lineJoin: 'round',
      lineCap: 'round'
    }).forEach(poly => routeLayers.push(poly));
    const portIcon = (label, kind) => L.divIcon({
      className: 'port-marker',
      html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="width:12px;height:12px;border-radius:50%;background:${routeColor};border:2px solid var(--surface);box-shadow:0 0 0 2px ${routeColor}80;"></div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:2px 5px;font-size:10px;font-weight:600;color:var(--text);white-space:nowrap;box-shadow:var(--shadow);margin-top:3px;">${label}</div>
      </div>`,
      iconSize: [100, 36],
      iconAnchor: [50, 6]
    });
    const depMarker = L.marker(r.start, { icon: portIcon(r.departure, 'departure'), zIndexOffset: 500 }).addTo(map);
    const destMarker = L.marker(r.end, { icon: portIcon(r.destination, 'destination'), zIndexOffset: 500 }).addTo(map);
    routeMarkers.push(depMarker, destMarker);
    const bounds = L.latLngBounds(r.points);
    map.fitBounds(bounds, { padding: [120, 120], maxZoom: 8, animate: true });
    updateRoutePanel(s);
  }
  function clearRoutes() {
    routeLayers.forEach(p => map.removeLayer(p));
    routeLayers = [];
    routeMarkers.forEach(m => map.removeLayer(m));
    routeMarkers = [];
  }
  function updateRoutePanel(s) {
    const r = s.route;
    const routeColor = statusColors[s.status] || statusColors.cyan;
    const isLight = document.body.classList.contains('light-mode');
    const routeName = `${r.departure} → ${r.destination}`;
    document.getElementById('routeName').textContent = routeName;
    document.getElementById('routeDistance').textContent = `${r.distanceNm} nm`;
    document.getElementById('routeEta').textContent = r.eta;
    document.getElementById('routeSpeed').textContent = r.speed;
    document.getElementById('routeStatus').textContent = statusLabels[s.status];
    document.getElementById('routeStatus').className = s.status === 'green' ? 'green' : s.status === 'amber' ? 'amber' : s.status === 'red' ? 'red' : s.status === 'blue' ? 'marine' : s.status === 'cyan' ? 'marine' : '';
    document.getElementById('routeType').textContent = r.type === 'verified-live' ? 'Verified live' : r.type === 'verified-recent' ? 'Verified recent' : r.type === 'provisional' ? 'Provisional' : 'Predicted';
    document.getElementById('routeDep').textContent = r.departure;
    document.getElementById('routeDest').textContent = r.destination;
    const swatch = document.getElementById('routePanelSwatch');
    if (swatch) swatch.style.setProperty('--line-color', routeColor);
    const depDot = document.getElementById('routeDepDot');
    const destDot = document.getElementById('routeDestDot');
    if (depDot) depDot.style.background = routeColor;
    if (destDot) destDot.style.background = routeColor;
  }

  const sectionTitleTooltips = {
    'Deployment': 'Deployment details and commissioning history',
    'Vessel': 'Vessel particulars and static data',
    'PerformanceMetric': 'Verified performance and savings metrics',
    'Voyage': 'Current voyage route and ETA',
    'Contract': 'Contract terms and invoicing status',
    'CIIRecord': 'Carbon intensity indicator rating',
    'Maintenance': 'Condition-based maintenance status',
    'EventLayer': 'Recent sensor and diagnostic events'
  };
  function sectionTitle(title, type, id, label) {
    let tooltip = sectionTitleTooltips[type] || sectionTitleTooltips[title] || 'Drill into ' + label;
    if (title.startsWith('Components')) tooltip = 'Component health and remaining useful life';
    if (title.startsWith('Sensors')) tooltip = 'Sensor status and transmission lane';
    return `<div class="panel-title section-title tooltip" data-tooltip="${tooltip}" style="margin-top:14px;" onclick="openEntity('${type}', '${id}', '${label}')">${title} <span style="color:var(--muted);font-weight:400;">›</span></div>`;
  }
  function sectionCard(rows) {
    return `<div class="card">${rows.map(r => `<div class="mini-list-item"><span>${r.label}</span><span>${r.value}</span></div>`).join('')}</div>`;
  }
  function section(title, type, id, label, rows) {
    return sectionTitle(title, type, id, label) + sectionCard(rows);
  }
  function componentRow(unitIdx, compIdx, c) {
    const healthClass = c.health < 70 ? 'red' : c.health < 85 ? 'amber' : 'green';
    return `<tr class="component-row entity-row" onclick="openComponentEntity(${unitIdx}, ${compIdx})"><td>${c.name}</td><td class="${healthClass}">${c.health}%</td><td>${c.rul}</td></tr>`;
  }
  function sensorRow(unitIdx, sensorIdx, sen) {
    const statusClass = sen.status === 'Normal' ? 'green' : sen.status === 'Alert' ? 'red' : 'amber';
    return `<tr class="sensor-row entity-row" onclick="openSensorEntity(${unitIdx}, ${sensorIdx})"><td>${sen.name}</td><td class="${statusClass}">${sen.status}</td><td>${sen.transmission}</td></tr>`;
  }

  function renderDetails(s) {
    const d = s.details || {};
    const vessel = d.vessel || {};
    const contract = d.contract || null;
    const voyage = d.voyage || null;
    const perf = d.performanceMetrics || null;
    const cii = d.cii || null;
    const cbm = d.cbm || null;
    const events = d.events || null;
    const fastRigUnits = d.fastRigUnits || [];
    const badge = val => val ? `<span class="badge badge-verified">Verified</span>` : `<span class="badge badge-disabled">No data</span>`;

    let html = '';
    html += section('Deployment', 'Deployment', d.deploymentId || 'unknown', 'Deployment', [
      { label: 'Deployment ID', value: d.deploymentId || '—' },
      { label: 'Status', value: d.deploymentStatus || '—' },
      { label: 'Install date', value: d.installDate || '—' },
      { label: 'Commissioning', value: d.commissioningDate || '—' },
      { label: 'FastRig units', value: fastRigUnits.length.toString() }
    ]);
    html += section('Vessel', 'Vessel', s.imo, s.name, [
      { label: 'IMO / Name', value: `${s.imo} / ${s.name}` },
      { label: 'Type', value: s.type },
      { label: 'Flag', value: vessel.flag || '—' },
      { label: 'Year built', value: vessel.yearBuilt || '—' },
      { label: 'DWT', value: vessel.dwt ? vessel.dwt.toLocaleString() + ' t' + (s.dwtBand ? ' · ' + s.dwtBand : '') : '—' },
      { label: 'Length × beam', value: vessel.lengthOverall && vessel.beam ? `${vessel.lengthOverall} × ${vessel.beam} m` : '—' },
      { label: 'Propulsion', value: vessel.propulsion || '—' }
    ]);
    fastRigUnits.forEach((rig, unitIdx) => {
      html += section(`FastRigUnit ${unitIdx + 1}`, 'FastRigUnit', rig.serialNumber, `FastRigUnit ${unitIdx + 1}`, [
        { label: 'Serial number', value: rig.serialNumber },
        { label: 'Configuration', value: rig.configuration },
        { label: 'Build date', value: rig.buildDate },
        { label: 'Lifecycle stage', value: rig.lifecycleStage },
        { label: 'Residual value', value: rig.residualValue }
      ]);
      html += sectionTitle(`Components · Unit ${unitIdx + 1}`, 'FastRigUnit', rig.serialNumber, `FastRigUnit ${unitIdx + 1}`);
      html += '<div class="card"><table><tr><th>Component</th><th>Health</th><th>RUL</th></tr>';
      rig.components.forEach((c, compIdx) => { html += componentRow(unitIdx, compIdx, c); });
      html += '</table></div>';
      html += sectionTitle(`Sensors · Unit ${unitIdx + 1}`, 'FastRigUnit', rig.serialNumber, `FastRigUnit ${unitIdx + 1}`);
      html += '<div class="card"><table><tr><th>Sensor</th><th>Status</th><th>Lane</th></tr>';
      rig.sensors.forEach((sen, sensorIdx) => { html += sensorRow(unitIdx, sensorIdx, sen); });
      html += '</table></div>';
    });
    if (perf) {
      html += section('PerformanceData (Silver)', 'PerformanceData', `perf-${s.imo}`, 'PerformanceData', [
        { label: 'Avg thrust', value: perf.avgThrust },
        { label: 'Peak power', value: perf.peakPower },
        { label: 'Power contribution', value: perf.powerContribution },
        { label: 'Load-band hours', value: perf.loadBandHours.toLocaleString() },
        { label: 'Fuel flow', value: perf.fuelFlow },
        { label: 'Fidelity', value: s.ops ? s.ops.calculation.fidelity : '—' }
      ]);
    }
    if (s.ops && s.ops.calculation && s.ops.variancePp !== null && s.ops.variancePp !== undefined) {
      const calc = s.ops.calculation;
      html += section('CalculationEngine (Gold)', 'CalculationEngine', calc.inputSnapshotRef, 'CalculationEngine', [
        { label: 'Method version', value: calc.methodVersion },
        { label: 'Input snapshot', value: calc.inputSnapshotRef },
        { label: 'Computed at', value: calc.computedAt },
        { label: 'Scenario type', value: calc.scenarioType },
        { label: 'Valid window', value: `${calc.validFrom} → ${calc.validTo}` },
        { label: 'Baseline source', value: calc.baselineSource }
      ]);
      const lineageEvents = (s.ops.eventTimeline || []).filter(e => e.type === 'sensor_batch' || e.type === 'savings_calc').slice(0, 3);
      html += `<div class="card">
        <div class="panel-title" style="margin-top:0">Lineage</div>
        <div class="lineage-chain">${calc.baselineSource} → PerformanceData (${calc.fidelity}) → ${calc.methodVersion} → Gold (${calc.scenarioType})</div>
        <div class="mini-list-item"><span>Input snapshot</span><span class="mono">${calc.inputSnapshotRef}</span></div>
        ${lineageEvents.map(e => `
          <div class="timeline-row">
            <span class="timeline-ts mono">${e.ts}</span>
            <span class="timeline-lane lane-${e.lane.toLowerCase()}">${e.lane}</span>
            <span class="timeline-msg">${e.msg}</span>
            <span class="timeline-fid ${e.fidelity}">${e.fidelity}</span>
          </div>`).join('')}
      </div>`;
    }
    if (voyage) {
      html += section('Voyage', 'Voyage', voyage.voyageId, 'Voyage', [
        { label: 'Voyage ID', value: voyage.voyageId },
        { label: 'Source', value: voyage.source },
        { label: 'Route', value: `${voyage.departure} → ${voyage.destination}` },
        { label: 'ETA', value: voyage.eta },
        { label: 'Distance remaining', value: voyage.distanceRemaining },
        { label: 'Speed', value: voyage.speed }
      ]);
    }
    if (contract) {
      html += section('Contract', 'Contract', contract.contractId, 'Contract', [
        { label: 'Contract ID', value: contract.contractId },
        { label: 'Type', value: contract.type },
        { label: 'Period', value: `${contract.startDate} → ${contract.endDate}` },
        { label: 'PAYS rate', value: contract.paysRate },
        { label: 'Guarantee floor', value: contract.guaranteeFloor },
        { label: 'Next invoice', value: contract.nextInvoiceDate },
        { label: 'Voyages ready', value: contract.voyagesReady },
        { label: 'Data trust', value: badge(contract.dataTrust === 'verified') }
      ]);
    }
    if (cii) {
      html += section('CIIRecord', 'CIIRecord', `cii-${s.imo}`, 'CIIRecord', [
        { label: 'Current rating', value: cii.currentRating },
        { label: 'Target rating', value: cii.targetRating },
        { label: 'Operational carbon intensity', value: cii.operationalCarbonIntensity },
        { label: 'Required attained', value: cii.requiredAttained },
        { label: 'Verified data', value: cii.verifiedDataPct }
      ]);
    }
    if (cbm) {
      html += section('Maintenance / CBM', 'Maintenance', `cbm-${s.imo}`, 'Maintenance', [
        { label: 'Health score', value: cbm.healthScore + '%' },
        { label: 'Last diagnostic', value: cbm.lastDiagnostic },
        { label: 'Edge evaluated', value: cbm.edgeEvaluated ? 'Yes' : 'No' },
        { label: 'Open faults', value: cbm.openFaults },
        { label: 'RUL summary', value: cbm.rulSummary }
      ]);
    }
    if (events) {
      html += section('EventLayer (24h)', 'EventLayer', `evt-${s.imo}`, 'EventLayer', [
        { label: 'Sensor readings', value: events.sensorReadings24h.toLocaleString() },
        { label: 'Control events', value: events.controlEvents24h.toLocaleString() },
        { label: 'Diagnostic events', value: events.diagnosticEvents24h.toLocaleString() },
        { label: 'Downtime (30d)', value: events.downtimeHours30d + ' h' }
      ]);
    }
    if (s.ops && s.ops.eventTimeline && s.ops.eventTimeline.length) {
      html += '<div class="card"><div class="panel-title" style="margin-top:0">Event timeline (append-only)</div>' +
        s.ops.eventTimeline.map(e => `
          <div class="timeline-row">
            <span class="timeline-ts mono">${e.ts}</span>
            <span class="timeline-lane lane-${e.lane.toLowerCase()}">${e.lane}</span>
            <span class="timeline-msg">${e.msg}</span>
            <span class="timeline-fid ${e.fidelity}">${e.fidelity}</span>
          </div>`).join('') + '</div>';
    }
    if (s.contract !== 'Prospect') {
      html += section('Document register', 'Document', `docs-${s.imo}`, 'Document', [
        { label: 'Deployment certificate', value: `DEP-CERT-${s.imo}.pdf` },
        { label: 'Commissioning report', value: `COMM-${s.imo}-2023.pdf` },
        { label: 'Class approval', value: d.installDate ? `CLASS-APP-${s.imo.slice(-3)}.pdf` : '—' },
        { label: 'Storage', value: 'object storage · metadata + lineage only' }
      ]);
    }
    document.getElementById('detailsContent').innerHTML = html;
  }

  function openEntity(type, id, label) {
    if (!selectedShip) return;
    pushEntity(type, id, label);
  }
  function openComponentEntity(unitIdx, compIdx) {
    if (!selectedShip) return;
    const rig = selectedShip.details.fastRigUnits[unitIdx];
    const c = rig.components[compIdx];
    openEntity('Component', `comp-${unitIdx}-${compIdx}`, c.name);
  }
  function openSensorEntity(unitIdx, sensorIdx) {
    if (!selectedShip) return;
    const rig = selectedShip.details.fastRigUnits[unitIdx];
    const sen = rig.sensors[sensorIdx];
    openEntity('Sensor', `sen-${unitIdx}-${sensorIdx}`, sen.name);
  }

  const entityDocs = {
    Deployment: [
      { name: 'Deployment certificate', ref: 'DEP-CERT-001.pdf' },
      { name: 'Commissioning report', ref: 'COMM-2023-008.pdf' },
      { name: 'Installation acceptance', ref: 'INST-ACC-014.pdf' },
      { name: 'Bronze: deployment_events.parquet', ref: 'bronze/deployment_events' },
      { name: 'Silver: dim_deployment', ref: 'silver/dim_deployment' }
    ],
    Vessel: [
      { name: 'Class certificate', ref: 'CLASS-2023-102.pdf' },
      { name: 'Safety management certificate', ref: 'SMC-2024-044.pdf' },
      { name: 'Vessel particulars', ref: 'VP-2024-001.pdf' },
      { name: 'Bronze: vessel_static.parquet', ref: 'bronze/vessel_static' },
      { name: 'Silver: dim_vessel', ref: 'silver/dim_vessel' }
    ],
    FastRigUnit: [
      { name: 'Factory acceptance test', ref: 'FAT-2022-056.pdf' },
      { name: 'Type certificate', ref: 'TC-FR-MKV.pdf' },
      { name: 'Maintenance manual', ref: 'MM-FR-004.pdf' },
      { name: 'Bronze: rig_telemetry.parquet', ref: 'bronze/rig_telemetry' },
      { name: 'Silver: dim_fast_rig_unit', ref: 'silver/dim_fast_rig_unit' }
    ],
    Component: [
      { name: 'Component data sheet', ref: 'CDS-HPU-001.pdf' },
      { name: 'Inspection report', ref: 'INSP-2024-012.pdf' },
      { name: 'RUL model card', ref: 'RUL-HPU-v2.pdf' },
      { name: 'Bronze: component_status.parquet', ref: 'bronze/component_status' },
      { name: 'Silver: dim_component', ref: 'silver/dim_component' }
    ],
    Sensor: [
      { name: 'Sensor calibration record', ref: 'CAL-PRES-003.pdf' },
      { name: 'Data sheet', ref: 'DS-PRES-003.pdf' },
      { name: 'Installation log', ref: 'INST-PRES-003.pdf' },
      { name: 'Bronze: sensor_readings.parquet', ref: 'bronze/sensor_readings' },
      { name: 'Silver: dim_sensor', ref: 'silver/dim_sensor' }
    ],
    Contract: [
      { name: 'PAYS agreement', ref: 'PAYS-2023-001.pdf' },
      { name: 'Guarantee schedule', ref: 'GUAR-2023-001.pdf' },
      { name: 'Invoice template', ref: 'INV-TPL-001.pdf' },
      { name: 'Bronze: contract_events.parquet', ref: 'bronze/contract_events' },
      { name: 'Silver: dim_contract', ref: 'silver/dim_contract' }
    ],
    Voyage: [
      { name: 'Voyage plan', ref: 'VP-2024-001.pdf' },
      { name: 'Noon reports', ref: 'NOON-2024-001.pdf' },
      { name: 'Weather routing advice', ref: 'WRA-2024-001.pdf' },
      { name: 'Bronze: voyage_segments.parquet', ref: 'bronze/voyage_segments' },
      { name: 'Silver: fact_voyage', ref: 'silver/fact_voyage' }
    ],
    PerformanceMetric: [
      { name: 'Performance report', ref: 'PERF-2024-001.pdf' },
      { name: 'Savings verification', ref: 'SV-2024-001.pdf' },
      { name: 'Gold calculation snapshot', ref: 'gold/perf_snapshot' },
      { name: 'Bronze: operational_telemetry.parquet', ref: 'bronze/operational_telemetry' },
      { name: 'Silver: fact_performance', ref: 'silver/fact_performance' }
    ],
    CIIRecord: [
      { name: 'CII report', ref: 'CII-2024-001.pdf' },
      { name: 'Emissions verification', ref: 'EMV-2024-001.pdf' },
      { name: 'Regulatory submission', ref: 'REG-SUB-2024-001.pdf' },
      { name: 'Bronze: emissions_data.parquet', ref: 'bronze/emissions_data' },
      { name: 'Silver: fact_cii', ref: 'silver/fact_cii' }
    ],
    Maintenance: [
      { name: 'CBM diagnostic log', ref: 'CBM-2024-001.pdf' },
      { name: 'Work order history', ref: 'WO-HIST-2024-001.pdf' },
      { name: 'Spare parts list', ref: 'SPL-2024-001.pdf' },
      { name: 'Bronze: diagnostic_events.parquet', ref: 'bronze/diagnostic_events' },
      { name: 'Silver: fact_maintenance', ref: 'silver/fact_maintenance' }
    ],
    EventLayer: [
      { name: 'Event stream schema', ref: 'EVT-SCHEMA-v1.pdf' },
      { name: 'Audit trail', ref: 'AUDIT-2024-001.pdf' },
      { name: 'Bronze: event_layer.parquet', ref: 'bronze/event_layer' },
      { name: 'Silver: fact_events', ref: 'silver/fact_events' }
    ]
  };
  const entityRelated = {
    Deployment: ['FastRigUnit', 'Vessel', 'Contract'],
    Vessel: ['Deployment', 'CIIRecord', 'Voyage', 'Contract'],
    FastRigUnit: ['Component', 'Sensor', 'Deployment', 'Vessel'],
    Component: ['Sensor', 'FastRigUnit', 'Maintenance'],
    Sensor: ['Component', 'FastRigUnit', 'EventLayer'],
    Contract: ['Deployment', 'Voyage', 'PerformanceMetric'],
    Voyage: ['Vessel', 'Contract', 'PerformanceMetric'],
    PerformanceMetric: ['Voyage', 'Deployment', 'FastRigUnit'],
    CIIRecord: ['Vessel', 'Voyage'],
    Maintenance: ['Component', 'FastRigUnit', 'EventLayer'],
    EventLayer: ['Vessel', 'Sensor', 'FastRigUnit']
  };

  let navStack = [];
  function getEntityData(type, id) {
    if (!selectedShip) return null;
    const d = selectedShip.details;
    switch (type) {
      case 'Deployment': return { deploymentId: d.deploymentId, deploymentStatus: d.deploymentStatus, installDate: d.installDate, commissioningDate: d.commissioningDate, fastRigUnits: d.fastRigUnits ? d.fastRigUnits.length : 0 };
      case 'Vessel': return { name: selectedShip.name, imo: selectedShip.imo, type: selectedShip.type, ...d.vessel };
      case 'FastRigUnit': return d.fastRigUnits.find(r => r.serialNumber === id);
      case 'Component': {
        const parts = id.split('-');
        const unitIdx = parseInt(parts[1], 10);
        const compIdx = parseInt(parts[2], 10);
        return d.fastRigUnits[unitIdx] ? d.fastRigUnits[unitIdx].components[compIdx] : null;
      }
      case 'Sensor': {
        const parts = id.split('-');
        const unitIdx = parseInt(parts[1], 10);
        const sensorIdx = parseInt(parts[2], 10);
        return d.fastRigUnits[unitIdx] ? d.fastRigUnits[unitIdx].sensors[sensorIdx] : null;
      }
      case 'Contract': return d.contract;
      case 'Voyage': return d.voyage;
      case 'PerformanceData': return d.performanceMetrics;
      case 'CalculationEngine': return selectedShip.ops ? selectedShip.ops.calculation : null;
      case 'CIIRecord': return d.cii;
      case 'Maintenance': return d.cbm;
      case 'EventLayer': return d.events;
      default: return null;
    }
  }
  function getFirstRelatedEntity(type, relatedType, data) {
    if (!selectedShip) return null;
    const d = selectedShip.details;
    const ship = selectedShip;
    switch (relatedType) {
      case 'Deployment': return d.deploymentId ? { id: d.deploymentId, label: 'Deployment' } : null;
      case 'Vessel': return { id: ship.imo, label: ship.name };
      case 'FastRigUnit': if (d.fastRigUnits && d.fastRigUnits.length) return { id: d.fastRigUnits[0].serialNumber, label: d.fastRigUnits[0].serialNumber }; break;
      case 'Component': if (d.fastRigUnits && d.fastRigUnits.length && d.fastRigUnits[0].components.length) return { id: `comp-0-0`, label: d.fastRigUnits[0].components[0].name }; break;
      case 'Sensor': if (d.fastRigUnits && d.fastRigUnits.length && d.fastRigUnits[0].sensors.length) return { id: `sen-0-0`, label: d.fastRigUnits[0].sensors[0].name }; break;
      case 'Contract': return d.contract ? { id: d.contract.contractId, label: 'Contract' } : null;
      case 'Voyage': return d.voyage ? { id: d.voyage.voyageId, label: 'Voyage' } : null;
      case 'PerformanceMetric': return d.performanceMetrics ? { id: `perf-${ship.imo}`, label: 'PerformanceMetric' } : null;
      case 'CIIRecord': return d.cii ? { id: `cii-${ship.imo}`, label: 'CIIRecord' } : null;
      case 'Maintenance': return d.cbm ? { id: `cbm-${ship.imo}`, label: 'Maintenance' } : null;
      case 'EventLayer': return d.events ? { id: `evt-${ship.imo}`, label: 'EventLayer' } : null;
    }
    return null;
  }
  function renderEntityAttributes(type, data) {
    if (!data) return '<div class="card">No data available.</div>';
    const rows = [];
    const add = (label, value) => rows.push({ label, value: value === undefined || value === null ? '—' : value });
    switch (type) {
      case 'Deployment': add('Deployment ID', data.deploymentId); add('Status', data.deploymentStatus); add('Install date', data.installDate); add('Commissioning date', data.commissioningDate); add('FastRig units', data.fastRigUnits); break;
      case 'Vessel': add('IMO', data.imo); add('Name', data.name); add('Type', data.type); add('Flag', data.flag); add('Year built', data.yearBuilt); add('DWT', data.dwt ? data.dwt.toLocaleString() + ' t' + (selectedShip.dwtBand ? ' · ' + selectedShip.dwtBand : '') : null); add('Length × beam', data.lengthOverall && data.beam ? `${data.lengthOverall} × ${data.beam} m` : null); add('Propulsion', data.propulsion); add('SFOF', data.sfof); break;
      case 'FastRigUnit': add('Serial number', data.serialNumber); add('Configuration', data.configuration); add('Build date', data.buildDate); add('Lifecycle stage', data.lifecycleStage); add('Residual value', data.residualValue); add('Components', data.components ? data.components.length : 0); add('Sensors', data.sensors ? data.sensors.length : 0); break;
      case 'Component': add('Name', data.name); add('Type', data.type); add('Health', data.health + '%'); add('Operating hours', data.hours); add('RUL estimate', data.rul); break;
      case 'Sensor': add('Name', data.name); add('Type', data.type); add('Status', data.status); add('Last reading', data.lastReading); add('Transmission lane', data.transmission); break;
      case 'Contract': add('Contract ID', data.contractId); add('Type', data.type); add('Period', `${data.startDate} → ${data.endDate}`); add('PAYS rate', data.paysRate); add('Guarantee floor', data.guaranteeFloor); add('Next invoice', data.nextInvoiceDate); add('Voyages ready', data.voyagesReady); add('Data trust', data.dataTrust); break;
      case 'Voyage': add('Voyage ID', data.voyageId); add('Source', data.source); add('Route', `${data.departure} → ${data.destination}`); add('ETA', data.eta); add('Distance remaining', data.distanceRemaining); add('Speed', data.speed); break;
      case 'PerformanceMetric': add('Avg thrust', data.avgThrust); add('Peak power', data.peakPower); add('Power contribution', data.powerContribution); add('Load-band hours', data.loadBandHours ? data.loadBandHours.toLocaleString() : null); add('Fuel flow', data.fuelFlow); break;
      case 'CIIRecord': add('Current rating', data.currentRating); add('Target rating', data.targetRating); add('Operational carbon intensity', data.operationalCarbonIntensity); add('Required attained', data.requiredAttained); add('Verified data', data.verifiedDataPct); break;
      case 'Maintenance': add('Health score', data.healthScore + '%'); add('Last diagnostic', data.lastDiagnostic); add('Edge evaluated', data.edgeEvaluated ? 'Yes' : 'No'); add('Open faults', data.openFaults); add('RUL summary', data.rulSummary); break;
      case 'EventLayer': add('Sensor readings (24h)', data.sensorReadings24h ? data.sensorReadings24h.toLocaleString() : null); add('Control events (24h)', data.controlEvents24h ? data.controlEvents24h.toLocaleString() : null); add('Diagnostic events (24h)', data.diagnosticEvents24h ? data.diagnosticEvents24h.toLocaleString() : null); add('Downtime (30d)', data.downtimeHours30d + ' h'); break;
    }
    return sectionCard(rows);
  }
  function renderDocsSection(type) {
    const docs = entityDocs[type] || [];
    return `
      <div class="panel-title" style="margin-top:14px;">Documents & base data</div>
      <div class="card doc-list">
        ${docs.map(d => `<div class="doc-list-item"><span>${d.name}</span><span style="color:var(--accent);cursor:pointer;" onclick="alert('Open ${d.ref}')">${d.ref}</span></div>`).join('')}
      </div>`;
  }
  function renderRelatedSection(type, data) {
    const related = entityRelated[type] || [];
    const chips = related.map(r => {
      const target = getFirstRelatedEntity(type, r, data);
      if (!target) return '';
      return `<span class="panel-tab" style="margin:0 4px 4px 0;" onclick="openEntity('${r}', '${target.id}', '${target.label}')">${r}</span>`;
    }).filter(Boolean).join('');
    return chips ? `
      <div class="panel-title" style="margin-top:14px;">Related entities</div>
      <div class="card" style="padding:10px;">${chips}</div>
    ` : '';
  }
  function renderBreadcrumbs() {
    const container = document.getElementById('entityBreadcrumb');
    if (!navStack.length) { container.innerHTML = ''; return; }
    container.innerHTML = navStack.map((crumb, idx) => {
      const isLast = idx === navStack.length - 1;
      const tooltip = isLast ? 'Current view' : `Go back to ${crumb.label}`;
      return `<span class="${isLast ? 'current' : ''} tooltip" data-tooltip="${tooltip}" onclick="navigateToEntity(${idx})">${crumb.label}</span>`;
    }).join(' <span style="color:var(--border-light);">/</span> ');
  }
  function navigateToEntity(idx) {
    navStack = navStack.slice(0, idx + 1);
    renderEntity();
  }
  function renderEntity() {
    const crumb = navStack[navStack.length - 1];
    if (!crumb) return;
    renderBreadcrumbs();
    const data = getEntityData(crumb.type, crumb.id);
    document.getElementById('entityTitle').textContent = crumb.label || crumb.type;
    document.getElementById('entityContent').innerHTML = renderEntityAttributes(crumb.type, data) + renderDocsSection(crumb.type) + renderRelatedSection(crumb.type, data);
    showLens('entity');
  }
  function pushEntity(type, id, label) {
    const top = navStack[navStack.length - 1];
    if (!top || top.type !== type || top.id !== id) {
      navStack.push({ type, id, label });
    }
    renderEntity();
  }
  function popEntity() {
    if (navStack.length > 1) {
      navStack.pop();
      renderEntity();
    } else {
      navStack = [];
      selectTab('details');
    }
  }

  function headlineAction() {
    if (!selectedShip) return;
    const headline = computeHeadline(selectedShip);
    if (headline.lens === 'fix' && selectedShip.alert && selectedShip.alertData && selectedShip.status === 'red') {
      openWorkOrder();
    } else {
      selectTab(headline.lens);
    }
  }

  function closePanel() {
    document.getElementById('shipPanel').classList.remove('open');
    clearRoutes();
    selectedShip = null;
    updateMarkerStyles();
    document.getElementById('topbarTitle').innerHTML = tabTitles.overview;
  }

  function toggleMoreFilters() {
    const el = document.getElementById('moreFilters');
    const btn = document.getElementById('moreFiltersToggle');
    const open = el.style.display !== 'none';
    el.style.display = open ? 'none' : '';
    btn.textContent = open ? 'More filters ▾' : 'Fewer filters ▴';
  }
  function toggleLegend() {
    const el = document.getElementById('mapLegend');
    const btn = document.getElementById('legendToggle');
    const open = el.style.display !== 'none';
    el.style.display = open ? 'none' : '';
    btn.classList.toggle('active', !open);
  }

  function showLens(name) {
    document.querySelectorAll('.lens').forEach(l => l.classList.remove('active'));
    document.getElementById('lens-' + name).classList.add('active');
  }

  function openWorkOrder() {
    if (!selectedShip || !selectedShip.alertData) return;
    document.getElementById('woComponent').textContent = selectedShip.alertData.component;
    document.getElementById('woFault').textContent = selectedShip.alertData.fault;
    document.getElementById('woScore').textContent = selectedShip.alertData.score;
    document.getElementById('woRul').textContent = selectedShip.alertData.rul;
    document.getElementById('woStock').textContent = selectedShip.alertData.stock;
    document.getElementById('woAction').textContent = selectedShip.alertData.action;
    showLens('fixdetail');
  }
  function openWorkOrderFromBoard(code) {
    document.getElementById('woComponent').textContent = 'HPU accumulator';
    document.getElementById('woFault').textContent = code;
    document.getElementById('woScore').textContent = '0.82';
    document.getElementById('woRul').textContent = '41 days';
    document.getElementById('woStock').textContent = '2 in Rotterdam';
    document.getElementById('woAction').textContent = 'Inspect accumulator within 7 days';
    showLens('fixdetail');
  }

  function showFixTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.sub-lens').forEach(l => l.classList.remove('active'));
    document.getElementById('fix-' + name).classList.add('active');
  }

  async function selectTab(name) {
    const targetTab = document.querySelector(`.panel-tab[data-tab="${name}"]`);
    if (targetTab && targetTab.classList.contains('panel-hidden')) {
      const firstVisible = document.querySelector('.panel-tab:not(.panel-hidden)');
      if (firstVisible) name = firstVisible.dataset.tab;
    }
    showLens(name);
    document.querySelectorAll('.panel-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    document.getElementById('topbarTitle').innerHTML = tabTitles[name] + (selectedShip ? ' <span style="color:var(--muted);font-weight:400;">· ' + selectedShip.name + '</span>' : '');
    if (name === 'optimise' && selectedShip) {
      clearRoutes();
      setRouteLoading(true);
      setTimeout(() => {
        setRouteLoading(false);
        showRoutes(selectedShip);
      }, 300);
    } else {
      clearRoutes();
    }
  }

  document.getElementById('roleSelect').addEventListener('change', (e) => {
    setRolePreset(e.target.value);
  });

  // Tooltip system
  let activeTooltip = null;
  function showTooltip(el) {
    const text = el.getAttribute('data-tooltip');
    if (!text) return;
    hideTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-popup' + (text.length > 50 ? ' tooltip-wrap' : '');
    tooltip.textContent = text;
    document.body.appendChild(tooltip);
    const rect = el.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const fitsAbove = spaceAbove >= tooltipRect.height + 8;
    const fitsBelow = spaceBelow >= tooltipRect.height + 8;
    const placeBelow = !fitsAbove || (fitsBelow && spaceBelow > spaceAbove);
    let left = rect.left + rect.width / 2;
    if (left - tooltipRect.width / 2 < 8) left = tooltipRect.width / 2 + 8;
    if (left + tooltipRect.width / 2 > window.innerWidth - 8) left = window.innerWidth - tooltipRect.width / 2 - 8;
    tooltip.style.left = left + 'px';
    if (placeBelow) {
      tooltip.style.top = rect.bottom + 6 + 'px';
      tooltip.style.transform = 'translate(-50%, 0)';
    } else {
      tooltip.style.top = rect.top - 6 + 'px';
      tooltip.style.transform = 'translate(-50%, -100%)';
    }
    requestAnimationFrame(() => { tooltip.style.opacity = '1'; tooltip.style.visibility = 'visible'; });
    activeTooltip = tooltip;
  }
  function hideTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }
  document.body.addEventListener('mouseenter', (e) => { if (e.target.classList && e.target.classList.contains('tooltip')) showTooltip(e.target); }, true);
  document.body.addEventListener('mouseleave', (e) => { if (e.target.classList && e.target.classList.contains('tooltip')) hideTooltip(); }, true);
  document.body.addEventListener('focusin', (e) => { if (e.target.classList && e.target.classList.contains('tooltip')) showTooltip(e.target); }, true);
  document.body.addEventListener('focusout', (e) => { if (e.target.classList && e.target.classList.contains('tooltip')) hideTooltip(); }, true);

  // Responsive menu
  function toggleMenu() {
    const left = document.querySelector('.left-panel');
    const overlay = document.getElementById('leftPanelOverlay');
    left.classList.toggle('open');
    overlay.classList.toggle('open');
  }

  // Live vessel position simulation
  let liveMode = false;
  let liveInterval = null;
  let liveSpeed = 1;
  const baseProgressPerTick = 0.0005;
  function setLiveSpeed(speed) {
    liveSpeed = parseFloat(speed) || 1;
  }
  function toggleLiveMode() {
    liveMode = !liveMode;
    const btn = document.getElementById('liveBtn');
    const simBadge = document.getElementById('simBadge');
    if (liveMode) {
      btn.classList.add('active');
      if (simBadge) simBadge.style.display = '';
      ships.forEach(s => { if (s.route && s.route.points && s.route.points.length >= 2 && s.sailing && !s.atPort && s.status !== 'blue' && s.status !== 'grey') { if (s.routeProgress == null) s.routeProgress = 0.2 + Math.random() * 0.4; } });
      liveInterval = setInterval(simulateLiveTick, 1000);
      simulateLiveTick();
    } else {
      btn.classList.remove('active');
      if (simBadge) simBadge.style.display = 'none';
      if (liveInterval) clearInterval(liveInterval);
      liveInterval = null;
    }
  }
  function simulateLiveTick() {
    const now = new Date().toISOString();
    document.getElementById('lastUpdate').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const filteredIds = new Set(applyFilters(ships).map(s => s.id));
    markers.forEach(m => {
      const s = m.ship;
      if (!s.route || !s.route.points || s.route.points.length < 2 || !s.sailing || s.atPort || s.status === 'blue' || s.status === 'grey') return;
      const totalSegments = s.route.points.length - 1;
      s.routeProgress = Math.min(1, (s.routeProgress || 0) + baseProgressPerTick * liveSpeed * (1 + (s.id % 3) * 0.1));
      const idx = Math.min(Math.floor(s.routeProgress * totalSegments), totalSegments - 1);
      const f = (s.routeProgress * totalSegments) - idx;
      const a = s.route.points[idx];
      const b = s.route.points[idx + 1];
      const [lat, lon] = greatCirclePoint(a[0], a[1], b[0], b[1], f);
      s.lat = lat; s.lon = lon; s.heading = Math.round(bearing(a[0], a[1], b[0], b[1]));
      m.setLatLng([lat, lon]);
      m.setIcon(shipIcon(s, selectedShip && selectedShip.id === s.id ? 'selected' : (selectedShip ? 'dimmed' : null), !filteredIds.has(s.id)));
    });
    if (selectedShip) {
      const m = markers.find(m => m.ship.id === selectedShip.id);
      if (m) selectedShip = m.ship;
      renderShipPosition(selectedShip);
    }
    renderFleetSummary();
    if (viewMode === 'list') renderListView();
  }
  function renderShipPosition(s) {
    const voyage = s.details && s.details.voyage;
    if (voyage) {
      voyage.distanceRemaining = `${Math.round((1 - (s.routeProgress || 0.5)) * (s.route.distanceNm || 3000))} nm`;
      voyage.speed = s.route && s.route.speed ? s.route.speed : '12 kt';
    }
    if (selectedShip && selectedShip.id === s.id) {
      const routeDistance = document.getElementById('routeDistance');
      if (routeDistance && s.route) routeDistance.textContent = `${s.route.distanceNm} nm`;
    }
  }

  // Alerts centre
  let alertsCache = [];
  let alertsFilter = 'all';
  function openAlertsCentre() {
    document.getElementById('alertsModal').style.display = 'flex';
    fetch('/api/alerts').then(r => r.json()).then(data => {
      alertsCache = (data.alerts || []).map(a => ({ ...a, acknowledged: false }));
      renderAlertsModal();
      updateAlertsBadge();
    }).catch(err => {
      console.warn('Alerts fetch failed:', err);
      alertsCache = [];
      ships.forEach(s => {
        if (s.alert) {
          const prov = s.ops && s.ops.alertProvenance;
          alertsCache.push({ vesselId: s.id, vesselName: s.name, type: getAlertType(s), severity: getAlertType(s), message: s.alert, timestamp: 'Just now', acknowledged: false,
            provenance: prov ? `${prov.evaluatedAt}-evaluated · ${prov.subtype} · ${prov.modelVersion} · ${prov.lane}` : null });
        }
      });
      renderAlertsModal();
      updateAlertsBadge();
    });
  }
  function closeAlertsCentre(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('alertsModal').style.display = 'none';
  }
  function filterAlerts(type) {
    alertsFilter = type;
    document.querySelectorAll('#alertsModalFilter button').forEach(b => b.classList.toggle('active', b.dataset.filter === type));
    renderAlertsModal();
  }
  function renderAlertsModal() {
    const list = document.getElementById('alertsModalList');
    const filtered = alertsFilter === 'all' ? alertsCache : alertsCache.filter(a => a.severity === alertsFilter || a.type === alertsFilter);
    const visible = filtered.filter(a => !a.acknowledged);
    if (visible.length === 0) { list.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px 0;">No active alerts.</div>'; return; }
    list.innerHTML = visible.map(a => `
      <div class="alert-row ${a.severity.toLowerCase().replace(' ', '-')}" onclick="openAlertShip(${a.vesselId})">
        <div style="flex:1;">
          <div style="font-weight:600;font-size:12px;">${a.vesselName}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${a.message || a.action || (a.faultCode + ' · ' + a.component) || 'Alert'}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;">${a.severity} · ${a.timestamp || 'Just now'}</div>
          ${a.provenance ? `<div style="font-size:9px;color:var(--cyan);margin-top:2px;">${a.provenance}</div>` : ''}
        </div>
        <button class="btn secondary" style="padding:4px 10px;font-size:10px;" onclick="event.stopPropagation();ackAlert(${a.vesselId}, '${a.message}')">Ack</button>
      </div>
    `).join('');
  }
  function ackAlert(vesselId, message) {
    const a = alertsCache.find(x => x.vesselId === vesselId && x.message === message);
    if (a) a.acknowledged = true;
    renderAlertsModal();
    updateAlertsBadge();
  }
  function acknowledgeAllAlerts() {
    alertsCache.forEach(a => a.acknowledged = true);
    renderAlertsModal();
    updateAlertsBadge();
  }
  function openAlertShip(id) {
    closeAlertsCentre();
    openShipById(id);
  }
  function updateAlertsBadge() {
    const unack = alertsCache.filter(a => !a.acknowledged).length || ships.filter(s => s.alert && !s.alertAcknowledged).length;
    const badge = document.getElementById('alertsBadge');
    badge.textContent = unack;
    badge.style.display = unack > 0 ? 'flex' : 'none';
  }
  updateAlertsBadge();

  // Scenario planning
  function populateScenarioVessels() {
    const sel = document.getElementById('scenarioVessel');
    if (!sel) return;
    sel.innerHTML = ships.map(s => `<option value="${s.id}">${s.name} (${s.type})</option>`).join('');
  }
  function runScenario() {
    const id = parseInt(document.getElementById('scenarioVessel').value);
    const s = ships.find(x => x.id === id);
    if (!s) return;
    const rigs = parseInt(document.getElementById('scenarioRigs').value) || 0;
    const deviation = parseFloat(document.getElementById('scenarioDeviation').value) || 0;
    const wind = parseFloat(document.getElementById('scenarioWind').value) || 1;
    const fuelPrice = parseFloat(document.getElementById('scenarioFuelPrice').value) || 650;
    const baseSaving = s.savings && s.savings !== '—' ? parseFloat(s.savings) : 0;
    const rigBoost = rigs * 1.8;
    const windBoost = (wind - 1) * 8;
    const devPenalty = Math.abs(deviation) * 0.03;
    const predictedSaving = Math.max(0, baseSaving + rigBoost + windBoost - devPenalty);
    const annualFuel = 2500 + (s.type === 'Bulk Carrier' ? 1500 : s.type === 'Container' ? 1200 : 800);
    const fuelSavedT = annualFuel * predictedSaving / 100;
    const co2SavedT = fuelSavedT * 3.15;
    const valueGBP = fuelSavedT * fuelPrice * 0.8;
    const result = { vesselId: id, vesselName: s.name, rigs, deviation, wind, fuelPrice, predictedSaving, fuelSavedT, co2SavedT, valueGBP };
    window.currentScenario = result;
    document.getElementById('scenarioResult').style.display = 'block';
    document.getElementById('scenarioResult').innerHTML = `
      <div class="panel-title" style="margin-top:0">Scenario result <span class="badge badge-provisional">scenario_type: provisional</span></div>
      <div class="metric"><div class="metric-value green">${predictedSaving.toFixed(1)}%</div><div class="metric-label">Predicted fuel saving</div></div>
      <div class="mini-list-item"><span>Fuel saved / yr</span><span class="mono">${fuelSavedT.toFixed(0)} t</span></div>
      <div class="mini-list-item"><span>CO₂ avoided / yr</span><span class="mono">${co2SavedT.toFixed(0)} t</span></div>
      <div class="mini-list-item"><span>Value / yr</span><span class="mono">£${(valueGBP / 1e6).toFixed(2)}M</span></div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;">Not admissible for PAYS invoicing, guarantees, or regulatory filings until batch-verified.</div>
    `;
    renderScenarioComparison();
  }
  function saveScenario() {
    if (!window.currentScenario) { runScenario(); }
    const saved = JSON.parse(localStorage.getItem('fastFleet_scenarios') || '[]');
    saved.push({ ...window.currentScenario, id: Date.now(), name: `${window.currentScenario.vesselName} · ${window.currentScenario.rigs} rigs` });
    localStorage.setItem('fastFleet_scenarios', JSON.stringify(saved));
    renderSavedScenarios();
    renderScenarioComparison();
  }
  function clearScenarios() {
    localStorage.removeItem('fastFleet_scenarios');
    renderSavedScenarios();
    renderScenarioComparison();
  }
  function renderSavedScenarios() {
    const saved = JSON.parse(localStorage.getItem('fastFleet_scenarios') || '[]');
    const el = document.getElementById('savedScenarios');
    if (saved.length === 0) { el.innerHTML = '<div style="color:var(--muted);font-size:11px;">No saved scenarios.</div>'; return; }
    el.innerHTML = saved.map(s => `
      <div class="scenario-card" style="margin-bottom:8px;">
        <h4>${s.name}</h4>
        <div class="scenario-metric"><span>Saving</span><span class="green">${s.predictedSaving.toFixed(1)}%</span></div>
        <div class="scenario-metric"><span>Fuel</span><span>${s.fuelSavedT.toFixed(0)} t/yr</span></div>
        <div class="scenario-metric"><span>Value</span><span>£${(s.valueGBP/1e6).toFixed(2)}M</span></div>
        <button class="btn secondary" style="margin-top:8px;width:100%;" onclick="loadScenario(${s.id})">Load</button>
      </div>
    `).join('');
  }
  function loadScenario(id) {
    const saved = JSON.parse(localStorage.getItem('fastFleet_scenarios') || '[]');
    const s = saved.find(x => x.id === id);
    if (!s) return;
    document.getElementById('scenarioVessel').value = s.vesselId;
    document.getElementById('scenarioRigs').value = s.rigs;
    document.getElementById('scenarioDeviation').value = s.deviation;
    document.getElementById('scenarioWind').value = s.wind;
    document.getElementById('scenarioFuelPrice').value = s.fuelPrice;
    window.currentScenario = s;
    document.getElementById('scenarioResult').style.display = 'block';
    document.getElementById('scenarioResult').innerHTML = `
      <div class="panel-title" style="margin-top:0">Scenario result</div>
      <div class="metric"><div class="metric-value green">${s.predictedSaving.toFixed(1)}%</div><div class="metric-label">Predicted fuel saving</div></div>
      <div class="mini-list-item"><span>Fuel saved / yr</span><span>${s.fuelSavedT.toFixed(0)} t</span></div>
      <div class="mini-list-item"><span>CO₂ avoided / yr</span><span>${s.co2SavedT.toFixed(0)} t</span></div>
      <div class="mini-list-item"><span>Value / yr</span><span>£${(s.valueGBP / 1e6).toFixed(2)}M</span></div>
    `;
    renderScenarioComparison();
  }
  function renderScenarioComparison() {
    const saved = JSON.parse(localStorage.getItem('fastFleet_scenarios') || '[]');
    const el = document.getElementById('scenarioComparison');
    if (saved.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = saved.map(s => `
      <div class="scenario-card">
        <h4>${s.name}</h4>
        <div class="scenario-metric"><span>Fuel saving</span><span class="green">${s.predictedSaving.toFixed(1)}%</span></div>
        <div class="scenario-metric"><span>CO₂ / yr</span><span>${s.co2SavedT.toFixed(0)} t</span></div>
        <div class="scenario-metric"><span>Value / yr</span><span>£${(s.valueGBP/1e6).toFixed(2)}M</span></div>
      </div>
    `).join('');
  }

  // Demo wizards
  function runWizard(name) {
    const sel = document.getElementById('wizardSelect');
    sel.value = '';
    sel.classList.remove('pulse-attention');
    localStorage.setItem('zevi.wizardsSeen', '1');
    if (name === 'onboarding') { startTour(); }
    else if (name === 'add-ship') openAddShipWizard();
    else if (name === 'sales-case') openSalesCaseWizard();
    else if (name === 'scenario') { openShipById(ships[0].id); selectTab('scenarios'); }
    else if (name === 'arrival-window') startArrivalWindowWizard();
    else if (name === 'maintenance') startMaintenanceWizard();
    else if (name === 'invoice') startInvoiceWizard();
    else if (name === 'regulatory') startRegulatoryWizard();
  }
  function openAddShipWizard() {
    const name = prompt('Ship name:');
    if (!name) return;
    const type = prompt('Type (Bulk Carrier / Container / Tanker / RoRo):', 'Bulk Carrier') || 'Bulk Carrier';
    const newId = Math.max(...ships.map(s => s.id)) + 1;
    const s = {
      id: newId, name, imo: '99' + String(newId).padStart(5, '0'), type, status: 'blue', sailing: false, atPort: true,
      reason: 'Prospect, prediction ready', savings: '—', guarantee: '—', variance: '—', cii: '—', ciiTarget: '—', co2: '—',
      contract: 'Prospect', nextInvoice: '—', voyagesReady: 0, deploy: 'None', hours: '0', perfTrust: 'provisional', cbmTrust: 'provisional', compTrust: 'provisional', contractTrust: 'provisional',
      alert: null, alertData: null, lat: 51.9, lon: 4.1, heading: 0, voyage: 'Rotterdam → New York'
    };
    s.route = generateRoute(s);
    ships.push(s);
    const marker = L.marker([s.lat, s.lon], { icon: shipIcon(s) });
    marker.ship = s;
    marker.bindTooltip(`<b>${s.name}</b><br>${s.type}<br>${statusLabels[s.status]}`, { permanent: false, direction: 'top', className: 'ship-tooltip' });
    marker.on('click', (e) => { L.DomEvent.stopPropagation(e); openShip(s); });
    marker.on('mouseover', () => syncRowHover(s.id, true));
    marker.on('mouseout', () => syncRowHover(s.id, false));
    marker.addTo(map);
    markers.push(marker);
    refreshFleetViews();
    populateScenarioVessels();
    alert(`Added ${name} as a prospect. Open Scenarios to build a case.`);
  }
  function openSalesCaseWizard() {
    const prospects = ships.filter(s => s.contract === 'Prospect');
    const id = parseInt(prompt('Prospect ship ID:' + prospects.map(s => `\n${s.id} = ${s.name}`).join('')));
    const s = ships.find(x => x.id === id);
    if (!s) return alert('No prospect found with that ID');
    openShipById(s.id);
    selectTab('scenarios');
    document.getElementById('scenarioVessel').value = s.id;
    document.getElementById('scenarioRigs').value = 2;
    runScenario();
    alert('Sales case draft generated. Adjust parameters and click Save.');
  }
  // Settings, demo mode, and tour
  let demoMode = localStorage.getItem('fastFleet_demoMode') !== 'false';
  function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    document.getElementById('demoModeToggle').classList.toggle('on', demoMode);
    document.querySelectorAll('#rolePresetList .role-card').forEach(c => c.classList.toggle('active', c.dataset.role === currentRole));
  }
  function closeSettings(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('settingsModal').style.display = 'none';
  }
  function toggleDemoMode() {
    demoMode = !demoMode;
    localStorage.setItem('fastFleet_demoMode', demoMode);
    document.getElementById('demoModeToggle').classList.toggle('on', demoMode);
    applyDemoMode();
  }
  function applyDemoMode() {
    document.querySelectorAll('.demo-badge').forEach(el => el.style.display = demoMode ? 'inline-flex' : 'none');
  }
  function setRolePreset(role) {
    currentRole = role;
    localStorage.setItem('fastFleet_role', role);
    document.getElementById('roleSelect').value = role;
    document.querySelectorAll('#rolePresetList .role-card').forEach(c => c.classList.toggle('active', c.dataset.role === role));
    applyRolePreset();
    renderFleetSummary();
    if (selectedShip) {
      openShip(selectedShip);
      const defaultTab = { all: 'overview', service: 'fix', tech: 'performance', commercial: 'commercial', owner: 'overview' }[role] || 'overview';
      selectTab(defaultTab);
    }
  }
  function applyRolePreset() {
    const role = currentRole;
    const roleTabs = {
      all: ['overview', 'performance', 'fix', 'commercial', 'regs', 'optimise', 'scenarios', 'details'],
      service: ['overview', 'fix', 'details'],
      tech: ['overview', 'performance', 'regs', 'optimise', 'details'],
      commercial: ['overview', 'performance', 'commercial', 'scenarios'],
      owner: ['overview', 'performance', 'regs', 'commercial']
    };
    const visibleTabs = roleTabs[role] || roleTabs.all;
    const tabs = Array.from(document.querySelectorAll('.panel-tab'));
    const container = document.getElementById('panelTabs');
    tabs.forEach(t => {
      const visible = visibleTabs.includes(t.dataset.tab);
      t.classList.toggle('panel-hidden', !visible);
      t.classList.remove('panel-dimmed');
    });
    tabs.sort((a, b) => {
      const ia = visibleTabs.indexOf(a.dataset.tab);
      const ib = visibleTabs.indexOf(b.dataset.tab);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    tabs.forEach(t => container.appendChild(t));
    const topbarRole = {
      all: { simulate: true, wizards: true, alerts: true },
      service: { simulate: false, wizards: false, alerts: true },
      tech: { simulate: true, wizards: true, alerts: true },
      commercial: { simulate: false, wizards: true, alerts: false },
      owner: { simulate: false, wizards: false, alerts: false }
    }[role] || { simulate: true, wizards: true, alerts: true };
    const liveControls = document.querySelector('.live-controls');
    if (liveControls) liveControls.style.display = topbarRole.simulate ? '' : 'none';
    const wizardSelect = document.getElementById('wizardSelect');
    if (wizardSelect) wizardSelect.parentElement.style.display = topbarRole.wizards ? '' : 'none';
    const alertsBtn = document.getElementById('alertsBtn');
    if (alertsBtn) alertsBtn.style.display = topbarRole.alerts ? '' : 'none';
  }

  // Onboarding tour
  const tourSteps = [
    { target: '.left-panel', title: 'Fleet summary', body: 'Filter by status, alert type, or name. The fleet performance counter shows fuel saved, CO₂ saved, and current power generation.', position: 'right' },
    { target: '#map', title: 'Live map', body: 'Click any vessel to open its detail panel. Selected ships are highlighted; others are dimmed.', position: 'center' },
    { target: '#shipPanel', title: 'Role-tailored lenses', body: 'Tabs adapt to your role. All Access sees everything; other roles see only what matters to them.', position: 'left' },
    { target: '#liveBtn', title: 'Simulate', body: 'Toggle to watch vessels move along routes. Hidden for roles that don\u2019t need simulation.', position: 'bottom' },
    { target: '#alertsBtn', title: 'Alerts centre', body: 'Open the alerts centre to see critical, attention, route, and offline alerts across the fleet.', position: 'bottom' },
    { target: '#settingsBtn', title: 'Settings & demos', body: 'Enable demo mode to access guided wizards and role presets.', position: 'bottom' }
  ];
  let tourIndex = 0;
  function startTour() {
    tourIndex = 0;
    document.getElementById('tourOverlay').style.display = 'block';
    positionTourElements();
  }
  function nextTourStep() {
    tourIndex++;
    if (tourIndex >= tourSteps.length) { endTour(); return; }
    positionTourElements();
  }
  function endTour() {
    document.getElementById('tourOverlay').style.display = 'none';
  }
  function positionTourElements() {
    const step = tourSteps[tourIndex];
    const overlay = document.getElementById('tourOverlay');
    const highlight = document.getElementById('tourHighlight');
    const tooltip = document.getElementById('tourTooltip');
    document.getElementById('tourTitle').textContent = step.title;
    document.getElementById('tourBody').textContent = step.body;
    document.getElementById('tourStep').textContent = `${tourIndex + 1} / ${tourSteps.length}`;
    document.getElementById('tourNextBtn').textContent = tourIndex === tourSteps.length - 1 ? 'Finish' : 'Next';
    const target = document.querySelector(step.target);
    if (target && step.position !== 'center') {
      const rect = target.getBoundingClientRect();
      highlight.style.left = rect.left - 8 + 'px';
      highlight.style.top = rect.top - 8 + 'px';
      highlight.style.width = rect.width + 16 + 'px';
      highlight.style.height = rect.height + 16 + 'px';
      highlight.style.display = 'block';
      let tleft = rect.left + rect.width / 2 - 160;
      let ttop = rect.bottom + 16;
      if (step.position === 'left') { tleft = rect.left - 340; ttop = rect.top; }
      if (step.position === 'right') { tleft = rect.right + 16; ttop = rect.top; }
      if (step.position === 'bottom') { tleft = rect.left + rect.width / 2 - 160; ttop = rect.bottom + 16; }
      tooltip.style.left = Math.max(10, Math.min(window.innerWidth - 330, tleft)) + 'px';
      tooltip.style.top = Math.max(10, ttop) + 'px';
    } else {
      highlight.style.display = 'none';
      tooltip.style.left = '50%';
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
    }
  }

  // Arrival window optimiser: required speed for a target arrival, fuel impact via admiralty cubic (fuel ∝ v³).
  let awVoyage = null;
  function startArrivalWindowWizard() {
    if (!selectedShip) { openShipById(ships.find(s => s.sailing && s.status !== 'blue')?.id || ships[0].id); }
    selectTab('optimise');
    const v = selectedShip.details && selectedShip.details.voyage;
    const distNm = v ? parseFloat(String(v.distanceRemaining).replace(/[^0-9.]/g, '')) : (selectedShip.route ? selectedShip.route.distanceNm : 2000);
    const speedKt = v ? parseFloat(String(v.speed).replace(/[^0-9.]/g, '')) : 12;
    const etaH = Math.max(4, Math.round(distNm / speedKt));
    awVoyage = { distNm, speedKt, etaH };
    const slider = document.getElementById('awSlider');
    slider.min = Math.max(4, etaH - 48);
    slider.max = etaH + 48;
    slider.value = etaH;
    document.getElementById('awCurrent').textContent = `${speedKt} kt · ${distNm.toLocaleString()} nm · ETA ${etaH}h`;
    document.getElementById('arrivalWindowCard').style.display = 'block';
    updateArrivalWindowPreview();
  }
  function updateArrivalWindowPreview() {
    if (!awVoyage) return;
    const targetH = parseInt(document.getElementById('awSlider').value, 10);
    const widthH = parseInt(document.getElementById('awWidth').value, 10);
    const reqSpeed = awVoyage.distNm / targetH;
    const fuelPct = (Math.pow(reqSpeed / awVoyage.speedKt, 3) - 1) * 100;
    const feasible = reqSpeed >= 8 && reqSpeed <= 16;
    const saving = fuelPct < 0;
    document.getElementById('awReqSpeed').textContent = `${reqSpeed.toFixed(1)} kt (plan ${awVoyage.speedKt} kt)`;
    const fuelEl = document.getElementById('awFuel');
    fuelEl.textContent = `${saving ? '' : '+'}${fuelPct.toFixed(1)}% ${saving ? 'saving' : 'cost'}`;
    fuelEl.className = 'mono ' + (saving ? 'green' : 'red');
    document.getElementById('awWindow').textContent = `${Math.max(0, targetH - widthH)}h – ${targetH + widthH}h from now`;
    const feasEl = document.getElementById('awFeasible');
    feasEl.textContent = feasible ? 'Within engine envelope' : 'Outside engine envelope (8–16 kt)';
    feasEl.className = feasible ? 'green' : 'red';
  }
  function endArrivalWindowWizard() {
    const req = document.getElementById('awReqSpeed').textContent;
    const win = document.getElementById('awWindow').textContent;
    alert(`Recommendation endorsed: proceed at ${req} for arrival window ${win}. Logged as advisory — bridge confirms execution.`);
    document.getElementById('arrivalWindowCard').style.display = 'none';
  }
  function cancelArrivalWindowWizard() {
    document.getElementById('arrivalWindowCard').style.display = 'none';
  }

  // Maintenance response wizard
  let maintenanceStep = 1;
  function startMaintenanceWizard() {
    if (!selectedShip || !selectedShip.alertData) {
      const red = ships.find(s => s.status === 'red');
      if (red) openShipById(red.id);
      else { alert('No active maintenance alerts. Select a red-status vessel first.'); return; }
    }
    showLens('fixdetail');
    document.getElementById('maintenanceWizardCard').style.display = 'block';
    maintenanceStep = 1;
    showMaintenanceStep(1);
    if (selectedShip && selectedShip.alertData) {
      document.getElementById('mwFault').textContent = selectedShip.alertData.fault || selectedShip.alertData.faultCode;
      document.getElementById('mwComponent').textContent = selectedShip.alertData.component;
      document.getElementById('mwRul').textContent = selectedShip.alertData.rul;
    }
  }
  function showMaintenanceStep(n) {
    maintenanceStep = n;
    [1, 2, 3].forEach(i => document.getElementById('maintenanceWizardStep' + i).style.display = i === n ? 'block' : 'none');
    document.querySelectorAll('#maintenanceWizardCard .wizard-step').forEach((s, i) => {
      s.classList.toggle('active', i === n - 1);
      s.classList.toggle('done', i < n - 1);
    });
    if (n === 3) {
      document.getElementById('mwAction').textContent = document.getElementById('mwSeverity').value;
      document.getElementById('mwPartsSummary').textContent = document.getElementById('mwParts').value + ' · ' + document.getElementById('mwStock').value;
      document.getElementById('mwWindowSummary').textContent = document.getElementById('mwWindow').value;
    }
  }
  function nextMaintenanceStep() { if (maintenanceStep < 3) showMaintenanceStep(maintenanceStep + 1); }
  function prevMaintenanceStep() { if (maintenanceStep > 1) showMaintenanceStep(maintenanceStep - 1); }
  function endMaintenanceWizard() {
    alert('Work order approved and scheduled. Alert acknowledged.');
    document.getElementById('maintenanceWizardCard').style.display = 'none';
    if (selectedShip) selectedShip.alertAcknowledged = true;
    updateAlertsBadge();
  }
  function cancelMaintenanceWizard() {
    document.getElementById('maintenanceWizardCard').style.display = 'none';
  }

  // Verified invoice wizard
  let invoiceStep = 1;
  function startInvoiceWizard() {
    if (!selectedShip) openShipById(1);
    selectTab('commercial');
    const o = selectedShip && selectedShip.ops ? selectedShip.ops : { invoices: [] };
    const money = n => '£' + Math.round(n).toLocaleString();
    const list = document.getElementById('iwVoyageList');
    if (list) list.innerHTML = o.invoices.map(inv =>
      `<label class="invoice-item"><input type="checkbox" ${inv.trust === 'verified' ? 'checked' : ''} ${inv.trust === 'provisional' ? 'disabled' : ''}> ${inv.voyage} · ${inv.date} · ${inv.trust === 'verified' ? 'Verified' : 'Provisional'} · ${money(inv.amount)}</label>`).join('') || '<div style="font-size:11px;color:var(--muted);">No voyages recorded.</div>';
    const c = selectedShip && selectedShip.details ? selectedShip.details.contract : null;
    const iwContract = document.getElementById('iwContract');
    if (iwContract) iwContract.innerHTML = `<option>${selectedShip.contract} — ${c ? c.paysRate : '80% of verified savings'}</option>`;
    const totalVerified = o.invoices.filter(i => i.trust === 'verified').reduce((a, i) => a + i.amount, 0);
    const nVerified = o.invoices.filter(i => i.trust === 'verified').length;
    if (document.getElementById('iwPeriod')) document.getElementById('iwPeriod').value = 'July 2026';
    if (document.getElementById('iwTotal')) document.getElementById('iwTotal').value = money(totalVerified);
    if (document.getElementById('iwCustomer')) document.getElementById('iwCustomer').textContent = selectedShip.name + ' · ' + selectedShip.contract;
    if (document.getElementById('iwPeriodSummary')) document.getElementById('iwPeriodSummary').textContent = 'July 2026';
    if (document.getElementById('iwVoyages')) document.getElementById('iwVoyages').textContent = nVerified;
    if (document.getElementById('iwTotalDue')) document.getElementById('iwTotalDue').textContent = money(totalVerified);
    document.getElementById('invoiceWizardCard').style.display = 'block';
    invoiceStep = 1;
    showInvoiceStep(1);
  }
  function showInvoiceStep(n) {
    invoiceStep = n;
    [1, 2, 3].forEach(i => document.getElementById('invoiceWizardStep' + i).style.display = i === n ? 'block' : 'none');
    document.querySelectorAll('#invoiceWizardCard .wizard-step').forEach((s, i) => {
      s.classList.toggle('active', i === n - 1);
      s.classList.toggle('done', i < n - 1);
    });
  }
  function nextInvoiceStep() { if (invoiceStep < 3) showInvoiceStep(invoiceStep + 1); }
  function prevInvoiceStep() { if (invoiceStep > 1) showInvoiceStep(invoiceStep - 1); }
  function endInvoiceWizard() {
    const total = document.getElementById('iwTotalDue') ? document.getElementById('iwTotalDue').textContent : '';
    alert(`Verified invoice generated for ${total}. Draft sent to finance.`);
    document.getElementById('invoiceWizardCard').style.display = 'none';
  }
  function cancelInvoiceWizard() {
    document.getElementById('invoiceWizardCard').style.display = 'none';
  }

  // Regulatory submission wizard
  let regulatoryStep = 1;
  function startRegulatoryWizard() {
    if (!selectedShip) openShipById(1);
    selectTab('regs');
    document.getElementById('regulatoryWizardCard').style.display = 'block';
    regulatoryStep = 1;
    showRegulatoryStep(1);
  }
  function showRegulatoryStep(n) {
    regulatoryStep = n;
    [1, 2, 3].forEach(i => document.getElementById('regulatoryWizardStep' + i).style.display = i === n ? 'block' : 'none');
    document.querySelectorAll('#regulatoryWizardCard .wizard-step').forEach((s, i) => {
      s.classList.toggle('active', i === n - 1);
      s.classList.toggle('done', i < n - 1);
    });
    if (n === 3) {
      document.getElementById('rwPortal').textContent = document.getElementById('rwRegulation').value;
      document.getElementById('rwPeriodSummary').textContent = document.getElementById('rwPeriod').value;
    }
  }
  function nextRegulatoryStep() { if (regulatoryStep < 3) showRegulatoryStep(regulatoryStep + 1); }
  function prevRegulatoryStep() { if (regulatoryStep > 1) showRegulatoryStep(regulatoryStep - 1); }
  function endRegulatoryWizard() {
    const reg = document.getElementById('rwRegulation').value;
    const period = document.getElementById('rwPeriod').value;
    alert(`Regulatory submission sent to ${reg} for ${period}. Submission ID: REG-${Date.now().toString().slice(-6)}`);
    document.getElementById('regulatoryWizardCard').style.display = 'none';
  }
  function cancelRegulatoryWizard() {
    document.getElementById('regulatoryWizardCard').style.display = 'none';
  }

  // Evaluate vessel (prospect estimation via /api/evaluate)
  function renderEvaluationResult(ev) {
    const result = document.getElementById('evalResult');
    if (!result) return;
    const usd = n => (n === null || n === undefined || isNaN(n)) ? '—' : 'US$' + Math.round(n).toLocaleString();
    const num = (n, dp) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toFixed(dp);
    const note = ev.note || 'Provisional estimate — not admissible for PAYS invoicing, guarantees, or regulatory filings.';
    result.innerHTML = `
      <div class="scenario-result" style="margin-top:12px;">
        <div class="mini-list-item" style="font-weight:700;"><span>Evaluation${ev.name ? ' · ' + ev.name : ''}</span><span class="badge badge-provisional">Provisional</span></div>
        <div class="metric" style="margin:10px 0 4px;"><div class="metric-value green">${num(ev.estSavingsPct, 1)}%</div><div class="metric-label">Est. fuel saving</div></div>
        <div class="mini-list-item"><span>Est. fuel saved</span><span class="mono">${num(ev.estAnnualFuelSavedT, 1)} t/yr</span></div>
        <div class="mini-list-item"><span>Est. savings value</span><span class="mono">${usd(ev.estAnnualValueUsd)}/yr</span></div>
        <div class="mini-list-item"><span>Est. fee</span><span class="mono">${usd(ev.estAnnualFeeUsd)}/yr</span></div>
        <div class="mini-list-item"><span>Net benefit</span><span class="mono">${usd(ev.estNetAnnualBenefitUsd)}/yr</span></div>
        <div class="mini-list-item"><span>Assumed units</span><span class="mono">${ev.assumedUnits !== null && ev.assumedUnits !== undefined ? ev.assumedUnits : '—'}</span></div>
        <div class="mini-list-item"><span>DWT band</span><span class="mono">${ev.dwtBand || '—'}</span></div>
        <div style="font-size:10px;color:var(--muted);margin-top:8px;">${note}</div>
      </div>
    `;
  }
  async function runEvaluation() {
    const type = document.getElementById('evalType').value;
    const dwt = parseInt(document.getElementById('evalDwt').value, 10);
    const name = document.getElementById('evalName').value.trim();
    const result = document.getElementById('evalResult');
    if (!dwt) {
      result.innerHTML = '<div class="alert alert-amber" style="margin-top:10px;"><div class="alert-icon">!</div><div class="alert-text">Enter a DWT between 1,000 and 500,000.</div></div>';
      return;
    }
    result.innerHTML = '<div style="font-size:11px;color:var(--muted);margin-top:10px;">Evaluating…</div>';
    try {
      const res = await fetch(`/api/evaluate?type=${encodeURIComponent(type)}&dwt=${dwt}&name=${encodeURIComponent(name)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Evaluation failed');
      renderEvaluationResult(data);
    } catch (err) {
      result.innerHTML = `<div class="alert alert-amber" style="margin-top:10px;"><div class="alert-icon">!</div><div class="alert-text">${err.message}</div></div>`;
    }
  }
  // Logo/title click: reset to default fleet map view
  function resetFleetView() {
    closeAlertsCentre();
    const settings = document.getElementById('settingsModal');
    if (settings) settings.style.display = 'none';
    document.getElementById('columnMenu').style.display = 'none';
    closePanel();
    showLens('overview');
    setViewMode('map');
    if (ships.length) {
      map.fitBounds(L.latLngBounds(ships.map(s => [s.lat, s.lon])), { padding: [40, 40] });
    }
  }

  // Expose scenario helpers referenced by inline onclick
  Object.assign(window, { loadScenario, ackAlert });

  // Init new UI pieces
  populateScenarioVessels();
  renderSavedScenarios();
  renderScenarioComparison();
  applyDemoMode();
  applyRolePreset();

  // Expose handlers that the inline HTML onclick attributes reference.
  Object.assign(window, {
    closePanel, selectTab, showLens, showFixTab, openWorkOrder,
    openWorkOrderFromBoard, headlineAction,
    toggleWeatherLayer, openEntity, popEntity, navigateToEntity,
    openComponentEntity, openSensorEntity, openShip, openShipById,
    toggleMenu, toggleLiveMode, setLiveSpeed, openAlertsCentre, closeAlertsCentre,
    filterAlerts, acknowledgeAllAlerts, runScenario, saveScenario, clearScenarios,
    runWizard, loadScenario, ackAlert,
    openSettings, closeSettings, toggleDemoMode, setRolePreset, startTour, nextTourStep, endTour,
    startArrivalWindowWizard, updateArrivalWindowPreview, endArrivalWindowWizard, cancelArrivalWindowWizard,
    startMaintenanceWizard, nextMaintenanceStep, prevMaintenanceStep, endMaintenanceWizard, cancelMaintenanceWizard,
    startInvoiceWizard, nextInvoiceStep, prevInvoiceStep, endInvoiceWizard, cancelInvoiceWizard,
    startRegulatoryWizard, nextRegulatoryStep, prevRegulatoryStep, endRegulatoryWizard, cancelRegulatoryWizard,
    setViewMode, toggleFiltersSection, toggleFilterValue, removeFilterChip, clearAllFilters,
    loadFilterPreset, saveFilterPreset, deleteFilterPreset,
    renderListView, refreshFleetViews, applyFilters,
    sortListBy, exportFleetCsv, toggleColumnMenu, setListColumn, syncMarkerHover, syncRowHover,
    runEvaluation, resetFleetView, toggleLegend, toggleMoreFilters
  });
  }

  loadFleetData()
    .then(ok => {
      if (!ok) console.log('Using embedded static data');
      return initApp();
    })
    .catch(err => {
      console.warn('API load failed, using fallback:', err);
      return initApp();
    });

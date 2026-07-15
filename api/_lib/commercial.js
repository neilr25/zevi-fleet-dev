// Shared commercial model for the ZEVI fleet prototype.
// All money/savings constants live here so the prototype stays deterministic
// and every number shown in the UI traces back to data + these assumptions.
//
// ROI is a run-rate multiple: annual verified-savings value / annual service fee.
// SGS contracts are service contracts (Lease = fixed annual fee, PAYS = share of
// verified savings); there is no customer capex, so "payback years" is not the
// right frame and is intentionally omitted.

const FUEL_PRICE_USD_PER_T = 650;     // VLSFO-ish reference price
const ANNUAL_BURN_T_PER_DWT = 0.15;   // fleet heuristic: annual fuel burn scales with dwt
const LEASE_FEE_PER_UNIT_USD = 60000; // fixed annual fee per FastRig unit
const LEASE_FEE_PER_DWT_USD = 1.5;    // plus a size-scaled component
const NOW = new Date('2026-07-15T00:00:00Z'); // prototype "today" (data is anchored to Jul 2026)

const DWT_BANDS = [
  { max: 10000, label: '<10k', adj: -0.8 },
  { max: 50000, label: '10k–50k', adj: 0 },
  { max: 80000, label: '50k–80k', adj: 0.3 },
  { max: 120000, label: '80k–120k', adj: 0.6 },
  { max: 200000, label: '120k–200k', adj: 0.9 },
  { max: Infinity, label: '>200k', adj: 1.1 }
];

const BASE_SAVINGS_PCT_BY_TYPE = {
  'Bulk Carrier': 5.5,
  'Tanker': 5.2,
  'Container': 6.0,
  'RoRo': 5.8,
  'Chemical & Oil Carrier': 5.3,
  'Gas Carrier': 5.4,
  'General Cargo': 5.6
};

function dwtBand(dwt) {
  const band = DWT_BANDS.find(b => dwt < b.max);
  return band ? band.label : '>200k';
}

function dwtBandAdj(dwt) {
  const band = DWT_BANDS.find(b => dwt < b.max);
  return band ? band.adj : 1.1;
}

function unitCountForDwt(dwt) {
  if (dwt < 50000) return 1;
  if (dwt < 120000) return 2;
  return 3;
}

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }

function annualFeeUsd({ contractType, paysRate, unitCount, dwt, annualSavingsValueUsd }) {
  if (contractType === 'PAYS') {
    // Fee is the agreed share of verified savings value.
    return Math.round(annualSavingsValueUsd * (paysRate != null ? paysRate : 0.8));
  }
  // Lease-style fixed annual fee.
  return Math.round(unitCount * LEASE_FEE_PER_UNIT_USD + dwt * LEASE_FEE_PER_DWT_USD);
}

function roiFrom({ annualSavingsValueUsd, contractType, paysRate, unitCount, dwt }) {
  const fee = annualFeeUsd({ contractType, paysRate, unitCount, dwt, annualSavingsValueUsd });
  return {
    annualSavingsValueUsd: Math.round(annualSavingsValueUsd),
    annualFeeUsd: fee,
    roiMultiple: fee > 0 ? round2(annualSavingsValueUsd / fee) : null,
    netAnnualBenefitUsd: Math.round(annualSavingsValueUsd - fee)
  };
}

// Deployed vessel: run-rate ROI from the verified saving % (Gold) and contract terms.
function deployedRoi({ dwt, unitCount, contract, fuelSavingPct }) {
  const annualBurnT = dwt * ANNUAL_BURN_T_PER_DWT;
  const annualSavingsValueUsd = annualBurnT * (fuelSavingPct / 100) * FUEL_PRICE_USD_PER_T;
  return roiFrom({
    annualSavingsValueUsd,
    contractType: contract.type,
    paysRate: contract.paysRate,
    unitCount,
    dwt
  });
}

// Prospect / arbitrary vessel: provisional estimate from type + DWT band.
function evaluateProspect({ type, dwt }) {
  const base = BASE_SAVINGS_PCT_BY_TYPE[type] || 5.5;
  const estSavingsPct = round1(base + dwtBandAdj(dwt));
  const annualBurnT = dwt * ANNUAL_BURN_T_PER_DWT;
  const estAnnualFuelSavedT = round1(annualBurnT * (estSavingsPct / 100));
  const estAnnualValueUsd = Math.round(estAnnualFuelSavedT * FUEL_PRICE_USD_PER_T);
  const units = unitCountForDwt(dwt);
  const roi = roiFrom({
    annualSavingsValueUsd: estAnnualValueUsd,
    contractType: 'Lease', // assume lease-style fee for evaluation
    unitCount: units,
    dwt
  });
  return {
    estSavingsPct,
    estAnnualFuelSavedT,
    estAnnualValueUsd,
    estAnnualFeeUsd: roi.annualFeeUsd,
    estRoiMultiple: roi.roiMultiple,
    estNetAnnualBenefitUsd: roi.netAnnualBenefitUsd,
    assumedUnits: units,
    dwtBand: dwtBand(dwt),
    basis: 'type+dwt heuristic',
    calcMethodVersion: 'estimate-v0.1',
    trust: 'provisional'
  };
}

module.exports = {
  FUEL_PRICE_USD_PER_T,
  ANNUAL_BURN_T_PER_DWT,
  dwtBand,
  unitCountForDwt,
  deployedRoi,
  evaluateProspect
};

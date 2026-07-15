module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { vesselType, rigs, windFactor, routeDeviation, fuelPrice, annualFuel } = req.body || {};
  const baseSaving = {
    'Bulk Carrier': 6.2,
    'Container': 5.8,
    'Tanker': 4.9,
    'RoRo': 6.5
  }[vesselType] || 5.5;

  const rigBoost = (rigs || 0) * 1.8;
  const windBoost = ((windFactor || 1) - 1) * 8;
  const devPenalty = Math.abs(routeDeviation || 0) * 0.03;
  const predictedSaving = Math.max(0, baseSaving + rigBoost + windBoost - devPenalty);
  const fuelT = annualFuel || 2500;
  const fuelSavedT = fuelT * predictedSaving / 100;
  const co2SavedT = fuelSavedT * 3.15;
  const valueGBP = fuelSavedT * (fuelPrice || 650) * 0.8;
  const paybackYears = rigs ? (rigs * 0.45) / (valueGBP / 1e6) : 0;

  res.status(200).json({
    baseSaving,
    rigBoost,
    windBoost,
    devPenalty,
    predictedSaving,
    fuelSavedT: Math.round(fuelSavedT),
    co2SavedT: Math.round(co2SavedT),
    valueGBP: Math.round(valueGBP),
    paybackYears: paybackYears ? paybackYears.toFixed(1) : null
  });
};

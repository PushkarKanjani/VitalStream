/**
 * Single source of truth for outlier rules on the frontend.
 * Mirrors backend app/outlier_rules.py definitions.
 */

export const METRIC_RULES = {
  syst_bp: {
    label: 'SBP',
    fullLabel: 'Systolic BP',
    unit: 'mmHg',
    expectedLow: 75.0,
    expectedHigh: 180.0,
    impossibleLow: 20.0,
    impossibleHigh: 300.0,
  },
  hr: {
    label: 'HR',
    fullLabel: 'Heart Rate',
    unit: 'bpm',
    expectedLow: 45.0,
    expectedHigh: 140.0,
    impossibleLow: 20.0,
    impossibleHigh: 260.0,
  },
  o2_sat: {
    label: 'SpO₂',
    fullLabel: 'Oxygen Saturation',
    unit: '%',
    expectedLow: 85.0,
    expectedHigh: 100.0,
    impossibleLow: 30.0,
    impossibleHigh: 100.0,
  },
  etco2: {
    label: 'EtCO₂',
    fullLabel: 'End-Tidal CO2',
    unit: 'mmHg',
    expectedLow: 20.0,
    expectedHigh: 55.0,
    impossibleLow: 5.0,
    impossibleHigh: 100.0,
  },
  temp_c: {
    label: 'Temp',
    fullLabel: 'Temperature',
    unit: '°C',
    expectedLow: 35.0,
    expectedHigh: 39.5,
    impossibleLow: 25.0,
    impossibleHigh: 45.0,
  },
}

export function classifyMetric(metric, value) {
  const cfg = METRIC_RULES[metric]
  if (!cfg || value == null) return null

  if (value < cfg.impossibleLow || value > cfg.impossibleHigh) {
    return { level: 'artifact', label: 'SENSOR CHECK', rule: 'ARTIFACT' }
  }
  if (value < cfg.expectedLow || value > cfg.expectedHigh) {
    return { level: 'danger', label: 'CRITICAL', rule: 'THRESHOLD' }
  }
  return { level: 'normal', label: 'NORMAL', rule: 'none' }
}

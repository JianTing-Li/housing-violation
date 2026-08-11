// Fixed, hand-chosen rate bins for the neighborhood choropleth legend —
// deliberately NOT quantiles, so a bin's meaning stays the same across
// data refreshes instead of shifting whenever the underlying rates move.
//
// Chosen by inspecting the actual distribution of Bronx NTA rates (38
// neighborhoods clearing the 25-case volume floor, ranging ~46%-88%):
// round 5-point boundaries at 65/75/80/85 split that range into legible,
// roughly-populated groups (7/4/8/12/7 neighborhoods per bin) without
// implying more precision than the data supports. Revisit only if a future
// refresh moves the real range outside the current bounds.
export const RATE_BINS = [
  { id: 'under-65', min: -Infinity, max: 65, label: 'Under 65%' },
  { id: '65-74', min: 65, max: 75, label: '65–74%' },
  { id: '75-79', min: 75, max: 80, label: '75–79%' },
  { id: '80-84', min: 80, max: 85, label: '80–84%' },
  { id: '85-plus', min: 85, max: Infinity, label: '85% and above' },
];

export const INSUFFICIENT_DATA_BIN = {
  id: 'insufficient-data',
  label: 'Insufficient data',
};

export const MIN_CLASSIFIABLE_CASES = 25;

// A neighborhood is only assigned a rate bin if it has both a computed
// rate and enough classifiable cases to trust it — otherwise it gets the
// insufficient-data bucket regardless of what its raw rate happens to be.
export function binForNeighborhood(entry) {
  if (!entry || entry.rate == null || !entry.sufficient_data) {
    return INSUFFICIENT_DATA_BIN;
  }
  const pct = entry.rate * 100;
  const bin = RATE_BINS.find((b) => pct >= b.min && pct < b.max);
  return bin ?? INSUFFICIENT_DATA_BIN;
}

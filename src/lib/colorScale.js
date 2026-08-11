import { RATE_BINS, INSUFFICIENT_DATA_BIN, binForNeighborhood } from './neighborhoodLegend.js';

// Discrete, single-hue palette — one fixed color per legend bin, not a
// continuous interpolation. A neighborhood's color only changes if it
// crosses a bin boundary, not on every data refresh, and the map's colors
// always match exactly what the legend shows.
const BIN_COLORS = {
  'under-65': '#f7ebe3',
  '65-74': '#e8c3ac',
  '75-79': '#d69a72',
  '80-84': '#b3401f',
  '85-plus': '#7a2a14',
};

export const INSUFFICIENT_DATA_COLOR = '#c9c5bd';

export function colorForBin(bin) {
  if (!bin || bin === INSUFFICIENT_DATA_BIN) return INSUFFICIENT_DATA_COLOR;
  return BIN_COLORS[bin.id] ?? INSUFFICIENT_DATA_COLOR;
}

export function colorForNeighborhood(entry) {
  return colorForBin(binForNeighborhood(entry));
}

export { RATE_BINS, INSUFFICIENT_DATA_BIN, BIN_COLORS };

// Single-hue scale from pale tint to the site accent color, per the
// "avoid red/green" design guidance — intensity reads as "more recurrence"
// without implying good/bad via hue.
const LOW = [250, 235, 224]; // pale tint of the accent
const HIGH = [140, 45, 20]; // darker accent for the top of the range
const NO_DATA = '#dedad3';

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

export function makeRateColorScale(values) {
  const finite = values.filter((v) => v != null);
  const min = Math.min(...finite);
  const max = Math.max(...finite);

  return function colorFor(rate) {
    if (rate == null) return NO_DATA;
    const t = max === min ? 0.5 : (rate - min) / (max - min);
    const [r, g, b] = [0, 1, 2].map((i) => lerp(LOW[i], HIGH[i], t));
    return `rgb(${r}, ${g}, ${b})`;
  };
}

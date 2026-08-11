export function formatPct(rate, digits = 0) {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(digits)}%`;
}

export function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

// Violation descriptions come from raw NOV citation text (ALL CAPS legal
// language plus apartment/floor-specific detail baked in). This strips the
// leading section-code citation and cuts before the apartment-specific
// tail, so it reads as a category label rather than a single citation.
export function cleanViolationLabel(description) {
  let s = description || '';
  s = s.replace(/^HMC ADM CODE:\s*/i, '');
  s = s.replace(/^§+\s?[\d.\-()A-Za-z]*\s*(,\s*[\d.\-()A-Za-z]+\s*)*(ADM\.?\s?CODE|HMC|M\/D LAW)?:?\s*/i, '');

  const cutMarkers = [' LOCATED AT', ' IN THE ENTIRE APARTMENT', ' AT APT', ' AT PUBLIC HALL', ', SECTION'];
  for (const marker of cutMarkers) {
    const idx = s.indexOf(marker);
    if (idx !== -1) {
      s = s.slice(0, idx);
      break;
    }
  }

  s = s.trim();
  if (s.length > 70) {
    const truncated = s.slice(0, 70);
    const lastSpace = truncated.lastIndexOf(' ');
    s = `${(lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim()}…`;
  }
  s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Single source of truth for each finding's recommendation — used both
// inline (as a Callout next to its chart) and in the Recommendations
// summary section, so the two never drift apart.
export const RECOMMENDATIONS = [
  {
    id: 'reinspection',
    section: 'All closed violations',
    text: 'Test follow-up inspections on a sample of closed violations. Compare the results with similar cases that did not receive a follow-up inspection.',
    tier: 2,
  },
  {
    id: 'severity-scrutiny',
    section: 'More serious violations',
    text: 'Give Class C closures a larger share of follow-up checks, then compare their repeat violation rate with Classes A and B.',
    tier: 1,
  },
  {
    id: 'violation-targeting',
    section: 'Common repeat types',
    text: 'Start a follow-up pilot with violation categories that have both high repeat rates and enough records for a fair comparison.',
    tier: 1,
  },
  {
    id: 'neighborhood-resourcing',
    section: 'Neighborhood patterns',
    text: 'Use neighborhood rates to choose sites for a pilot, while accounting for the mix of buildings and registrations in each area.',
    tier: 3,
  },
  {
    id: 'owner-accountability',
    section: 'Owner records',
    text: 'Join these records with HPD’s Registration Contacts data before drawing conclusions about an owner’s full portfolio. Then examine owners with both many violations and high repeat rates.',
    tier: 4,
  },
];

// Presentation metadata for the Recommendations summary section only —
// the inline per-chart Callouts read `text` by id and never see this.
export const RECOMMENDATION_TIERS = [
  {
    tier: 1,
    label: 'Start here',
    note: 'Narrow, cheap pilots with a clear comparison built in. They are fast to staff and fast to read results from.',
  },
  {
    tier: 2,
    label: 'Then',
    note: 'A broader, more resource-intensive test worth running once a narrow pilot shows signal.',
  },
  {
    tier: 3,
    label: 'Use alongside a pilot',
    note: 'Not a standalone test. It is a targeting layer for choosing where to run a Tier 1 or 2 pilot.',
  },
  {
    tier: 4,
    label: 'Data prerequisite',
    note: 'Not yet actionable as a pilot. This requires a data join HPD would need to do first.',
  },
];

export function getRecommendation(id) {
  return RECOMMENDATIONS.find((r) => r.id === id)?.text ?? '';
}

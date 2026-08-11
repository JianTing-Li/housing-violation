// Single source of truth for each finding's recommendation — used both
// inline (as a Callout next to its chart) and in the Recommendations
// summary section, so the two never drift apart.
export const RECOMMENDATIONS = [
  {
    id: 'reinspection',
    section: 'All closed violations',
    text: 'Test follow-up inspections on a sample of closed violations. Compare the results with similar cases that did not receive a follow-up inspection.',
  },
  {
    id: 'severity-scrutiny',
    section: 'More serious violations',
    text: 'Give Class C closures a larger share of follow-up checks, then compare their repeat violation rate with Classes A and B.',
  },
  {
    id: 'violation-targeting',
    section: 'Common repeat types',
    text: 'Start a follow-up pilot with violation categories that have both high repeat rates and enough records for a fair comparison.',
  },
  {
    id: 'neighborhood-resourcing',
    section: 'Neighborhood patterns',
    text: 'Use neighborhood rates to choose sites for a pilot, while accounting for the mix of buildings and registrations in each area.',
  },
  {
    id: 'owner-accountability',
    section: 'Owner records',
    text: 'Join these records with HPD’s Registration Contacts data before drawing conclusions about an owner’s full portfolio. Then examine owners with both many violations and high repeat rates.',
  },
];

export function getRecommendation(id) {
  return RECOMMENDATIONS.find((r) => r.id === id)?.text ?? '';
}

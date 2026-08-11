// Single source of truth for each finding's recommendation — used both
// inline (as a Callout next to its chart) and in the Recommendations
// summary section, so the two never drift apart.
export const RECOMMENDATIONS = [
  {
    id: 'reinspection',
    section: 'Overall recurrence rate',
    text: 'Require a verified re-inspection before a violation is closed, instead of relying on landlord self-certification — the current system counts a violation as "fixed" without confirming it.',
  },
  {
    id: 'severity-scrutiny',
    section: 'Severity class',
    text: 'Scrutiny at close-out should scale with severity, not just urgency at issuance — a Class C closure deserves at least as much verification as a Class A one.',
  },
  {
    id: 'violation-targeting',
    section: 'Violation type',
    text: "Target verified re-inspection at these specific top categories first — they're where a \"closed\" status is least likely to mean the problem is actually gone.",
  },
  {
    id: 'neighborhood-resourcing',
    section: 'Neighborhood patterns',
    text: 'Use this pattern for inspection-capacity and resourcing decisions, not as a standalone explanation — high-recurrence neighborhoods are where verified re-inspection would catch the most repeat failures per inspector-hour.',
  },
  {
    id: 'owner-accountability',
    section: 'Owner & building level',
    text: "Pursue ownership-level accountability for the owners with both high volume and high rates. A full portfolio view requires joining against HPD's separate Registration Contacts dataset — a next step, not a finished claim here.",
  },
];

export function getRecommendation(id) {
  return RECOMMENDATIONS.find((r) => r.id === id)?.text ?? '';
}

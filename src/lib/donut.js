// Pure data-shaping for the overall-recurrence donut, kept separate from
// the chart component so the numerator/denominator/reconciliation logic is
// testable without rendering React or Recharts.
//
// The whole point of this module: the donut's geometry and its headline
// percentage must share the same denominator. Too-recent (censored) cases
// have no share of the circle at all — they're reported as a separate
// count outside the chart, not folded into a third slice.
export function computeDonutData(summary) {
  const classifiable = summary.recurred + summary.no_recurrence;
  const recurredShare = classifiable === 0 ? 0 : summary.recurred / classifiable;
  const noRecurrenceShare = classifiable === 0 ? 0 : summary.no_recurrence / classifiable;

  return {
    classifiable,
    tooRecentCount: summary.censored,
    totalAnalyzed: summary.total,
    segments: [
      {
        key: 'recurred',
        label: 'Repeat violation within a year',
        count: summary.recurred,
        share: recurredShare,
      },
      {
        key: 'no_recurrence',
        label: 'Full year passed with no match',
        count: summary.no_recurrence,
        share: noRecurrenceShare,
      },
    ],
  };
}

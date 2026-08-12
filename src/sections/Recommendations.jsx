import { RECOMMENDATIONS, RECOMMENDATION_TIERS } from '../lib/recommendations.js';

export function Recommendations() {
  return (
    <section id="recommendations" className="section">
      <h2>What could HPD test next?</h2>
      <p>
        Closing the gap between a violation being marked resolved and the underlying problem
        actually going away matters for two reasons. Tenants would spend less time living with
        hazards that were supposedly fixed, and HPD's inspectors would spend less time
        re-inspecting the same order at the same building. The patterns above point to where that
        gap is most worth testing.
      </p>
      <p>
        These patterns do not show why a violation type was recorded again. They can help shape
        follow-up tests and show where a closer look may be most useful.
      </p>
      <p>
        The order below is deliberate. Narrower, cheaper pilots come first because they're faster
        to staff and yield results sooner. Broader or more dependent tests follow once those early
        pilots show signal.
      </p>

      <div className="recommendation-tiers">
        {RECOMMENDATION_TIERS.map(({ tier, label, note }) => {
          const items = RECOMMENDATIONS.filter((r) => r.tier === tier);
          if (items.length === 0) return null;
          const isPrerequisite = tier === 4;

          return (
            <div
              key={tier}
              className={
                isPrerequisite
                  ? 'recommendation-tier recommendation-tier--prerequisite'
                  : 'recommendation-tier'
              }
            >
              <div className="recommendation-tier__header">
                <span className="recommendation-tier__badge">
                  {isPrerequisite ? '⏸' : tier}
                </span>
                <div>
                  <span className="recommendation-tier__label">{label}</span>
                  <span className="recommendation-tier__note">{note}</span>
                </div>
              </div>
              <ol className="recommendations-list">
                {items.map((r) => (
                  <li key={r.id}>
                    <span className="recommendations-list__section">{r.section}</span>
                    <span>{r.text}</span>
                    {isPrerequisite && (
                      <span className="recommendations-list__flag">Not yet actionable</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}

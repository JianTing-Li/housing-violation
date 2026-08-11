import { RECOMMENDATIONS } from '../lib/recommendations.js';

export function Recommendations() {
  return (
    <section id="recommendations" className="section">
      <h2>What could HPD test next?</h2>
      <p>
        These patterns do not show why a violation type was recorded again. They can help shape
        follow-up tests—and show where a closer look may be most useful.
      </p>
      <ol className="recommendations-list">
        {RECOMMENDATIONS.map((r) => (
          <li key={r.id}>
            <span className="recommendations-list__section">{r.section}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

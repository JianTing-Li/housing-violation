import { RECOMMENDATIONS } from '../lib/recommendations.js';

export function Recommendations() {
  return (
    <section id="recommendations" className="section">
      <h2>What this suggests</h2>
      <p>
        None of these findings say a given owner or neighborhood is acting in bad faith — they
        point at where the current close-out process isn't confirming that a fix actually held.
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

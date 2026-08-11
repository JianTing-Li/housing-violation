import { useJsonData } from '../hooks/useJsonData.js';
import { formatPct } from '../lib/format.js';

export function Hero() {
  const { data, loading, error } = useJsonData('overall_summary.json');

  return (
    <section id="overview" className="section section--hero">
      <h1>When a Bronx housing violation is closed, what happens next?</h1>
      <p className="lede">
        We examined closed HPD violations to measure how often a violation with the same order
        number was recorded again in the same building within one year. This does not establish
        that the same condition returned or that a repair failed. It identifies patterns that may
        warrant further investigation.
      </p>

      {loading && <p className="hero-stat hero-stat--loading">Loading…</p>}
      {error && <p className="hero-stat hero-stat--error">Couldn't load summary data.</p>}
      {data && (
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat__number">{formatPct(data.rate)}</span>
            <span className="hero-stat__label">
              of classifiable cases had a repeat violation within a year
            </span>
          </div>
          <div className="hero-stat hero-stat--sub">
            <span className="hero-stat__number">{formatPct(data.building_any_recurrence_rate)}</span>
            <span className="hero-stat__label">
              of buildings in the analysis had at least one repeat violation
            </span>
          </div>
        </div>
      )}

      <details className="term-note">
        <summary>What counts as a repeat violation?</summary>
        <p>
          A repeat violation means a later violation with the same building ID and HPD order
          number was recorded within 365 days of the first one’s close date. It does not mean the
          same physical condition returned, the same apartment was involved, or that a repair
          failed.
        </p>
      </details>

      {data && (
        <p className="methodology-line">
          Bronx HPD violations, {data.date_range_start.slice(0, 10)} to{' '}
          {data.data_cutoff.slice(0, 10)} · {data.total.toLocaleString()} closed violations
          analyzed
        </p>
      )}
    </section>
  );
}

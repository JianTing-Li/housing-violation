import { useJsonData } from '../hooks/useJsonData.js';
import { formatPct } from '../lib/format.js';

export function Hero() {
  const { data, loading, error } = useJsonData('overall_summary.json');

  return (
    <section id="overview" className="section section--hero">
      <h1>When a Bronx housing violation is closed, what happens next?</h1>
      <p className="lede">
        We tracked closed HPD violations to see how often the same kind was recorded again in the
        same building within a year. A repeat does not prove that the same condition returned or
        that a repair failed. But it raises a useful question: was the underlying problem fully
        addressed?
      </p>

      {loading && <p className="hero-stat hero-stat--loading">Loading…</p>}
      {error && <p className="hero-stat hero-stat--error">Couldn't load summary data.</p>}
      {data && (
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat__number">{formatPct(data.rate)}</span>
            <span className="hero-stat__label">
              of classifiable cases had a same-type repeat within a year
            </span>
          </div>
          <div className="hero-stat hero-stat--sub">
            <span className="hero-stat__number">{formatPct(data.building_any_recurrence_rate)}</span>
            <span className="hero-stat__label">
              of buildings in the analysis had at least one same-type repeat
            </span>
          </div>
        </div>
      )}

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

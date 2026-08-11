import { useJsonData } from '../hooks/useJsonData.js';
import { formatPct } from '../lib/format.js';

export function Hero() {
  const { data, loading, error } = useJsonData('overall_summary.json');

  return (
    <section id="overview" className="section section--hero">
      <h1>When a Bronx housing violation closes, does it actually go away?</h1>
      <p className="lede">
        A fixed violation that comes back means the repair wasn't real. We looked at how often
        the same violation reappears on the same building within a year of being marked
        closed — a proxy for whether landlords are actually fixing problems, not just how many
        violations exist.
      </p>

      {loading && <p className="hero-stat hero-stat--loading">Loading…</p>}
      {error && <p className="hero-stat hero-stat--error">Couldn't load summary data.</p>}
      {data && (
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat__number">{formatPct(data.rate)}</span>
            <span className="hero-stat__label">of closed violations recur within a year</span>
          </div>
          <div className="hero-stat hero-stat--sub">
            <span className="hero-stat__number">{formatPct(data.building_any_recurrence_rate)}</span>
            <span className="hero-stat__label">of buildings had at least one recurrence</span>
          </div>
        </div>
      )}

      {data && (
        <p className="methodology-line">
          Bronx HPD violations, {data.date_range_start.slice(0, 10)} to{' '}
          {data.last_updated.slice(0, 10)} · {data.total.toLocaleString()} closed violations
          analyzed
        </p>
      )}
    </section>
  );
}

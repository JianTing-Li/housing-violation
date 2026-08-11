import { useState } from 'react';
import { ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { formatNumber } from '../lib/format.js';

const SCATTER_TARGET_POINTS = 800;

export function Methodology() {
  const [expanded, setExpanded] = useState(false);
  const { data: summary } = useJsonData('overall_summary.json');
  const { data: scatter } = useJsonData('building_scatter.json');

  const sampledScatter =
    expanded && scatter
      ? scatter.filter((_, i) => i % Math.max(1, Math.ceil(scatter.length / SCATTER_TARGET_POINTS)) === 0)
      : null;

  return (
    <section id="methodology" className="section">
      <details className="methodology" onToggle={(e) => setExpanded(e.target.open)}>
        <summary>Methodology &amp; limitations</summary>

        <div className="methodology__body">
          <p>
            A violation "recurs" if a later violation with the same building ID and order number
            has an inspection date within <strong>365 days</strong> of the prior one's effective
            close date (the certified date, or the status-change date if no certification exists).
          </p>
          <p>
            Violations closed too recently to have had a full 365-day window are{' '}
            <strong>censored</strong> — excluded from the rate rather than counted as "no
            recurrence," since we don't yet know how they'll turn out. This is a standard
            survival-analysis approach: counting an unresolved case as a negative would bias the
            rate downward.
          </p>
          <p>
            Rankings by rate (violation type, neighborhood, owner) apply a minimum volume floor of
            25 eligible closed violations before a rate is shown — a building or category with a
            handful of violations can swing from 0% to 100% on a single case, which isn't a
            meaningful signal. The scatterplot below shows why: rates for buildings with few
            eligible violations are scattered across the full range, while buildings with more
            history cluster more tightly.
          </p>

          {sampledScatter && (
            <div className="chart-block">
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <XAxis
                    type="number"
                    dataKey="eligible_count"
                    name="Eligible closed violations"
                    label={{ value: 'Eligible closed violations (log scale)', position: 'bottom', fontSize: 12 }}
                    scale="log"
                    domain={['auto', 'auto']}
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="recurrence_rate"
                    name="Recurrence rate"
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    domain={[0, 1]}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ZAxis range={[12, 12]} />
                  <Scatter data={sampledScatter} fill="#b3401f" fillOpacity={0.35} />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="chart-caption">
                Each point is one building ({formatNumber(sampledScatter.length)} of{' '}
                {formatNumber(scatter.length)} shown). Buildings with few eligible violations
                (left side) scatter across the full rate range; buildings with more history
                (right side) converge — a visual case for the volume floor used elsewhere on this
                page.
              </p>
            </div>
          )}

          {summary && (
            <p className="methodology-line">
              Data source:{' '}
              <a href="https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5">
                NYC HPD Housing Maintenance Code Violations (wvxf-dwi5)
              </a>
              . Covers {summary.date_range_start.slice(0, 10)} through{' '}
              {summary.last_updated.slice(0, 10)}, Bronx only.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

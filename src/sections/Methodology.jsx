import { useMemo, useState } from 'react';
import { ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { formatNumber } from '../lib/format.js';

const SCATTER_TARGET_POINTS = 800;

// Recharts' log-scale axis doesn't generate ticks past the first few powers
// of the base on its own — it stops at 1/2/4/8 regardless of how far the
// data actually extends. Build the tick list ourselves, up to the real max.
function powerOfTwoTicks(maxValue) {
  const ticks = [1];
  while (ticks[ticks.length - 1] < maxValue) {
    ticks.push(ticks[ticks.length - 1] * 2);
  }
  return ticks;
}

export function Methodology() {
  const [expanded, setExpanded] = useState(false);
  const { data: summary } = useJsonData('overall_summary.json');
  const { data: scatter } = useJsonData('building_scatter.json');

  const sampledScatter =
    expanded && scatter
      ? scatter.filter((_, i) => i % Math.max(1, Math.ceil(scatter.length / SCATTER_TARGET_POINTS)) === 0)
      : null;

  // Ticks are computed from the full dataset, not the sampled subset, so
  // the axis reflects the real range of eligible_count regardless of how
  // many points are actually plotted.
  const xTicks = useMemo(() => {
    if (!scatter) return [];
    const max = Math.max(...scatter.map((d) => d.eligible_count));
    return powerOfTwoTicks(max);
  }, [scatter]);

  return (
    <section id="methodology" className="section">
      <details className="methodology" onToggle={(e) => setExpanded(e.target.open)}>
        <summary>What this does—and doesn’t—tell us</summary>

        <div className="methodology__body">
          <p>
            In this analysis, a repeat means that a later violation has the same building ID and
            HPD order number, with an inspection date within <strong>365 days</strong> of the first
            record’s effective close date. The effective close date is the certified date, or the
            status-change date when no certified date is available. The order number identifies a
            kind of violation; it does not identify a specific apartment or physical condition.
          </p>
          <p>
            A case is classified as a repeat as soon as a matching record appears within that
            year. A case counts as “no repeat” only after the full year passes without a match.
            Newer cases with no match yet are <strong>censored</strong>, meaning they are left out
            of the rate until there is enough follow-up time. Counting them as “no repeat” now
            would make the rate look lower simply because they are newer.
          </p>
          <p>
            Rate rankings include only violation types, neighborhoods, and registrations with at
            least 25 classifiable closed violations. With only a few records, one case can move a
            rate sharply. The chart below shows the same issue at the building level: rates vary
            widely when there are few records, then bunch together as the record count grows.
          </p>

          {sampledScatter && (
            <div className="chart-block">
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 36 }}>
                  <XAxis
                    type="number"
                    dataKey="eligible_count"
                    name="Classifiable closed violations"
                    label={{ value: 'Classifiable closed violations (log scale)', position: 'bottom', fontSize: 12 }}
                    scale="log"
                    domain={[1, xTicks[xTicks.length - 1] ?? 'auto']}
                    ticks={xTicks}
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="recurrence_rate"
                    name="Same-type repeat rate"
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
                {formatNumber(scatter.length)} shown). Buildings with few classifiable violations
                are on the left, where rates cover nearly the full range. Buildings with more
                records are on the right, where the rates cluster more closely.
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
              {summary.data_cutoff.slice(0, 10)}, Bronx only.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

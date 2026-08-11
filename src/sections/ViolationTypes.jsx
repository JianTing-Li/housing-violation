import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { ChartTakeaway } from '../components/ChartTakeaway.jsx';
import { Callout } from '../components/Callout.jsx';
import { cleanViolationLabel, formatPct } from '../lib/format.js';
import { getRecommendation } from '../lib/recommendations.js';

const TOP_N = 8;

export function ViolationTypes() {
  const { data, loading, error } = useJsonData('by_violation_type.json');

  if (loading || error || !data) return null;

  const genuine = data.filter((d) => !d.is_compliance_cadence);
  const complianceCadence = data.find((d) => d.is_compliance_cadence);

  const top = genuine.slice(0, TOP_N);
  const chartData = [...top, ...(complianceCadence ? [complianceCadence] : [])].map((d) => ({
    ...d,
    label: cleanViolationLabel(d.description),
    ratePct: Math.round(d.rate * 100),
  }));

  return (
    <section id="violation-types" className="section">
      <h2>Which kinds of violations keep coming back?</h2>

      <div className="chart-block chart-block--tall">
        <ResponsiveContainer width="100%" height={chartData.length * 46 + 20}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 56, left: 10, bottom: 0 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={260}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12.5 }}
            />
            <Bar dataKey="ratePct" radius={[0, 4, 4, 0]} maxBarSize={26}>
              {chartData.map((entry) => (
                <Cell key={entry.code} fill={entry.is_compliance_cadence ? '#c9c3ba' : '#b3401f'} />
              ))}
              <LabelList dataKey="ratePct" position="right" formatter={(v) => `${v}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartTakeaway>
        {top.length > 0 && (
          <>
            "{cleanViolationLabel(top[0].description)}" recurs at {formatPct(top[0].rate)} — the
            highest rate among violation types with enough volume to measure reliably.
          </>
        )}
      </ChartTakeaway>

      <p>
        Ranked by recurrence rate among categories with at least 25 eligible closed violations, so
        rare violation types don't produce misleadingly extreme rates. The muted bar is the annual
        bedbug-notice filing (§27-2018.1) — a recurring paperwork requirement, not a
        repaired-and-failed-again violation, so it's expected to look different from the rest.
      </p>

      <Callout>{getRecommendation('violation-targeting')}</Callout>
    </section>
  );
}

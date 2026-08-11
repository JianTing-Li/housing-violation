import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { ChartTakeaway } from '../components/ChartTakeaway.jsx';
import { Callout } from '../components/Callout.jsx';
import { formatPct } from '../lib/format.js';
import { getRecommendation } from '../lib/recommendations.js';

const TOP_N = 8;

function ViolationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="violation-tooltip">
      <strong>{d.display_name}</strong>
      <span className="violation-tooltip__rate">{d.ratePct}% repeat rate</span>
      <p>{d.description}</p>
    </div>
  );
}

export function ViolationTypes() {
  const { data, loading, error } = useJsonData('by_violation_type.json');

  if (loading || error || !data) return null;

  const genuine = data.filter((d) => !d.is_compliance_cadence);
  const complianceCadence = data.find((d) => d.is_compliance_cadence);

  const top = genuine.slice(0, TOP_N);
  const chartData = [...top, ...(complianceCadence ? [complianceCadence] : [])].map((d) => ({
    ...d,
    label: d.display_name,
    ratePct: Math.round(d.rate * 100),
  }));

  return (
    <section id="violation-types" className="section">
      <h2>Which problems return most often?</h2>

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
              width={190}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12.5 }}
            />
            <Tooltip content={<ViolationTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
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
            “{top[0].display_name}” has a {formatPct(top[0].rate)} same-type repeat rate, the
            highest among categories with enough records to compare.
          </>
        )}
      </ChartTakeaway>

      <p>
        The chart includes only categories with at least 25 classifiable closed violations. That
        keeps a handful of records from producing an extreme rate. If the annual bedbug-notice
        filing (§27-2018.1) appears, it is shown in gray because it is a recurring paperwork
        requirement, not a repair record.
      </p>

      <Callout>{getRecommendation('violation-targeting')}</Callout>
    </section>
  );
}

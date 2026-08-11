import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { ChartTakeaway } from '../components/ChartTakeaway.jsx';
import { Callout } from '../components/Callout.jsx';
import { formatNumber, formatPct } from '../lib/format.js';

const COLORS = {
  recurred: '#b3401f',
  no_recurrence: '#1a1a1a',
  censored: '#c9c3ba',
};

const LABELS = {
  recurred: 'Recurred within a year',
  no_recurrence: 'Confirmed no recurrence',
  censored: 'Censored (too recent to know)',
};

export function OverallRecurrence() {
  const { data, loading, error } = useJsonData('overall_summary.json');

  if (loading || error || !data) return null;

  const chartData = ['recurred', 'no_recurrence', 'censored'].map((key) => ({
    key,
    name: LABELS[key],
    value: data[key],
  }));

  return (
    <section id="overall-recurrence-rate" className="section">
      <h2>How often does a closed violation come back?</h2>

      <div className="chart-block">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={80}
              outerRadius={130}
              paddingAngle={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatNumber(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ChartTakeaway>
        {formatPct(data.rate)} of closed violations with a fully observed one-year window came
        back — only {formatPct(1 - data.rate)} were confirmed permanently resolved.
      </ChartTakeaway>

      <p>
        A violation counts as "closed" once HPD certifies the repair or marks it resolved.
        Violations closed too recently to have had a full year to potentially recur —{' '}
        {formatNumber(data.censored)} of them — are <strong>censored</strong>: excluded from the
        rate rather than counted as "no recurrence," since we simply don't know yet how they'll
        turn out.
      </p>

      <Callout>
        Require a verified re-inspection before a violation is closed, instead of relying on
        landlord self-certification — the current system counts a violation as "fixed" without
        confirming it.
      </Callout>
    </section>
  );
}

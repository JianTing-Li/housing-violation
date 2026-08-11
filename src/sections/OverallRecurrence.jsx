import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { ChartTakeaway } from '../components/ChartTakeaway.jsx';
import { Callout } from '../components/Callout.jsx';
import { formatNumber, formatPct } from '../lib/format.js';
import { getRecommendation } from '../lib/recommendations.js';

const COLORS = {
  recurred: '#b3401f',
  no_recurrence: '#1a1a1a',
  censored: '#c9c3ba',
};

const LABELS = {
  recurred: 'Same type recorded within a year',
  no_recurrence: 'Full year passed with no match',
  censored: 'Too recent, with no match yet',
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
      <h2>How often does the same kind of violation return?</h2>

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
        Among closed violations we could classify, about 4 in 5 ({formatPct(data.rate)}) were
        followed by a violation with the same HPD order number in the same building. The other{' '}
        {formatPct(1 - data.rate)} went a full year with no such match.
      </ChartTakeaway>

      <p>
        Here, “classifiable” means one of two things: the same type appeared again within a year,
        or a full year passed without a match. Another {formatNumber(data.censored)} closed
        violations are too recent and have no match so far. They are excluded from the rate
        because their full follow-up window has not passed.
      </p>

      <Callout>{getRecommendation('reinspection')}</Callout>
    </section>
  );
}

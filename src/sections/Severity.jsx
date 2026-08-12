import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { ChartTakeaway } from '../components/ChartTakeaway.jsx';
import { Callout } from '../components/Callout.jsx';
import { formatPct } from '../lib/format.js';
import { getRecommendation } from '../lib/recommendations.js';

const CLASS_LABELS = {
  A: 'Class A (non-hazardous)',
  B: 'Class B (hazardous)',
  C: 'Class C (immediately hazardous)',
};

function buildTakeaway(byClass) {
  const ranked = [...byClass].sort((a, b) => b.rate - a.rate);
  const [highest, second] = ranked;
  const highestLabel = CLASS_LABELS[highest.class];

  if (highest.class === 'C') {
    return `Class C, the “immediately hazardous” tier, has the highest repeat violation rate (${formatPct(highest.rate)}), just ahead of Class B (${formatPct(second.rate)}).`;
  }

  return `${highestLabel} has the highest repeat violation rate (${formatPct(highest.rate)}). Class C is close behind at ${formatPct(byClass.find((c) => c.class === 'C').rate)}, so severity alone does not explain the pattern.`;
}

export function Severity() {
  const { data, loading, error } = useJsonData('by_class.json');

  if (loading || error || !data) return null;

  const chartData = data.map((d) => ({
    ...d,
    label: `Class ${d.class}`,
    ratePct: Math.round(d.rate * 100),
  }));

  return (
    <section id="severity" className="section">
      <h2>How do repeat rates vary by severity?</h2>

      <div className="chart-block">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 28, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e4e0da" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <Bar dataKey="ratePct" fill="#b3401f" radius={[4, 4, 0, 0]} maxBarSize={90}>
              <LabelList dataKey="ratePct" position="top" formatter={(v) => `${v}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartTakeaway>{buildTakeaway(data)}</ChartTakeaway>

      <p>
        HPD groups violations into three classes: A (non-hazardous), B (hazardous), and C
        (immediately hazardous). The repeat violation rate does not fall steadily as severity
        rises. This measure cannot tell whether any individual repair held.
      </p>

      <Callout>{getRecommendation('severity-scrutiny')}</Callout>

      <p>
        That raises a more specific question: which kinds of problems are actually driving these
        repeats?
      </p>
    </section>
  );
}

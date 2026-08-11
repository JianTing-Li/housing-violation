import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { ChartTakeaway } from '../components/ChartTakeaway.jsx';
import { Callout } from '../components/Callout.jsx';
import { formatPct } from '../lib/format.js';

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
    return `Class C — the most urgent, "immediately hazardous" tier — recurs at the highest rate of any severity class (${formatPct(highest.rate)}), ahead of Class B (${formatPct(second.rate)}).`;
  }

  return `${highestLabel} recurs at the highest rate (${formatPct(highest.rate)}), narrowly ahead of Class C (${formatPct(byClass.find((c) => c.class === 'C').rate)}) — even the most urgent violations aren't closing for good at a meaningfully lower rate.`;
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
      <h2>Does the most dangerous violation get fixed for good?</h2>

      <div className="chart-block">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
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
        HPD assigns every violation a severity class at issuance — A (non-hazardous) through C
        (immediately hazardous). If enforcement worked as intended, the most urgent violations
        should show the strongest, most durable fixes. The recurrence rate doesn't show a clear
        drop-off for Class C.
      </p>

      <Callout>
        Scrutiny at close-out should scale with severity, not just urgency at issuance — a
        Class C closure deserves at least as much verification as a Class A one.
      </Callout>
    </section>
  );
}

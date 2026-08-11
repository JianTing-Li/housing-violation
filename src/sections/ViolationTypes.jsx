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

function CategoryList({ items }) {
  return (
    <ul className="category-list">
      {items.map((d) => (
        <li key={d.code}>
          <span className="category-list__name">{d.display_name}</span>
          <span className="category-list__rate">{formatPct(d.rate)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ViolationTypes() {
  const { data, loading, error } = useJsonData('by_violation_type.json');

  if (loading || error || !data) return null;

  const physical = data.filter((d) => d.category === 'physical');
  const administrative = data
    .filter((d) => d.category === 'administrative')
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  const ambiguous = data
    .filter((d) => d.category === 'ambiguous')
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

  const top = physical.slice(0, TOP_N);
  const chartData = top.map((d) => ({
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
            <Bar dataKey="ratePct" fill="#b3401f" radius={[0, 4, 4, 0]} maxBarSize={26}>
              <LabelList dataKey="ratePct" position="right" formatter={(v) => `${v}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartTakeaway>
        {top.length > 0 && (
          <>
            “{top[0].display_name}” has a {formatPct(top[0].rate)} same-type repeat rate, the
            highest among physical-condition categories with enough records to compare.
          </>
        )}
      </ChartTakeaway>

      <p>
        This chart only includes physical conditions — things like leaks, pests, or broken
        equipment — with at least 25 classifiable closed violations. Paperwork and posting
        requirements, like the annual bedbug filing, are left out here because a repeat filing
        isn't evidence of an unresolved physical problem. They're listed separately below.
      </p>

      <Callout>{getRecommendation('violation-targeting')}</Callout>

      {administrative.length > 0 && (
        <div className="category-aside">
          <h3>Recurring paperwork &amp; posting requirements</h3>
          <p className="category-aside__note">
            These come back on a schedule — annual filings, required signage — not because a
            repair failed. Excluded from the chart above; shown here for reference.
          </p>
          <CategoryList items={administrative} />
        </div>
      )}

      {ambiguous.length > 0 && (
        <div className="category-aside">
          <h3>Not yet classified</h3>
          <p className="category-aside__note">
            These don't clearly read as either a physical condition or a paperwork requirement
            from the violation text alone, so they're held out of the chart above until reviewed.
          </p>
          <CategoryList items={ambiguous} />
        </div>
      )}
    </section>
  );
}

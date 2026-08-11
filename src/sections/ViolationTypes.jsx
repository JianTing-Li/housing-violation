import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

  const physical = data.filter((d) => d.chart_eligibility === 'physical_condition_ranking');
  const administrative = data
    .filter((d) => d.category === 'administrative_or_posting')
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  const enforcement = data
    .filter((d) => d.category === 'enforcement_or_legal_status')
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

  const top = physical.slice(0, TOP_N);
  const chartData = top.map((d) => ({
    ...d,
    label: d.display_name,
    ratePct: Math.round(d.rate * 100),
  }));

  return (
    <section id="violation-types" className="section">
      <h2>Which physical-condition violations have the highest repeat rates?</h2>

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
            “{top[0].display_name}” has a {formatPct(top[0].rate)} repeat violation rate, the
            highest among physical-condition categories with enough records to compare.
          </>
        )}
      </ChartTakeaway>

      <p>
        This chart includes only records categorized as a physical condition, with at least 25
        classifiable closed violations. Administrative, posting, and enforcement records are
        excluded here because a repeat of that kind of record is not evidence of an unresolved
        physical condition. They are listed separately below.
      </p>

      <Callout>{getRecommendation('violation-targeting')}</Callout>

      {administrative.length > 0 && (
        <div className="category-aside">
          <h3>Administrative and posting violations</h3>
          <p className="category-aside__note">
            These are valid HPD violations involving reports, registrations, certificates,
            notices, or required signs. They are presented separately because they do not
            directly describe a physical housing condition. Some involve periodic requirements;
            others do not.
          </p>
          <CategoryList items={administrative} />
        </div>
      )}

      {enforcement.length > 0 && (
        <div className="category-aside">
          <h3>Enforcement and legal-status records</h3>
          <p className="category-aside__note">
            These describe a regulatory or legal status — a vacate order, a filing tied to one, or
            an enforcement-program notice — rather than an ongoing physical condition or a routine
            posting duty.
          </p>
          <CategoryList items={enforcement} />
        </div>
      )}
    </section>
  );
}

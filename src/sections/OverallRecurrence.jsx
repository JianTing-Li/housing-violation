import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { ChartTakeaway } from '../components/ChartTakeaway.jsx';
import { Callout } from '../components/Callout.jsx';
import { formatNumber, formatPct } from '../lib/format.js';
import { getRecommendation } from '../lib/recommendations.js';
import { computeDonutData } from '../lib/donut.js';

const COLORS = {
  recurred: '#b3401f',
  no_recurrence: '#1a1a1a',
};

function renderSegmentLabel({ cx, cy, midAngle, outerRadius, percent, index }) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className={index === 0 ? 'donut-label donut-label--recurred' : 'donut-label donut-label--no-recurrence'}
    >
      {Math.round(percent * 100)}%
    </text>
  );
}

export function OverallRecurrence() {
  const { data, loading, error } = useJsonData('overall_summary.json');

  if (loading || error || !data) return null;

  const donut = computeDonutData(data);
  const chartData = donut.segments.map((s) => ({ ...s, value: s.count }));
  const recurredSegment = donut.segments.find((s) => s.key === 'recurred');
  const noRecurrenceSegment = donut.segments.find((s) => s.key === 'no_recurrence');

  const srSummary =
    `Of ${formatNumber(donut.classifiable)} classifiable closed violations, ` +
    `${formatNumber(recurredSegment.count)} (${formatPct(recurredSegment.share)}) had a repeat violation within a year, and ` +
    `${formatNumber(noRecurrenceSegment.count)} (${formatPct(noRecurrenceSegment.share)}) did not. ` +
    `An additional ${formatNumber(donut.tooRecentCount)} closed violations are too recent to classify and are excluded from these percentages.`;

  return (
    <section id="overall-recurrence-rate" className="section">
      <h2>How often does the same kind of violation get recorded again?</h2>

      <div className="chart-block donut-block">
        <ResponsiveContainer width="100%" height={340}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              innerRadius={90}
              outerRadius={135}
              paddingAngle={2}
              label={renderSegmentLabel}
              labelLine={false}
              isAnimationActive={false}
            >
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={COLORS[entry.key]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center" aria-hidden="true">
          <span className="donut-center__number">{formatPct(recurredSegment.share)}</span>
          <span className="donut-center__label">repeat violation</span>
        </div>
        <p className="sr-only">{srSummary}</p>
      </div>

      <ul className="donut-legend" aria-hidden="true">
        <li>
          <span className="donut-legend__swatch" style={{ background: COLORS.recurred }} />
          Repeat violation within a year: {formatPct(recurredSegment.share)} ({formatNumber(recurredSegment.count)})
        </li>
        <li>
          <span className="donut-legend__swatch" style={{ background: COLORS.no_recurrence }} />
          Full year passed with no match: {formatPct(noRecurrenceSegment.share)} ({formatNumber(noRecurrenceSegment.count)})
        </li>
      </ul>

      <p className="donut-note">
        {formatNumber(donut.tooRecentCount)} additional cases are too recent to classify and are
        excluded from these percentages.
      </p>

      <ChartTakeaway>
        Among the {formatNumber(donut.classifiable)} closed violations we could classify, {formatPct(recurredSegment.share)}{' '}
        were followed by a violation with the same HPD order number in the same building within a
        year. The remaining {formatPct(noRecurrenceSegment.share)} went a full year with no such
        match.
      </ChartTakeaway>

      <p>
        Put another way, roughly {Math.round(recurredSegment.count / noRecurrenceSegment.count)}{' '}
        violations recur for every one that doesn’t. Going a full year without the same violation
        returning is the less common outcome in this data, not the norm. See “What counts as a
        repeat violation?” above for how a repeat is defined.
      </p>

      <Callout>{getRecommendation('reinspection')}</Callout>

      <p>
        A recurrence rate this size raises an obvious follow-up. Is this mostly minor, technical
        repeats, or are the most hazardous violations just as likely to come back?
      </p>
    </section>
  );
}

import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { ChartTakeaway } from '../components/ChartTakeaway.jsx';
import { Callout } from '../components/Callout.jsx';
import { formatNumber, formatPct } from '../lib/format.js';
import { getRecommendation } from '../lib/recommendations.js';

const TOP_N = 8;

function OwnerBarChart({ data, dataKey, valueFormatter, barColor }) {
  return (
    <ResponsiveContainer width="100%" height={TOP_N * 40 + 20}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 10, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12.5 }}
        />
        <Bar dataKey={dataKey} fill={barColor} radius={[0, 4, 4, 0]} maxBarSize={22}>
          <LabelList dataKey={dataKey} position="right" formatter={valueFormatter} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Owners() {
  const { data: topCount, loading: countLoading, error: countError } =
    useJsonData('by_owner_top_count.json');
  const { data: topRate, loading: rateLoading, error: rateError } =
    useJsonData('by_owner_top_rate.json');

  if (countLoading || rateLoading || countError || rateError || !topCount || !topRate) return null;

  const countData = topCount.slice(0, TOP_N).map((d) => ({
    ...d,
    label: `Reg #${d.registrationid}`,
  }));
  const rateData = topRate.slice(0, TOP_N).map((d) => ({
    ...d,
    label: `Reg #${d.registrationid}`,
    ratePct: Math.round(d.rate * 100),
  }));

  return (
    <section id="owners" className="section section--wide">
      <h2>Which owners account for the most repeat violations?</h2>
      <p>
        The violations data identifies owners only by HPD registration number. It does not include
        names or show whether several registrations belong to the same owner. The charts therefore
        compare registrations, not full ownership portfolios.
      </p>

      <div className="owner-charts">
        <div className="owner-chart">
          <h3>Most closed violations</h3>
          <p className="owner-chart__subtitle">Total records, regardless of repeat rate</p>
          <OwnerBarChart data={countData} dataKey="total" valueFormatter={formatNumber} barColor="#1a1a1a" />
        </div>
        <div className="owner-chart">
          <h3>Highest same-type repeat rate</h3>
          <p className="owner-chart__subtitle">
            Among registrations with at least 25 classifiable violations
          </p>
          <OwnerBarChart data={rateData} dataKey="ratePct" valueFormatter={(v) => `${v}%`} barColor="#b3401f" />
        </div>
      </div>

      <ChartTakeaway>
        Registration #{countData[0]?.registrationid} has the most closed violations:{' '}
        {formatNumber(countData[0]?.total)}. Its same-type repeat rate is{' '}
        {formatPct(countData[0]?.rate)}. A high count and a high rate are different measures, and
        they do not always point to the same registration.
      </ChartTakeaway>

      <Callout>{getRecommendation('owner-accountability')}</Callout>
    </section>
  );
}

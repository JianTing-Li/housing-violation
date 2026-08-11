import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { Choropleth } from '../components/Choropleth.jsx';
import { ChartTakeaway } from '../components/ChartTakeaway.jsx';
import { Callout } from '../components/Callout.jsx';
import { formatPct } from '../lib/format.js';
import { getRecommendation } from '../lib/recommendations.js';

const TOP_N = 5;
const MIN_ELIGIBLE = 25; // same volume floor used elsewhere before ranking by rate

export function Neighborhoods() {
  const { data: boundaries, loading: boundariesLoading, error: boundariesError } =
    useJsonData('bronx_nta_boundaries.geojson');
  const { data: byNeighborhood, loading: dataLoading, error: dataError } =
    useJsonData('by_neighborhood.json');

  if (boundariesLoading || dataLoading || boundariesError || dataError || !boundaries || !byNeighborhood) {
    return null;
  }

  const ratesByNta = Object.fromEntries(byNeighborhood.map((d) => [d.nta, d]));

  const ranked = byNeighborhood
    .filter((d) => d.nta !== 'UNKNOWN' && d.recurred + d.no_recurrence >= MIN_ELIGIBLE)
    .sort((a, b) => b.rate - a.rate);
  const top5 = ranked.slice(0, TOP_N).map((d) => ({ ...d, ratePct: Math.round(d.rate * 100) }));

  return (
    <section id="neighborhoods" className="section section--wide">
      <h2>Where does this problem concentrate?</h2>

      <div className="map-block">
        <Choropleth boundaries={boundaries} ratesByNta={ratesByNta} />
      </div>
      <p className="map-caption">Darker shading = higher recurrence rate. Hover a neighborhood for exact numbers.</p>

      <ChartTakeaway>
        {top5[0]?.nta} has the highest recurrence rate in the Bronx at {formatPct(top5[0]?.rate)},
        among neighborhoods with enough closed violations to measure reliably.
      </ChartTakeaway>

      <div className="chart-block">
        <ResponsiveContainer width="100%" height={TOP_N * 46 + 20}>
          <BarChart data={top5} layout="vertical" margin={{ top: 0, right: 56, left: 10, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="nta"
              width={220}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12.5 }}
            />
            <Bar dataKey="ratePct" fill="#b3401f" radius={[0, 4, 4, 0]} maxBarSize={26}>
              <LabelList dataKey="ratePct" position="right" formatter={(v) => `${v}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p>
        Geography alone doesn't explain "why" — a neighborhood's rate reflects whichever
        buildings and owners happen to be concentrated there. Pair this with the ownership data
        below before drawing conclusions about a place itself.
      </p>

      <Callout>{getRecommendation('neighborhood-resourcing')}</Callout>
    </section>
  );
}

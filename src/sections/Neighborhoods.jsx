import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useJsonData } from '../hooks/useJsonData.js';
import { Choropleth } from '../components/Choropleth.jsx';
import { ChartTakeaway } from '../components/ChartTakeaway.jsx';
import { Callout } from '../components/Callout.jsx';
import { formatNumber, formatPct } from '../lib/format.js';
import { getRecommendation } from '../lib/recommendations.js';
import { RATE_BINS, MIN_CLASSIFIABLE_CASES } from '../lib/neighborhoodLegend.js';
import { colorForBin, INSUFFICIENT_DATA_COLOR } from '../lib/colorScale.js';

const TOP_N = 5;

function MapLegend() {
  return (
    <div className="map-legend">
      <span className="map-legend__title">Repeat violation rate</span>
      <ul className="map-legend__list">
        {RATE_BINS.map((bin) => (
          <li key={bin.id}>
            <span className="map-legend__swatch" style={{ background: colorForBin(bin) }} />
            {bin.label}
          </li>
        ))}
        <li>
          <span className="map-legend__swatch" style={{ background: INSUFFICIENT_DATA_COLOR }} />
          Insufficient data
        </li>
      </ul>
      <p className="map-legend__note">
        Gray areas have fewer than {MIN_CLASSIFIABLE_CASES} classifiable cases, or no data.
      </p>
    </div>
  );
}

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
    .filter((d) => d.nta !== 'UNKNOWN' && d.sufficient_data)
    .sort((a, b) => b.rate - a.rate);
  const top5 = ranked.slice(0, TOP_N).map((d) => ({ ...d, ratePct: Math.round(d.rate * 100) }));

  return (
    <section id="neighborhoods" className="section section--wide">
      <h2>Where do violations return most often?</h2>

      <MapLegend />
      <div className="map-block">
        <Choropleth boundaries={boundaries} ratesByNta={ratesByNta} />
      </div>
      <p className="map-caption">
        Each neighborhood is keyboard- and touch-accessible: focus or tap for its exact rate and
        case count. The ranked list below covers the same data as a table.
      </p>

      <ChartTakeaway>
        {top5[0]?.nta} has the Bronx’s highest repeat violation rate at{' '}
        {formatPct(top5[0]?.rate)}, among neighborhoods with enough records to compare.
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

      <details className="neighborhood-table-details">
        <summary>All {ranked.length} neighborhoods with sufficient data (table)</summary>
        <table className="neighborhood-table">
          <caption>
            All Bronx neighborhoods with at least {MIN_CLASSIFIABLE_CASES} classifiable cases,
            ranked by repeat violation rate
          </caption>
          <thead>
            <tr>
              <th scope="col">Neighborhood</th>
              <th scope="col">Repeat rate</th>
              <th scope="col">Classifiable cases</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((d) => (
              <tr key={d.nta}>
                <td>{d.nta}</td>
                <td>{formatPct(d.rate)}</td>
                <td>{formatNumber(d.recurred + d.no_recurrence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <p>
        The map shows where repeats are recorded, not why. A neighborhood’s rate reflects its mix
        of buildings and HPD registrations. It should not be read as a judgment about the
        neighborhood itself.
      </p>

      <Callout>{getRecommendation('neighborhood-resourcing')}</Callout>
    </section>
  );
}

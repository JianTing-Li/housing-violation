import { geoJSON } from 'leaflet';
import { GeoJSON, MapContainer } from 'react-leaflet';
import { formatNumber, formatPct } from '../lib/format.js';
import { makeRateColorScale } from '../lib/colorScale.js';

export function Choropleth({ boundaries, ratesByNta }) {
  const bounds = geoJSON(boundaries).getBounds();
  const colorFor = makeRateColorScale(Object.values(ratesByNta).map((r) => r.rate));

  function style(feature) {
    const entry = ratesByNta[feature.properties.ntaname];
    return {
      fillColor: colorFor(entry?.rate),
      fillOpacity: 0.85,
      color: '#fdfcfa',
      weight: 1,
    };
  }

  function onEachFeature(feature, layer) {
    const entry = ratesByNta[feature.properties.ntaname];
    const label = entry
      ? `<strong>${feature.properties.ntaname}</strong><br/>${formatPct(entry.rate)} recurrence rate<br/>${formatNumber(entry.recurred + entry.no_recurrence)} eligible closed violations`
      : `<strong>${feature.properties.ntaname}</strong><br/>No violation data`;
    layer.bindTooltip(label, { sticky: true });
  }

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [16, 16] }}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', background: '#fdfcfa' }}
      zoomControl={false}
      attributionControl={false}
    >
      <GeoJSON data={boundaries} style={style} onEachFeature={onEachFeature} />
    </MapContainer>
  );
}

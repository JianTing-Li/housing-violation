import { geoJSON } from 'leaflet';
import { GeoJSON, MapContainer } from 'react-leaflet';
import { formatNumber, formatPct } from '../lib/format.js';
import { colorForNeighborhood } from '../lib/colorScale.js';
import { binForNeighborhood } from '../lib/neighborhoodLegend.js';

export function Choropleth({ boundaries, ratesByNta }) {
  const bounds = geoJSON(boundaries).getBounds();

  function style(feature) {
    const entry = ratesByNta[feature.properties.ntaname];
    return {
      fillColor: colorForNeighborhood(entry),
      fillOpacity: 0.85,
      color: '#fdfcfa',
      weight: 1,
    };
  }

  function tooltipHtml(feature) {
    const entry = ratesByNta[feature.properties.ntaname];
    const bin = binForNeighborhood(entry);
    if (!entry || bin.id === 'insufficient-data') {
      return `<strong>${feature.properties.ntaname}</strong><br/>Insufficient data (fewer than 25 classifiable cases)`;
    }
    return (
      `<strong>${feature.properties.ntaname}</strong><br/>` +
      `${formatPct(entry.rate)} repeat violation rate<br/>` +
      `${formatNumber(entry.recurred + entry.no_recurrence)} classifiable closed violations`
    );
  }

  function onEachFeature(feature, layer) {
    const entry = ratesByNta[feature.properties.ntaname];
    const bin = binForNeighborhood(entry);
    const ariaLabel =
      entry && bin.id !== 'insufficient-data'
        ? `${feature.properties.ntaname}: ${formatPct(entry.rate)} repeat violation rate, ${formatNumber(entry.recurred + entry.no_recurrence)} classifiable closed violations`
        : `${feature.properties.ntaname}: insufficient data, fewer than 25 classifiable cases`;

    layer.bindTooltip(tooltipHtml(feature), { sticky: true });

    // Hover alone isn't accessible — make each neighborhood keyboard-
    // focusable and touch-tappable, with the same info surfaced either way.
    layer.on('add', () => {
      const el = layer.getElement?.();
      if (!el) return;
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', ariaLabel);
      el.addEventListener('focus', () => layer.openTooltip());
      el.addEventListener('blur', () => layer.closeTooltip());
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          layer.openTooltip();
        }
      });
      el.addEventListener('click', () => layer.openTooltip());
    });
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

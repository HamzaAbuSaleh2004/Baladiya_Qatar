import { useEffect, useRef } from 'react';
import { loadMapsLibrary } from '../maps';

const CATEGORY_COLORS = {
  pothole: '#6c0028',
  falling_tree: '#2e7d32',
};

const STATUS_COLORS = {
  investigating: '#9e9e9e',
  in_progress: '#ed6c02',
  resolved: '#2e7d32',
  rejected: '#c62828',
};

const CATEGORY_LABEL = {
  pothole: 'Pothole / Road',
  falling_tree: 'Tree Hazard',
};

const DEFAULT_CENTER = { lat: 25.2854, lng: 51.5310 };
const DEFAULT_ZOOM = 11;

function colorFor(t, mode) {
  if (mode === 'status') return STATUS_COLORS[t.status] || '#666';
  return CATEGORY_COLORS[t.category] || '#666';
}

function popupHtml(t) {
  const cat = CATEGORY_LABEL[t.category] || t.category || 'Issue';
  const status = (t.status || '').replace('_', ' ');
  const sev = t.severity ? `<span style="text-transform:capitalize">${t.severity}</span>` : '—';
  const when = t.created_at ? new Date(t.created_at).toLocaleString() : '';
  return `
    <div style="font-family:'Public Sans',system-ui,sans-serif;min-width:180px">
      <div style="font-weight:600;color:#6c0028">#${t.ticket_id || ''}</div>
      <div>${cat}</div>
      <div style="margin-top:4px;font-size:12px">
        <span style="text-transform:capitalize">${status}</span> · ${sev}
      </div>
      ${when ? `<div style="margin-top:4px;font-size:11px;color:#555">${when}</div>` : ''}
    </div>
  `;
}

export default function TicketsMap({
  tickets = [],
  height = 360,
  heatmap = false,
  colorMode = 'category', // 'category' | 'status'
  onSelect,
  className = '',
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const heatRef = useRef(null);
  const infoRef = useRef(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ Map, InfoWindow }] = await Promise.all([
          loadMapsLibrary('maps'),
        ]);
        if (cancelled || !elRef.current) return;
        mapRef.current = new Map(elRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapId: 'baladiya_map',
          disableDefaultUI: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          clickableIcons: false,
        });
        infoRef.current = new InfoWindow();
      } catch {
        // Map didn't load; element will stay empty.
      }
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) mapRef.current = null;
    };
  }, []);

  // Render markers / heat layer when tickets / mode change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = mapRef.current;
      if (!m) {
        // Map may not be ready yet — try again on next render.
        return;
      }

      const [, { AdvancedMarkerElement }, viz] = await Promise.all([
        loadMapsLibrary('maps'),
        loadMapsLibrary('marker'),
        loadMapsLibrary('visualization').catch(() => null),
      ]);
      if (cancelled) return;

      // Clean up previous overlays.
      markersRef.current.forEach((mk) => { mk.map = null; });
      markersRef.current = [];
      if (heatRef.current) {
        heatRef.current.setMap(null);
        heatRef.current = null;
      }

      const points = (tickets || [])
        .map((t) => {
          const lat = t?.location?.latitude;
          const lng = t?.location?.longitude;
          if (lat == null || lng == null) return null;
          return { t, lat: Number(lat), lng: Number(lng) };
        })
        .filter(Boolean);

      if (points.length === 0) return;

      if (heatmap && viz?.HeatmapLayer) {
        heatRef.current = new viz.HeatmapLayer({
          data: points.map((p) => new window.google.maps.LatLng(p.lat, p.lng)),
          radius: 28,
          opacity: 0.8,
        });
        heatRef.current.setMap(m);
      } else {
        points.forEach(({ t, lat, lng }) => {
          // Custom HTML pin (AdvancedMarker) — coloured circle.
          const pin = document.createElement('div');
          pin.style.cssText = `
            width: 16px; height: 16px; border-radius: 50%;
            background: ${colorFor(t, colorMode)};
            border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
          `;
          const marker = new AdvancedMarkerElement({
            map: m,
            position: { lat, lng },
            content: pin,
          });
          marker.addListener('click', () => {
            infoRef.current?.setContent(popupHtml(t));
            infoRef.current?.open({ map: m, anchor: marker });
            if (onSelect) onSelect(t);
          });
          markersRef.current.push(marker);
        });
      }

      // Fit bounds.
      if (points.length > 1) {
        const bounds = new window.google.maps.LatLngBounds();
        points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        m.fitBounds(bounds, 60);
      } else if (points.length === 1) {
        m.setCenter({ lat: points[0].lat, lng: points[0].lng });
        m.setZoom(15);
      }
    })();
    return () => { cancelled = true; };
  }, [tickets, heatmap, colorMode, onSelect]);

  return (
    <div
      ref={elRef}
      className={`rounded-xl border border-outline-variant overflow-hidden ${className}`}
      style={{ height, width: '100%' }}
    />
  );
}

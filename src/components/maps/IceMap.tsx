import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, ImageOverlay, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface IceMapProps {
  lats: number[];
  lons: number[];
  grid: (number | null)[];
  /** Summary line shown on the map, e.g. "D+3 · Projection · mean 68%". */
  info: string;
  /** Tag for the click probe popup, e.g. "D0 observed". */
  probeTag: string;
  vesselPos?: [number, number];
  vesselLabel?: string;
}

const CARTO_API_KEY = 'cb1_2u4s_1_2ff09c9dfad35436c7775919';
const CARTO_TILE_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;

// High-contrast concentration ramp. Open water (<15%) stays transparent so
// the base map shows through; pack ice goes deep navy.
function colorFor(v: number | null): [number, number, number, number] {
  if (v === null || v < 0.15) return [0, 0, 0, 0];
  const stops: [number, [number, number, number]][] = [
    [0.15, [207, 226, 242]],
    [0.4, [123, 167, 212]],
    [0.65, [47, 109, 179]],
    [0.85, [18, 58, 107]],
    [1, [10, 37, 71]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [v0, c0] = stops[i - 1];
      const [v1, c1] = stops[i];
      const f = (v - v0) / (v1 - v0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
        205,
      ];
    }
  }
  return [10, 37, 71, 205];
}

function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [16, 16] });
  }, [map, bounds]);
  return null;
}

function Probe({
  lats,
  lons,
  grid,
  tag,
}: {
  lats: number[];
  lons: number[];
  grid: (number | null)[];
  tag: string;
}) {
  const map = useMap();
  useEffect(() => {
    const onClick = (e: L.LeafletMouseEvent) => {
      let bi = 0;
      let bj = 0;
      let best = Infinity;
      for (let i = 0; i < lats.length; i++) {
        for (let j = 0; j < lons.length; j++) {
          const d = Math.abs(lats[i] - e.latlng.lat) + Math.abs(lons[j] - e.latlng.lng);
          if (d < best) {
            best = d;
            bi = i;
            bj = j;
          }
        }
      }
      const v = grid[bi * lons.length + bj];
      L.popup()
        .setLatLng(e.latlng)
        .setContent(
          v === null
            ? `No data (land) · ${tag}`
            : `Ice ${Math.round(v * 100)}% · ${tag}`,
        )
        .openOn(map);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map, lats, lons, grid, tag]);
  return null;
}

export function IceMap({ lats, lons, grid, info, probeTag, vesselPos, vesselLabel }: IceMapProps) {
  const bounds = useMemo<[[number, number], [number, number]]>(() => {
    return [
      [lats[0], lons[0]],
      [lats[lats.length - 1], lons[lons.length - 1]],
    ];
  }, [lats, lons]);

  const overlayUrl = useMemo(() => {
    const w = lons.length;
    const h = lats.length;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(w, h);
    for (let r = 0; r < h; r++) {
      // Canvas row 0 is the top = highest latitude; lats[] ascend.
      const srcRow = (h - 1 - r) * w;
      for (let c = 0; c < w; c++) {
        const [rr, gg, bb, aa] = colorFor(grid[srcRow + c]);
        const o = (r * w + c) * 4;
        img.data[o] = rr;
        img.data[o + 1] = gg;
        img.data[o + 2] = bb;
        img.data[o + 3] = aa;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }, [lats, lons, grid]);

  return (
    <div className="relative z-0" style={{ aspectRatio: '4/3' }}>
      <MapContainer
        bounds={bounds}
        style={{ height: '100%', width: '100%', background: '#e8edf2', fontFamily: 'Inter, system-ui, sans-serif' }}
        zoomControl={true}
        scrollWheelZoom={false}
        attributionControl={true}
      >
        <FitBounds bounds={bounds} />
        <TileLayer
          url={CARTO_TILE_URL}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> &middot; Ice: NOAA NCEI OISST'
        />
        {overlayUrl && (
          <ImageOverlay url={overlayUrl} bounds={bounds} opacity={0.9} zIndex={10} />
        )}
        <Probe lats={lats} lons={lons} grid={grid} tag={probeTag} />
        {vesselPos && (
          <CircleMarker
            center={vesselPos}
            radius={7}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#111e32', fillOpacity: 1 }}
          >
            {vesselLabel && <Tooltip direction="top" offset={[0, -7]}>{vesselLabel}</Tooltip>}
          </CircleMarker>
        )}
      </MapContainer>

      <div
        className="absolute left-3.5 top-3.5 bg-white border border-border rounded-md px-2.5 py-1.5 text-[11px] font-medium text-ice"
        style={{ boxShadow: '0 1px 2px rgba(16,24,40,.08)', zIndex: 500 }}
      >
        {info}
      </div>
      <div
        className="absolute right-3.5 bottom-3.5 bg-white border border-border rounded-md px-2.5 py-1.5 text-[10.5px] text-ice-faint"
        style={{ boxShadow: '0 1px 2px rgba(16,24,40,.08)', zIndex: 500 }}
      >
        Click map for values
      </div>
    </div>
  );
}

import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import { MEMBER_CITIES } from '@/lib/data';
import type { MemberGeo } from '@/lib/data';
import {
  WORLD_GEOGRAPHIES,
  GEO_BY_ISO_N,
  memberColor,
  NO_MEMBER_FILL,
  LEGEND_GRADIENT,
} from './mapGeo';
import { cn } from '@/lib/utils';

interface TooltipState {
  geo: MemberGeo;
  x: number;
  y: number;
}

interface WorldHeatMapProps {
  selected: MemberGeo | null;
  onSelect: (geo: MemberGeo | null) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

/** Isolated perpetual pulse so parent re-renders never reset the animation. */
const PulseDot = memo(function PulseDot({ size, hot }: { size: number; hot: boolean }) {
  return (
    <g>
      <motion.circle
        r={size}
        fill={hot ? '#E10600' : '#0066B1'}
        initial={{ opacity: 0.5, scale: 1 }}
        animate={{ opacity: 0, scale: 2.6 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
      />
      <circle
        r={size}
        fill={hot ? '#E10600' : '#0066B1'}
        stroke="#FFFFFF"
        strokeWidth={1.2}
        style={hot ? { filter: 'drop-shadow(0 0 6px rgba(225,6,0,0.9))' } : undefined}
      />
      <circle r={size * 0.35} fill="#FFFFFF" opacity={0.9} />
    </g>
  );
});

export default function WorldHeatMap({ selected, onSelect }: WorldHeatMapProps) {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([15, 20]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);

  const maxCity = useMemo(() => Math.max(1, ...MEMBER_CITIES.map((c) => c.members)), []);

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.6, MAX_ZOOM));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.6, MIN_ZOOM));
  const handleReset = () => {
    setZoom(1);
    setCenter([15, 20]);
  };

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute right-4 top-4 z-20 flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <button
          onClick={handleZoomIn}
          className="p-2.5 text-ink-muted transition-colors hover:bg-slate-50 hover:text-bmw-blue"
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <div className="h-px bg-border" />
        <button
          onClick={handleZoomOut}
          className="p-2.5 text-ink-muted transition-colors hover:bg-slate-50 hover:text-bmw-blue"
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
        <div className="h-px bg-border" />
        <button
          onClick={handleReset}
          className="p-2.5 text-ink-muted transition-colors hover:bg-slate-50 hover:text-bmw-blue"
          aria-label="Reset view"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Floating tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key={tooltip.geo.isoA3}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-ink-dark px-3.5 py-2.5 shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y - 10 }}
          >
            <p className="whitespace-nowrap font-display text-[13px] font-bold text-white">
              {tooltip.geo.name}
            </p>
            <p className="mt-0.5 whitespace-nowrap font-mono text-[11px] tabular-nums text-sky">
              {tooltip.geo.members} members · {tooltip.geo.chapters}{' '}
              {tooltip.geo.chapters === 1 ? 'chapter' : 'chapters'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 130, center: [10, 18] }}
        width={900}
        height={470}
        style={{ width: '100%', height: 'auto' }}
      >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onMoveEnd={({ coordinates, zoom: z }) => {
            setCenter(coordinates as [number, number]);
            setZoom(z);
          }}
        >
          <Geographies geography={WORLD_GEOGRAPHIES}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const isoN = String(geo.id).padStart(3, '0');
                const data = GEO_BY_ISO_N.get(isoN);
                const isHovered = data != null && hoveredIso === data.isoA3;
                const isSelected = data != null && selected?.isoA3 === data.isoA3;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={data ? memberColor(data.members) : NO_MEMBER_FILL}
                    stroke={isSelected ? '#E10600' : isHovered ? '#0066B1' : '#FFFFFF'}
                    strokeWidth={isSelected || isHovered ? 1.4 : 0.5}
                    style={{
                      default: { outline: 'none', transition: 'fill 200ms, stroke 150ms' },
                      hover: { outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                    className={cn(data && 'cursor-pointer')}
                    onMouseEnter={(evt) => {
                      if (!data) return;
                      setHoveredIso(data.isoA3);
                      const rect = (
                        evt.currentTarget.ownerSVGElement as SVGSVGElement
                      ).getBoundingClientRect();
                      setTooltip({
                        geo: data,
                        x: evt.clientX - rect.left,
                        y: evt.clientY - rect.top,
                      });
                    }}
                    onMouseMove={(evt) => {
                      if (!data) return;
                      const rect = (
                        evt.currentTarget.ownerSVGElement as SVGSVGElement
                      ).getBoundingClientRect();
                      setTooltip({
                        geo: data,
                        x: evt.clientX - rect.left,
                        y: evt.clientY - rect.top,
                      });
                    }}
                    onMouseLeave={() => {
                      setHoveredIso(null);
                      setTooltip(null);
                    }}
                    onClick={() => {
                      if (data) onSelect(isSelected ? null : data);
                    }}
                  />
                );
              })
            }
          </Geographies>

          {/* City pulse markers */}
          {MEMBER_CITIES.map((c) => {
            const t = c.members / maxCity;
            const size = 2.4 + t * 4.4;
            return (
              <Marker key={c.city} coordinates={c.coordinates}>
                <PulseDot size={size} hot={t > 0.75} />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-xl border border-border bg-white/90 px-4 py-3 backdrop-blur-sm">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
          Member density
        </p>
        <div
          className="mt-2 h-2 w-44 rounded-full border border-border"
          style={{ background: LEGEND_GRADIENT }}
        />
        <div className="mt-1.5 flex w-44 justify-between text-[10px] font-medium text-ink-faint">
          <span>Fewer</span>
          <span>More members</span>
        </div>
      </div>
    </div>
  );
}

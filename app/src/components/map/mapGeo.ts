import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import worldAtlas from '@/assets/countries-110m.json';
import { MEMBER_GEO, maxCountryMembers } from '@/lib/data';
import type { MemberGeo } from '@/lib/data';

// Convert TopoJSON → GeoJSON once at module scope (memoized for the app lifetime).
// world-atlas country ids are ISO 3166-1 numeric strings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WORLD_GEOGRAPHIES: FeatureCollection<Geometry, { name?: string }> = feature(
  worldAtlas as never,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (worldAtlas as any).objects.countries,
) as never;

/** Live lookup (data is editable by admins, so never cached at module load). */
export const GEO_BY_ISO_N = {
  get: (isoN: string): MemberGeo | undefined => MEMBER_GEO.find((g) => g.isoN === isoN),
  has: (isoN: string): boolean => MEMBER_GEO.some((g) => g.isoN === isoN),
};

// --- Density color scale: white -> BMW blue -> hot red (sqrt for spread) ---

type RGB = [number, number, number];
const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const COLD = hexToRgb('#FFFFFF');
const MID = hexToRgb('#0066B1'); // bmw-blue
const HOT = hexToRgb('#E10600'); // hot red

const lerp = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const rgbStr = (c: RGB): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** Density t in [0,1] using a sqrt scale so mid countries read well. */
export const densityT = (members: number): number =>
  Math.sqrt(Math.min(members / maxCountryMembers(), 1));

/** Map fill for a member count (0 handled by caller as "no members"). */
export function memberColor(members: number): string {
  const t = densityT(members);
  // Two-segment ramp: 0→0.5 white→blue, 0.5→1 blue→red
  return t <= 0.5 ? rgbStr(lerp(COLD, MID, t * 2)) : rgbStr(lerp(MID, HOT, (t - 0.5) * 2));
}

export const NO_MEMBER_FILL = '#EEF2F7';

export const LEGEND_GRADIENT =
  'linear-gradient(to right, #FFFFFF 0%, #0066B1 50%, #E10600 100%)';

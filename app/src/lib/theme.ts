import { useSyncExternalStore } from 'react';

/**
 * Light / dark theme.
 * Dark = "Night Pit Lane" (carbon black, electric blue, gold). Light = white, BMW blue, light blue, red.
 * The choice is stored per device; first visit follows the phone's system setting.
 */
export type Theme = 'dark' | 'light';
const KEY = 'mflight-theme';
const listeners = new Set<() => void>();

let brandRgb: [number, number, number] = [28, 105, 212];
let goldRgb: [number, number, number] | null = null;

function initial(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

let current: Theme = typeof window === 'undefined' ? 'dark' : initial();

const mix = (c: [number, number, number], t: number, to: number) => c.map((v) => Math.round(v + (to - v) * t)).join(' ');
const lum = (c: [number, number, number]) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Brand blue for each theme: light keeps the club colour, dark lifts it so text stays readable on black. */
function applyVars() {
  const root = document.documentElement;
  const s = root.style;
  if (current === 'dark') {
    // lift towards white until it reads on the dark background, but keep white text on it legible
    let t = 0;
    while (lum(brandRgb.map((v) => v + (255 - v) * t) as [number, number, number]) < 0.16 && t < 0.5) t += 0.04;
    s.setProperty('--brand', mix(brandRgb, t, 255));
    s.setProperty('--brand-dark', mix(brandRgb, 0.1, 0));
    s.setProperty('--brand-light', mix(brandRgb, 0.78, 8));
  } else {
    s.setProperty('--brand', brandRgb.join(' '));
    s.setProperty('--brand-dark', mix(brandRgb, 0.17, 0));
    s.setProperty('--brand-light', mix(brandRgb, 0.9, 255));
  }
  if (goldRgb) s.setProperty('--gold', goldRgb.join(' '));
  root.classList.toggle('dark', current === 'dark');
  root.dataset.theme = current;
  root.style.colorScheme = current;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = current === 'dark' ? '#07090D' : '#FFFFFF';
}

export function setBrandColors(brand: [number, number, number] | null, gold: [number, number, number] | null) {
  if (brand) brandRgb = brand;
  if (gold) goldRgb = gold;
  applyVars();
}

export function getTheme(): Theme {
  return current;
}

export function setTheme(t: Theme) {
  current = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  applyVars();
  listeners.forEach((l) => l());
}

export const toggleTheme = () => setTheme(current === 'dark' ? 'light' : 'dark');

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}

if (typeof window !== 'undefined') applyVars();

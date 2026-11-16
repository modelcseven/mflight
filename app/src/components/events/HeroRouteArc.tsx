import { memo } from 'react';

/**
 * Decorative hero route-line (events.md §1): dashed BMW-blue (#0066B1) arc on a
 * white/20 track, small plane traveling the path on a 6s loop. Desktop only
 * (parent hides < lg).
 */
function HeroRouteArcBase() {
  const d = 'M 8,330 C 110,220 190,150 280,118 C 350,94 420,62 492,18';
  return (
    <svg viewBox="0 0 500 340" fill="none" className="h-full w-full" aria-hidden>
      {/* white/20 track */}
      <path d={d} stroke="rgba(255,255,255,0.2)" strokeWidth="5" strokeLinecap="round" />
      {/* dashed BMW-blue route */}
      <path d={d} stroke="#0066B1" strokeWidth="1.5" strokeDasharray="6 7" strokeLinecap="round" opacity="0.9" />
      {/* origin + destination dots */}
      <circle cx="8" cy="330" r="4" fill="#8FC1E8" />
      <circle cx="8" cy="330" r="8" fill="none" stroke="#8FC1E8" strokeOpacity="0.4" strokeWidth="1.5" />
      <circle cx="492" cy="18" r="4" fill="#C9A227" />
      <circle cx="492" cy="18" r="8" fill="none" stroke="#C9A227" strokeOpacity="0.45" strokeWidth="1.5" />
      {/* traveling plane */}
      <g>
        <path d="M 0,-7 L 15,0 L 0,7 L 4,0 Z" fill="#8FC1E8" stroke="#030712" strokeOpacity="0.35" strokeWidth="0.75">
          <animateMotion dur="6s" repeatCount="indefinite" rotate="auto" path={d} />
        </path>
      </g>
    </svg>
  );
}

const HeroRouteArc = memo(HeroRouteArcBase);
export default HeroRouteArc;

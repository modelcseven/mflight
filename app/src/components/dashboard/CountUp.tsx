import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

/**
 * Count-up number (design.md §5): counts 0 → value over `duration` ms with easeOut
 * on first viewport reveal. Used by dashboard stats and the trips footer.
 */
export default function CountUp({
  value,
  duration = 900,
  format = (n: number) => n.toLocaleString('en-GB'),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOut cubic
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}

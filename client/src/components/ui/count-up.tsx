import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
}

export function CountUp({ value, duration = 600, className }: CountUpProps) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const from = startValueRef.current;
    const to = value;
    startTimeRef.current = null;

    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(from + (to - from) * ease(progress));
      setDisplayed(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        startValueRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{displayed}</span>;
}

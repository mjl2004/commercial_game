import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  duration?: number;
  /** render with comma formatting */
  formatted?: boolean;
  className?: string;
  style?: React.CSSProperties;
  prefix?: string;
  suffix?: string;
}

/**
 * Slot-machine style number roll animation (FA-32).
 * Each digit scrolls independently to its target value.
 */
export default function AnimatedNumber({
  value,
  duration = 500,
  formatted = true,
  className,
  style,
  prefix = '',
  suffix = '',
}: Props) {
  const [display, setDisplay] = useState(String(value));
  const prevValue = useRef(value);
  const displayRef = useRef(display);

  useEffect(() => {
    displayRef.current = display;
  });

  useEffect(() => {
    if (value === prevValue.current) return;
    prevValue.current = value;

    const target = formatted ? value.toLocaleString() : String(value);
    const targetDigits = target.replace(/[^0-9]/g, '').split('').map(Number);
    const startDigits = displayRef.current.replace(/[^0-9]/g, '').split('').map(Number);

    // Pad shorter side
    while (startDigits.length < targetDigits.length) startDigits.unshift(0);
    while (targetDigits.length < startDigits.length) targetDigits.unshift(0);

    const steps = Math.max(1, Math.floor(duration / 16));
    const stepTime = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 2);
      const current = startDigits.map((s, i) =>
        Math.round(s + (targetDigits[i] - s) * eased),
      );
      const fmt = current.join('');
      setDisplay(formatted ? Number(fmt).toLocaleString() : fmt);

      if (step >= steps) {
        clearInterval(timer);
        setDisplay(target);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, duration, formatted]);

  return (
    <span
      className={className}
      style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {prefix}{display}{suffix}
    </span>
  );
}

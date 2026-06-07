import { useState } from 'react';

const RING_DURATION = 1200;

/**
 * Cascade multiple ripple origins sequentially
 * to simulate ripple propagation along trade routes (FA-33).
 */
export function useRippleSequence() {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  function trigger(positions: Array<{ x: number; y: number }>) {
    positions.forEach((pos, i) => {
      setTimeout(() => {
        setRipples((prev) => [...prev, { id: Date.now() + i, x: pos.x, y: pos.y }]);
      }, i * 350);
    });

    const total = positions.length * 350 + RING_DURATION + 500;
    setTimeout(() => setRipples([]), total);
  }

  return { ripples, trigger };
}

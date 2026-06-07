import { useEffect, useState, useMemo } from 'react';
import { Box, keyframes } from '@mui/material';

const RING_COUNT = 4;
const RING_DELAY = 200;
const RING_DURATION = 1200;

const expand = keyframes`
  0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.7; }
  80%  { opacity: 0.15; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
`;

interface Ring {
  id: number;
  delay: number;
}

interface Props {
  x: number;
  y: number;
  maxRadius?: number;
  color?: string;
  onComplete?: () => void;
}

export default function RippleRing({
  x,
  y,
  maxRadius = 120,
  color = '#00d4aa',
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  const rings: Ring[] = useMemo(
    () => Array.from({ length: RING_COUNT }, (_, i) => ({ id: i, delay: i * RING_DELAY })),
    [],
  );

  useEffect(() => {
    // briefly render, then clean up
    const total = RING_COUNT * RING_DELAY + RING_DURATION + 100;
    const exitTimer = setTimeout(() => setPhase('out'), total - 200);
    const doneTimer = setTimeout(() => onComplete?.(), total);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  if (phase === 'out') return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 350,
        pointerEvents: 'none',
        opacity: phase === 'in' ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      {rings.map((ring) => (
        <Box
          key={ring.id}
          sx={{
            position: 'absolute',
            left: x,
            top: y,
            width: maxRadius * 2,
            height: maxRadius * 2,
            borderRadius: '50%',
            border: `1.5px solid ${color}`,
            animation: `${expand} ${RING_DURATION}ms ease-out ${ring.delay}ms both`,
          }}
        />
      ))}
    </Box>
  );
}

import { useEffect, useState } from 'react';
import { Box, keyframes } from '@mui/material';

const PARTICLE_COUNT = 24;
const DURATION_MS = 900;

const fly = (x: number, y: number) => keyframes`
  0%   { transform: translate(0, 0) scale(1); opacity: 1; }
  50%  { transform: translate(${x * 0.6}px, ${y * 0.6}px) scale(1.3); opacity: 0.8; }
  100% { transform: translate(${x}px, ${y}px) scale(0.2); opacity: 0; }
`;

/* gold + cyan tech palette */
const colors = [
  '#ffd700', '#ffb800', '#ffec8b', '#ffe066', '#fff3b0',
  '#00d4ff', '#00e5ff', '#5af7ff', '#88f7ff',
];

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

interface Props {
  anchorEl: HTMLElement | null;
  onComplete?: () => void;
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 100;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 30, // bias upward
      size: 4 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 80,
    };
  });
}

export default function TradeParticles({ anchorEl, onComplete }: Props) {
  const [particles] = useState<Particle[]>(generateParticles);

  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), DURATION_MS + 100);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 500,
      }}
    >
      {particles.map((p) => (
        <Box
          key={p.id}
          sx={{
            position: 'absolute',
            left: cx,
            top: cy,
            width: p.size,
            height: p.size,
            borderRadius: p.size < 6 ? '50%' : '35%',
            bgcolor: p.color,
            boxShadow: `0 0 ${p.size + 2}px ${p.color}`,
            animation: `${fly(p.x, p.y)} ${DURATION_MS}ms ease-out ${p.delay}ms both`,
          }}
        />
      ))}
    </Box>
  );
}

import { useEffect, useState } from 'react';
import { Box, keyframes } from '@mui/material';
import colors from '../theme/colors';

/* ---- flash types ---- */
export type FlashType = 'encounter' | 'market' | 'route' | 'warp' | 'tradeSuccess';

interface Config {
  color: string;
  edge: boolean;    // edge glow
  border: boolean;  // flowing border
  pulse: boolean;   // center pulse
  count: number;    // number of flashes
  duration: number; // per flash ms
}

const CONFIG: Record<FlashType, Config> = {
  encounter:    { color: colors.dangerHigh, edge: true,  border: false, pulse: false, count: 3, duration: 300 },
  market:       { color: colors.warning,    edge: false, border: true,  pulse: false, count: 1, duration: 1500 },
  route:        { color: colors.primary,    edge: false, border: false, pulse: true,  count: 2, duration: 600 },
  warp:         { color: colors.successLow, edge: false, border: false, pulse: true,  count: 1, duration: 800 },
  tradeSuccess: { color: colors.primary,    edge: true,  border: false, pulse: false, count: 2, duration: 400 },
};

/* ---- keyframes ---- */
const edgeFlash = (color: string) => keyframes`
  0%, 100% { box-shadow: inset 0 0 0 transparent; }
  40%      { box-shadow: inset 0 0 60px ${color}66, inset 0 0 120px ${color}33; }
`;

const borderFlow = keyframes`
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
`;

const centerPulse = keyframes`
  0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.6; }
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
`;

interface Props {
  type: FlashType;
  onComplete?: () => void;
}

export default function ScreenFlash({ type, onComplete }: Props) {
  const [active, setActive] = useState(true);
  const cfg = CONFIG[type];

  useEffect(() => {
    const total = cfg.count * cfg.duration + 200;
    const timer = setTimeout(() => {
      setActive(false);
      onComplete?.();
    }, total);
    return () => clearTimeout(timer);
  }, [cfg.count, cfg.duration, onComplete]);

  if (!active) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 450,
        pointerEvents: 'none',
      }}
    >
      {/* edge glow */}
      {cfg.edge && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            animation: `${edgeFlash(cfg.color)} ${cfg.duration}ms ease-in-out ${cfg.count}`,
          }}
        />
      )}

      {/* flowing border */}
      {cfg.border && (
        <Box
          sx={{
            position: 'absolute',
            inset: 4,
            borderRadius: '2px',
            border: '3px solid transparent',
            borderImage: `linear-gradient(90deg, transparent, ${cfg.color}, transparent) 1`,
            background: `linear-gradient(90deg, transparent 0%, ${cfg.color}33 50%, transparent 100%)`,
            backgroundSize: '200% 100%',
            animation: `${borderFlow} ${cfg.duration}ms linear ${cfg.count} both`,
          }}
        />
      )}

      {/* center pulse */}
      {cfg.pulse && (
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${cfg.color}44 0%, transparent 70%)`,
            animation: `${centerPulse} ${cfg.duration}ms ease-out ${cfg.count} both`,
          }}
        />
      )}
    </Box>
  );
}

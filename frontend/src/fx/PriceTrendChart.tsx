import { useMemo } from 'react';
import { Box } from '@mui/material';
import colors from '../theme/colors';

interface Props {
  data: number[];
  width?: number;
  height?: number;
}

export default function PriceTrendChart({ data, width = 280, height = 80 }: Props) {
  const points = useMemo(() => {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padX = 4;
    const padY = 12;
    const w = width - padX * 2;
    const h = height - padY * 2;

    return data.map((val, i) => ({
      x: padX + (i / (data.length - 1)) * w,
      y: padY + h - ((val - min) / range) * h,
      val,
    }));
  }, [data, width, height]);

  if (!points) return null;

  const isUp = data[data.length - 1] >= data[0];
  const lineColor = isUp ? colors.accent : colors.danger;
  const areaColor = isUp ? 'rgba(5,255,161,0.12)' : 'rgba(255,42,109,0.12)';
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;
  const refLine = points[0].y;

  return (
    <Box sx={{ width, height, position: 'relative' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* reference dashed line */}
        <line
          x1={points[0].x}
          y1={refLine}
          x2={width - 4}
          y2={refLine}
          stroke={colors.muted}
          strokeWidth={0.5}
          strokeDasharray="3 3"
          opacity={0.5}
        />

        {/* area fill */}
        <path d={areaD} fill={areaColor} />

        {/* line */}
        <path
          d={pathD}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: 'chartDraw 0.6s ease forwards',
            strokeDasharray: '1000',
            strokeDashoffset: '1000',
          }}
        />

        {/* endpoints */}
        <circle cx={points[0].x} cy={points[0].y} r={2.5} fill={colors.muted} />
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill={lineColor}
          stroke={lineColor}
          strokeWidth={1}
        />

        {/* first / last price labels */}
        <text x={points[0].x - 2} y={points[0].y - 6} textAnchor="start" fill={colors.muted} fontSize="8" fontFamily="var(--font-mono)">
          {data[0].toLocaleString()}
        </text>
        <text x={points[points.length - 1].x + 2} y={points[points.length - 1].y - 6} textAnchor="end" fill={lineColor} fontSize="8" fontFamily="var(--font-mono)" fontWeight="700">
          {data[data.length - 1].toLocaleString()}
        </text>
      </svg>

      {/* stroke-dasharray draw animation */}
      <style>{`
        @keyframes chartDraw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </Box>
  );
}

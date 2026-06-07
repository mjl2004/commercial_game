import { Box, Typography, Tooltip } from '@mui/material';
import colors from '../theme/colors';
import { ArrowUpward, ArrowDownward, Remove } from '@mui/icons-material';

interface Props {
  goodsName: string;
  price: number;
  prevPrice?: number;
  /** compact mode for star map overlay */
  compact?: boolean;
}

export default function PriceTag({ goodsName, price, prevPrice, compact = false }: Props) {
  const changePct = prevPrice && prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : null;
  const trend: 'up' | 'down' | 'flat' =
    changePct === null ? 'flat' : changePct > 0.5 ? 'up' : changePct < -0.5 ? 'down' : 'flat';

  const trendColor = trend === 'up' ? colors.successLow : trend === 'down' ? colors.dangerHigh : colors.muted;

  const content = (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: compact ? 1 : 1.25,
        py: compact ? 0.25 : 0.5,
        borderRadius: '2px',
        bgcolor: 'rgba(10,14,39,0.92)',
        border: `1px solid ${trendColor}33`,
        backdropFilter: 'blur(4px)',
        transition: 'all 0.25s ease',
        '&:hover': { borderColor: `${trendColor}66` },
      }}
    >
      {!compact && (
        <Typography variant="caption" noWrap sx={{ maxWidth: 80, color: colors.textSub }}>
          {goodsName}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        {trend === 'up' ? (
          <ArrowUpward sx={{ fontSize: compact ? 14 : 16, color: trendColor }} />
        ) : trend === 'down' ? (
          <ArrowDownward sx={{ fontSize: compact ? 14 : 16, color: trendColor }} />
        ) : (
          <Remove sx={{ fontSize: compact ? 14 : 16, color: trendColor }} />
        )}
        <Typography
          variant={compact ? 'caption' : 'body2'}
          sx={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: trendColor }}
        >
          {price.toLocaleString()}
        </Typography>
      </Box>
      {changePct !== null && (
        <Typography
          variant="caption"
          sx={{ fontFamily: 'var(--font-mono)', color: trendColor, fontSize: '0.65rem' }}
        >
          {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
        </Typography>
      )}
    </Box>
  );

  if (compact) {
    return (
      <Tooltip title={`${goodsName}: ${price.toLocaleString()} cr`} arrow placement="top">
        {content}
      </Tooltip>
    );
  }

  return content;
}

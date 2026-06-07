import { Box, Typography, Tooltip } from '@mui/material';
import { WANTED_META } from '../theme/assets';
import colors from '../theme/colors';

interface Props {
  level: number;
  score?: number;
  reason?: string;
  /** compact mode hides the text label */
  compact?: boolean;
}

export default function WantedBadge({ level, score, reason, compact = false }: Props) {
  const meta = WANTED_META[level] ?? WANTED_META[0];
  const pulse = level > 0;

  return (
    <Tooltip
      title={reason ? `Suspicious score: ${score ?? '?'} · ${reason}` : `Suspicious score: ${score ?? '?'}`}
      arrow
      disableHoverListener={!reason && !score}
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 0 : 1 }}>
        <Box
          sx={{
            width: compact ? 24 : 32,
            height: compact ? 24 : 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? 14 : 16,
            bgcolor: `${meta.color}1a`,
            border: `2px solid ${meta.color}`,
            flexShrink: 0,
            animation: pulse ? 'wantedPulse 2s ease-in-out infinite' : 'none',
            '@keyframes wantedPulse': {
              '0%, 100%': { boxShadow: `0 0 4px ${meta.color}33` },
              '50%': { boxShadow: `0 0 14px ${meta.color}99` },
            },
          }}
        >
          {meta.src ? (
            <Box component="img" src={meta.src} alt={meta.label} sx={{ width: 16, height: 16 }} />
          ) : (
            meta.emoji
          )}
        </Box>
        {!compact && (
          <Box>
            <Typography variant="body2" sx={{ fontFamily: 'var(--font-mono)', color: meta.color, lineHeight: 1.2 }}>
              {meta.label}
            </Typography>
            {score !== undefined && (
              <Typography variant="caption" sx={{ color: colors.muted, fontFamily: 'var(--font-mono)' }}>
                score: {score}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}

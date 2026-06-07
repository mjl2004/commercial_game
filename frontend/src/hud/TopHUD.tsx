import { Box, Typography, Button, LinearProgress, Chip } from '@mui/material';
import AnimatedNumber from '../fx/AnimatedNumber';
import colors from '../theme/colors';
import { ASSET_PATHS } from '../theme/assets';

export type PlayerStatus = 'EXPLORING' | 'TRAVELING' | 'TRADING' | 'DETAINED';

const STATUS_LABEL: Record<PlayerStatus, { text: string; color: string }> = {
  EXPLORING: { text: '自由探索', color: colors.accent },
  TRAVELING: { text: '航行中', color: colors.primary },
  TRADING: { text: '交易中', color: colors.warning },
  DETAINED: { text: '被扣留', color: colors.danger },
};

export interface TopHUDProps {
  credits: number;
  previousCredits?: number;
  status: PlayerStatus;
  startYear: number;
  currentYear: number;
  endYear: number;
  wantedLevel: number;
  onEndGame: () => void;
  disabled?: boolean;
}

function GlowDivider() {
  return (
    <Box
      sx={{
        width: '1px',
        height: '70%',
        background: 'linear-gradient(180deg, transparent, rgba(0,212,255,0.3), transparent)',
        mx: 1.5,
        flexShrink: 0,
      }}
    />
  );
}

export default function TopHUD({
  credits,
  previousCredits,
  status,
  startYear,
  currentYear,
  endYear,
  wantedLevel,
  onEndGame,
  disabled,
}: TopHUDProps) {
  const creditDelta = previousCredits ? credits - previousCredits : 0;
  const totalYears = Math.max(1, endYear - startYear);
  const elapsedYears = Math.max(0, currentYear - startYear);
  const yearProgress = Math.min(100, Math.max(0, (elapsedYears / totalYears) * 100));

  return (
    <Box
      className="hud-panel hud-panel-top"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--hud-top-height)',
        display: 'flex',
        alignItems: 'center',
        px: 3,
        gap: 2,
        zIndex: 10,
        background: 'rgba(10, 14, 26, 0.7)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 180 }}>
        <Box component="img" src={ASSET_PATHS.icons.uiCredits} alt="" sx={{ width: 28, height: 28, opacity: 0.9 }} />
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <AnimatedNumber
            value={credits}
            duration={600}
            formatted
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '1.5rem',
              letterSpacing: '-0.02em',
              color: creditDelta > 0 ? colors.successLow : creditDelta < 0 ? colors.dangerHigh : colors.textMain,
              textShadow:
                creditDelta !== 0
                  ? `0 0 10px ${creditDelta > 0 ? 'rgba(0,229,160,0.4)' : 'rgba(255,71,87,0.4)'}`
                  : 'none',
            }}
          />
          <Typography component="span" sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: colors.textSub, ml: 0.5 }}>
            CR
          </Typography>
        </Box>
      </Box>

      <GlowDivider />

      <Chip
        label={STATUS_LABEL[status].text}
        size="small"
        sx={{
          bgcolor: `${STATUS_LABEL[status].color}18`,
          color: STATUS_LABEL[status].color,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.05em',
          border: `1px solid ${STATUS_LABEL[status].color}44`,
          height: 28,
          borderRadius: '2px',
        }}
      />

      <GlowDivider />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 140 }}>
        <Box component="img" src={ASSET_PATHS.icons.uiTime} alt="" sx={{ width: 20, height: 20, opacity: 0.7 }} />
        <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: colors.textMain, letterSpacing: '0.05em' }}>
          Y-{currentYear} / {endYear}
        </Typography>
      </Box>

      <GlowDivider />

      <Box sx={{ flex: 1, maxWidth: 260, minWidth: 160 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, alignItems: 'center' }}>
          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.textSub }}>
            世界年份
          </Typography>
          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color: colors.primary }}>
            {elapsedYears}/{totalYears}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={yearProgress}
          sx={{
            height: 5,
            borderRadius: '2px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            '& .MuiLinearProgress-bar': {
              background: yearProgress < 55 ? colors.primary : yearProgress < 80 ? colors.warning : colors.dangerHigh,
              borderRadius: '2px',
            },
          }}
        />
      </Box>

      <GlowDivider />

      {wantedLevel > 0 ? (
        <Chip
          label={`WANTED Lv${wantedLevel}`}
          size="small"
          sx={{
            bgcolor: `${colors.wantedOrange}18`,
            color: colors.wantedOrange,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            border: `1px solid ${colors.wantedOrange}55`,
            animation: 'wantedBlink 2s ease-in-out infinite',
            height: 26,
            borderRadius: '2px',
          }}
        />
      ) : (
        <Chip
          label="CLEAN"
          size="small"
          sx={{
            bgcolor: `${colors.accent}12`,
            color: colors.accent,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            fontSize: '0.7rem',
            border: `1px solid ${colors.accent}33`,
            height: 26,
            borderRadius: '2px',
          }}
        />
      )}

      <Button
        variant="contained"
        color="error"
        size="small"
        onClick={onEndGame}
        disabled={disabled}
        sx={{
          ml: 'auto',
          fontSize: '0.7rem',
          letterSpacing: '0.06em',
          py: 0.75,
          px: 2.5,
          minWidth: 0,
          clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
          background: 'linear-gradient(180deg, rgba(255,43,109,0.2) 0%, rgba(255,43,109,0.08) 100%)',
          border: '1px solid rgba(255,43,109,0.5)',
          '&:hover': {
            background: 'linear-gradient(180deg, rgba(255,43,109,0.3) 0%, rgba(255,43,109,0.15) 100%)',
            boxShadow: '0 0 16px rgba(255,43,109,0.3)',
          },
        }}
      >
        结束本局
      </Button>
    </Box>
  );
}

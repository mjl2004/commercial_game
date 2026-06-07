import { useState, useCallback } from 'react';
import { Box, Typography, Tooltip, IconButton } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import colors from '../theme/colors';
import { ASSET_PATHS, goodsSrc } from '../theme/assets';

/* ---- types ---- */
export interface CargoSlot {
  goodsId: number;
  goodsName: string;
  quantity: number;
  avgCost?: number;
  isContraband?: boolean;
}

export interface RightCargoPanelProps {
  cargoUsed: number;
  cargoCapacity: number;
  slots: (CargoSlot | null)[];
  onSlotClick?: (goodsId: number) => void;
}

const ICON_SIZE = 48;

export default function RightCargoPanel({
  cargoUsed,
  cargoCapacity,
  slots,
  onSlotClick,
}: RightCargoPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((v) => !v);
  }, []);

  if (collapsed) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 'var(--hud-top-height)',
          right: 0,
          bottom: 'var(--hud-bottom-height)',
          width: 36,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          background: 'rgba(13, 17, 28, 0.7)',
          backdropFilter: 'blur(8px)',
          borderLeft: `1px solid ${colors.border}`,
          cursor: 'pointer',
          transition: 'all var(--transition-normal)',
          '&:hover': {
            background: 'rgba(13, 17, 28, 0.85)',
            borderLeftColor: colors.primary,
          },
        }}
        onClick={toggleCollapse}
      >
        <Box component="img" src={ASSET_PATHS.icons.uiCargo} alt="" sx={{ width: 18, height: 18, opacity: 0.6 }} />
        <Typography
          sx={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            color: colors.primary,
            writingMode: 'vertical-rl',
            letterSpacing: '0.1em',
          }}
        >
          CARGO
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.textMain }}>
          {cargoUsed}
        </Typography>
        <ChevronLeft sx={{ fontSize: 16, color: colors.muted }} />
      </Box>
    );
  }

  return (
    <Box
      className="hud-panel hud-panel-right"
      sx={{
        position: 'fixed',
        top: 'var(--hud-top-height)',
        right: 0,
        bottom: 'var(--hud-bottom-height)',
        width: 'var(--hud-right-width)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        py: 2,
        px: 1.5,
        background: 'rgba(13, 17, 28, 0.75)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* ---- title + collapse ---- */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, px: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="img" src={ASSET_PATHS.icons.uiCargo} alt="" sx={{ width: 18, height: 18, opacity: 0.7 }} />
          <Typography
            sx={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: colors.textMain,
              letterSpacing: '0.06em',
            }}
          >
            CARGO{' '}
            <span style={{ color: colors.primary }}>{cargoUsed}</span>
            <span style={{ color: colors.textSub }}>/{cargoCapacity}</span>
          </Typography>
        </Box>
        <IconButton size="small" onClick={toggleCollapse} sx={{ color: colors.muted, p: 0.25 }}>
          <ChevronRight sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* ---- slots ---- */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {slots.map((slot, i) =>
          slot ? (
            <Tooltip
              key={slot.goodsId}
              title={`${slot.goodsName} ×${slot.quantity}${slot.avgCost ? ` @ ${slot.avgCost.toLocaleString()} CR` : ''}`}
              arrow
              placement="left"
            >
              <Box
                onClick={() => onSlotClick?.(slot.goodsId)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1,
                  py: 1.25,
                  borderRadius: '2px',
                  bgcolor: 'rgba(0,212,255,0.03)',
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  position: 'relative',
                  overflow: 'visible',
                  '&:hover': {
                    bgcolor: 'rgba(0,212,255,0.06)',
                    borderColor: colors.primary,
                    boxShadow: `0 0 12px ${colors.glow}`,
                  },
                }}
              >
                {/* goods icon */}
                <Box
                  component="img"
                  src={goodsSrc(slot.goodsId)}
                  alt={slot.goodsName}
                  sx={{ width: ICON_SIZE, height: ICON_SIZE, flexShrink: 0 }}
                />
                {/* info */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: colors.textMain, lineHeight: 1.3, fontWeight: 500 }} noWrap>
                    {slot.goodsName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.25 }}>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: colors.primary, fontWeight: 600 }}>
                      ×{slot.quantity}
                    </Typography>
                    {slot.avgCost && (
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: colors.textSub }} noWrap>
                        @ {slot.avgCost.toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                </Box>
                {/* contraband badge */}
                {slot.isContraband && (
                  <Box
                    component="img"
                    src={ASSET_PATHS.icons.contrabandWarning}
                    alt="违禁品"
                    sx={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 18,
                      height: 18,
                      filter: 'drop-shadow(0 0 4px rgba(255,107,53,0.6))',
                    }}
                  />
                )}
              </Box>
            </Tooltip>
          ) : (
            <Box
              key={`empty-${i}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 1,
                py: 2,
                borderRadius: '2px',
                border: `1px dashed ${colors.muted}33`,
                minHeight: 56,
                opacity: 0.6,
              }}
            >
              <Typography sx={{ fontSize: '0.65rem', color: colors.muted, fontFamily: 'var(--font-mono)' }}>
                空仓
              </Typography>
            </Box>
          ),
        )}
      </Box>
    </Box>
  );
}

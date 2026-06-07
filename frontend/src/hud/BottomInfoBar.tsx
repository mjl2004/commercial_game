import { Box, Typography, LinearProgress, Tooltip, IconButton } from '@mui/material';
import colors from '../theme/colors';
import { GOODS_SHORT_NAMES, ASSET_PATHS, goodsSrc } from '../theme/assets';

export interface MonopolyItem {
  goodsId: number;
  goodsName: string;
  shortName: string;
  icon: string;
  ratio: number;
}

export interface BottomInfoBarProps {
  monopolyItems: MonopolyItem[];
  currentStationName?: string;
  currentStationSecurity?: string;
  hoveredStationName?: string;
  hoveredMoveCost?: number;
  regionFocusGoodsName?: string;
  onToggleRegionView?: () => void;
  regionViewActive?: boolean;
}

function ResourceMiniCard({ item }: { item: MonopolyItem }) {
  const pct = item.ratio * 100;
  const barColor = pct >= 70 ? colors.primary : pct >= 30 ? colors.warning : colors.dangerHigh;

  return (
    <Tooltip title={`${item.goodsName}: ${pct.toFixed(1)}%`} arrow placement="top">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          minWidth: 72,
          px: 1,
          py: 0.75,
          borderRadius: '2px',
          border: `1px solid ${colors.border}`,
          bgcolor: 'rgba(0,212,255,0.02)',
          transition: 'all var(--transition-fast)',
        }}
      >
        <Box component="img" src={goodsSrc(item.goodsId)} alt={item.goodsName} sx={{ width: 22, height: 22, opacity: 0.9 }} />
        <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: colors.textSub, lineHeight: 1 }}>
          {GOODS_SHORT_NAMES[item.goodsId] ?? item.shortName}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(pct, 100)}
          sx={{
            width: '100%',
            height: 4,
            borderRadius: '2px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            '& .MuiLinearProgress-bar': {
              bgcolor: barColor,
            },
          }}
        />
        <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', fontWeight: 600, color: barColor }}>
          {pct.toFixed(0)}%
        </Typography>
      </Box>
    </Tooltip>
  );
}

export default function BottomInfoBar({
  monopolyItems,
  currentStationName,
  currentStationSecurity,
  hoveredStationName,
  hoveredMoveCost,
  regionFocusGoodsName,
  onToggleRegionView,
  regionViewActive,
}: BottomInfoBarProps) {
  return (
    <Box
      className="hud-panel hud-panel-bottom"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--hud-bottom-height)',
        display: 'flex',
        alignItems: 'center',
        px: 3,
        gap: 3,
        zIndex: 10,
        background: 'rgba(10, 14, 26, 0.7)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, flex: 2, alignItems: 'center', overflow: 'auto' }}>
        {monopolyItems.length > 0 ? (
          monopolyItems.map((item) => <ResourceMiniCard key={item.goodsId} item={item} />)
        ) : (
          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.muted }}>
            No monopoly data
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
        {currentStationName ? (
          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: colors.textMain, fontWeight: 500 }}>
            {'\u{1F4CD}'} {currentStationName}
            {currentStationSecurity && (
              <Typography component="span" sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.textSub, ml: 0.75 }}>
                安全: {currentStationSecurity}
              </Typography>
            )}
          </Typography>
        ) : (
          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.muted }}>
            Unknown location
          </Typography>
        )}

        {hoveredStationName && (
          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: colors.primary }}>
            {'\u{1F3AF}'} 悬停: {hoveredStationName}
            {hoveredMoveCost !== undefined && (
              <Typography component="span" sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: colors.warning, ml: 0.75 }}>
                消耗 {hoveredMoveCost} 年
              </Typography>
            )}
          </Typography>
        )}

        {regionViewActive && regionFocusGoodsName && (
          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: colors.accent }}>
            区域视图: {regionFocusGoodsName}
          </Typography>
        )}
      </Box>

      <IconButton
        onClick={onToggleRegionView}
        size="small"
        sx={{
          ml: 1,
          border: `1px solid ${regionViewActive ? colors.primary : colors.border}`,
          borderRadius: '2px',
          opacity: regionViewActive ? 1 : 0.6,
          transition: 'all var(--transition-fast)',
          '&:hover': { borderColor: colors.primary, opacity: 1, bgcolor: 'rgba(0,212,255,0.06)' },
        }}
      >
        <Box component="img" src={ASSET_PATHS.icons.uiSector} alt="" sx={{ width: 20, height: 20 }} />
      </IconButton>
    </Box>
  );
}

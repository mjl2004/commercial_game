import { Box } from '@mui/material';
import type { ReactNode } from 'react';

import TopHUD from '../hud/TopHUD';
import type { TopHUDProps } from '../hud/TopHUD';
import RightCargoPanel from '../hud/RightCargoPanel';
import type { RightCargoPanelProps } from '../hud/RightCargoPanel';
import BottomInfoBar from '../hud/BottomInfoBar';
import type { BottomInfoBarProps } from '../hud/BottomInfoBar';
import StarMap from '../canvas/StarMap';
import { WorldEventToastContainer } from '../fx/WorldEventToast';

interface GameSceneLayout {
  topHUD: TopHUDProps;
  rightCargo: RightCargoPanelProps;
  bottomInfo: BottomInfoBarProps;
  modalSlot?: ReactNode;
  isProcessing?: boolean;
  regionViewActive?: boolean;
  onRegionViewChange?: (active: boolean) => void;
}

export default function GameScene({
  topHUD,
  rightCargo,
  bottomInfo,
  modalSlot,
  isProcessing = false,
  regionViewActive = false,
  onRegionViewChange,
}: GameSceneLayout) {
  return (
    <Box sx={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0e1a' }}>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          transition: 'filter 0.4s ease',
          ...(isProcessing ? { filter: 'brightness(0.78)' } : {}),
        }}
      >
        <StarMap regionViewActive={regionViewActive} />
      </Box>

      <TopHUD {...topHUD} disabled={isProcessing} />
      <RightCargoPanel {...rightCargo} />
      <BottomInfoBar
        {...bottomInfo}
        onToggleRegionView={() => onRegionViewChange?.(!regionViewActive)}
        regionViewActive={regionViewActive}
      />

      {modalSlot}
      <WorldEventToastContainer />

      {isProcessing && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 15,
            pointerEvents: 'auto',
            bgcolor: 'rgba(0,0,0,0.15)',
          }}
        />
      )}
    </Box>
  );
}

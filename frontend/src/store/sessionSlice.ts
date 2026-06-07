import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ActiveTravel, EncounterChoiceData, GameSessionData, MoveState, PlayerStatus } from '../game/types';

export interface SessionState {
  current: GameSessionData | null;
  loading: boolean;
}

const initialState: SessionState = {
  current: null,
  loading: false,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<GameSessionData | null>) {
      state.current = action.payload;
    },
    setSessionLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setHoveredStation(state, action: PayloadAction<number | null>) {
      if (!state.current) return;
      state.current.ui.hoveredStationId = action.payload;
    },
    setSelectedTargetStation(state, action: PayloadAction<number | null>) {
      if (!state.current) return;
      state.current.ui.selectedTargetStationId = action.payload;
    },
    setMoveState(state, action: PayloadAction<MoveState>) {
      if (!state.current) return;
      state.current.ui.moveState = action.payload;
    },
    openTradeModal(state, action: PayloadAction<{ stationId: number }>) {
      if (!state.current) return;
      state.current.ui.tradeModal.open = true;
      state.current.ui.tradeModal.stationId = action.payload.stationId;
      state.current.ui.tradeModal.isLoading = true;
      state.current.ui.tradeModal.selectedGoodsId = null;
      state.current.ui.tradeModal.errorMessage = null;
    },
    closeTradeModal(state) {
      if (!state.current) return;
      state.current.ui.tradeModal.open = false;
      state.current.ui.tradeModal.stationId = null;
      state.current.ui.tradeModal.isLoading = false;
      state.current.ui.tradeModal.selectedGoodsId = null;
      state.current.ui.tradeModal.isSubmitting = false;
      state.current.ui.tradeModal.errorMessage = null;
    },
    setTradeModalLoading(state, action: PayloadAction<boolean>) {
      if (!state.current) return;
      state.current.ui.tradeModal.isLoading = action.payload;
    },
    setTradeSelectedGoods(state, action: PayloadAction<number | null>) {
      if (!state.current) return;
      state.current.ui.tradeModal.selectedGoodsId = action.payload;
      state.current.ui.tradeModal.errorMessage = null;
    },
    setTradeSubmitting(state, action: PayloadAction<boolean>) {
      if (!state.current) return;
      state.current.ui.tradeModal.isSubmitting = action.payload;
    },
    setTradeError(state, action: PayloadAction<string | null>) {
      if (!state.current) return;
      state.current.ui.tradeModal.errorMessage = action.payload;
    },
    setRippleState(state, action: PayloadAction<{ affectedStationIds: number[]; startedAt: number | null }>) {
      if (!state.current) return;
      state.current.ui.ripple = action.payload;
    },
    setPlayerStatus(state, action: PayloadAction<PlayerStatus>) {
      if (!state.current) return;
      state.current.player.status = action.payload;
    },
    beginTravel(state, action: PayloadAction<ActiveTravel>) {
      if (!state.current) return;
      state.current.ui.activeTravel = action.payload;
      state.current.ui.moveState = 'traveling';
      state.current.ui.pendingAction = {
        type: 'move',
        stationId: action.payload.fromStationId,
        targetStationId: action.payload.toStationId,
        yearsCost: action.payload.travelCost,
        baseYearsSettled: false,
      };
      state.current.player.status = 'TRAVELING';
    },
    completeTravel(state, action: PayloadAction<{ stationId: number }>) {
      if (!state.current) return;
      state.current.player.currentStationId = action.payload.stationId;
      state.current.ui.activeTravel = null;
      state.current.ui.selectedTargetStationId = null;
      state.current.ui.hoveredStationId = null;
    },
    beginTradeAction(state, action: PayloadAction<{ stationId: number }>) {
      if (!state.current) return;
      state.current.ui.pendingAction = {
        type: 'trade',
        stationId: action.payload.stationId,
        baseYearsSettled: true,
      };
    },
    startEncounter(state, action: PayloadAction<{ event: { id: string; title: string; description: string; choices: EncounterChoiceData[] } }>) {
      if (!state.current) return;
      state.current.ui.moveState = 'event_blocking';
      state.current.ui.encounter = {
        open: true,
        eventId: action.payload.event.id,
        title: action.payload.event.title,
        description: action.payload.event.description,
        choices: action.payload.event.choices,
        selectedChoiceId: null,
        result: null,
        isResolving: false,
      };
    },
    setEncounterResolving(state, action: PayloadAction<boolean>) {
      if (!state.current) return;
      state.current.ui.encounter.isResolving = action.payload;
    },
    closeEncounter(state) {
      if (!state.current) return;
      state.current.ui.encounter = {
        open: false,
        eventId: null,
        title: '',
        description: '',
        choices: [],
        selectedChoiceId: null,
        result: null,
        isResolving: false,
      };
    },
    finishTurnResolution(state) {
      if (!state.current) return;
      state.current.ui.pendingAction = {
        type: null,
        stationId: null,
        targetStationId: null,
        yearsCost: undefined,
        baseYearsSettled: true,
      };
      state.current.ui.moveState = 'idle';
      if (state.current.player.status !== 'LOST' && state.current.player.status !== 'TIMEUP' && state.current.player.status !== 'WON') {
        state.current.player.status = 'EXPLORING';
      }
    },
  },
});

export const {
  setSession,
  setSessionLoading,
  setHoveredStation,
  setSelectedTargetStation,
  setMoveState,
  openTradeModal,
  closeTradeModal,
  setTradeModalLoading,
  setTradeSelectedGoods,
  setTradeSubmitting,
  setTradeError,
  setRippleState,
  setPlayerStatus,
  beginTravel,
  completeTravel,
  beginTradeAction,
  startEncounter,
  setEncounterResolving,
  closeEncounter,
  finishTurnResolution,
} = sessionSlice.actions;

export default sessionSlice.reducer;

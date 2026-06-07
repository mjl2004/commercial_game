import { configureStore } from '@reduxjs/toolkit';
import playerReducer, {
  setPlayer,
  setPlayerLoading,
  setPlayerError,
  updateCredits,
  updateCargo,
  updateWantedLevel,
} from './playerSlice';
import starMapReducer, {
  setPlanets,
  setConnections,
  selectPlanet,
  hoverPlanet,
  setCamera,
  setActiveTravelPreview,
  setStarMapLoading,
} from './starMapSlice';
import marketReducer, { setPrices, setMarketLoading } from './marketSlice';
import eventReducer, {
  setActiveEvent,
  addNotification,
  dismissNotification,
  clearActiveEvent,
} from './eventSlice';
import sessionReducer, {
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
} from './sessionSlice';

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    player: playerReducer,
    starMap: starMapReducer,
    market: marketReducer,
    event: eventReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export {
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
  setPlayer,
  setPlayerLoading,
  setPlayerError,
  updateCredits,
  updateCargo,
  updateWantedLevel,
  setPlanets,
  setConnections,
  selectPlanet,
  hoverPlanet,
  setCamera,
  setActiveTravelPreview,
  setStarMapLoading,
  setPrices,
  setMarketLoading,
  setActiveEvent,
  addNotification,
  dismissNotification,
  clearActiveEvent,
};

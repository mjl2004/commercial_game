import { pushWorldToast } from '../fx/worldEventBus';
import type { GameSessionData } from '../game/types';
import { evaluateGameState } from '../game/monopolyService';

export type WorldStateSource = 'move' | 'trade';

function cloneSession(session: GameSessionData): GameSessionData {
  return JSON.parse(JSON.stringify(session)) as GameSessionData;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function checkFailureState(session: GameSessionData): GameSessionData {
  const nextSession = cloneSession(session);
  if (nextSession.player.credits <= 0) {
    nextSession.player.status = 'LOST';
    return nextSession;
  }

  if (nextSession.player.detainedYears > 18) {
    nextSession.player.status = 'LOST';
    return nextSession;
  }

  if (nextSession.meta.currentYear >= nextSession.meta.endYear) {
    nextSession.player.status = 'TIMEUP';
    return nextSession;
  }

  return nextSession;
}

export function advanceWorldState(
  session: GameSessionData,
  payload: { yearsElapsed: number; source: WorldStateSource },
): GameSessionData {
  const nextSession = cloneSession(session);
  nextSession.meta.currentYear += payload.yearsElapsed;

  Object.values(nextSession.warehouses).forEach((entries) => {
    entries.forEach((entry) => {
      entry.storedTurns += payload.yearsElapsed;
    });
  });

  nextSession.player.suspicion = clamp(nextSession.player.suspicion - payload.yearsElapsed * 5, 0, 999);
  if (nextSession.player.suspicion === 0 && nextSession.player.wantedLevel > 0) {
    nextSession.player.wantedLevel = Math.max(0, nextSession.player.wantedLevel - 1);
  }

  if (Math.random() < 0.15) {
    pushWorldToast(
      payload.source === 'move' ? '航道情报更新，巡逻强度发生变化' : '市场震荡扩散到周边站点',
      payload.source === 'move' ? 'route_opened' : 'market_shock',
    );
  }

  return evaluateGameState(checkFailureState(nextSession));
}

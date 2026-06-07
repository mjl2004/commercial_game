import { checkVictoryState } from './monopolyService';
import type { GameSessionData } from './types';

export interface ScoreBreakdown {
  creditsBonus: number;
  monopolyBonus: number;
  tradeBonus: number;
  eventBonus: number;
  total: number;
}

export interface SettlementData {
  result: 'won' | 'lost' | 'timeup';
  playerName: string;
  finalCredits: number;
  monopolyCount: number;
  tradeCount: number;
  eventCount: number;
  recordId?: string | null;
  finalizedAt?: string | null;
  accountId?: string | null;
  breakdown: ScoreBreakdown;
}

export const DEFAULT_SETTLEMENT: SettlementData = {
  result: 'timeup',
  playerName: 'Pilot',
  finalCredits: 10000,
  monopolyCount: 0,
  tradeCount: 0,
  eventCount: 0,
  recordId: null,
  finalizedAt: null,
  accountId: null,
  breakdown: {
    creditsBonus: 5000,
    monopolyBonus: 0,
    tradeBonus: 0,
    eventBonus: 0,
    total: 5000,
  },
};

export function computeSettlementData(session: GameSessionData): SettlementData {
  const victoryState = checkVictoryState(session);
  const result: SettlementData['result'] =
    session.player.status === 'WON' || victoryState.won
      ? 'won'
      : session.player.status === 'LOST'
        ? 'lost'
        : 'timeup';
  const creditsBonus = Math.round(session.player.credits * 0.5);
  const monopolyBonus = victoryState.monopolyCount * 5000;
  const tradeBonus = session.stats.tradeCount * 100;
  const eventBonus = session.stats.eventCount * 200;

  return {
    result,
    playerName: session.player.name,
    finalCredits: session.player.credits,
    monopolyCount: victoryState.monopolyCount,
    tradeCount: session.stats.tradeCount,
    eventCount: session.stats.eventCount,
    recordId: null,
    finalizedAt: null,
    accountId: null,
    breakdown: {
      creditsBonus,
      monopolyBonus,
      tradeBonus,
      eventBonus,
      total: creditsBonus + monopolyBonus + tradeBonus + eventBonus,
    },
  };
}

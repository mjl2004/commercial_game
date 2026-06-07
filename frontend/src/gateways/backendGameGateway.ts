import { httpClient } from '../api/http';
import { clearStoredSession, normalizeSession, persistSession as persistLocalSession, restoreSession as restoreLocalSession } from '../api/sessionApi';
import { ENCOUNTER_POOL } from '../game/encounterPool';
import { computeSettlementData } from '../game/settlement';
import { mockGameGateway } from './mockGameGateway';
import { logBackendParityDiff, shouldRunBackendParityCheck } from './backendParity';
import type {
  EncounterResolutionPayload,
  GameGateway,
  StartMoveResult,
} from './types';
import type { GameSessionData } from '../game/types';
import type { AccountRecord } from '../api/authApi';
import type { TradeExecutionPayload, TradeExecutionResult } from '../api/sessionTradeApi';
import type { WarehousePayload, WarehouseResult } from '../api/sessionWarehouseApi';

const BACKEND_SESSION_ID_KEY = 'backend-session-id';

interface SessionEnvelope {
  ok: boolean;
  sessionId: string;
  session: GameSessionData;
}

interface ActionEnvelope {
  ok: boolean;
  session: GameSessionData;
  code?: string;
  message?: string;
  encounter?: StartMoveResult['encounter'];
  result?: { success: boolean; message: string };
  taxPaid?: number;
  rippleAffectedStationIds?: number[];
  actionContext?: {
    randomControl?: {
      encounterRoll?: number;
      encounterIndex?: number;
      seed?: number;
    };
  };
}

interface SettlementEnvelope {
  ok: boolean;
  settlement: import('../game/settlement').SettlementData;
  archived?: boolean;
}

interface CompleteSettlementEnvelope {
  ok: boolean;
  settlement: import('../game/settlement').SettlementData;
  account: AccountRecord | null;
  archived?: boolean;
}

function loadBackendSessionId() {
  return localStorage.getItem(BACKEND_SESSION_ID_KEY);
}

function saveBackendSessionId(sessionId: string) {
  localStorage.setItem(BACKEND_SESSION_ID_KEY, sessionId);
}

function clearBackendSessionId() {
  localStorage.removeItem(BACKEND_SESSION_ID_KEY);
}

async function runParityCheck(
  actionName: string,
  sessionId: string,
  backendSession: GameSessionData,
  mockRunner: () => Promise<GameSessionData>,
) {
  if (!shouldRunBackendParityCheck()) {
    return;
  }

  try {
    const mockSession = await mockRunner();
    logBackendParityDiff(actionName, sessionId, mockSession, backendSession);
  } catch (error) {
    console.error(`[backend-parity] ${actionName} parity check failed to execute`, error);
  }
}

function withPatchedRandom<T>(sequence: number[], run: () => Promise<T>): Promise<T> {
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => {
    const value = sequence[index] ?? sequence[sequence.length - 1] ?? 0.99;
    index += 1;
    return value;
  };
  return run().finally(() => {
    Math.random = originalRandom;
  });
}

async function callSessionAction<T extends ActionEnvelope>(path: string, payload: unknown): Promise<T> {
  const sessionId = loadBackendSessionId();
  if (!sessionId) {
    throw new Error('Missing backend session id');
  }

  const response = await httpClient.post<T>(`/api/session/${sessionId}${path}`, payload);
  const data = response.data;
  if (data.ok && data.session) {
    persistLocalSession(normalizeSession(data.session));
  }
  return data;
}

export const backendGameGateway: GameGateway = {
  async startSession(playerName) {
    const response = await httpClient.post<SessionEnvelope>('/api/session/start', { playerName });
    const normalized = normalizeSession(response.data.session);
    saveBackendSessionId(response.data.sessionId);
    persistLocalSession(normalized);
    return normalized;
  },

  async restoreSession() {
    const sessionId = loadBackendSessionId();
    if (!sessionId) {
      return null;
    }

    try {
      const response = await httpClient.get<SessionEnvelope>(`/api/session/${sessionId}`);
      const normalized = normalizeSession(response.data.session);
      persistLocalSession(normalized);
      return normalized;
    } catch {
      return restoreLocalSession();
    }
  },

  async persistSession(session) {
    persistLocalSession(session);
    const sessionId = loadBackendSessionId();
    if (!sessionId) {
      return;
    }

    await httpClient.post(`/api/session/${sessionId}/persist`, {
      session,
    });
  },

  async clearSession() {
    const sessionId = loadBackendSessionId();
    clearBackendSessionId();
    clearStoredSession();
    if (!sessionId) {
      return;
    }

    try {
      await httpClient.delete(`/api/session/${sessionId}`);
    } catch {
      // Ignore cleanup failures so the UI can still recover locally.
    }
  },

  async openMarket(session, stationId) {
    return mockGameGateway.openMarket(session, stationId);
  },

  async executeTrade(session, payload) {
    const response = await callSessionAction<TradeExecutionResult & ActionEnvelope>('/trade', payload);
    if (response.ok) {
      const normalized = normalizeSession(response.session);
      await runParityCheck('executeTrade', normalized.meta.sessionId, normalized, async () => {
        const mockResult = await mockGameGateway.executeTrade(session, payload);
        return mockResult.ok ? mockResult.session : session;
      });
      return {
        ...response,
        session: normalized,
      } as TradeExecutionResult;
    }
    return response as TradeExecutionResult;
  },

  async depositWarehouse(session, payload) {
    const response = await callSessionAction<WarehouseResult & ActionEnvelope>('/warehouse/deposit', payload);
    if (response.ok) {
      const normalized = normalizeSession(response.session);
      await runParityCheck('depositWarehouse', normalized.meta.sessionId, normalized, async () => {
        const mockResult = await mockGameGateway.depositWarehouse(session, payload);
        return mockResult.ok ? mockResult.session : session;
      });
      return {
        ...response,
        session: normalized,
      } as WarehouseResult;
    }
    return response as WarehouseResult;
  },

  async withdrawWarehouse(session, payload) {
    const response = await callSessionAction<WarehouseResult & ActionEnvelope>('/warehouse/withdraw', payload);
    if (response.ok) {
      const normalized = normalizeSession(response.session);
      await runParityCheck('withdrawWarehouse', normalized.meta.sessionId, normalized, async () => {
        const mockResult = await mockGameGateway.withdrawWarehouse(session, payload);
        return mockResult.ok ? mockResult.session : session;
      });
      return {
        ...response,
        session: normalized,
      } as WarehouseResult;
    }
    return response as WarehouseResult;
  },

  async startMove(session, params) {
    const response = await callSessionAction<ActionEnvelope>('/move/start', params);
    const normalized = normalizeSession(response.session);
    await runParityCheck('startMove', normalized.meta.sessionId, normalized, async () => {
      const encounterRoll = response.actionContext?.randomControl?.encounterRoll;
      const encounterIndex = response.actionContext?.randomControl?.encounterIndex;
      if (encounterRoll === undefined || encounterIndex === undefined) {
        const mockResult = await mockGameGateway.startMove(session, params);
        return mockResult.session;
      }

      const indexRandom = (encounterIndex + 0.1) / ENCOUNTER_POOL.length;
      const mockResult = await withPatchedRandom([encounterRoll, indexRandom], () => mockGameGateway.startMove(session, params));
      return mockResult.session;
    });
    return {
      session: normalized,
      encounter: response.encounter ?? null,
    };
  },

  async resolveEncounterChoice(session, payload: EncounterResolutionPayload) {
    const response = await callSessionAction<ActionEnvelope>('/encounter/resolve', payload);
    const normalized = normalizeSession(response.session);
    await runParityCheck('resolveEncounterChoice', normalized.meta.sessionId, normalized, async () => {
      const mockResult = await mockGameGateway.resolveEncounterChoice(session, payload);
      return mockResult.session;
    });
    return {
      session: normalized,
      result: response.result ?? { success: false, message: response.message ?? 'Unknown error' },
    };
  },

  async finalizeEncounterAndAdvance(session) {
    const response = await callSessionAction<ActionEnvelope>('/encounter/finalize', {});
    const normalized = normalizeSession(response.session);
    await runParityCheck('finalizeEncounterAndAdvance', normalized.meta.sessionId, normalized, async () => {
      return mockGameGateway.finalizeEncounterAndAdvance(session);
    });
    return normalized;
  },

  async advanceWorld(session, yearsElapsed, source) {
    const response = await callSessionAction<ActionEnvelope>('/world/advance', {
      yearsElapsed,
      source,
    });
    const normalized = normalizeSession(response.session);
    await runParityCheck('advanceWorld', normalized.meta.sessionId, normalized, async () => {
      return mockGameGateway.advanceWorld(session, yearsElapsed, source);
    });
    return normalized;
  },

  async evaluateSettlement(session) {
    const sessionId = loadBackendSessionId();
    if (!sessionId) {
      return computeSettlementData(session);
    }

    try {
      const response = await httpClient.get<SettlementEnvelope>(`/api/session/${sessionId}/settlement`);
      return response.data.settlement;
    } catch {
      return computeSettlementData(session);
    }
  },

  async completeSettlement(session, accountId) {
    const sessionId = loadBackendSessionId();
    if (!sessionId) {
      const settlement = computeSettlementData(session);
      return { settlement, account: null };
    }

    try {
      const response = await httpClient.post<CompleteSettlementEnvelope>(`/api/session/${sessionId}/complete`, {
        accountId: accountId ?? null,
      });
      return {
        settlement: response.data.settlement,
        account: response.data.account,
      };
    } catch {
      const settlement = computeSettlementData(session);
      return { settlement, account: null };
    }
  },
};

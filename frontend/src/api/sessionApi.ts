import { createGameSession, generateSessionSeed } from '../game/sessionGenerator';
import type { GameSessionData, SessionTemplate, StationInventoryItem, WarehouseEntry } from '../game/types';

const SESSION_TEMPLATE_URL = '/data/session-template.json';
const SESSION_STORAGE_KEY = 'current-game-session';
const SESSION_VERSION = 5;

export async function fetchSessionTemplate(): Promise<SessionTemplate> {
  const response = await fetch(SESSION_TEMPLATE_URL);
  if (!response.ok) {
    throw new Error(`Failed to load session template: ${response.status}`);
  }
  return response.json() as Promise<SessionTemplate>;
}

function normalizePriceHistory(item: StationInventoryItem): StationInventoryItem {
  const history = Array.isArray(item.priceHistory) && item.priceHistory.length > 0
    ? item.priceHistory.filter((value) => Number.isFinite(value))
    : [item.currentPrice];
  const normalizedHistory = [...history, item.currentPrice].slice(-8);

  return {
    ...item,
    priceHistory: normalizedHistory,
  };
}

function normalizeWarehouses(session: Partial<GameSessionData>): Record<number, WarehouseEntry[]> {
  const stationIds = session.stations?.map((station) => station.id) ?? [];
  const source = session.warehouses ?? {};

  return Object.fromEntries(
    stationIds.map((stationId) => {
      const entries = Array.isArray(source[stationId])
        ? source[stationId].map((entry) => ({
            goodsId: entry.goodsId,
            quantity: entry.quantity,
            storedTurns: entry.storedTurns ?? 0,
          }))
        : [];
      return [stationId, entries];
    }),
  );
}

export function normalizeSession(raw: GameSessionData): GameSessionData {
  const normalizedStations = raw.stations.map((station) => ({
    ...station,
    inventory: station.inventory.map(normalizePriceHistory),
  }));

  return {
    ...raw,
    meta: {
      ...raw.meta,
      sessionVersion: raw.meta.sessionVersion ?? SESSION_VERSION,
      lastPersistedAt: raw.meta.lastPersistedAt ?? raw.meta.generatedAt,
      startYear: raw.meta.startYear ?? 2100,
      currentYear: raw.meta.currentYear ?? raw.meta.startYear ?? 2100,
      endYear: raw.meta.endYear ?? 2200,
    },
    stations: normalizedStations,
    warehouses: normalizeWarehouses({ ...raw, stations: normalizedStations }),
    player: {
      ...raw.player,
      detainedYears: (raw.player as GameSessionData['player'] & { detainedSeconds?: number }).detainedYears
        ?? (raw.player as GameSessionData['player'] & { detainedSeconds?: number }).detainedSeconds
        ?? 0,
    },
    ui: {
      hoveredStationId: raw.ui?.hoveredStationId ?? null,
      selectedTargetStationId: raw.ui?.selectedTargetStationId ?? null,
      moveState: raw.ui?.moveState ?? 'idle',
      activeTravel: raw.ui?.activeTravel ?? null,
      pendingAction: {
        type: raw.ui?.pendingAction?.type ?? null,
        stationId: raw.ui?.pendingAction?.stationId ?? null,
        targetStationId: raw.ui?.pendingAction?.targetStationId ?? null,
        yearsCost: raw.ui?.pendingAction?.yearsCost,
        baseYearsSettled: raw.ui?.pendingAction?.baseYearsSettled ?? true,
      },
      tradeModal: {
        open: raw.ui?.tradeModal?.open ?? false,
        stationId: raw.ui?.tradeModal?.stationId ?? null,
        isLoading: raw.ui?.tradeModal?.isLoading ?? false,
        selectedGoodsId: raw.ui?.tradeModal?.selectedGoodsId ?? null,
        isSubmitting: raw.ui?.tradeModal?.isSubmitting ?? false,
        errorMessage: raw.ui?.tradeModal?.errorMessage ?? null,
      },
      ripple: {
        affectedStationIds: raw.ui?.ripple?.affectedStationIds ?? [],
        startedAt: raw.ui?.ripple?.startedAt ?? null,
      },
      encounter: {
        open: raw.ui?.encounter?.open ?? false,
        eventId: raw.ui?.encounter?.eventId ?? null,
        title: raw.ui?.encounter?.title ?? '',
        description: raw.ui?.encounter?.description ?? '',
        choices: raw.ui?.encounter?.choices ?? [],
        selectedChoiceId: raw.ui?.encounter?.selectedChoiceId ?? null,
        result: raw.ui?.encounter?.result ?? null,
        isResolving: raw.ui?.encounter?.isResolving ?? false,
      },
    },
    stats: {
      tradeCount: raw.stats?.tradeCount ?? 0,
      eventCount: raw.stats?.eventCount ?? 0,
    },
  };
}

export function loadStoredSession(): GameSessionData | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    return normalizeSession(JSON.parse(raw) as GameSessionData);
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function persistSession(session: GameSessionData) {
  const normalized = normalizeSession(session);
  normalized.meta.lastPersistedAt = new Date().toISOString();
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalized));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function restoreSession(): GameSessionData | null {
  const stored = loadStoredSession();
  if (!stored) return null;
  if (stored.meta.sessionVersion !== SESSION_VERSION) {
    return normalizeSession(stored);
  }
  return stored;
}

export async function startNewSession(playerName: string): Promise<GameSessionData> {
  const template = await fetchSessionTemplate();
  const session = normalizeSession(createGameSession(template, playerName, generateSessionSeed()));
  persistSession(session);
  return session;
}

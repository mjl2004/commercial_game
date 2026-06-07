import { DATA_MODE } from './indexRuntime';
import type { GameSessionData } from '../game/types';

const ENABLE_BACKEND_PARITY_CHECK = import.meta.env.VITE_ENABLE_BACKEND_PARITY_CHECK === 'true';

type ComparableValue = boolean | number | string | null | ComparableValue[] | { [key: string]: ComparableValue };

function toComparable(value: unknown): ComparableValue {
  return JSON.parse(JSON.stringify(value)) as ComparableValue;
}

function collectDiffs(
  path: string,
  expected: ComparableValue,
  actual: ComparableValue,
  diffs: Array<{ path: string; expected: ComparableValue; actual: ComparableValue }>,
) {
  if (JSON.stringify(expected) === JSON.stringify(actual)) {
    return;
  }

  const expectedIsObject = expected !== null && typeof expected === 'object' && !Array.isArray(expected);
  const actualIsObject = actual !== null && typeof actual === 'object' && !Array.isArray(actual);
  if (expectedIsObject && actualIsObject) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const key of keys) {
      collectDiffs(
        path ? `${path}.${key}` : key,
        (expected as Record<string, ComparableValue>)[key] ?? null,
        (actual as Record<string, ComparableValue>)[key] ?? null,
        diffs,
      );
    }
    return;
  }

  diffs.push({ path, expected, actual });
}

function comparableSession(session: GameSessionData) {
  return {
    player: {
      credits: session.player.credits,
      cargo: toComparable(session.player.cargo),
      currentStationId: session.player.currentStationId,
      wantedLevel: session.player.wantedLevel,
      suspicion: session.player.suspicion,
      detainedYears: session.player.detainedYears,
    },
    meta: {
      currentYear: session.meta.currentYear,
    },
    stations: session.stations.map((station) => ({
      id: station.id,
      inventory: station.inventory.map((item) => ({
        goodsId: item.goodsId,
        stock: item.stock,
        currentPrice: item.currentPrice,
        priceHistory: item.priceHistory,
      })),
    })),
    warehouses: toComparable(session.warehouses),
    stats: {
      tradeCount: session.stats.tradeCount,
      eventCount: session.stats.eventCount,
    },
    ui: {
      pendingAction: toComparable(session.ui.pendingAction),
      ripple: toComparable(session.ui.ripple),
      encounter: toComparable(session.ui.encounter),
    },
  };
}

export function shouldRunBackendParityCheck() {
  return DATA_MODE === 'backend' && ENABLE_BACKEND_PARITY_CHECK;
}

export function logBackendParityDiff(actionName: string, sessionId: string, expected: GameSessionData, actual: GameSessionData) {
  const diffs: Array<{ path: string; expected: ComparableValue; actual: ComparableValue }> = [];
  collectDiffs('', comparableSession(expected), comparableSession(actual), diffs);
  if (diffs.length === 0) {
    return;
  }

  console.groupCollapsed(`[backend-parity] ${actionName} mismatch for ${sessionId}`);
  for (const diff of diffs) {
    console.error(diff.path, { expected: diff.expected, actual: diff.actual });
  }
  console.groupEnd();
}

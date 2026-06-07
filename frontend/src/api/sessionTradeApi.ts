import type {
  CargoItem,
  GameSessionData,
  GoodsDefinition,
  RouteData,
  StationData,
  StationInventoryItem,
} from '../game/types';
import { advanceWorldState, checkFailureState } from './sessionWorldApi';

export interface TradeExecutionPayload {
  stationId: number;
  goodsId: number;
  quantity: number;
  tradeType: 'buy' | 'sell';
}

export interface TradeFailure {
  ok: false;
  code: 'INSUFFICIENT_FUNDS' | 'CARGO_FULL' | 'STOCK_NOT_ENOUGH' | 'NO_CARGO' | 'INVALID_STATION' | 'INVALID_GOODS';
  message: string;
}

export interface TradeSuccess {
  ok: true;
  session: GameSessionData;
  rippleAffectedStationIds: number[];
}

export type TradeExecutionResult = TradeFailure | TradeSuccess;

const MARKET_OPEN_DELAY_MS = 420;
const PRICE_HISTORY_LIMIT = 8;

function cloneSession(session: GameSessionData): GameSessionData {
  return JSON.parse(JSON.stringify(session)) as GameSessionData;
}

function routeNeighbors(routes: RouteData[], stationId: number) {
  return routes.flatMap((route) => {
    if (route.from === stationId) return [route.to];
    if (route.to === stationId) return [route.from];
    return [];
  });
}

function findGoodsDefinition(session: GameSessionData, goodsId: number): GoodsDefinition | undefined {
  return session.goods.find((goods) => goods.id === goodsId);
}

function findStation(session: GameSessionData, stationId: number): StationData | undefined {
  return session.stations.find((station) => station.id === stationId);
}

function appendPriceHistory(item: StationInventoryItem, nextPrice: number) {
  item.currentPrice = nextPrice;
  item.priceHistory = [...item.priceHistory, nextPrice].slice(-PRICE_HISTORY_LIMIT);
}

function updateCargo(
  cargo: CargoItem[],
  goods: GoodsDefinition,
  quantity: number,
  unitPrice: number,
  tradeType: 'buy' | 'sell',
) {
  const nextCargo = [...cargo];
  const cargoIndex = nextCargo.findIndex((item) => item.goodsId === goods.id);

  if (tradeType === 'buy') {
    if (cargoIndex === -1) {
      nextCargo.push({
        goodsId: goods.id,
        goodsName: goods.name,
        quantity,
        avgCost: unitPrice,
        isContraband: goods.isContraband,
      });
    } else {
      const existing = nextCargo[cargoIndex];
      const totalQuantity = existing.quantity + quantity;
      existing.avgCost = Math.round((existing.avgCost * existing.quantity + unitPrice * quantity) / totalQuantity);
      existing.quantity = totalQuantity;
    }
    return nextCargo;
  }

  if (cargoIndex === -1) return nextCargo;
  const existing = nextCargo[cargoIndex];
  existing.quantity -= quantity;
  if (existing.quantity <= 0) {
    nextCargo.splice(cargoIndex, 1);
  }
  return nextCargo;
}

function computeRippleAffected(session: GameSessionData, originStationId: number) {
  const visited = new Set<number>([originStationId]);
  const queue: Array<{ stationId: number; hop: number }> = [{ stationId: originStationId, hop: 0 }];
  const result: Array<{ stationId: number; hop: number }> = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.hop >= 3) continue;
    const neighbors = routeNeighbors(session.routes, current.stationId);
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      const hop = current.hop + 1;
      result.push({ stationId: neighbor, hop });
      queue.push({ stationId: neighbor, hop });
    }
  }

  return result;
}

export async function openStationMarket(session: GameSessionData, stationId: number) {
  const station = findStation(session, stationId);
  if (!station || session.player.currentStationId !== stationId) {
    throw new Error('INVALID_STATION');
  }

  await new Promise((resolve) => setTimeout(resolve, MARKET_OPEN_DELAY_MS));
  return station;
}

export async function executeTrade(session: GameSessionData, payload: TradeExecutionPayload): Promise<TradeExecutionResult> {
  const station = findStation(session, payload.stationId);
  if (!station || session.player.currentStationId !== payload.stationId) {
    return { ok: false, code: 'INVALID_STATION', message: '当前不在该站点，无法交易。' };
  }

  const goods = findGoodsDefinition(session, payload.goodsId);
  const inventoryItem = station.inventory.find((item) => item.goodsId === payload.goodsId);
  if (!goods || !inventoryItem) {
    return { ok: false, code: 'INVALID_GOODS', message: '该商品不存在。' };
  }

  const currentCargo = session.player.cargo.find((item) => item.goodsId === payload.goodsId);
  const cargoUsed = session.player.cargo.reduce((sum, item) => sum + item.quantity, 0);
  const unitPrice = inventoryItem.currentPrice;

  if (payload.tradeType === 'buy') {
    if (inventoryItem.stock < payload.quantity) {
      return { ok: false, code: 'STOCK_NOT_ENOUGH', message: '本站库存不足。' };
    }
    if (session.player.credits < unitPrice * payload.quantity) {
      return { ok: false, code: 'INSUFFICIENT_FUNDS', message: '资金不足。' };
    }
    if (cargoUsed + payload.quantity > session.player.cargoCapacity) {
      return { ok: false, code: 'CARGO_FULL', message: '货舱已满。' };
    }
  } else if (!currentCargo || currentCargo.quantity < payload.quantity) {
    return { ok: false, code: 'NO_CARGO', message: '没有足够货物可卖。' };
  }

  const nextSession = cloneSession(session);
  const nextStation = findStation(nextSession, payload.stationId)!;
  const nextInventory = nextStation.inventory.find((item) => item.goodsId === payload.goodsId)!;
  const nextGoods = findGoodsDefinition(nextSession, payload.goodsId)!;
  const yearsCost = 1;

  if (payload.tradeType === 'buy') {
    nextInventory.stock -= payload.quantity;
    nextSession.player.credits -= unitPrice * payload.quantity;
  } else {
    nextInventory.stock += payload.quantity;
    nextSession.player.credits += unitPrice * payload.quantity;
  }

  nextSession.player.cargo = updateCargo(nextSession.player.cargo, nextGoods, payload.quantity, unitPrice, payload.tradeType);
  nextSession.stats.tradeCount += 1;

  const baseShift = Math.max(4, Math.round(payload.quantity * 1.4));
  const nextCurrentPrice = payload.tradeType === 'buy'
    ? nextInventory.currentPrice + baseShift
    : Math.max(1, nextInventory.currentPrice - baseShift);
  appendPriceHistory(nextInventory, nextCurrentPrice);

  const rippleAffected = computeRippleAffected(nextSession, payload.stationId);
  for (const affected of rippleAffected) {
    const affectedStation = findStation(nextSession, affected.stationId);
    const affectedInventory = affectedStation?.inventory.find((item) => item.goodsId === payload.goodsId);
    if (!affectedStation || !affectedInventory) continue;

    const delta = Math.max(
      1,
      Math.round((baseShift * (1 / affected.hop)) * (1 / affectedStation.independenceFactor)),
    );
    const ripplePrice = payload.tradeType === 'buy'
      ? affectedInventory.currentPrice + delta
      : Math.max(1, affectedInventory.currentPrice - delta);
    appendPriceHistory(affectedInventory, ripplePrice);
  }

  nextSession.ui.tradeModal.errorMessage = null;
  nextSession.ui.tradeModal.isSubmitting = false;
  nextSession.ui.ripple = {
    affectedStationIds: [payload.stationId, ...rippleAffected.map((item) => item.stationId)],
    startedAt: Date.now(),
  };
  const advancedSession = advanceWorldState(checkFailureState(nextSession), {
    yearsElapsed: yearsCost,
    source: 'trade',
  });

  return {
    ok: true,
    session: advancedSession,
    rippleAffectedStationIds: advancedSession.ui.ripple.affectedStationIds,
  };
}

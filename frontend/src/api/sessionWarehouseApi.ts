import type { GameSessionData, GoodsDefinition, WarehouseEntry } from '../game/types';

export interface WarehousePayload {
  stationId: number;
  goodsId: number;
  quantity: number;
}

export interface WarehouseSuccess {
  ok: true;
  session: GameSessionData;
  taxPaid?: number;
}

export interface WarehouseFailure {
  ok: false;
  message: string;
}

export type WarehouseResult = WarehouseSuccess | WarehouseFailure;

const BASE_TAX_RATE = 12;
const TURN_FACTOR = 0.12;

function cloneSession(session: GameSessionData): GameSessionData {
  return JSON.parse(JSON.stringify(session)) as GameSessionData;
}

function findGoods(session: GameSessionData, goodsId: number): GoodsDefinition | undefined {
  return session.goods.find((goods) => goods.id === goodsId);
}

function getWantedMultiplier(wantedLevel: number) {
  if (wantedLevel <= 0) return 1;
  if (wantedLevel === 1) return 1.35;
  if (wantedLevel === 2) return 1.9;
  return 2.6;
}

function getStoredYearMultiplier(storedYears: number) {
  return 1 + storedYears * TURN_FACTOR;
}

function findWarehouseEntry(entries: WarehouseEntry[], goodsId: number) {
  return entries.find((entry) => entry.goodsId === goodsId);
}

export async function depositToWarehouse(session: GameSessionData, payload: WarehousePayload): Promise<WarehouseResult> {
  if (session.player.currentStationId !== payload.stationId) {
    return { ok: false, message: '必须到达当前站点才能存入仓库。' };
  }

  const cargoItem = session.player.cargo.find((item) => item.goodsId === payload.goodsId);
  if (!cargoItem || cargoItem.quantity < payload.quantity) {
    return { ok: false, message: '货舱中没有足够货物可存入。' };
  }

  const nextSession = cloneSession(session);
  const nextCargoItem = nextSession.player.cargo.find((item) => item.goodsId === payload.goodsId)!;
  const warehouseEntries = nextSession.warehouses[payload.stationId] ?? [];
  const existingWarehouse = findWarehouseEntry(warehouseEntries, payload.goodsId);

  nextCargoItem.quantity -= payload.quantity;
  if (nextCargoItem.quantity <= 0) {
    nextSession.player.cargo = nextSession.player.cargo.filter((item) => item.goodsId !== payload.goodsId);
  }

  if (existingWarehouse) {
    existingWarehouse.quantity += payload.quantity;
  } else {
    warehouseEntries.push({
      goodsId: payload.goodsId,
      quantity: payload.quantity,
      storedTurns: 0,
    });
  }

  nextSession.warehouses[payload.stationId] = warehouseEntries;
  return { ok: true, session: nextSession };
}

export async function withdrawFromWarehouse(session: GameSessionData, payload: WarehousePayload): Promise<WarehouseResult> {
  if (session.player.currentStationId !== payload.stationId) {
    return { ok: false, message: '必须到达当前站点才能取出货物。' };
  }

  const warehouseEntries = session.warehouses[payload.stationId] ?? [];
  const warehouseEntry = findWarehouseEntry(warehouseEntries, payload.goodsId);
  if (!warehouseEntry || warehouseEntry.quantity < payload.quantity) {
    return { ok: false, message: '当前站点仓库中没有足够货物。' };
  }

  const cargoUsed = session.player.cargo.reduce((sum, item) => sum + item.quantity, 0);
  if (cargoUsed + payload.quantity > session.player.cargoCapacity) {
    return { ok: false, message: '货舱剩余空间不足。' };
  }

  const goods = findGoods(session, payload.goodsId);
  if (!goods) {
    return { ok: false, message: '该商品不存在。' };
  }

  const wantedMultiplier = getWantedMultiplier(session.player.wantedLevel);
  const taxRate = BASE_TAX_RATE * getStoredYearMultiplier(warehouseEntry.storedTurns) * wantedMultiplier;
  const taxPaid = Math.round(payload.quantity * taxRate);
  if (session.player.credits < taxPaid) {
    return { ok: false, message: '资金不足，无法支付取货税费。' };
  }

  const nextSession = cloneSession(session);
  const nextWarehouseEntries = nextSession.warehouses[payload.stationId] ?? [];
  const nextWarehouseEntry = findWarehouseEntry(nextWarehouseEntries, payload.goodsId)!;
  const cargoItem = nextSession.player.cargo.find((item) => item.goodsId === payload.goodsId);

  nextWarehouseEntry.quantity -= payload.quantity;
  if (nextWarehouseEntry.quantity <= 0) {
    nextSession.warehouses[payload.stationId] = nextWarehouseEntries.filter((entry) => entry.goodsId !== payload.goodsId);
  }

  nextSession.player.credits -= taxPaid;

  if (cargoItem) {
    const totalQuantity = cargoItem.quantity + payload.quantity;
    cargoItem.avgCost = Math.round((cargoItem.avgCost * cargoItem.quantity + goods.basePrice * payload.quantity) / totalQuantity);
    cargoItem.quantity = totalQuantity;
  } else {
    nextSession.player.cargo.push({
      goodsId: goods.id,
      goodsName: goods.name,
      quantity: payload.quantity,
      avgCost: goods.basePrice,
      isContraband: goods.isContraband,
    });
  }

  return {
    ok: true,
    session: nextSession,
    taxPaid,
  };
}

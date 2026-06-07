import type { GameSessionData, RegionMonopolyNode } from './types';

export interface MonopolyProgressItem {
  goodsId: number;
  goodsName: string;
  shortName: string;
  ratio: number;
  playerHeld: number;
  marketTotal: number;
}

export interface RegionMonopolyState {
  focusGoodsId: number | null;
  focusGoodsName: string | null;
  highlightedStations: RegionMonopolyNode[];
}

function sumCargoForGoods(session: GameSessionData, goodsId: number) {
  return session.player.cargo
    .filter((item) => item.goodsId === goodsId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function sumWarehousesForGoods(session: GameSessionData, goodsId: number) {
  return Object.values(session.warehouses).reduce((sum, entries) => {
    const quantity = entries
      .filter((entry) => entry.goodsId === goodsId)
      .reduce((acc, entry) => acc + entry.quantity, 0);
    return sum + quantity;
  }, 0);
}

function sumMarketForGoods(session: GameSessionData, goodsId: number) {
  return session.stations.reduce((sum, station) => {
    const inventory = station.inventory.find((item) => item.goodsId === goodsId);
    return sum + (inventory?.stock ?? 0);
  }, 0);
}

function stationNeighbors(session: GameSessionData, stationId: number) {
  return session.routes.flatMap((route) => {
    if (route.from === stationId) return [route.to];
    if (route.to === stationId) return [route.from];
    return [];
  });
}

export function computeGalaxyMonopolyProgress(session: GameSessionData): MonopolyProgressItem[] {
  return session.goods.map((goods) => {
    const cargoHeld = sumCargoForGoods(session, goods.id);
    const warehouseHeld = sumWarehousesForGoods(session, goods.id);
    const playerHeld = cargoHeld + warehouseHeld;
    const marketTotal = sumMarketForGoods(session, goods.id);
    const denominator = playerHeld + marketTotal;
    const ratio = denominator > 0 ? playerHeld / denominator : 0;

    return {
      goodsId: goods.id,
      goodsName: goods.name,
      shortName: goods.shortName,
      ratio,
      playerHeld,
      marketTotal,
    };
  });
}

export function computeRegionMonopolyState(session: GameSessionData): RegionMonopolyState {
  const galaxyProgress = computeGalaxyMonopolyProgress(session).sort((a, b) => b.ratio - a.ratio);
  const focus = galaxyProgress[0];
  if (!focus) {
    return { focusGoodsId: null, focusGoodsName: null, highlightedStations: [] };
  }

  const highlightedStations: RegionMonopolyNode[] = [];
  for (const station of session.stations) {
    const localStations = [station.id, ...stationNeighbors(session, station.id)];
    const localMarket = localStations.reduce((sum, localStationId) => {
      const localStation = session.stations.find((entry) => entry.id === localStationId);
      const inventory = localStation?.inventory.find((item) => item.goodsId === focus.goodsId);
      return sum + (inventory?.stock ?? 0);
    }, 0);
    const denominator = focus.playerHeld + localMarket;
    const ratio = denominator > 0 ? focus.playerHeld / denominator : 0;
    if (ratio >= 0.8) {
      highlightedStations.push({
        stationId: station.id,
        goodsId: focus.goodsId,
        ratio,
      });
    }
  }

  return {
    focusGoodsId: focus.goodsId,
    focusGoodsName: focus.goodsName,
    highlightedStations,
  };
}

export function checkVictoryState(session: GameSessionData) {
  const progress = computeGalaxyMonopolyProgress(session);
  const winner = progress.find((item) => item.ratio >= 0.8);
  return {
    won: Boolean(winner),
    winningGoods: winner ?? null,
    monopolyCount: progress.filter((item) => item.ratio >= 0.8).length,
    progress,
  };
}

export function evaluateGameState(session: GameSessionData): GameSessionData {
  const nextSession = JSON.parse(JSON.stringify(session)) as GameSessionData;
  const victory = checkVictoryState(nextSession);

  if (victory.won) {
    nextSession.player.status = 'WON';
    return nextSession;
  }

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

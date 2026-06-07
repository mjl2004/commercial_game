import type {
  EncounterChoiceData,
  GameSessionData,
  GoodsDefinition,
  RouteData,
  SessionTemplate,
  StationData,
  StationInventoryItem,
} from './types';

const SESSION_ID_PREFIX = 'session';

function createRng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function randInt(min: number, max: number, rng: () => number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(a: Pick<StationData, 'x' | 'y'>, b: Pick<StationData, 'x' | 'y'>) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function createInventory(goods: GoodsDefinition[], rng: () => number): StationInventoryItem[] {
  return goods.map((goodsDef) => {
    const stock = randInt(goodsDef.stockMin, goodsDef.stockMax, rng);
    const currentPrice = clamp(
      goodsDef.basePrice + randInt(-goodsDef.priceVariance, goodsDef.priceVariance, rng),
      Math.max(1, goodsDef.basePrice - goodsDef.priceVariance),
      goodsDef.basePrice + goodsDef.priceVariance,
    );
    const priceHistory = Array.from({ length: 6 }, (_, index) => {
      if (index === 5) return currentPrice;
      return clamp(
        currentPrice + randInt(-Math.floor(goodsDef.priceVariance * 0.5), Math.floor(goodsDef.priceVariance * 0.5), rng),
        Math.max(1, goodsDef.basePrice - goodsDef.priceVariance),
        goodsDef.basePrice + goodsDef.priceVariance,
      );
    });

    return {
      goodsId: goodsDef.id,
      stock,
      basePrice: goodsDef.basePrice,
      currentPrice,
      priceHistory,
    };
  });
}

function createStations(template: SessionTemplate, rng: () => number): StationData[] {
  const margin = 140;
  const stations: StationData[] = [];
  const stationNames = shuffle(template.stationNames, rng).slice(0, template.meta.stationCount);

  for (let i = 0; i < template.meta.stationCount; i += 1) {
    let attempts = 0;
    let x = 0;
    let y = 0;

    do {
      x = randInt(margin, template.meta.mapWidth - margin, rng);
      y = randInt(margin, template.meta.mapHeight - margin, rng);
      attempts += 1;
    } while (
      attempts < 300 &&
      stations.some((station) => distance(station, { x, y }) < template.meta.minStationDistance)
    );

    stations.push({
      id: i + 1,
      name: stationNames[i],
      x,
      y,
      security: template.securityLevels[randInt(0, template.securityLevels.length - 1, rng)],
      faction: template.factions[randInt(0, template.factions.length - 1, rng)],
      independenceFactor: Number((1 + rng() * 0.75).toFixed(2)),
      inventory: createInventory(template.goods, rng),
    });
  }

  return stations;
}

function routeKey(from: number, to: number) {
  return from < to ? `${from}-${to}` : `${to}-${from}`;
}

function buildRoutes(stations: StationData[], rng: () => number): RouteData[] {
  const routes: RouteData[] = [];
  const added = new Set<string>();
  const degrees = new Map<number, number>();
  const stationIds = shuffle(
    stations.map((station) => station.id),
    rng,
  );
  const stationMap = new Map(stations.map((station) => [station.id, station]));
  const connected = new Set<number>([stationIds[0]]);

  const addRoute = (from: number, to: number) => {
    if (from === to) return false;
    const key = routeKey(from, to);
    if (added.has(key)) return false;

    const fromStation = stationMap.get(from);
    const toStation = stationMap.get(to);
    if (!fromStation || !toStation) return false;

    const rawDistance = distance(fromStation, toStation);
    const travelCost = clamp(Math.round(rawDistance / 180), 1, 6);

    routes.push({
      from,
      to,
      travelCost,
      status: 'ACTIVE',
    });
    added.add(key);
    degrees.set(from, (degrees.get(from) ?? 0) + 1);
    degrees.set(to, (degrees.get(to) ?? 0) + 1);
    return true;
  };

  for (let i = 1; i < stationIds.length; i += 1) {
    const stationId = stationIds[i];
    const current = stationMap.get(stationId)!;
    const candidates = [...connected]
      .map((candidateId) => stationMap.get(candidateId)!)
      .sort((a, b) => distance(current, a) - distance(current, b))
      .slice(0, 4);

    const target = candidates[randInt(0, candidates.length - 1, rng)];
    addRoute(stationId, target.id);
    connected.add(stationId);
  }

  const extraTargetCount = stations.length - 1 + randInt(5, 8, rng);
  const maxDegree = 4;
  const candidates: Array<{ from: number; to: number; distance: number }> = [];

  for (let i = 0; i < stations.length; i += 1) {
    for (let j = i + 1; j < stations.length; j += 1) {
      candidates.push({
        from: stations[i].id,
        to: stations[j].id,
        distance: distance(stations[i], stations[j]),
      });
    }
  }

  const shuffledCandidates = shuffle(candidates, rng).sort((a, b) => a.distance - b.distance);
  for (const candidate of shuffledCandidates) {
    if (routes.length >= extraTargetCount) break;
    if ((degrees.get(candidate.from) ?? 0) >= maxDegree || (degrees.get(candidate.to) ?? 0) >= maxDegree) {
      continue;
    }

    const chance = candidate.distance < 260 ? 0.78 : candidate.distance < 360 ? 0.42 : 0.12;
    if (rng() < chance) {
      addRoute(candidate.from, candidate.to);
    }
  }

  return routes;
}

export function generateSessionSeed() {
  return Math.floor(Date.now() % 2147483647);
}

export function createGameSession(template: SessionTemplate, playerName: string, seed = generateSessionSeed()): GameSessionData {
  const rng = createRng(seed);
  const stations = createStations(template, rng);
  const routes = buildRoutes(stations, rng);
  const spawnStation = stations[randInt(0, stations.length - 1, rng)];

  return {
    meta: {
      sessionVersion: 5,
      sessionId: `${SESSION_ID_PREFIX}-${seed}`,
      seed,
      generatedAt: new Date().toISOString(),
      lastPersistedAt: new Date().toISOString(),
      startYear: 2100,
      currentYear: 2100,
      endYear: 2200,
      mapWidth: template.meta.mapWidth,
      mapHeight: template.meta.mapHeight,
    },
    goods: template.goods,
    stations,
    routes,
    player: {
      id: 1,
      name: playerName || 'Pilot',
      credits: 10000,
      currentStationId: spawnStation.id,
      cargo: [],
      cargoCapacity: 80,
      wantedLevel: 0,
      suspicion: 0,
      detainedYears: 0,
      status: 'EXPLORING',
    },
    warehouses: Object.fromEntries(stations.map((station) => [station.id, []])),
    ui: {
      hoveredStationId: null,
      selectedTargetStationId: null,
      moveState: 'idle',
      activeTravel: null,
      pendingAction: {
        type: null,
        stationId: null,
        targetStationId: null,
        yearsCost: undefined,
      },
      tradeModal: {
        open: false,
        stationId: null,
        isLoading: false,
        selectedGoodsId: null,
        isSubmitting: false,
        errorMessage: null,
      },
      ripple: {
        affectedStationIds: [],
        startedAt: null,
      },
      encounter: {
        open: false,
        eventId: null,
        title: '',
        description: '',
        choices: [] as EncounterChoiceData[],
        selectedChoiceId: null,
        result: null,
        isResolving: false,
      },
    },
    stats: {
      tradeCount: 0,
      eventCount: 0,
    },
  };
}

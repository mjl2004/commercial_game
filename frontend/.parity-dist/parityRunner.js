import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
//#region src/game/sessionGenerator.ts
var SESSION_ID_PREFIX = "session";
function createRng(seed) {
	let value = seed >>> 0;
	return () => {
		value = value * 1664525 + 1013904223 >>> 0;
		return value / 4294967296;
	};
}
function shuffle(items, rng) {
	const next = [...items];
	for (let i = next.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[next[i], next[j]] = [next[j], next[i]];
	}
	return next;
}
function randInt(min, max, rng) {
	return Math.floor(rng() * (max - min + 1)) + min;
}
function clamp$2(value, min, max) {
	return Math.min(Math.max(value, min), max);
}
function distance(a, b) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}
function createInventory(goods, rng) {
	return goods.map((goodsDef) => {
		const stock = randInt(goodsDef.stockMin, goodsDef.stockMax, rng);
		const currentPrice = clamp$2(goodsDef.basePrice + randInt(-goodsDef.priceVariance, goodsDef.priceVariance, rng), Math.max(1, goodsDef.basePrice - goodsDef.priceVariance), goodsDef.basePrice + goodsDef.priceVariance);
		const priceHistory = Array.from({ length: 6 }, (_, index) => {
			if (index === 5) return currentPrice;
			return clamp$2(currentPrice + randInt(-Math.floor(goodsDef.priceVariance * .5), Math.floor(goodsDef.priceVariance * .5), rng), Math.max(1, goodsDef.basePrice - goodsDef.priceVariance), goodsDef.basePrice + goodsDef.priceVariance);
		});
		return {
			goodsId: goodsDef.id,
			stock,
			basePrice: goodsDef.basePrice,
			currentPrice,
			priceHistory
		};
	});
}
function createStations(template, rng) {
	const margin = 140;
	const stations = [];
	const stationNames = shuffle(template.stationNames, rng).slice(0, template.meta.stationCount);
	for (let i = 0; i < template.meta.stationCount; i += 1) {
		let attempts = 0;
		let x = 0;
		let y = 0;
		do {
			x = randInt(margin, template.meta.mapWidth - margin, rng);
			y = randInt(margin, template.meta.mapHeight - margin, rng);
			attempts += 1;
		} while (attempts < 300 && stations.some((station) => distance(station, {
			x,
			y
		}) < template.meta.minStationDistance));
		stations.push({
			id: i + 1,
			name: stationNames[i],
			x,
			y,
			security: template.securityLevels[randInt(0, template.securityLevels.length - 1, rng)],
			faction: template.factions[randInt(0, template.factions.length - 1, rng)],
			independenceFactor: Number((1 + rng() * .75).toFixed(2)),
			inventory: createInventory(template.goods, rng)
		});
	}
	return stations;
}
function routeKey(from, to) {
	return from < to ? `${from}-${to}` : `${to}-${from}`;
}
function buildRoutes(stations, rng) {
	const routes = [];
	const added = /* @__PURE__ */ new Set();
	const degrees = /* @__PURE__ */ new Map();
	const stationIds = shuffle(stations.map((station) => station.id), rng);
	const stationMap = new Map(stations.map((station) => [station.id, station]));
	const connected = new Set([stationIds[0]]);
	const addRoute = (from, to) => {
		if (from === to) return false;
		const key = routeKey(from, to);
		if (added.has(key)) return false;
		const fromStation = stationMap.get(from);
		const toStation = stationMap.get(to);
		if (!fromStation || !toStation) return false;
		const rawDistance = distance(fromStation, toStation);
		const travelCost = clamp$2(Math.round(rawDistance / 180), 1, 6);
		routes.push({
			from,
			to,
			travelCost,
			status: "ACTIVE"
		});
		added.add(key);
		degrees.set(from, (degrees.get(from) ?? 0) + 1);
		degrees.set(to, (degrees.get(to) ?? 0) + 1);
		return true;
	};
	for (let i = 1; i < stationIds.length; i += 1) {
		const stationId = stationIds[i];
		const current = stationMap.get(stationId);
		const candidates = [...connected].map((candidateId) => stationMap.get(candidateId)).sort((a, b) => distance(current, a) - distance(current, b)).slice(0, 4);
		const target = candidates[randInt(0, candidates.length - 1, rng)];
		addRoute(stationId, target.id);
		connected.add(stationId);
	}
	const extraTargetCount = stations.length - 1 + randInt(5, 8, rng);
	const maxDegree = 4;
	const candidates = [];
	for (let i = 0; i < stations.length; i += 1) for (let j = i + 1; j < stations.length; j += 1) candidates.push({
		from: stations[i].id,
		to: stations[j].id,
		distance: distance(stations[i], stations[j])
	});
	const shuffledCandidates = shuffle(candidates, rng).sort((a, b) => a.distance - b.distance);
	for (const candidate of shuffledCandidates) {
		if (routes.length >= extraTargetCount) break;
		if ((degrees.get(candidate.from) ?? 0) >= maxDegree || (degrees.get(candidate.to) ?? 0) >= maxDegree) continue;
		const chance = candidate.distance < 260 ? .78 : candidate.distance < 360 ? .42 : .12;
		if (rng() < chance) addRoute(candidate.from, candidate.to);
	}
	return routes;
}
function generateSessionSeed() {
	return Math.floor(Date.now() % 2147483647);
}
function createGameSession(template, playerName, seed = generateSessionSeed()) {
	const rng = createRng(seed);
	const stations = createStations(template, rng);
	const routes = buildRoutes(stations, rng);
	const spawnStation = stations[randInt(0, stations.length - 1, rng)];
	return {
		meta: {
			sessionVersion: 5,
			sessionId: `${SESSION_ID_PREFIX}-${seed}`,
			seed,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			lastPersistedAt: (/* @__PURE__ */ new Date()).toISOString(),
			startYear: 2100,
			currentYear: 2100,
			endYear: 2200,
			mapWidth: template.meta.mapWidth,
			mapHeight: template.meta.mapHeight
		},
		goods: template.goods,
		stations,
		routes,
		player: {
			id: 1,
			name: playerName || "Pilot",
			credits: 1e4,
			currentStationId: spawnStation.id,
			cargo: [],
			cargoCapacity: 80,
			wantedLevel: 0,
			suspicion: 0,
			detainedYears: 0,
			status: "EXPLORING"
		},
		warehouses: Object.fromEntries(stations.map((station) => [station.id, []])),
		ui: {
			hoveredStationId: null,
			selectedTargetStationId: null,
			moveState: "idle",
			activeTravel: null,
			pendingAction: {
				type: null,
				stationId: null,
				targetStationId: null,
				yearsCost: void 0
			},
			tradeModal: {
				open: false,
				stationId: null,
				isLoading: false,
				selectedGoodsId: null,
				isSubmitting: false,
				errorMessage: null
			},
			ripple: {
				affectedStationIds: [],
				startedAt: null
			},
			encounter: {
				open: false,
				eventId: null,
				title: "",
				description: "",
				choices: [],
				selectedChoiceId: null,
				result: null,
				isResolving: false
			}
		},
		stats: {
			tradeCount: 0,
			eventCount: 0
		}
	};
}
//#endregion
//#region src/api/sessionApi.ts
var SESSION_VERSION = 5;
function normalizePriceHistory(item) {
	const normalizedHistory = [...Array.isArray(item.priceHistory) && item.priceHistory.length > 0 ? item.priceHistory.filter((value) => Number.isFinite(value)) : [item.currentPrice], item.currentPrice].slice(-8);
	return {
		...item,
		priceHistory: normalizedHistory
	};
}
function normalizeWarehouses(session) {
	const stationIds = session.stations?.map((station) => station.id) ?? [];
	const source = session.warehouses ?? {};
	return Object.fromEntries(stationIds.map((stationId) => {
		return [stationId, Array.isArray(source[stationId]) ? source[stationId].map((entry) => ({
			goodsId: entry.goodsId,
			quantity: entry.quantity,
			storedTurns: entry.storedTurns ?? 0
		})) : []];
	}));
}
function normalizeSession(raw) {
	const normalizedStations = raw.stations.map((station) => ({
		...station,
		inventory: station.inventory.map(normalizePriceHistory)
	}));
	return {
		...raw,
		meta: {
			...raw.meta,
			sessionVersion: raw.meta.sessionVersion ?? SESSION_VERSION,
			lastPersistedAt: raw.meta.lastPersistedAt ?? raw.meta.generatedAt,
			startYear: raw.meta.startYear ?? 2100,
			currentYear: raw.meta.currentYear ?? raw.meta.startYear ?? 2100,
			endYear: raw.meta.endYear ?? 2200
		},
		stations: normalizedStations,
		warehouses: normalizeWarehouses({
			...raw,
			stations: normalizedStations
		}),
		player: {
			...raw.player,
			detainedYears: raw.player.detainedYears ?? raw.player.detainedSeconds ?? 0
		},
		ui: {
			hoveredStationId: raw.ui?.hoveredStationId ?? null,
			selectedTargetStationId: raw.ui?.selectedTargetStationId ?? null,
			moveState: raw.ui?.moveState ?? "idle",
			activeTravel: raw.ui?.activeTravel ?? null,
			pendingAction: {
				type: raw.ui?.pendingAction?.type ?? null,
				stationId: raw.ui?.pendingAction?.stationId ?? null,
				targetStationId: raw.ui?.pendingAction?.targetStationId ?? null,
				yearsCost: raw.ui?.pendingAction?.yearsCost,
				baseYearsSettled: raw.ui?.pendingAction?.baseYearsSettled ?? true
			},
			tradeModal: {
				open: raw.ui?.tradeModal?.open ?? false,
				stationId: raw.ui?.tradeModal?.stationId ?? null,
				isLoading: raw.ui?.tradeModal?.isLoading ?? false,
				selectedGoodsId: raw.ui?.tradeModal?.selectedGoodsId ?? null,
				isSubmitting: raw.ui?.tradeModal?.isSubmitting ?? false,
				errorMessage: raw.ui?.tradeModal?.errorMessage ?? null
			},
			ripple: {
				affectedStationIds: raw.ui?.ripple?.affectedStationIds ?? [],
				startedAt: raw.ui?.ripple?.startedAt ?? null
			},
			encounter: {
				open: raw.ui?.encounter?.open ?? false,
				eventId: raw.ui?.encounter?.eventId ?? null,
				title: raw.ui?.encounter?.title ?? "",
				description: raw.ui?.encounter?.description ?? "",
				choices: raw.ui?.encounter?.choices ?? [],
				selectedChoiceId: raw.ui?.encounter?.selectedChoiceId ?? null,
				result: raw.ui?.encounter?.result ?? null,
				isResolving: raw.ui?.encounter?.isResolving ?? false
			}
		},
		stats: {
			tradeCount: raw.stats?.tradeCount ?? 0,
			eventCount: raw.stats?.eventCount ?? 0
		}
	};
}
//#endregion
//#region src/fx/worldEventBus.ts
var toastId = 0;
var listeners = [];
function pushWorldToast(message, type = "market_shock") {
	const event = {
		id: `wt-${++toastId}`,
		message,
		type,
		timestamp: Date.now()
	};
	listeners.forEach((fn) => fn(event));
}
//#endregion
//#region src/game/monopolyService.ts
function sumCargoForGoods(session, goodsId) {
	return session.player.cargo.filter((item) => item.goodsId === goodsId).reduce((sum, item) => sum + item.quantity, 0);
}
function sumWarehousesForGoods(session, goodsId) {
	return Object.values(session.warehouses).reduce((sum, entries) => {
		return sum + entries.filter((entry) => entry.goodsId === goodsId).reduce((acc, entry) => acc + entry.quantity, 0);
	}, 0);
}
function sumMarketForGoods(session, goodsId) {
	return session.stations.reduce((sum, station) => {
		return sum + (station.inventory.find((item) => item.goodsId === goodsId)?.stock ?? 0);
	}, 0);
}
function computeGalaxyMonopolyProgress(session) {
	return session.goods.map((goods) => {
		const playerHeld = sumCargoForGoods(session, goods.id) + sumWarehousesForGoods(session, goods.id);
		const marketTotal = sumMarketForGoods(session, goods.id);
		const denominator = playerHeld + marketTotal;
		const ratio = denominator > 0 ? playerHeld / denominator : 0;
		return {
			goodsId: goods.id,
			goodsName: goods.name,
			shortName: goods.shortName,
			ratio,
			playerHeld,
			marketTotal
		};
	});
}
function checkVictoryState(session) {
	const progress = computeGalaxyMonopolyProgress(session);
	const winner = progress.find((item) => item.ratio >= .8);
	return {
		won: Boolean(winner),
		winningGoods: winner ?? null,
		monopolyCount: progress.filter((item) => item.ratio >= .8).length,
		progress
	};
}
function evaluateGameState(session) {
	const nextSession = JSON.parse(JSON.stringify(session));
	if (checkVictoryState(nextSession).won) {
		nextSession.player.status = "WON";
		return nextSession;
	}
	if (nextSession.player.credits <= 0) {
		nextSession.player.status = "LOST";
		return nextSession;
	}
	if (nextSession.player.detainedYears > 18) {
		nextSession.player.status = "LOST";
		return nextSession;
	}
	if (nextSession.meta.currentYear >= nextSession.meta.endYear) {
		nextSession.player.status = "TIMEUP";
		return nextSession;
	}
	return nextSession;
}
//#endregion
//#region src/api/sessionWorldApi.ts
function cloneSession$4(session) {
	return JSON.parse(JSON.stringify(session));
}
function clamp$1(value, min, max) {
	return Math.min(Math.max(value, min), max);
}
function checkFailureState(session) {
	const nextSession = cloneSession$4(session);
	if (nextSession.player.credits <= 0) {
		nextSession.player.status = "LOST";
		return nextSession;
	}
	if (nextSession.player.detainedYears > 18) {
		nextSession.player.status = "LOST";
		return nextSession;
	}
	if (nextSession.meta.currentYear >= nextSession.meta.endYear) {
		nextSession.player.status = "TIMEUP";
		return nextSession;
	}
	return nextSession;
}
function advanceWorldState(session, payload) {
	const nextSession = cloneSession$4(session);
	nextSession.meta.currentYear += payload.yearsElapsed;
	Object.values(nextSession.warehouses).forEach((entries) => {
		entries.forEach((entry) => {
			entry.storedTurns += payload.yearsElapsed;
		});
	});
	nextSession.player.suspicion = clamp$1(nextSession.player.suspicion - payload.yearsElapsed * 5, 0, 999);
	if (nextSession.player.suspicion === 0 && nextSession.player.wantedLevel > 0) nextSession.player.wantedLevel = Math.max(0, nextSession.player.wantedLevel - 1);
	if (Math.random() < .15) pushWorldToast(payload.source === "move" ? "航道情报更新，巡逻强度发生变化" : "市场震荡扩散到周边站点", payload.source === "move" ? "route_opened" : "market_shock");
	return evaluateGameState(checkFailureState(nextSession));
}
//#endregion
//#region src/api/sessionTradeApi.ts
var PRICE_HISTORY_LIMIT = 8;
function cloneSession$3(session) {
	return JSON.parse(JSON.stringify(session));
}
function routeNeighbors(routes, stationId) {
	return routes.flatMap((route) => {
		if (route.from === stationId) return [route.to];
		if (route.to === stationId) return [route.from];
		return [];
	});
}
function findGoodsDefinition(session, goodsId) {
	return session.goods.find((goods) => goods.id === goodsId);
}
function findStation(session, stationId) {
	return session.stations.find((station) => station.id === stationId);
}
function appendPriceHistory(item, nextPrice) {
	item.currentPrice = nextPrice;
	item.priceHistory = [...item.priceHistory, nextPrice].slice(-PRICE_HISTORY_LIMIT);
}
function updateCargo(cargo, goods, quantity, unitPrice, tradeType) {
	const nextCargo = [...cargo];
	const cargoIndex = nextCargo.findIndex((item) => item.goodsId === goods.id);
	if (tradeType === "buy") {
		if (cargoIndex === -1) nextCargo.push({
			goodsId: goods.id,
			goodsName: goods.name,
			quantity,
			avgCost: unitPrice,
			isContraband: goods.isContraband
		});
		else {
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
	if (existing.quantity <= 0) nextCargo.splice(cargoIndex, 1);
	return nextCargo;
}
function computeRippleAffected(session, originStationId) {
	const visited = new Set([originStationId]);
	const queue = [{
		stationId: originStationId,
		hop: 0
	}];
	const result = [];
	while (queue.length > 0) {
		const current = queue.shift();
		if (current.hop >= 3) continue;
		const neighbors = routeNeighbors(session.routes, current.stationId);
		for (const neighbor of neighbors) {
			if (visited.has(neighbor)) continue;
			visited.add(neighbor);
			const hop = current.hop + 1;
			result.push({
				stationId: neighbor,
				hop
			});
			queue.push({
				stationId: neighbor,
				hop
			});
		}
	}
	return result;
}
async function executeTrade(session, payload) {
	const station = findStation(session, payload.stationId);
	if (!station || session.player.currentStationId !== payload.stationId) return {
		ok: false,
		code: "INVALID_STATION",
		message: "当前不在该站点，无法交易。"
	};
	const goods = findGoodsDefinition(session, payload.goodsId);
	const inventoryItem = station.inventory.find((item) => item.goodsId === payload.goodsId);
	if (!goods || !inventoryItem) return {
		ok: false,
		code: "INVALID_GOODS",
		message: "该商品不存在。"
	};
	const currentCargo = session.player.cargo.find((item) => item.goodsId === payload.goodsId);
	const cargoUsed = session.player.cargo.reduce((sum, item) => sum + item.quantity, 0);
	const unitPrice = inventoryItem.currentPrice;
	if (payload.tradeType === "buy") {
		if (inventoryItem.stock < payload.quantity) return {
			ok: false,
			code: "STOCK_NOT_ENOUGH",
			message: "本站库存不足。"
		};
		if (session.player.credits < unitPrice * payload.quantity) return {
			ok: false,
			code: "INSUFFICIENT_FUNDS",
			message: "资金不足。"
		};
		if (cargoUsed + payload.quantity > session.player.cargoCapacity) return {
			ok: false,
			code: "CARGO_FULL",
			message: "货舱已满。"
		};
	} else if (!currentCargo || currentCargo.quantity < payload.quantity) return {
		ok: false,
		code: "NO_CARGO",
		message: "没有足够货物可卖。"
	};
	const nextSession = cloneSession$3(session);
	const nextInventory = findStation(nextSession, payload.stationId).inventory.find((item) => item.goodsId === payload.goodsId);
	const nextGoods = findGoodsDefinition(nextSession, payload.goodsId);
	const yearsCost = 1;
	if (payload.tradeType === "buy") {
		nextInventory.stock -= payload.quantity;
		nextSession.player.credits -= unitPrice * payload.quantity;
	} else {
		nextInventory.stock += payload.quantity;
		nextSession.player.credits += unitPrice * payload.quantity;
	}
	nextSession.player.cargo = updateCargo(nextSession.player.cargo, nextGoods, payload.quantity, unitPrice, payload.tradeType);
	nextSession.stats.tradeCount += 1;
	const baseShift = Math.max(4, Math.round(payload.quantity * 1.4));
	appendPriceHistory(nextInventory, payload.tradeType === "buy" ? nextInventory.currentPrice + baseShift : Math.max(1, nextInventory.currentPrice - baseShift));
	const rippleAffected = computeRippleAffected(nextSession, payload.stationId);
	for (const affected of rippleAffected) {
		const affectedStation = findStation(nextSession, affected.stationId);
		const affectedInventory = affectedStation?.inventory.find((item) => item.goodsId === payload.goodsId);
		if (!affectedStation || !affectedInventory) continue;
		const delta = Math.max(1, Math.round(baseShift * (1 / affected.hop) * (1 / affectedStation.independenceFactor)));
		appendPriceHistory(affectedInventory, payload.tradeType === "buy" ? affectedInventory.currentPrice + delta : Math.max(1, affectedInventory.currentPrice - delta));
	}
	nextSession.ui.tradeModal.errorMessage = null;
	nextSession.ui.tradeModal.isSubmitting = false;
	nextSession.ui.ripple = {
		affectedStationIds: [payload.stationId, ...rippleAffected.map((item) => item.stationId)],
		startedAt: Date.now()
	};
	const advancedSession = advanceWorldState(checkFailureState(nextSession), {
		yearsElapsed: yearsCost,
		source: "trade"
	});
	return {
		ok: true,
		session: advancedSession,
		rippleAffectedStationIds: advancedSession.ui.ripple.affectedStationIds
	};
}
//#endregion
//#region src/api/sessionWarehouseApi.ts
var BASE_TAX_RATE = 12;
var TURN_FACTOR = .12;
function cloneSession$2(session) {
	return JSON.parse(JSON.stringify(session));
}
function findGoods(session, goodsId) {
	return session.goods.find((goods) => goods.id === goodsId);
}
function getWantedMultiplier(wantedLevel) {
	if (wantedLevel <= 0) return 1;
	if (wantedLevel === 1) return 1.35;
	if (wantedLevel === 2) return 1.9;
	return 2.6;
}
function getStoredYearMultiplier(storedYears) {
	return 1 + storedYears * TURN_FACTOR;
}
function findWarehouseEntry(entries, goodsId) {
	return entries.find((entry) => entry.goodsId === goodsId);
}
async function depositToWarehouse(session, payload) {
	if (session.player.currentStationId !== payload.stationId) return {
		ok: false,
		message: "必须到达当前站点才能存入仓库。"
	};
	const cargoItem = session.player.cargo.find((item) => item.goodsId === payload.goodsId);
	if (!cargoItem || cargoItem.quantity < payload.quantity) return {
		ok: false,
		message: "货舱中没有足够货物可存入。"
	};
	const nextSession = cloneSession$2(session);
	const nextCargoItem = nextSession.player.cargo.find((item) => item.goodsId === payload.goodsId);
	const warehouseEntries = nextSession.warehouses[payload.stationId] ?? [];
	const existingWarehouse = findWarehouseEntry(warehouseEntries, payload.goodsId);
	nextCargoItem.quantity -= payload.quantity;
	if (nextCargoItem.quantity <= 0) nextSession.player.cargo = nextSession.player.cargo.filter((item) => item.goodsId !== payload.goodsId);
	if (existingWarehouse) existingWarehouse.quantity += payload.quantity;
	else warehouseEntries.push({
		goodsId: payload.goodsId,
		quantity: payload.quantity,
		storedTurns: 0
	});
	nextSession.warehouses[payload.stationId] = warehouseEntries;
	return {
		ok: true,
		session: nextSession
	};
}
async function withdrawFromWarehouse(session, payload) {
	if (session.player.currentStationId !== payload.stationId) return {
		ok: false,
		message: "必须到达当前站点才能取出货物。"
	};
	const warehouseEntry = findWarehouseEntry(session.warehouses[payload.stationId] ?? [], payload.goodsId);
	if (!warehouseEntry || warehouseEntry.quantity < payload.quantity) return {
		ok: false,
		message: "当前站点仓库中没有足够货物。"
	};
	if (session.player.cargo.reduce((sum, item) => sum + item.quantity, 0) + payload.quantity > session.player.cargoCapacity) return {
		ok: false,
		message: "货舱剩余空间不足。"
	};
	const goods = findGoods(session, payload.goodsId);
	if (!goods) return {
		ok: false,
		message: "该商品不存在。"
	};
	const wantedMultiplier = getWantedMultiplier(session.player.wantedLevel);
	const taxRate = BASE_TAX_RATE * getStoredYearMultiplier(warehouseEntry.storedTurns) * wantedMultiplier;
	const taxPaid = Math.round(payload.quantity * taxRate);
	if (session.player.credits < taxPaid) return {
		ok: false,
		message: "资金不足，无法支付取货税费。"
	};
	const nextSession = cloneSession$2(session);
	const nextWarehouseEntries = nextSession.warehouses[payload.stationId] ?? [];
	const nextWarehouseEntry = findWarehouseEntry(nextWarehouseEntries, payload.goodsId);
	const cargoItem = nextSession.player.cargo.find((item) => item.goodsId === payload.goodsId);
	nextWarehouseEntry.quantity -= payload.quantity;
	if (nextWarehouseEntry.quantity <= 0) nextSession.warehouses[payload.stationId] = nextWarehouseEntries.filter((entry) => entry.goodsId !== payload.goodsId);
	nextSession.player.credits -= taxPaid;
	if (cargoItem) {
		const totalQuantity = cargoItem.quantity + payload.quantity;
		cargoItem.avgCost = Math.round((cargoItem.avgCost * cargoItem.quantity + goods.basePrice * payload.quantity) / totalQuantity);
		cargoItem.quantity = totalQuantity;
	} else nextSession.player.cargo.push({
		goodsId: goods.id,
		goodsName: goods.name,
		quantity: payload.quantity,
		avgCost: goods.basePrice,
		isContraband: goods.isContraband
	});
	return {
		ok: true,
		session: nextSession,
		taxPaid
	};
}
//#endregion
//#region src/api/sessionEncounterApi.ts
function cloneSession$1(session) {
	return JSON.parse(JSON.stringify(session));
}
function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}
function resolveEncounter(session, choiceId) {
	if (!session.ui.encounter.eventId) return {
		session,
		result: {
			success: false,
			message: "当前没有可结算的遭遇事件。"
		}
	};
	const nextSession = cloneSession$1(session);
	const choice = nextSession.ui.encounter.choices.find((item) => item.choiceId === choiceId);
	if (!choice) return {
		session,
		result: {
			success: false,
			message: "无效的事件选项。"
		}
	};
	nextSession.ui.encounter.selectedChoiceId = choiceId;
	nextSession.ui.encounter.isResolving = true;
	nextSession.player.credits += choice.effect.creditsDelta ?? 0;
	nextSession.meta.currentYear += Math.max(0, choice.effect.yearDelta ?? 0);
	nextSession.meta.endYear += Math.max(0, choice.effect.endYearDelta ?? 0);
	nextSession.player.wantedLevel = clamp(nextSession.player.wantedLevel + (choice.effect.wantedLevelDelta ?? 0), 0, 3);
	nextSession.player.suspicion = clamp(nextSession.player.suspicion + Math.max(0, (choice.effect.wantedLevelDelta ?? 0) * 15), 0, 999);
	nextSession.stats.eventCount += 1;
	let resultMessage = "事件处理完成。";
	if ((choice.effect.creditsDelta ?? 0) > 0) resultMessage = `你获得了 ${(choice.effect.creditsDelta ?? 0).toLocaleString()} CR。`;
	else if ((choice.effect.yearDelta ?? 0) > 0) resultMessage = `你额外消耗了 ${choice.effect.yearDelta} 世界年份。`;
	else if ((choice.effect.endYearDelta ?? 0) > 0) resultMessage = `终止年份延后了 ${choice.effect.endYearDelta} 年。`;
	else if ((choice.effect.creditsDelta ?? 0) < 0) resultMessage = `你损失了 ${Math.abs(choice.effect.creditsDelta ?? 0).toLocaleString()} CR。`;
	nextSession.ui.encounter.result = {
		success: true,
		message: resultMessage
	};
	return {
		session: checkFailureState(nextSession),
		result: nextSession.ui.encounter.result
	};
}
//#endregion
//#region src/testing/parityRunner.ts
function cloneSession(value) {
	return JSON.parse(JSON.stringify(value));
}
function projectRoot() {
	const currentFile = fileURLToPath(import.meta.url);
	return path.resolve(path.dirname(currentFile), "..");
}
function loadTemplate() {
	const templatePath = path.join(projectRoot(), "public", "data", "session-template.json");
	const raw = fs.readFileSync(templatePath, "utf-8");
	return JSON.parse(raw);
}
function patchRandom(sequence) {
	const originalRandom = Math.random;
	let index = 0;
	Math.random = () => {
		if (index >= sequence.length) return sequence[sequence.length - 1] ?? .99;
		const value = sequence[index];
		index += 1;
		return value;
	};
	return () => {
		Math.random = originalRandom;
	};
}
function stationGoodsId(session) {
	return session.stations[session.player.currentStationId - 1].inventory[0].goodsId;
}
function makeSession(template, playerName, seed) {
	return normalizeSession(createGameSession(template, playerName, seed));
}
async function runScenario(scenario) {
	const template = loadTemplate();
	if (scenario.action === "create_session") return makeSession(template, scenario.playerName, scenario.seed);
	if (scenario.action === "trade_buy") {
		const session = makeSession(template, scenario.playerName, scenario.seed);
		const goodsId = stationGoodsId(session);
		return executeTrade(session, {
			stationId: session.player.currentStationId,
			goodsId,
			quantity: scenario.quantity,
			tradeType: "buy"
		});
	}
	if (scenario.action === "trade_sell") {
		const session = makeSession(template, scenario.playerName, scenario.seed);
		const goodsId = stationGoodsId(session);
		const bought = await executeTrade(session, {
			stationId: session.player.currentStationId,
			goodsId,
			quantity: scenario.buyQuantity,
			tradeType: "buy"
		});
		if (!bought.ok) return bought;
		return executeTrade(bought.session, {
			stationId: bought.session.player.currentStationId,
			goodsId,
			quantity: scenario.sellQuantity,
			tradeType: "sell"
		});
	}
	if (scenario.action === "warehouse_roundtrip") {
		const session = makeSession(template, scenario.playerName, scenario.seed);
		const goodsId = stationGoodsId(session);
		const bought = await executeTrade(session, {
			stationId: session.player.currentStationId,
			goodsId,
			quantity: scenario.quantity,
			tradeType: "buy"
		});
		if (!bought.ok) return bought;
		const deposited = await depositToWarehouse(bought.session, {
			stationId: bought.session.player.currentStationId,
			goodsId,
			quantity: scenario.quantity
		});
		if (!deposited.ok) return deposited;
		return withdrawFromWarehouse(deposited.session, {
			stationId: deposited.session.player.currentStationId,
			goodsId,
			quantity: scenario.quantity
		});
	}
	if (scenario.action === "encounter_flow") {
		const session = makeSession(template, scenario.playerName, scenario.seed);
		const movedSession = cloneSession(session);
		movedSession.player.currentStationId = scenario.targetStationId;
		movedSession.player.status = "TRAVELING";
		movedSession.ui.activeTravel = null;
		movedSession.ui.hoveredStationId = null;
		movedSession.ui.selectedTargetStationId = null;
		movedSession.ui.moveState = "event_blocking";
		movedSession.ui.pendingAction = {
			type: "move",
			stationId: session.player.currentStationId,
			targetStationId: scenario.targetStationId,
			yearsCost: scenario.yearsCost,
			baseYearsSettled: false
		};
		const encounter = (await import("./assets/encounterPool-DnuX3NLB.js")).ENCOUNTER_POOL.find((item) => item.id === scenario.encounterId);
		if (!encounter) throw new Error(`Encounter not found: ${scenario.encounterId}`);
		movedSession.ui.encounter = {
			open: true,
			eventId: encounter.id,
			title: encounter.title,
			description: encounter.description,
			choices: cloneSession(encounter.choices),
			selectedChoiceId: null,
			result: null,
			isResolving: false
		};
		const resolved = resolveEncounter(movedSession, scenario.choiceId);
		const restoreRandom = patchRandom([.99]);
		try {
			const finalized = advanceWorldState(resolved.session, {
				yearsElapsed: scenario.yearsCost,
				source: "move"
			});
			finalized.ui.pendingAction = {
				...finalized.ui.pendingAction,
				baseYearsSettled: true
			};
			return {
				movedSession,
				resolved,
				finalized
			};
		} finally {
			restoreRandom();
		}
	}
	if (scenario.action === "advance_world") {
		const session = makeSession(template, scenario.playerName, scenario.seed);
		session.warehouses[session.player.currentStationId] = [{
			goodsId: 1,
			quantity: 2,
			storedTurns: 0
		}];
		const restoreRandom = patchRandom([.99]);
		try {
			return advanceWorldState(session, {
				yearsElapsed: scenario.yearsElapsed,
				source: "move"
			});
		} finally {
			restoreRandom();
		}
	}
	throw new Error(`Unsupported scenario: ${scenario.action}`);
}
var rawInput = fs.readFileSync(0, "utf-8");
var result = await runScenario(JSON.parse(rawInput));
process.stdout.write(JSON.stringify(result));
//#endregion
export {};

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeSession } from '../api/sessionApi';
import { createGameSession } from '../game/sessionGenerator';
import { executeTrade } from '../api/sessionTradeApi';
import { depositToWarehouse, withdrawFromWarehouse } from '../api/sessionWarehouseApi';
import { advanceWorldState } from '../api/sessionWorldApi';
import { resolveEncounter } from '../api/sessionEncounterApi';
import type { GameSessionData, SessionTemplate } from '../game/types';

type Scenario =
  | { action: 'create_session'; playerName: string; seed: number }
  | { action: 'trade_buy'; playerName: string; seed: number; quantity: number }
  | { action: 'trade_sell'; playerName: string; seed: number; buyQuantity: number; sellQuantity: number }
  | { action: 'warehouse_roundtrip'; playerName: string; seed: number; quantity: number }
  | {
      action: 'encounter_flow';
      playerName: string;
      seed: number;
      encounterId: string;
      choiceId: number;
      yearsCost: number;
      targetStationId: number;
    }
  | { action: 'advance_world'; playerName: string; seed: number; yearsElapsed: number };

function cloneSession<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function projectRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '..');
}

function loadTemplate(): SessionTemplate {
  const templatePath = path.join(projectRoot(), 'public', 'data', 'session-template.json');
  const raw = fs.readFileSync(templatePath, 'utf-8');
  return JSON.parse(raw) as SessionTemplate;
}

function patchRandom(sequence: number[]) {
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => {
    if (index >= sequence.length) {
      return sequence[sequence.length - 1] ?? 0.99;
    }
    const value = sequence[index];
    index += 1;
    return value;
  };
  return () => {
    Math.random = originalRandom;
  };
}

function stationGoodsId(session: GameSessionData) {
  return session.stations[session.player.currentStationId - 1].inventory[0].goodsId;
}

function makeSession(template: SessionTemplate, playerName: string, seed: number) {
  return normalizeSession(createGameSession(template, playerName, seed));
}

async function runScenario(scenario: Scenario) {
  const template = loadTemplate();

  if (scenario.action === 'create_session') {
    return makeSession(template, scenario.playerName, scenario.seed);
  }

  if (scenario.action === 'trade_buy') {
    const session = makeSession(template, scenario.playerName, scenario.seed);
    const goodsId = stationGoodsId(session);
    return executeTrade(session, {
      stationId: session.player.currentStationId,
      goodsId,
      quantity: scenario.quantity,
      tradeType: 'buy',
    });
  }

  if (scenario.action === 'trade_sell') {
    const session = makeSession(template, scenario.playerName, scenario.seed);
    const goodsId = stationGoodsId(session);
    const bought = await executeTrade(session, {
      stationId: session.player.currentStationId,
      goodsId,
      quantity: scenario.buyQuantity,
      tradeType: 'buy',
    });
    if (!bought.ok) return bought;
    return executeTrade(bought.session, {
      stationId: bought.session.player.currentStationId,
      goodsId,
      quantity: scenario.sellQuantity,
      tradeType: 'sell',
    });
  }

  if (scenario.action === 'warehouse_roundtrip') {
    const session = makeSession(template, scenario.playerName, scenario.seed);
    const goodsId = stationGoodsId(session);
    const bought = await executeTrade(session, {
      stationId: session.player.currentStationId,
      goodsId,
      quantity: scenario.quantity,
      tradeType: 'buy',
    });
    if (!bought.ok) return bought;
    const deposited = await depositToWarehouse(bought.session, {
      stationId: bought.session.player.currentStationId,
      goodsId,
      quantity: scenario.quantity,
    });
    if (!deposited.ok) return deposited;
    return withdrawFromWarehouse(deposited.session, {
      stationId: deposited.session.player.currentStationId,
      goodsId,
      quantity: scenario.quantity,
    });
  }

  if (scenario.action === 'encounter_flow') {
    const session = makeSession(template, scenario.playerName, scenario.seed);
    const movedSession = cloneSession(session);
    movedSession.player.currentStationId = scenario.targetStationId;
    movedSession.player.status = 'TRAVELING';
    movedSession.ui.activeTravel = null;
    movedSession.ui.hoveredStationId = null;
    movedSession.ui.selectedTargetStationId = null;
    movedSession.ui.moveState = 'event_blocking';
    movedSession.ui.pendingAction = {
      type: 'move',
      stationId: session.player.currentStationId,
      targetStationId: scenario.targetStationId,
      yearsCost: scenario.yearsCost,
      baseYearsSettled: false,
    };

    const encounterModule = await import('../game/encounterPool');
    const encounter = encounterModule.ENCOUNTER_POOL.find((item) => item.id === scenario.encounterId);
    if (!encounter) {
      throw new Error(`Encounter not found: ${scenario.encounterId}`);
    }
    movedSession.ui.encounter = {
      open: true,
      eventId: encounter.id,
      title: encounter.title,
      description: encounter.description,
      choices: cloneSession(encounter.choices),
      selectedChoiceId: null,
      result: null,
      isResolving: false,
    };

    const resolved = resolveEncounter(movedSession, scenario.choiceId);
    const restoreRandom = patchRandom([0.99]);
    try {
      const finalized = advanceWorldState(resolved.session, { yearsElapsed: scenario.yearsCost, source: 'move' });
      finalized.ui.pendingAction = {
        ...finalized.ui.pendingAction,
        baseYearsSettled: true,
      };
      return {
        movedSession,
        resolved,
        finalized,
      };
    } finally {
      restoreRandom();
    }
  }

  if (scenario.action === 'advance_world') {
    const session = makeSession(template, scenario.playerName, scenario.seed);
    session.warehouses[session.player.currentStationId] = [{ goodsId: 1, quantity: 2, storedTurns: 0 }];
    const restoreRandom = patchRandom([0.99]);
    try {
      return advanceWorldState(session, { yearsElapsed: scenario.yearsElapsed, source: 'move' });
    } finally {
      restoreRandom();
    }
  }

  throw new Error(`Unsupported scenario: ${(scenario as { action: string }).action}`);
}

const rawInput = fs.readFileSync(0, 'utf-8');
const scenario = JSON.parse(rawInput) as Scenario;
const result = await runScenario(scenario);
process.stdout.write(JSON.stringify(result));

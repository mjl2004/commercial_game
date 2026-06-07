import { ENCOUNTER_POOL } from '../game/encounterPool';
import type { EncounterEventData, GameSessionData, RouteData } from '../game/types';
import { checkFailureState } from './sessionWorldApi';

function cloneSession(session: GameSessionData): GameSessionData {
  return JSON.parse(JSON.stringify(session)) as GameSessionData;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function rollEncounter(_session: GameSessionData, _route: RouteData): EncounterEventData | null {
  if (Math.random() > 0.3) return null;
  const index = Math.floor(Math.random() * ENCOUNTER_POOL.length);
  return ENCOUNTER_POOL[index];
}

export function resolveEncounter(session: GameSessionData, choiceId: number) {
  if (!session.ui.encounter.eventId) {
    return {
      session,
      result: { success: false, message: '当前没有可结算的遭遇事件。' },
    };
  }

  const nextSession = cloneSession(session);
  const choice = nextSession.ui.encounter.choices.find((item) => item.choiceId === choiceId);
  if (!choice) {
    return {
      session,
      result: { success: false, message: '无效的事件选项。' },
    };
  }

  nextSession.ui.encounter.selectedChoiceId = choiceId;
  nextSession.ui.encounter.isResolving = true;
  nextSession.player.credits += choice.effect.creditsDelta ?? 0;
  nextSession.meta.currentYear += Math.max(0, choice.effect.yearDelta ?? 0);
  nextSession.meta.endYear += Math.max(0, choice.effect.endYearDelta ?? 0);
  nextSession.player.wantedLevel = clamp(
    nextSession.player.wantedLevel + (choice.effect.wantedLevelDelta ?? 0),
    0,
    3,
  );
  nextSession.player.suspicion = clamp(
    nextSession.player.suspicion + Math.max(0, (choice.effect.wantedLevelDelta ?? 0) * 15),
    0,
    999,
  );
  nextSession.stats.eventCount += 1;

  let resultMessage = '事件处理完成。';
  if ((choice.effect.creditsDelta ?? 0) > 0) {
    resultMessage = `你获得了 ${(choice.effect.creditsDelta ?? 0).toLocaleString()} CR。`;
  } else if ((choice.effect.yearDelta ?? 0) > 0) {
    resultMessage = `你额外消耗了 ${choice.effect.yearDelta} 世界年份。`;
  } else if ((choice.effect.endYearDelta ?? 0) > 0) {
    resultMessage = `终止年份延后了 ${choice.effect.endYearDelta} 年。`;
  } else if ((choice.effect.creditsDelta ?? 0) < 0) {
    resultMessage = `你损失了 ${Math.abs(choice.effect.creditsDelta ?? 0).toLocaleString()} CR。`;
  }

  nextSession.ui.encounter.result = {
    success: true,
    message: resultMessage,
  };

  return {
    session: checkFailureState(nextSession),
    result: nextSession.ui.encounter.result,
  };
}

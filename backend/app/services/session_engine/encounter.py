from typing import Any

from .types import RandomController
from .utils import clone_session, now_iso
from .world import advance_world_state, check_failure_state

ENCOUNTER_POOL = [
    {
        "id": "enc-merchant-cache",
        "title": "漂流商队残骸",
        "description": "你在航道边缘发现了一支失联商队的残骸，扫描显示还有一批可回收物资。",
        "choices": [
            {
                "choiceId": 1,
                "text": "回收残余货物",
                "consequenceHint": "收益：650 CR | 风险：通缉等级 +1",
                "effect": {"creditsDelta": 650, "wantedLevelDelta": 1},
            },
            {
                "choiceId": 2,
                "text": "记录坐标后离开",
                "consequenceHint": "收益：无 | 风险：无",
                "effect": {},
            },
        ],
    },
    {
        "id": "enc-patrol-check",
        "title": "临检巡逻队",
        "description": "一支联邦巡逻编队要求你减速并接受临检，你可以花钱加快通关，或配合完成检查。",
        "choices": [
            {
                "choiceId": 1,
                "text": "支付通行费用",
                "consequenceHint": "代价：300 CR | 风险：无",
                "effect": {"creditsDelta": -300},
            },
            {
                "choiceId": 2,
                "text": "接受完整检查",
                "consequenceHint": "收益：无 | 风险：额外消耗 1 世界年份",
                "effect": {"yearDelta": 1},
            },
        ],
    },
    {
        "id": "enc-smuggler-offer",
        "title": "走私者报价",
        "description": "一艘未注册飞船向你发来加密通讯，愿意出售一条灰色贸易情报，但会提高你的嫌疑。",
        "choices": [
            {
                "choiceId": 1,
                "text": "购买情报",
                "consequenceHint": "收益：终止年份 +1 | 风险：通缉等级 +1",
                "effect": {"endYearDelta": 1, "wantedLevelDelta": 1},
            },
            {
                "choiceId": 2,
                "text": "拒绝并断开信道",
                "consequenceHint": "收益：无 | 风险：无",
                "effect": {},
            },
        ],
    },
]


def route_for_move(session: dict[str, Any], station_id: int, target_station_id: int) -> dict[str, Any] | None:
    return next(
        (
            route
            for route in session["routes"]
            if (route["from"] == station_id and route["to"] == target_station_id)
            or (route["to"] == station_id and route["from"] == target_station_id)
        ),
        None,
    )


def roll_encounter(
    controller: RandomController | None,
    fallback_random: float,
    fallback_index: int,
) -> dict[str, Any] | None:
    encounter_roll = controller.encounter_roll if controller and controller.encounter_roll is not None else fallback_random
    if encounter_roll > 0.3:
        return None
    index = controller.encounter_index if controller and controller.encounter_index is not None else fallback_index
    return ENCOUNTER_POOL[index % len(ENCOUNTER_POOL)]


def start_move(
    session: dict[str, Any],
    payload: dict[str, Any],
    controller: RandomController | None,
    fallback_random: float,
    fallback_index: int,
) -> dict[str, Any]:
    route = route_for_move(session, payload["stationId"], payload["targetStationId"])
    if not route:
        return {"ok": False, "message": "No valid route between stations."}

    moved_session = clone_session(session)
    moved_session["player"]["currentStationId"] = payload["targetStationId"]
    moved_session["player"]["status"] = "TRAVELING"
    moved_session["ui"]["activeTravel"] = None
    moved_session["ui"]["hoveredStationId"] = None
    moved_session["ui"]["selectedTargetStationId"] = None
    moved_session["ui"]["moveState"] = "traveling"
    moved_session["ui"]["pendingAction"] = {
        "type": "move",
        "stationId": payload["stationId"],
        "targetStationId": payload["targetStationId"],
        "yearsCost": payload["yearsCost"],
        "baseYearsSettled": False,
    }

    encounter = roll_encounter(controller, fallback_random, fallback_index)
    moved_session["meta"]["lastPersistedAt"] = now_iso()
    return {
        "ok": True,
        "session": moved_session,
        "encounter": {
            "id": encounter["id"],
            "title": encounter["title"],
            "description": encounter["description"],
            "choices": encounter["choices"],
        }
        if encounter
        else None,
    }


def resolve_encounter_choice(session: dict[str, Any], choice_id: int, pending_action: dict[str, Any]) -> dict[str, Any]:
    if not session["ui"]["encounter"]["eventId"]:
        return {
            "ok": False,
            "result": {"success": False, "message": "当前没有可结算的遭遇事件。"},
            "session": session,
        }

    next_session = clone_session(session)
    next_session["ui"]["pendingAction"] = pending_action
    choice = next(
        (item for item in next_session["ui"]["encounter"]["choices"] if item["choiceId"] == choice_id),
        None,
    )
    if not choice:
        return {
            "ok": False,
            "result": {"success": False, "message": "无效的事件选项。"},
            "session": session,
        }

    effect = choice.get("effect", {})
    next_session["ui"]["encounter"]["selectedChoiceId"] = choice_id
    next_session["ui"]["encounter"]["isResolving"] = True
    next_session["player"]["credits"] += effect.get("creditsDelta", 0)
    next_session["meta"]["currentYear"] += max(0, effect.get("yearDelta", 0))
    next_session["meta"]["endYear"] += max(0, effect.get("endYearDelta", 0))
    next_session["player"]["wantedLevel"] = max(
        0,
        min(3, next_session["player"]["wantedLevel"] + effect.get("wantedLevelDelta", 0)),
    )
    next_session["player"]["suspicion"] = max(
        0,
        min(999, next_session["player"]["suspicion"] + max(0, effect.get("wantedLevelDelta", 0) * 15)),
    )
    next_session["player"]["detainedYears"] += max(0, effect.get("detainedYearsDelta", 0))
    next_session["stats"]["eventCount"] += 1

    result_message = "事件处理完成。"
    if effect.get("creditsDelta", 0) > 0:
        result_message = f"你获得了 {effect['creditsDelta']:,} CR。"
    elif effect.get("yearDelta", 0) > 0:
        result_message = f"你额外消耗了 {effect['yearDelta']} 世界年份。"
    elif effect.get("endYearDelta", 0) > 0:
        result_message = f"终止年份延后了 {effect['endYearDelta']} 年。"
    elif effect.get("creditsDelta", 0) < 0:
        result_message = f"你损失了 {abs(effect['creditsDelta']):,} CR。"

    next_session["ui"]["encounter"]["result"] = {"success": True, "message": result_message}
    next_session["meta"]["lastPersistedAt"] = now_iso()
    return {
        "ok": True,
        "session": check_failure_state(next_session),
        "result": next_session["ui"]["encounter"]["result"],
    }


def finalize_encounter_and_advance(session: dict[str, Any]) -> dict[str, Any]:
    years_elapsed = 0
    pending_action = session["ui"]["pendingAction"]
    if pending_action["type"] == "move" and not pending_action.get("baseYearsSettled", True):
        years_elapsed = pending_action.get("yearsCost") or 0

    advanced = advance_world_state(session, years_elapsed)
    advanced["ui"]["pendingAction"] = {
        **advanced["ui"]["pendingAction"],
        "baseYearsSettled": True,
    }
    advanced["meta"]["lastPersistedAt"] = now_iso()
    return advanced

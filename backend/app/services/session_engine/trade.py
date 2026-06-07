from typing import Any

from .shared import find_goods, find_station
from .utils import append_price_history, clone_session, now_iso
from .world import advance_world_state, check_failure_state, compute_ripple_affected


def update_cargo(
    cargo: list[dict[str, Any]],
    goods: dict[str, Any],
    quantity: int,
    unit_price: int,
    trade_type: str,
) -> list[dict[str, Any]]:
    next_cargo = clone_session({"items": cargo})["items"]
    cargo_index = next((i for i, item in enumerate(next_cargo) if item["goodsId"] == goods["id"]), -1)
    if trade_type == "buy":
        if cargo_index == -1:
            next_cargo.append(
                {
                    "goodsId": goods["id"],
                    "goodsName": goods["name"],
                    "quantity": quantity,
                    "avgCost": unit_price,
                    "isContraband": goods["isContraband"],
                }
            )
        else:
            existing = next_cargo[cargo_index]
            total_quantity = existing["quantity"] + quantity
            existing["avgCost"] = round(
                (existing["avgCost"] * existing["quantity"] + unit_price * quantity) / total_quantity
            )
            existing["quantity"] = total_quantity
        return next_cargo
    if cargo_index == -1:
        return next_cargo
    existing = next_cargo[cargo_index]
    existing["quantity"] -= quantity
    if existing["quantity"] <= 0:
        next_cargo.pop(cargo_index)
    return next_cargo


def execute_trade(session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    station = find_station(session, payload["stationId"])
    if not station or session["player"]["currentStationId"] != payload["stationId"]:
        return {"ok": False, "code": "INVALID_STATION", "message": "Current station does not match trade station."}

    goods = find_goods(session, payload["goodsId"])
    inventory_item = next((item for item in station["inventory"] if item["goodsId"] == payload["goodsId"]), None)
    if not goods or not inventory_item:
        return {"ok": False, "code": "INVALID_GOODS", "message": "Goods not found in station inventory."}

    current_cargo = next((item for item in session["player"]["cargo"] if item["goodsId"] == payload["goodsId"]), None)
    cargo_used = sum(item["quantity"] for item in session["player"]["cargo"])
    unit_price = inventory_item["currentPrice"]

    if payload["tradeType"] == "buy":
        if inventory_item["stock"] < payload["quantity"]:
            return {"ok": False, "code": "STOCK_NOT_ENOUGH", "message": "Station stock is not enough."}
        if session["player"]["credits"] < unit_price * payload["quantity"]:
            return {"ok": False, "code": "INSUFFICIENT_FUNDS", "message": "Insufficient credits."}
        if cargo_used + payload["quantity"] > session["player"]["cargoCapacity"]:
            return {"ok": False, "code": "CARGO_FULL", "message": "Cargo hold is full."}
    elif not current_cargo or current_cargo["quantity"] < payload["quantity"]:
        return {"ok": False, "code": "NO_CARGO", "message": "Not enough cargo to sell."}

    next_session = clone_session(session)
    next_station = find_station(next_session, payload["stationId"])
    next_inventory = next(item for item in next_station["inventory"] if item["goodsId"] == payload["goodsId"])
    next_goods = find_goods(next_session, payload["goodsId"])

    if payload["tradeType"] == "buy":
        next_inventory["stock"] -= payload["quantity"]
        next_session["player"]["credits"] -= unit_price * payload["quantity"]
    else:
        next_inventory["stock"] += payload["quantity"]
        next_session["player"]["credits"] += unit_price * payload["quantity"]

    next_session["player"]["cargo"] = update_cargo(
        next_session["player"]["cargo"], next_goods, payload["quantity"], unit_price, payload["tradeType"]
    )
    next_session["stats"]["tradeCount"] += 1

    base_shift = max(4, round(payload["quantity"] * 1.4))
    next_price = (
        next_inventory["currentPrice"] + base_shift
        if payload["tradeType"] == "buy"
        else max(1, next_inventory["currentPrice"] - base_shift)
    )
    append_price_history(next_inventory, next_price)

    ripple_affected = compute_ripple_affected(next_session, payload["stationId"])
    for affected in ripple_affected:
        affected_station = find_station(next_session, affected["stationId"])
        if not affected_station:
            continue
        affected_inventory = next(
            (item for item in affected_station["inventory"] if item["goodsId"] == payload["goodsId"]),
            None,
        )
        if not affected_inventory:
            continue
        delta = max(
            1,
            round((base_shift * (1 / affected["hop"])) * (1 / affected_station["independenceFactor"])),
        )
        ripple_price = (
            affected_inventory["currentPrice"] + delta
            if payload["tradeType"] == "buy"
            else max(1, affected_inventory["currentPrice"] - delta)
        )
        append_price_history(affected_inventory, ripple_price)

    next_session["ui"]["tradeModal"]["errorMessage"] = None
    next_session["ui"]["tradeModal"]["isSubmitting"] = False
    next_session["ui"]["ripple"] = {
        "affectedStationIds": [payload["stationId"], *[item["stationId"] for item in ripple_affected]],
        "startedAt": int(next_session.get("_time_ms", 0) or 0),
    }
    if next_session["ui"]["ripple"]["startedAt"] == 0:
        from datetime import datetime, timezone

        next_session["ui"]["ripple"]["startedAt"] = int(datetime.now(timezone.utc).timestamp() * 1000)
    next_session["meta"]["lastPersistedAt"] = now_iso()
    advanced = advance_world_state(check_failure_state(next_session), years_elapsed=1)
    return {"ok": True, "session": advanced, "rippleAffectedStationIds": advanced["ui"]["ripple"]["affectedStationIds"]}

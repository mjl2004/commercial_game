from .shared import calculate_withdraw_tax, find_goods
from .utils import clone_session, now_iso


def deposit_to_warehouse(session: dict, payload: dict) -> dict:
    if session["player"]["currentStationId"] != payload["stationId"]:
        return {"ok": False, "message": "You must be at the current station to deposit goods."}

    cargo_item = next((item for item in session["player"]["cargo"] if item["goodsId"] == payload["goodsId"]), None)
    if not cargo_item or cargo_item["quantity"] < payload["quantity"]:
        return {"ok": False, "message": "Not enough cargo to deposit."}

    next_session = clone_session(session)
    next_cargo_item = next(item for item in next_session["player"]["cargo"] if item["goodsId"] == payload["goodsId"])
    warehouse_entries = next_session["warehouses"].setdefault(str(payload["stationId"]), [])
    existing = next((entry for entry in warehouse_entries if entry["goodsId"] == payload["goodsId"]), None)

    next_cargo_item["quantity"] -= payload["quantity"]
    if next_cargo_item["quantity"] <= 0:
        next_session["player"]["cargo"] = [
            item for item in next_session["player"]["cargo"] if item["goodsId"] != payload["goodsId"]
        ]

    if existing:
        existing["quantity"] += payload["quantity"]
    else:
        warehouse_entries.append({"goodsId": payload["goodsId"], "quantity": payload["quantity"], "storedTurns": 0})

    next_session["meta"]["lastPersistedAt"] = now_iso()
    return {"ok": True, "session": next_session}


def withdraw_from_warehouse(session: dict, payload: dict) -> dict:
    if session["player"]["currentStationId"] != payload["stationId"]:
        return {"ok": False, "message": "You must be at the current station to withdraw goods."}

    warehouse_entries = session["warehouses"].get(str(payload["stationId"]), [])
    warehouse_entry = next((entry for entry in warehouse_entries if entry["goodsId"] == payload["goodsId"]), None)
    if not warehouse_entry or warehouse_entry["quantity"] < payload["quantity"]:
        return {"ok": False, "message": "Not enough stored goods in this station warehouse."}

    cargo_used = sum(item["quantity"] for item in session["player"]["cargo"])
    if cargo_used + payload["quantity"] > session["player"]["cargoCapacity"]:
        return {"ok": False, "message": "Not enough cargo capacity."}

    goods = find_goods(session, payload["goodsId"])
    if not goods:
        return {"ok": False, "message": "Goods not found."}

    tax_paid = calculate_withdraw_tax(payload["quantity"], session["player"]["wantedLevel"], warehouse_entry["storedTurns"])
    if session["player"]["credits"] < tax_paid:
        return {"ok": False, "message": "Insufficient credits to pay warehouse tax."}

    next_session = clone_session(session)
    next_entries = next_session["warehouses"].get(str(payload["stationId"]), [])
    next_entry = next((entry for entry in next_entries if entry["goodsId"] == payload["goodsId"]), None)
    cargo_item = next((item for item in next_session["player"]["cargo"] if item["goodsId"] == payload["goodsId"]), None)

    next_entry["quantity"] -= payload["quantity"]
    if next_entry["quantity"] <= 0:
        next_session["warehouses"][str(payload["stationId"])] = [
            entry for entry in next_entries if entry["goodsId"] != payload["goodsId"]
        ]

    next_session["player"]["credits"] -= tax_paid
    if cargo_item:
        total_quantity = cargo_item["quantity"] + payload["quantity"]
        cargo_item["avgCost"] = round(
            (cargo_item["avgCost"] * cargo_item["quantity"] + goods["basePrice"] * payload["quantity"]) / total_quantity
        )
        cargo_item["quantity"] = total_quantity
    else:
        next_session["player"]["cargo"].append(
            {
                "goodsId": goods["id"],
                "goodsName": goods["name"],
                "quantity": payload["quantity"],
                "avgCost": goods["basePrice"],
                "isContraband": goods["isContraband"],
            }
        )

    next_session["meta"]["lastPersistedAt"] = now_iso()
    return {"ok": True, "session": next_session, "taxPaid": tax_paid}

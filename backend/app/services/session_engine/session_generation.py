from typing import Any, Callable

from .constants import SESSION_VERSION
from .utils import clamp, create_rng, distance, now_iso, rand_int, shuffle


def create_inventory(goods: list[dict[str, Any]], rng: Callable[[], float]) -> list[dict[str, Any]]:
    inventory: list[dict[str, Any]] = []
    for goods_def in goods:
        stock = rand_int(goods_def["stockMin"], goods_def["stockMax"], rng)
        current_price = int(
            clamp(
                goods_def["basePrice"] + rand_int(-goods_def["priceVariance"], goods_def["priceVariance"], rng),
                max(1, goods_def["basePrice"] - goods_def["priceVariance"]),
                goods_def["basePrice"] + goods_def["priceVariance"],
            )
        )
        history: list[int] = []
        for index in range(6):
            if index == 5:
                history.append(current_price)
                continue
            history.append(
                int(
                    clamp(
                        current_price
                        + rand_int(
                            -int(goods_def["priceVariance"] * 0.5),
                            int(goods_def["priceVariance"] * 0.5),
                            rng,
                        ),
                        max(1, goods_def["basePrice"] - goods_def["priceVariance"]),
                        goods_def["basePrice"] + goods_def["priceVariance"],
                        )
                )
            )
        history = [*history, current_price][-8:]
        inventory.append(
            {
                "goodsId": goods_def["id"],
                "stock": stock,
                "basePrice": goods_def["basePrice"],
                "currentPrice": current_price,
                "priceHistory": history,
            }
        )
    return inventory


def create_stations(template: dict[str, Any], rng: Callable[[], float]) -> list[dict[str, Any]]:
    margin = 140
    stations: list[dict[str, Any]] = []
    station_names = shuffle(template["stationNames"], rng)[: template["meta"]["stationCount"]]

    for index in range(template["meta"]["stationCount"]):
        attempts = 0
        x = 0
        y = 0
        while True:
            x = rand_int(margin, template["meta"]["mapWidth"] - margin, rng)
            y = rand_int(margin, template["meta"]["mapHeight"] - margin, rng)
            attempts += 1
            if attempts >= 300 or all(
                distance(station, {"x": x, "y": y}) >= template["meta"]["minStationDistance"]
                for station in stations
            ):
                break

        stations.append(
            {
                "id": index + 1,
                "name": station_names[index],
                "x": x,
                "y": y,
                "security": template["securityLevels"][rand_int(0, len(template["securityLevels"]) - 1, rng)],
                "faction": template["factions"][rand_int(0, len(template["factions"]) - 1, rng)],
                "independenceFactor": round(1 + rng() * 0.75, 2),
                "inventory": create_inventory(template["goods"], rng),
            }
        )
    return stations


def route_key(from_station: int, to_station: int) -> str:
    return f"{min(from_station, to_station)}-{max(from_station, to_station)}"


def build_routes(stations: list[dict[str, Any]], rng: Callable[[], float]) -> list[dict[str, Any]]:
    routes: list[dict[str, Any]] = []
    added = set()
    degrees: dict[int, int] = {}
    station_ids = shuffle([station["id"] for station in stations], rng)
    station_map = {station["id"]: station for station in stations}
    connected = {station_ids[0]}

    def add_route(from_station: int, to_station: int) -> bool:
        if from_station == to_station:
            return False
        key = route_key(from_station, to_station)
        if key in added:
            return False

        from_data = station_map.get(from_station)
        to_data = station_map.get(to_station)
        if not from_data or not to_data:
            return False

        raw_distance = distance(from_data, to_data)
        travel_cost = int(clamp(round(raw_distance / 180), 1, 6))
        routes.append({"from": from_station, "to": to_station, "travelCost": travel_cost, "status": "ACTIVE"})
        added.add(key)
        degrees[from_station] = degrees.get(from_station, 0) + 1
        degrees[to_station] = degrees.get(to_station, 0) + 1
        return True

    for index in range(1, len(station_ids)):
        station_id = station_ids[index]
        current = station_map[station_id]
        candidates = sorted(
            [station_map[candidate_id] for candidate_id in connected],
            key=lambda item: distance(current, item),
        )[:4]
        target = candidates[rand_int(0, len(candidates) - 1, rng)]
        add_route(station_id, target["id"])
        connected.add(station_id)

    extra_target_count = len(stations) - 1 + rand_int(5, 8, rng)
    max_degree = 4
    candidates: list[dict[str, Any]] = []
    for left in range(len(stations)):
        for right in range(left + 1, len(stations)):
            candidates.append(
                {
                    "from": stations[left]["id"],
                    "to": stations[right]["id"],
                    "distance": distance(stations[left], stations[right]),
                }
            )

    shuffled_candidates = sorted(shuffle(candidates, rng), key=lambda item: item["distance"])
    for candidate in shuffled_candidates:
        if len(routes) >= extra_target_count:
            break
        if degrees.get(candidate["from"], 0) >= max_degree or degrees.get(candidate["to"], 0) >= max_degree:
            continue
        chance = 0.78 if candidate["distance"] < 260 else 0.42 if candidate["distance"] < 360 else 0.12
        if rng() < chance:
            add_route(candidate["from"], candidate["to"])

    return routes


def create_session(template: dict[str, Any], player_name: str, seed: int) -> dict[str, Any]:
    rng = create_rng(seed)
    stations = create_stations(template, rng)
    routes = build_routes(stations, rng)
    spawn_station = stations[rand_int(0, len(stations) - 1, rng)]
    now = now_iso()
    return {
        "meta": {
            "sessionVersion": SESSION_VERSION,
            "sessionId": f"session-{seed}",
            "seed": seed,
            "generatedAt": now,
            "lastPersistedAt": now,
            "startYear": 2100,
            "currentYear": 2100,
            "endYear": 2200,
            "mapWidth": template["meta"]["mapWidth"],
            "mapHeight": template["meta"]["mapHeight"],
        },
        "goods": template["goods"],
        "stations": stations,
        "routes": routes,
        "player": {
            "id": 1,
            "name": player_name or "Pilot",
            "credits": 10000,
            "currentStationId": spawn_station["id"],
            "cargo": [],
            "cargoCapacity": 80,
            "wantedLevel": 0,
            "suspicion": 0,
            "detainedYears": 0,
            "status": "EXPLORING",
        },
        "warehouses": {str(station["id"]): [] for station in stations},
        "ui": {
            "hoveredStationId": None,
            "selectedTargetStationId": None,
            "moveState": "idle",
            "activeTravel": None,
            "pendingAction": {
                "type": None,
                "stationId": None,
                "targetStationId": None,
                "yearsCost": None,
                "baseYearsSettled": True,
            },
            "tradeModal": {
                "open": False,
                "stationId": None,
                "isLoading": False,
                "selectedGoodsId": None,
                "isSubmitting": False,
                "errorMessage": None,
            },
            "ripple": {
                "affectedStationIds": [],
                "startedAt": None,
            },
            "encounter": {
                "open": False,
                "eventId": None,
                "title": "",
                "description": "",
                "choices": [],
                "selectedChoiceId": None,
                "result": None,
                "isResolving": False,
            },
        },
        "stats": {
            "tradeCount": 0,
            "eventCount": 0,
        },
    }

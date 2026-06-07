from typing import Any

from .constants import BASE_TAX_RATE, TURN_FACTOR


def find_station(session: dict[str, Any], station_id: int) -> dict[str, Any] | None:
    return next((station for station in session["stations"] if station["id"] == station_id), None)


def find_goods(session: dict[str, Any], goods_id: int) -> dict[str, Any] | None:
    return next((goods for goods in session["goods"] if goods["id"] == goods_id), None)


def route_neighbors(routes: list[dict[str, Any]], station_id: int) -> list[int]:
    neighbors: list[int] = []
    for route in routes:
        if route["from"] == station_id:
            neighbors.append(route["to"])
        elif route["to"] == station_id:
            neighbors.append(route["from"])
    return neighbors


def get_wanted_multiplier(wanted_level: int) -> float:
    if wanted_level <= 0:
        return 1
    if wanted_level == 1:
        return 1.35
    if wanted_level == 2:
        return 1.9
    return 2.6


def get_stored_year_multiplier(stored_years: int) -> float:
    return 1 + stored_years * TURN_FACTOR


def calculate_withdraw_tax(quantity: int, wanted_level: int, stored_turns: int) -> int:
    tax_rate = BASE_TAX_RATE * get_stored_year_multiplier(stored_turns) * get_wanted_multiplier(wanted_level)
    return round(quantity * tax_rate)

from typing import Any

from .shared import route_neighbors
from .utils import clone_session


def check_failure_state(session: dict[str, Any]) -> dict[str, Any]:
    next_session = clone_session(session)
    if next_session["player"]["credits"] <= 0:
        next_session["player"]["status"] = "LOST"
        return next_session
    if next_session["player"]["detainedYears"] > 18:
        next_session["player"]["status"] = "LOST"
        return next_session
    if next_session["meta"]["currentYear"] >= next_session["meta"]["endYear"]:
        next_session["player"]["status"] = "TIMEUP"
        return next_session
    return next_session


def advance_world_state(session: dict[str, Any], years_elapsed: int) -> dict[str, Any]:
    next_session = clone_session(session)
    next_session["meta"]["currentYear"] += years_elapsed
    for entries in next_session["warehouses"].values():
        for entry in entries:
            entry["storedTurns"] += years_elapsed
    next_session["player"]["suspicion"] = max(0, next_session["player"]["suspicion"] - years_elapsed * 5)
    if next_session["player"]["suspicion"] == 0 and next_session["player"]["wantedLevel"] > 0:
        next_session["player"]["wantedLevel"] = max(0, next_session["player"]["wantedLevel"] - 1)
    return check_failure_state(next_session)


def compute_ripple_affected(session: dict[str, Any], origin_station_id: int) -> list[dict[str, int]]:
    visited = {origin_station_id}
    queue = [{"stationId": origin_station_id, "hop": 0}]
    result: list[dict[str, int]] = []
    while queue:
        current = queue.pop(0)
        if current["hop"] >= 3:
            continue
        for neighbor in route_neighbors(session["routes"], current["stationId"]):
            if neighbor in visited:
                continue
            visited.add(neighbor)
            hop = current["hop"] + 1
            result.append({"stationId": neighbor, "hop": hop})
            queue.append({"stationId": neighbor, "hop": hop})
    return result

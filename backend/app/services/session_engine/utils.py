import copy
import math
from datetime import datetime, timezone
from typing import Any, Callable

from .constants import PRICE_HISTORY_LIMIT


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def create_rng(seed: int) -> Callable[[], float]:
    value = seed & 0xFFFFFFFF

    def next_float() -> float:
        nonlocal value
        value = (value * 1664525 + 1013904223) & 0xFFFFFFFF
        return value / 4294967296

    return next_float


def rand_int(minimum: int, maximum: int, rng: Callable[[], float]) -> int:
    return math.floor(rng() * (maximum - minimum + 1)) + minimum


def shuffle(items: list[Any], rng: Callable[[], float]) -> list[Any]:
    result = list(items)
    for index in range(len(result) - 1, 0, -1):
        swap_index = math.floor(rng() * (index + 1))
        result[index], result[swap_index] = result[swap_index], result[index]
    return result


def distance(a: dict[str, Any], b: dict[str, Any]) -> float:
    dx = a["x"] - b["x"]
    dy = a["y"] - b["y"]
    return math.sqrt(dx * dx + dy * dy)


def clone_session(session: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(session)


def append_price_history(item: dict[str, Any], next_price: int) -> None:
    item["currentPrice"] = next_price
    item["priceHistory"] = [*item["priceHistory"], next_price][-PRICE_HISTORY_LIMIT:]

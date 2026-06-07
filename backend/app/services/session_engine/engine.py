import random
from typing import Any

from .encounter import finalize_encounter_and_advance, resolve_encounter_choice, start_move
from .session_generation import create_session
from .trade import execute_trade
from .types import RandomController
from .warehouse import deposit_to_warehouse, withdraw_from_warehouse
from .world import advance_world_state, check_failure_state


class SessionEngine:
    @staticmethod
    def now_iso() -> str:
        from .utils import now_iso

        return now_iso()

    @staticmethod
    def create_session(template: dict[str, Any], player_name: str, seed: int) -> dict[str, Any]:
        return create_session(template, player_name, seed)

    @staticmethod
    def execute_trade(session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        return execute_trade(session, payload)

    @staticmethod
    def deposit_to_warehouse(session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        return deposit_to_warehouse(session, payload)

    @staticmethod
    def withdraw_from_warehouse(session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        return withdraw_from_warehouse(session, payload)

    @staticmethod
    def start_move(session: dict[str, Any], payload: dict[str, Any], controller: RandomController | None = None) -> dict[str, Any]:
        return start_move(
            session,
            payload,
            controller,
            fallback_random=random.random(),
            fallback_index=random.randrange(3),
        )

    @staticmethod
    def resolve_encounter_choice(session: dict[str, Any], choice_id: int, pending_action: dict[str, Any]) -> dict[str, Any]:
        return resolve_encounter_choice(session, choice_id, pending_action)

    @staticmethod
    def finalize_encounter_and_advance(session: dict[str, Any]) -> dict[str, Any]:
        return finalize_encounter_and_advance(session)

    @staticmethod
    def advance_world_state(session: dict[str, Any], years_elapsed: int) -> dict[str, Any]:
        return advance_world_state(session, years_elapsed)

    @staticmethod
    def check_failure_state(session: dict[str, Any]) -> dict[str, Any]:
        return check_failure_state(session)

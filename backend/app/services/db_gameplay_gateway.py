import json
import random
from typing import Any

from app.services.action_executor import ActionExecutionContext, ExecutionMode
from app.services.session_engine import SessionEngine
from app.services.session_engine.types import RandomController


class DBGameplayGateway:
    DATABASE_NATIVE_ACTIONS = {
        "start_session",
        "execute_trade",
        "deposit_warehouse",
        "withdraw_warehouse",
        "advance_world",
        "start_move",
        "resolve_encounter",
        "finalize_encounter",
    }
    DATABASE_FUNCTION_OVERRIDES = {
        "advance_world": "advance_world_v2",
        "resolve_encounter": "resolve_encounter_v2",
        "finalize_encounter": "finalize_encounter_v2",
    }

    @staticmethod
    def _run_reference_action(action_name: str, session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        if action_name == "execute_trade":
            return SessionEngine.execute_trade(session, payload)
        if action_name == "deposit_warehouse":
            return SessionEngine.deposit_to_warehouse(session, payload)
        if action_name == "withdraw_warehouse":
            return SessionEngine.withdraw_from_warehouse(session, payload)
        if action_name == "start_move":
            return SessionEngine.start_move(
                session,
                {
                    "stationId": payload["stationId"],
                    "targetStationId": payload["targetStationId"],
                    "yearsCost": payload["yearsCost"],
                },
                RandomController(
                    seed=session["meta"]["seed"],
                    encounter_roll=payload.get("encounterRoll"),
                    encounter_index=payload.get("encounterIndex"),
                ),
            )
        if action_name == "resolve_encounter":
            return SessionEngine.resolve_encounter_choice(session, payload["choiceId"], payload["pendingAction"])
        if action_name == "finalize_encounter":
            return {"ok": True, "session": SessionEngine.finalize_encounter_and_advance(session)}
        if action_name == "advance_world":
            return {"ok": True, "session": SessionEngine.advance_world_state(session, payload["yearsElapsed"])}
        raise RuntimeError(f"Unsupported reference action: {action_name}")

    @staticmethod
    def _build_context(action_name: str, session: dict[str, Any], payload: dict[str, Any], execution_mode: ExecutionMode) -> ActionExecutionContext:
        random_control = {
            key: value
            for key, value in {
                "seed": session.get("meta", {}).get("seed"),
                "encounterRoll": payload.get("encounterRoll"),
                "encounterIndex": payload.get("encounterIndex"),
            }.items()
            if value is not None
        }
        return ActionExecutionContext(
            session_id=session.get("meta", {}).get("sessionId", ""),
            action=action_name,
            payload=payload,
            random_control=random_control,
            input_session_version=session.get("meta", {}).get("sessionVersion"),
            executor_used=None if execution_mode == "auto" else execution_mode,
        )

    @staticmethod
    async def execute(
        action_name: str,
        session: dict[str, Any],
        payload: dict[str, Any] | None = None,
        random_control: dict[str, Any] | None = None,
        execution_mode: ExecutionMode = "auto",
    ) -> dict[str, Any]:
        payload_json = payload or {}
        context = DBGameplayGateway._build_context(action_name, session, payload_json, execution_mode)
        if random_control:
            context.random_control.update(random_control)
            payload_json.update(random_control)

        if action_name == "start_move":
            if "encounterRoll" not in payload_json:
                payload_json["encounterRoll"] = random.random()
            if "encounterIndex" not in payload_json:
                payload_json["encounterIndex"] = random.randrange(3)
            context.random_control["encounterRoll"] = payload_json["encounterRoll"]
            context.random_control["encounterIndex"] = payload_json["encounterIndex"]

        effective_mode: ExecutionMode = execution_mode
        if execution_mode == "auto":
            effective_mode = "database_native" if action_name in DBGameplayGateway.DATABASE_NATIVE_ACTIONS else "reference_python"
        context.executor_used = effective_mode

        if effective_mode == "database_native":
            result = await DBGameplayGateway._run_database_action(action_name, session, payload_json)
        else:
            result = DBGameplayGateway._run_reference_action(action_name, session, payload_json)
        result["actionContext"] = {
            "sessionId": context.session_id,
            "action": context.action,
            "payload": context.payload,
            "randomControl": context.random_control,
            "inputSessionVersion": context.input_session_version,
            "executorUsed": context.executor_used,
        }
        return result

    @staticmethod
    async def call_action(action_name: str, session: dict[str, Any], payload: dict[str, Any] | None = None) -> dict[str, Any]:
        return await DBGameplayGateway.execute(action_name, session, payload, execution_mode="auto")

    @staticmethod
    async def _run_database_action(action_name: str, session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        if action_name == "start_session":
            raise RuntimeError("start_session should use DBGameplayGateway.start_session directly")

        from app.db.connection import get_connection

        function_name = DBGameplayGateway.DATABASE_FUNCTION_OVERRIDES.get(action_name, action_name)

        def as_sql_text(value: str, tag: str) -> str:
            current_tag = tag
            while f"${current_tag}$" in value:
                current_tag = f"{current_tag}_x"
            return f"${current_tag}${value}${current_tag}$"

        session_text = json.dumps(session, ensure_ascii=False)
        payload_text = json.dumps(payload, ensure_ascii=False)
        async with get_connection() as conn:
            await conn.reload_schema_state()
            if action_name == "finalize_encounter":
                query = f"SELECT game_logic.{function_name}({as_sql_text(session_text, 'session')}::text)::text AS result"
            else:
                query = (
                    f"SELECT game_logic.{function_name}("
                    f"{as_sql_text(session_text, 'session')}::text, "
                    f"{as_sql_text(payload_text, 'payload')}::text"
                    f")::text AS result"
                )
            result_text = await conn.fetchval(query)
        if result_text is None:
            raise RuntimeError(f"Database {action_name} returned no result")
        if isinstance(result_text, str):
            return json.loads(result_text)
        return result_text

    @staticmethod
    async def start_session(initial_session: dict[str, Any]) -> dict[str, Any]:
        from app.db.connection import get_connection

        async with get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT game_logic.start_session($1::text) AS result",
                json.dumps(initial_session, ensure_ascii=False),
            )
        if not row or row["result"] is None:
            raise RuntimeError("Database start_session returned no result")
        result = row["result"]
        if isinstance(result, str):
            return json.loads(result)
        return result

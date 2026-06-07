from fastapi import HTTPException

from app.services.db_gameplay_gateway import DBGameplayGateway
from app.services.session_store import SessionStore


class GameplayService:
    @staticmethod
    async def _run_session_action(session_id: str, action_name: str, payload: dict) -> dict:
        session = await SessionStore.load(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        result = await DBGameplayGateway.execute(action_name, session, payload, execution_mode="auto")
        if result["ok"]:
            await SessionStore.save(session_id, result["session"]["player"]["name"], result["session"])
        return result

    @staticmethod
    async def execute_trade(session_id: str, payload: dict) -> dict:
        return await GameplayService._run_session_action(session_id, "execute_trade", payload)

    @staticmethod
    async def deposit_warehouse(session_id: str, payload: dict) -> dict:
        return await GameplayService._run_session_action(session_id, "deposit_warehouse", payload)

    @staticmethod
    async def withdraw_warehouse(session_id: str, payload: dict) -> dict:
        return await GameplayService._run_session_action(session_id, "withdraw_warehouse", payload)

    @staticmethod
    async def start_move(session_id: str, payload: dict) -> dict:
        return await GameplayService._run_session_action(session_id, "start_move", payload)

    @staticmethod
    async def resolve_encounter(session_id: str, payload: dict) -> dict:
        return await GameplayService._run_session_action(session_id, "resolve_encounter", payload)

    @staticmethod
    async def finalize_encounter(session_id: str) -> dict:
        return await GameplayService._run_session_action(session_id, "finalize_encounter", {})

    @staticmethod
    async def advance_world(session_id: str, payload: dict) -> dict:
        return await GameplayService._run_session_action(session_id, "advance_world", payload)

    @staticmethod
    async def persist_session(session_id: str, session: dict) -> dict:
        existing = await SessionStore.load(session_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Session not found")
        await SessionStore.save(session_id, session["player"]["name"], session)
        return {
            "ok": True,
            "sessionId": session_id,
            "session": session,
        }

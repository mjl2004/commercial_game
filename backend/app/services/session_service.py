from fastapi import HTTPException
import random

from app.services.db_gameplay_gateway import DBGameplayGateway
from app.services.session_engine import SessionEngine
from app.services.session_store import SessionStore


class SessionService:
    @staticmethod
    async def start_session(player_name: str, seed: int | None = None) -> dict:
        template = SessionStore.load_template()
        effective_seed = seed if seed is not None else random.randint(1, 2147483647)
        initial_session = SessionEngine.create_session(template, player_name, effective_seed)
        result = await DBGameplayGateway.start_session(initial_session)
        if result["ok"]:
            await SessionStore.save(result["sessionId"], player_name, result["session"])
        return result

    @staticmethod
    async def get_session(session_id: str) -> dict:
        session = await SessionStore.load(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return {
            "ok": True,
            "sessionId": session_id,
            "session": session,
        }

    @staticmethod
    async def delete_session(session_id: str) -> dict:
        existing = await SessionStore.load(session_id)
        if not existing:
            return {"ok": True}
        await SessionStore.delete(session_id)
        return {"ok": True}

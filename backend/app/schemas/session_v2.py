from typing import Any

from pydantic import BaseModel, Field


class StartSessionRequest(BaseModel):
    playerName: str = Field(min_length=1, max_length=64)
    seed: int | None = None


class SessionEnvelope(BaseModel):
    ok: bool = True
    sessionId: str
    session: dict[str, Any]


class PersistSessionRequest(BaseModel):
    session: dict[str, Any]

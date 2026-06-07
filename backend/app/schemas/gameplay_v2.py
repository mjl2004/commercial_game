from typing import Any, Literal

from pydantic import BaseModel, Field


class StartMovePayload(BaseModel):
    stationId: int
    targetStationId: int
    yearsCost: int = Field(ge=0)
    encounterRoll: float | None = None
    encounterIndex: int | None = None


class EncounterResolutionPayload(BaseModel):
    choiceId: int
    pendingAction: dict[str, Any]


class AdvanceWorldPayload(BaseModel):
    yearsElapsed: int = Field(ge=0)
    source: Literal["move", "trade"]

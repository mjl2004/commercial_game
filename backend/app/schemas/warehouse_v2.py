from typing import Any, Literal

from pydantic import BaseModel, Field


class WarehousePayload(BaseModel):
    stationId: int
    goodsId: int
    quantity: int = Field(gt=0)


class WarehouseSuccess(BaseModel):
    ok: Literal[True]
    session: dict[str, Any]
    taxPaid: int | None = None


class WarehouseFailure(BaseModel):
    ok: Literal[False]
    message: str

from typing import Any, Literal

from pydantic import BaseModel, Field


class TradeExecutionPayload(BaseModel):
    stationId: int
    goodsId: int
    quantity: int = Field(gt=0)
    tradeType: Literal["buy", "sell"]


class TradeSuccess(BaseModel):
    ok: Literal[True]
    session: dict[str, Any]
    rippleAffectedStationIds: list[int]


class TradeFailure(BaseModel):
    ok: Literal[False]
    code: Literal[
        "INSUFFICIENT_FUNDS",
        "CARGO_FULL",
        "STOCK_NOT_ENOUGH",
        "NO_CARGO",
        "INVALID_STATION",
        "INVALID_GOODS",
    ]
    message: str

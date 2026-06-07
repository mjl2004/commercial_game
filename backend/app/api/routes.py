from fastapi import APIRouter, HTTPException
from app.schemas import (
    AdvanceWorldPayload,
    CompleteSettlementRequest,
    LoginRequest,
    PlayerStatus,
    CargoItem,
    EncounterResolutionPayload,
    RecordScoreRequest,
    RegisterRequest,
    StartMovePayload,
    StartSessionRequest,
    PersistSessionRequest,
    TradeExecutionPayload,
    TradeRequest,
    TradeResult,
    MoveRequest,
    MoveResult,
    EventChoicePayload,
    EventChoiceResult,
    WarehousePayload,
)
from app.services import AuthService, EventService, GameplayService, SessionService, SettlementService, TradeService, WantedService
from app.db.connection import get_connection

router = APIRouter()

@router.post("/auth/register")
async def register(payload: RegisterRequest):
    return await AuthService.register(payload.model_dump())

@router.post("/auth/login")
async def login(payload: LoginRequest):
    return await AuthService.login(payload.model_dump())

@router.get("/auth/accounts/{account_id}")
async def get_account(account_id: str):
    account = await AuthService.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"ok": True, "account": account}

@router.get("/auth/accounts/{account_id}/settlements")
async def get_account_settlements(account_id: str, limit: int = 10):
    account = await AuthService.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    safe_limit = max(1, min(limit, 50))
    return {
        "ok": True,
        "accountId": account_id,
        "records": await SettlementService.list_records_by_account(account_id, safe_limit),
    }

@router.get("/leaderboard")
async def get_leaderboard():
    return {"ok": True, "entries": await AuthService.get_leaderboard()}

@router.post("/leaderboard/{account_id}/score")
async def record_score(account_id: str, payload: RecordScoreRequest):
    updated = await AuthService.record_score(account_id, payload.score)
    if updated is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"ok": True, "account": updated}

@router.get("/session/{session_id}/settlement")
async def evaluate_settlement(session_id: str):
    record = await SettlementService.get_record(session_id)
    if record:
        return {
            "ok": True,
            "settlement": record,
            "archived": True,
        }
    session_envelope = await SessionService.get_session(session_id)
    if not session_envelope["ok"]:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "ok": True,
        "settlement": await SettlementService.evaluate_prefer_db(session_envelope["session"]),
        "archived": False,
    }

@router.get("/session/{session_id}/archive")
async def get_settlement_archive(session_id: str):
    record = await SettlementService.get_record(session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Settlement archive not found")
    return {
        "ok": True,
        "settlement": record,
        "archived": True,
    }

@router.post("/session/{session_id}/complete")
async def complete_settlement(session_id: str, payload: CompleteSettlementRequest):
    session_envelope = await SessionService.get_session(session_id)
    result = await SettlementService.complete(session_id, session_envelope["session"], payload.accountId)
    if not result["ok"]:
        if result.get("code") == "ACCOUNT_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Account not found")
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to complete settlement"))
    return result

@router.post("/session/start")
async def start_session(payload: StartSessionRequest):
    return await SessionService.start_session(payload.playerName, payload.seed)

@router.get("/session/{session_id}")
async def get_session(session_id: str):
    return await SessionService.get_session(session_id)

@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    return await SessionService.delete_session(session_id)

@router.post("/session/{session_id}/persist")
async def persist_session(session_id: str, payload: PersistSessionRequest):
    return await GameplayService.persist_session(session_id, payload.session)

@router.post("/session/{session_id}/trade")
async def session_trade(session_id: str, payload: TradeExecutionPayload):
    return await GameplayService.execute_trade(session_id, payload.model_dump())

@router.post("/session/{session_id}/warehouse/deposit")
async def deposit_warehouse(session_id: str, payload: WarehousePayload):
    return await GameplayService.deposit_warehouse(session_id, payload.model_dump())

@router.post("/session/{session_id}/warehouse/withdraw")
async def withdraw_warehouse(session_id: str, payload: WarehousePayload):
    return await GameplayService.withdraw_warehouse(session_id, payload.model_dump())

@router.post("/session/{session_id}/move/start")
async def start_move(session_id: str, payload: StartMovePayload):
    return await GameplayService.start_move(session_id, payload.model_dump())

@router.post("/session/{session_id}/encounter/resolve")
async def resolve_encounter(session_id: str, payload: EncounterResolutionPayload):
    return await GameplayService.resolve_encounter(session_id, payload.model_dump())

@router.post("/session/{session_id}/encounter/finalize")
async def finalize_encounter(session_id: str):
    return await GameplayService.finalize_encounter(session_id)

@router.post("/session/{session_id}/world/advance")
async def advance_world(session_id: str, payload: AdvanceWorldPayload):
    return await GameplayService.advance_world(session_id, payload.model_dump())

@router.get("/players/{player_id}/status", response_model=PlayerStatus)
async def get_player_status(player_id: int):
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT id, name, credits, planet_id, wanted_level FROM players WHERE id = $1",
            player_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Player not found")
        cargo_rows = await conn.fetch(
            "SELECT commodity_id, quantity FROM player_cargo WHERE player_id = $1",
            player_id,
        )
        cargo = [
            CargoItem(
                commodityId=c["commodity_id"],
                commodityName=f"Commodity-{c['commodity_id']}",
                quantity=c["quantity"],
            )
            for c in cargo_rows
        ]
        return PlayerStatus(
            id=row["id"],
            name=row["name"],
            credits=row["credits"],
            currentPlanetId=row["planet_id"],
            cargo=cargo,
            wantedLevel=row["wanted_level"],
        )

@router.post("/trade", response_model=TradeResult)
async def trade(req: TradeRequest):
    try:
        result = await TradeService.execute_trade(req)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/move", response_model=MoveResult)
async def move(req: MoveRequest):
    async with get_connection() as conn:
        # 简单校验并更新位置
        row = await conn.fetchrow(
            "SELECT planet_id FROM players WHERE id = $1", req.playerId
        )
        if not row:
            raise HTTPException(status_code=404, detail="Player not found")
        await conn.execute(
            "UPDATE players SET planet_id = $1 WHERE id = $2",
            req.targetPlanetId,
            req.playerId,
        )
        return MoveResult(
            success=True,
            newPlanetId=req.targetPlanetId,
            travelCost=0,
        )

@router.post("/event/choice", response_model=EventChoiceResult)
async def event_choice(payload: EventChoicePayload):
    try:
        return await EventService.apply_choice(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/players/{player_id}/wanted")
async def get_wanted_level(player_id: int):
    level = await WantedService.recalculate_wanted_level(player_id)
    return {"playerId": player_id, "wantedLevel": level}

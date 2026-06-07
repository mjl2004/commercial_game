from __future__ import annotations

from copy import deepcopy
import json

from app.db.connection import get_connection
from app.services.auth_service import AuthService


class SettlementService:
    @staticmethod
    async def ensure_tables() -> None:
        async with get_connection() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS settlement_records (
                    record_id VARCHAR(64) PRIMARY KEY,
                    session_id VARCHAR(64) NOT NULL UNIQUE,
                    account_id VARCHAR(64) NULL,
                    final_score INT NOT NULL,
                    result_code VARCHAR(16) NOT NULL,
                    settlement_json TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

    @staticmethod
    def _sum_player_cargo(session: dict, goods_id: int) -> int:
        return sum(item["quantity"] for item in session["player"]["cargo"] if item["goodsId"] == goods_id)

    @staticmethod
    def _sum_warehouse_goods(session: dict, goods_id: int) -> int:
        total = 0
        for entries in session["warehouses"].values():
            total += sum(entry["quantity"] for entry in entries if entry["goodsId"] == goods_id)
        return total

    @staticmethod
    def _sum_market_goods(session: dict, goods_id: int) -> int:
        total = 0
        for station in session["stations"]:
            inventory = next((item for item in station["inventory"] if item["goodsId"] == goods_id), None)
            total += inventory["stock"] if inventory else 0
        return total

    @staticmethod
    def _compute_monopoly_count(session: dict) -> int:
        count = 0
        for goods in session["goods"]:
            player_held = SettlementService._sum_player_cargo(session, goods["id"]) + SettlementService._sum_warehouse_goods(session, goods["id"])
            market_total = SettlementService._sum_market_goods(session, goods["id"])
            denominator = player_held + market_total
            ratio = (player_held / denominator) if denominator > 0 else 0
            if ratio >= 0.8:
                count += 1
        return count

    @staticmethod
    def _derive_result(session: dict, monopoly_count: int) -> str:
        player = session["player"]
        meta = session["meta"]
        if monopoly_count > 0:
            return "won"
        if player["credits"] <= 0 or player["detainedYears"] > 18 or player["status"] == "LOST":
            return "lost"
        if meta["currentYear"] >= meta["endYear"] or player["status"] == "TIMEUP":
            return "timeup"
        if player["status"] == "WON":
            return "won"
        return "timeup"

    @staticmethod
    def evaluate(session: dict) -> dict:
        snapshot = deepcopy(session)
        monopoly_count = SettlementService._compute_monopoly_count(snapshot)
        result = SettlementService._derive_result(snapshot, monopoly_count)
        final_credits = snapshot["player"]["credits"]
        trade_count = snapshot["stats"]["tradeCount"]
        event_count = snapshot["stats"]["eventCount"]
        credits_bonus = round(final_credits * 0.5)
        monopoly_bonus = monopoly_count * 5000
        trade_bonus = trade_count * 100
        event_bonus = event_count * 200

        return {
            "result": result,
            "playerName": snapshot["player"]["name"],
            "finalCredits": final_credits,
            "monopolyCount": monopoly_count,
            "tradeCount": trade_count,
            "eventCount": event_count,
            "breakdown": {
                "creditsBonus": credits_bonus,
                "monopolyBonus": monopoly_bonus,
                "tradeBonus": trade_bonus,
                "eventBonus": event_bonus,
                "total": credits_bonus + monopoly_bonus + trade_bonus + event_bonus,
            },
        }

    @staticmethod
    async def evaluate_db(session: dict) -> dict:
        async with get_connection() as conn:
            result = await conn.fetchval(
                "SELECT game_logic.evaluate_settlement($1::text)::text",
                json.dumps(session, ensure_ascii=False),
            )
        if not result:
            raise RuntimeError("Database settlement evaluation returned no result")
        return json.loads(result) if isinstance(result, str) else result

    @staticmethod
    async def evaluate_prefer_db(session: dict) -> dict:
        try:
            return await SettlementService.evaluate_db(session)
        except Exception:
            return SettlementService.evaluate(session)

    @staticmethod
    async def complete_db(session_id: str, session: dict, account_id: str | None) -> dict:
        async with get_connection() as conn:
            result = await conn.fetchval(
                "SELECT game_logic.complete_settlement($1::text, $2::text, $3::text)::text",
                session_id,
                json.dumps(session, ensure_ascii=False),
                account_id,
            )
        if not result:
            raise RuntimeError("Database settlement completion returned no result")
        return json.loads(result) if isinstance(result, str) else result

    @staticmethod
    def _serialize_record(row) -> dict:
        settlement = json.loads(row["settlement_json"])
        settlement["recordId"] = row["record_id"]
        settlement["finalizedAt"] = row["created_at"].isoformat()
        settlement["accountId"] = row["account_id"]
        return settlement

    @staticmethod
    async def get_record(session_id: str) -> dict | None:
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT record_id, session_id, account_id, final_score, result_code, settlement_json, created_at
                FROM settlement_records
                WHERE session_id = $1
                """,
                session_id,
            )
        return SettlementService._serialize_record(row) if row else None

    @staticmethod
    async def list_records_by_account(account_id: str, limit: int = 10) -> list[dict]:
        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT record_id, session_id, account_id, final_score, result_code, settlement_json, created_at
                FROM settlement_records
                WHERE account_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                account_id,
                limit,
            )
        return [SettlementService._serialize_record(row) for row in rows]

    @staticmethod
    async def complete(session_id: str, session: dict, account_id: str | None) -> dict:
        try:
            return await SettlementService.complete_db(session_id, session, account_id)
        except Exception:
            existing = await SettlementService.get_record(session_id)
            if existing:
                account = await AuthService.get_account(account_id) if account_id else None
                return {
                    "ok": True,
                    "settlement": existing,
                    "account": account,
                    "archived": True,
                }

            settlement = await SettlementService.evaluate_prefer_db(session)
            updated_account = None
            if account_id:
                updated_account = await AuthService.record_score(account_id, settlement["breakdown"]["total"])
                if updated_account is None:
                    return {
                        "ok": False,
                        "message": "Account not found",
                        "code": "ACCOUNT_NOT_FOUND",
                    }

            payload = json.dumps(settlement, ensure_ascii=False)
            async with get_connection() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO settlement_records (
                        record_id,
                        session_id,
                        account_id,
                        final_score,
                        result_code,
                        settlement_json
                    )
                    VALUES (
                        'stl-' || replace(cast(clock_timestamp() AS text), ' ', '-') || '-' || substr(md5($1), 1, 8),
                        $1,
                        $2,
                        $3,
                        $4,
                        $5
                    )
                    RETURNING record_id, session_id, account_id, final_score, result_code, settlement_json, created_at
                    """,
                    session_id,
                    account_id,
                    settlement["breakdown"]["total"],
                    settlement["result"],
                    payload,
                )

            return {
                "ok": True,
                "settlement": SettlementService._serialize_record(row),
                "account": updated_account,
                "archived": True,
            }

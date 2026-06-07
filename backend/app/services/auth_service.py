from time import time_ns
import json

from app.db.connection import get_connection


class AuthService:
    @staticmethod
    async def ensure_tables() -> None:
        async with get_connection() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS accounts (
                    account_id VARCHAR(64) PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password_mock VARCHAR(128) NOT NULL,
                    nickname VARCHAR(64) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    best_score INT NOT NULL DEFAULT 0,
                    best_score_updated_at TIMESTAMP NULL
                )
                """
            )

    @staticmethod
    async def register(payload: dict) -> dict:
        email = payload["email"].strip().lower()
        password = payload["password"]
        nickname = payload["nickname"].strip()

        async with get_connection() as conn:
            existing = await conn.fetchrow(
                "SELECT account_id FROM accounts WHERE email = $1",
                email,
            )
            if existing:
                return {"ok": False, "message": "该邮箱已注册，请直接登录。"}

            row = await conn.fetchrow(
                """
                INSERT INTO accounts (account_id, email, password_mock, nickname)
                VALUES ($1, $2, $3, $4)
                RETURNING account_id, email, password_mock, nickname, created_at, updated_at, best_score, best_score_updated_at
                """,
                f"acc-{time_ns()}",
                email,
                password,
                nickname,
            )
        return {"ok": True, "account": AuthService._serialize_account(row)}

    @staticmethod
    async def login(payload: dict) -> dict:
        email = payload["email"].strip().lower()
        password = payload["password"]
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT account_id, email, password_mock, nickname, created_at, updated_at, best_score, best_score_updated_at
                FROM accounts
                WHERE email = $1
                """,
                email,
            )
        if not row:
            return {"ok": False, "message": "该邮箱尚未注册。"}
        if row["password_mock"] != password:
            return {"ok": False, "message": "密码错误，请重新输入。"}
        return {"ok": True, "account": AuthService._serialize_account(row)}

    @staticmethod
    async def get_account(account_id: str) -> dict | None:
        try:
            async with get_connection() as conn:
                result = await conn.fetchval(
                    "SELECT game_logic.get_account($1::text)::text",
                    account_id,
                )
            if not result or result == "null":
                return None
            return json.loads(result) if isinstance(result, str) else result
        except Exception:
            async with get_connection() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT account_id, email, password_mock, nickname, created_at, updated_at, best_score, best_score_updated_at
                    FROM accounts
                    WHERE account_id = $1
                    """,
                    account_id,
                )
            return AuthService._serialize_account(row) if row else None

    @staticmethod
    async def get_leaderboard() -> list[dict]:
        try:
            async with get_connection() as conn:
                result = await conn.fetchval(
                    "SELECT game_logic.get_leaderboard($1::int)::text",
                    10,
                )
            if not result:
                return []
            return json.loads(result) if isinstance(result, str) else result
        except Exception:
            async with get_connection() as conn:
                rows = await conn.fetch(
                    """
                    SELECT account_id, email, password_mock, nickname, created_at, updated_at, best_score, best_score_updated_at
                    FROM accounts
                    WHERE best_score > 0
                    ORDER BY best_score DESC, best_score_updated_at DESC NULLS LAST
                    LIMIT 10
                    """
                )
            return [
                {
                    "rank": index,
                    "accountId": row["account_id"],
                    "nickname": row["nickname"],
                    "emailMasked": AuthService._mask_email(row["email"]),
                    "bestScore": row["best_score"],
                    "updatedAt": row["best_score_updated_at"].isoformat() if row["best_score_updated_at"] else None,
                }
                for index, row in enumerate(rows, start=1)
            ]

    @staticmethod
    async def record_score(account_id: str, score: int) -> dict | None:
        async with get_connection() as conn:
            current = await conn.fetchrow(
                """
                SELECT account_id, email, password_mock, nickname, created_at, updated_at, best_score, best_score_updated_at
                FROM accounts
                WHERE account_id = $1
                """,
                account_id,
            )
            if not current:
                return None
            if score <= current["best_score"]:
                return AuthService._serialize_account(current)
            updated = await conn.fetchrow(
                """
                UPDATE accounts
                SET best_score = $2,
                    best_score_updated_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE account_id = $1
                RETURNING account_id, email, password_mock, nickname, created_at, updated_at, best_score, best_score_updated_at
                """,
                account_id,
                score,
            )
        return AuthService._serialize_account(updated)

    @staticmethod
    def _serialize_account(row) -> dict:
        return {
            "id": row["account_id"],
            "email": row["email"],
            "passwordMock": row["password_mock"],
            "nickname": row["nickname"],
            "createdAt": row["created_at"].isoformat(),
            "updatedAt": row["updated_at"].isoformat(),
            "bestScore": row["best_score"],
            "bestScoreUpdatedAt": row["best_score_updated_at"].isoformat() if row["best_score_updated_at"] else None,
        }

    @staticmethod
    def _mask_email(email: str) -> str:
        name, _, domain = email.partition("@")
        if not name or not domain:
            return email
        if len(name) <= 2:
            return f"{name[0]}*@{domain}"
        return f"{name[:2]}***@{domain}"

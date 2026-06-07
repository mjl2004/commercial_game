import json
from pathlib import Path
from typing import Any


class SessionStore:
    @staticmethod
    def _split_sql_statements(sql_content: str) -> list[str]:
        statements: list[str] = []
        buffer: list[str] = []
        in_dollar_quote = False

        for line in sql_content.splitlines():
            stripped = line.strip()
            if stripped.startswith("--"):
                continue

            if "$$" in line:
                dollar_count = line.count("$$")
                if dollar_count % 2 == 1:
                    in_dollar_quote = not in_dollar_quote

            buffer.append(line)
            if not in_dollar_quote and stripped.endswith(";"):
                statement = "\n".join(buffer).strip()
                if statement:
                    statements.append(statement)
                buffer = []

        trailing = "\n".join(buffer).strip()
        if trailing:
            statements.append(trailing)
        return statements

    @staticmethod
    async def ensure_table() -> None:
        from app.db.connection import get_connection

        async with get_connection() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS game_sessions (
                    session_id VARCHAR(64) PRIMARY KEY,
                    player_name VARCHAR(64) NOT NULL,
                    session_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            logic_path = Path(__file__).resolve().parents[1] / "db" / "game_logic.sql"
            for statement in SessionStore._split_sql_statements(logic_path.read_text(encoding="utf-8")):
                await conn.execute(statement)
            await conn.reload_schema_state()

    @staticmethod
    async def save(session_id: str, player_name: str, session: dict[str, Any]) -> None:
        from app.db.connection import get_connection

        payload = json.dumps(session, ensure_ascii=False)
        async with get_connection() as conn:
            existing = await conn.fetchrow(
                "SELECT session_id FROM game_sessions WHERE session_id = $1",
                session_id,
            )
            if existing:
                await conn.execute(
                    """
                    UPDATE game_sessions
                    SET player_name = $2,
                        session_json = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE session_id = $1
                    """,
                    session_id,
                    player_name,
                    payload,
                )
                return

            await conn.execute(
                """
                INSERT INTO game_sessions (session_id, player_name, session_json)
                VALUES ($1, $2, $3)
                """,
                session_id,
                player_name,
                payload,
            )

    @staticmethod
    async def load(session_id: str) -> dict[str, Any] | None:
        from app.db.connection import get_connection

        async with get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT session_json FROM game_sessions WHERE session_id = $1",
                session_id,
            )
        if not row:
            return None
        return json.loads(row["session_json"])

    @staticmethod
    async def delete(session_id: str) -> None:
        from app.db.connection import get_connection

        async with get_connection() as conn:
            await conn.execute(
                "DELETE FROM game_sessions WHERE session_id = $1",
                session_id,
            )

    @staticmethod
    def load_template() -> dict[str, Any]:
        root_dir = Path(__file__).resolve().parents[3]
        template_path = root_dir / "frontend" / "public" / "data" / "session-template.json"
        with template_path.open("r", encoding="utf-8") as file:
            return json.load(file)

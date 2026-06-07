import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("debug", "true")

from app.db.connection import close_pool, init_pool, get_connection
from app.services.auth_service import AuthService
from app.services.session_store import SessionStore


class AuthDbPhase2Test(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await close_pool()
        await init_pool()
        await SessionStore.ensure_table()
        await AuthService.ensure_tables()
        async with get_connection() as conn:
            await conn.execute("DELETE FROM public.accounts")

    async def asyncTearDown(self):
        await close_pool()

    async def test_get_account_db_matches_service_shape(self):
        created = await AuthService.register(
            {"email": "demo@example.com", "password": "secret", "nickname": "Demo"}
        )

        fetched = await AuthService.get_account(created["account"]["id"])

        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["id"], created["account"]["id"])
        self.assertEqual(fetched["email"], "demo@example.com")
        self.assertEqual(fetched["nickname"], "Demo")

    async def test_get_leaderboard_db_returns_ranked_masked_entries(self):
        first = await AuthService.register(
            {"email": "alpha@example.com", "password": "secret", "nickname": "Alpha"}
        )
        second = await AuthService.register(
            {"email": "beta@example.com", "password": "secret", "nickname": "Beta"}
        )

        await AuthService.record_score(first["account"]["id"], 5000)
        await AuthService.record_score(second["account"]["id"], 4200)

        leaderboard = await AuthService.get_leaderboard()

        self.assertEqual(len(leaderboard), 2)
        self.assertEqual(leaderboard[0]["rank"], 1)
        self.assertEqual(leaderboard[0]["accountId"], first["account"]["id"])
        self.assertEqual(leaderboard[0]["emailMasked"], "al***@example.com")
        self.assertEqual(leaderboard[1]["rank"], 2)
        self.assertEqual(leaderboard[1]["accountId"], second["account"]["id"])


if __name__ == "__main__":
    unittest.main()

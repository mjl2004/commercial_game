import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("debug", "true")

from app.db.connection import close_pool, init_pool
from app.services.session_engine import SessionEngine
from app.services.session_store import SessionStore
from app.services.settlement_service import SettlementService


class SettlementDbPhase2Test(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = SessionStore.load_template()

    async def asyncSetUp(self):
        await close_pool()
        await init_pool()
        await SessionStore.ensure_table()

    async def asyncTearDown(self):
        await close_pool()

    def create_session(self, seed: int = 99001) -> dict:
        return SessionEngine.create_session(self.template, "Tester", seed)

    async def test_evaluate_db_matches_python_reference(self):
        session = self.create_session(99002)
        session["player"]["credits"] = 9224
        session["player"]["status"] = "WON"
        session["stats"]["tradeCount"] = 2
        session["stats"]["eventCount"] = 1

        db_result = await SettlementService.evaluate_db(session)
        py_result = SettlementService.evaluate(session)

        self.assertEqual(db_result, py_result)

    async def test_complete_db_returns_archived_settlement_without_account(self):
        session = self.create_session(99003)
        session["player"]["credits"] = 9224
        session["player"]["status"] = "WON"
        session["stats"]["tradeCount"] = 2
        session["stats"]["eventCount"] = 1

        result = await SettlementService.complete_db(session["meta"]["sessionId"], session, None)

        self.assertTrue(result["ok"])
        self.assertTrue(result["archived"])
        self.assertEqual(result["settlement"]["playerName"], "Tester")
        self.assertEqual(result["settlement"]["breakdown"]["total"], 5012)
        self.assertIsNone(result["account"])


if __name__ == "__main__":
    unittest.main()

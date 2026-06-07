import os
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("debug", "true")

from app.db.connection import close_pool, get_connection, init_pool
from app.services.session_engine import SessionEngine
from app.services.session_store import SessionStore


class DBIntegrationPhase1Test(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = SessionStore.load_template()
        cls.session = SessionEngine.create_session(cls.template, "Tester", 12345)

    async def asyncSetUp(self):
        await close_pool()
        await init_pool()
        await SessionStore.ensure_table()
        await close_pool()
        await init_pool()

    async def asyncTearDown(self):
        await close_pool()

    async def test_game_logic_schema_and_views_exist(self):
        async with get_connection() as conn:
            schema_exists = await conn.fetchval(
                "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = 'game_logic'"
            )
            view_exists = await conn.fetchval(
                """
                SELECT COUNT(*)
                FROM information_schema.views
                WHERE table_schema = 'game_logic'
                  AND table_name IN ('session_player_summary', 'session_cargo_summary')
                """
            )

        self.assertEqual(schema_exists, 1)
        self.assertEqual(view_exists, 2)

    async def test_encounter_pool_seeded(self):
        async with get_connection() as conn:
            count = await conn.fetchval("SELECT COUNT(*) FROM game_logic.encounter_pool")
        self.assertGreaterEqual(count, 3)

    async def test_start_session_function_returns_json(self):
        async with get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT game_logic.start_session($1::text) AS result",
                json.dumps(self.session, ensure_ascii=False),
            )

        self.assertIsNotNone(row)
        result = json.loads(row["result"])
        self.assertTrue(result["ok"])
        self.assertEqual(result["sessionId"], self.session["meta"]["sessionId"])
        self.assertIn("session", result)

    async def test_db_gateway_views_can_read_saved_session(self):
        await SessionStore.save(self.session["meta"]["sessionId"], "Tester", self.session)
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT credits, current_station_id, current_year, end_year
                FROM game_logic.session_player_summary
                WHERE session_id = $1
                """,
                self.session["meta"]["sessionId"],
            )

        self.assertIsNotNone(row)
        self.assertEqual(row["credits"], self.session["player"]["credits"])
        self.assertEqual(row["current_station_id"], self.session["player"]["currentStationId"])
        self.assertEqual(row["current_year"], self.session["meta"]["currentYear"])
        self.assertEqual(row["end_year"], self.session["meta"]["endYear"])

    async def test_all_primary_actions_return_json_shape(self):
        payloads = {
            "start_move": {"stationId": self.session["routes"][0]["from"], "targetStationId": self.session["routes"][0]["to"], "yearsCost": self.session["routes"][0]["travelCost"], "encounterRoll": 0.9, "encounterIndex": 0},
            "resolve_encounter": {"choiceId": 1, "pendingAction": {"type": "move", "stationId": 1, "targetStationId": 2, "yearsCost": 1, "baseYearsSettled": False}},
            "advance_world": {"yearsElapsed": 1, "source": "move"},
        }

        async with get_connection() as conn:
            for action_name, payload in payloads.items():
                row = await conn.fetchrow(
                    f"SELECT game_logic.{action_name}($1::text, $2::text) AS result",
                    json.dumps(self.session, ensure_ascii=False),
                    json.dumps(payload, ensure_ascii=False),
                )
                self.assertIsNotNone(row, action_name)
                result = json.loads(row["result"])
                self.assertIn("ok", result, action_name)
                self.assertTrue(result["ok"], action_name)
                self.assertIn("session", result, action_name)


if __name__ == "__main__":
    unittest.main()

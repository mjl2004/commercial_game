import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("debug", "true")

from app.services.db_gameplay_gateway import DBGameplayGateway
from app.services.gameplay_service import GameplayService
from app.services.session_service import SessionService


class DBGameplayGatewayPhase1Test(unittest.IsolatedAsyncioTestCase):
    def build_session(self, seed: int = 100) -> dict:
        return {
            "meta": {
                "sessionId": f"session-{seed}",
                "seed": seed,
                "sessionVersion": 5,
                "currentYear": 2100,
                "endYear": 2200,
            },
            "player": {"name": "Tester", "credits": 10000, "suspicion": 0, "wantedLevel": 0, "detainedYears": 0},
            "warehouses": {},
            "ui": {"encounter": {}, "pendingAction": {}},
            "stats": {"tradeCount": 0, "eventCount": 0},
        }

    async def test_execute_supports_explicit_reference_mode_for_trade(self):
        expected = {"ok": True, "session": {"player": {"name": "Tester"}}}
        with patch("app.services.db_gameplay_gateway.DBGameplayGateway._run_reference_action", return_value=expected) as run_action:
            result = await DBGameplayGateway.execute(
                "execute_trade",
                self.build_session(),
                {"stationId": 1, "goodsId": 1, "quantity": 1, "tradeType": "buy"},
                execution_mode="reference_python",
            )

        self.assertTrue(result["ok"])
        run_action.assert_called_once()
        self.assertEqual(result["actionContext"]["executorUsed"], "reference_python")

    async def test_start_session_calls_db_gateway_not_engine(self):
        session = self.build_session(200)
        session["meta"]["sessionId"] = "session-200"
        with patch("app.services.session_store.SessionStore.load_template", return_value={"meta": {}}), \
             patch("app.services.session_service.SessionEngine.create_session", return_value=session), \
             patch("app.services.session_service.DBGameplayGateway.start_session", new=AsyncMock(return_value={"ok": True, "sessionId": "session-200", "session": session})) as start_gateway, \
             patch("app.services.session_store.SessionStore.save", new=AsyncMock()) as save_mock:
            result = await SessionService.start_session("Tester", 200)

        self.assertTrue(result["ok"])
        start_gateway.assert_awaited_once()
        save_mock.assert_awaited_once()

    async def test_gameplay_service_uses_db_actions(self):
        session = self.build_session(300)
        db_result = {"ok": True, "session": {"player": {"name": "Tester"}}}
        with patch("app.services.session_store.SessionStore.load", new=AsyncMock(return_value=session)), \
             patch("app.services.gameplay_service.DBGameplayGateway.execute", new=AsyncMock(return_value=db_result)) as execute_action, \
             patch("app.services.session_store.SessionStore.save", new=AsyncMock()) as save_mock:
            result = await GameplayService.execute_trade("session-300", {"stationId": 1, "goodsId": 1, "quantity": 1, "tradeType": "buy"})

        self.assertTrue(result["ok"])
        execute_action.assert_awaited_once_with(
            "execute_trade",
            session,
            {"stationId": 1, "goodsId": 1, "quantity": 1, "tradeType": "buy"},
            execution_mode="auto",
        )
        save_mock.assert_awaited_once()

    async def test_finalize_encounter_uses_db_action(self):
        session = self.build_session(400)
        db_result = {"ok": True, "session": {"player": {"name": "Tester"}}}
        with patch("app.services.session_store.SessionStore.load", new=AsyncMock(return_value=session)), \
             patch("app.services.gameplay_service.DBGameplayGateway.execute", new=AsyncMock(return_value=db_result)) as execute_action, \
             patch("app.services.session_store.SessionStore.save", new=AsyncMock()) as save_mock:
            result = await GameplayService.finalize_encounter("session-400")

        self.assertTrue(result["ok"])
        execute_action.assert_awaited_once_with("finalize_encounter", session, {}, execution_mode="auto")
        save_mock.assert_awaited_once()

    async def test_execute_supports_explicit_mode(self):
        result = await DBGameplayGateway.execute("advance_world", self.build_session(500), {"yearsElapsed": 0}, execution_mode="reference_python")
        self.assertEqual(result["actionContext"]["executorUsed"], "reference_python")

    async def test_auto_mode_uses_database_native_for_whitelisted_action(self):
        session = self.build_session(501)
        with patch("app.services.db_gameplay_gateway.DBGameplayGateway._run_database_action", new=AsyncMock(return_value={"ok": True, "session": session})) as run_db:
            result = await DBGameplayGateway.execute("advance_world", session, {"yearsElapsed": 0}, execution_mode="auto")
        self.assertTrue(result["ok"])
        run_db.assert_awaited_once()
        self.assertEqual(result["actionContext"]["executorUsed"], "database_native")

    async def test_execute_supports_explicit_database_native_mode(self):
        session = self.build_session(502)
        with patch("app.services.db_gameplay_gateway.DBGameplayGateway._run_database_action", new=AsyncMock(return_value={"ok": True, "session": session})) as run_db:
            result = await DBGameplayGateway.execute("finalize_encounter", session, {}, execution_mode="database_native")
        self.assertTrue(result["ok"])
        run_db.assert_awaited_once()
        self.assertEqual(result["actionContext"]["executorUsed"], "database_native")

    async def test_auto_mode_uses_database_native_for_trade_and_warehouse_actions(self):
        session = self.build_session(503)
        whitelisted_actions = [
            ("execute_trade", {"stationId": 1, "goodsId": 1, "quantity": 1, "tradeType": "buy"}),
            ("deposit_warehouse", {"stationId": 1, "goodsId": 1, "quantity": 1}),
            ("withdraw_warehouse", {"stationId": 1, "goodsId": 1, "quantity": 1}),
        ]

        for action_name, payload in whitelisted_actions:
            with self.subTest(action_name=action_name):
                with patch(
                    "app.services.db_gameplay_gateway.DBGameplayGateway._run_database_action",
                    new=AsyncMock(return_value={"ok": True, "session": session}),
                ) as run_db:
                    result = await DBGameplayGateway.execute(action_name, session, payload, execution_mode="auto")
                self.assertTrue(result["ok"])
                run_db.assert_awaited_once()
                self.assertEqual(result["actionContext"]["executorUsed"], "database_native")

    async def test_start_move_records_random_control(self):
        session = self.build_session(600)
        session["routes"] = [{"from": 1, "to": 2, "travelCost": 1, "status": "ACTIVE"}]
        session["player"]["currentStationId"] = 1
        session["ui"]["activeTravel"] = None
        session["ui"]["hoveredStationId"] = None
        session["ui"]["selectedTargetStationId"] = None
        session["ui"]["moveState"] = "idle"
        session["ui"]["pendingAction"] = {"type": None, "stationId": None, "targetStationId": None, "yearsCost": None, "baseYearsSettled": True}

        result = await DBGameplayGateway.execute(
            "start_move",
            session,
            {"stationId": 1, "targetStationId": 2, "yearsCost": 1},
            execution_mode="reference_python",
        )

        self.assertIn("encounterRoll", result["actionContext"]["randomControl"])
        self.assertIn("encounterIndex", result["actionContext"]["randomControl"])


if __name__ == "__main__":
    unittest.main()

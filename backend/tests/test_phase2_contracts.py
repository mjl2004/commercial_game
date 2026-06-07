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


class Phase2ContractsTest(unittest.IsolatedAsyncioTestCase):
    def build_session(self, seed: int = 123) -> dict:
        return {
            "meta": {
                "sessionVersion": 5,
                "sessionId": f"session-{seed}",
                "seed": seed,
                "currentYear": 2100,
                "endYear": 2200,
            },
            "player": {
                "name": "Tester",
                "credits": 10000,
                "currentStationId": 1,
                "cargo": [],
                "cargoCapacity": 80,
                "wantedLevel": 0,
                "suspicion": 0,
                "detainedYears": 0,
                "status": "EXPLORING",
            },
            "routes": [{"from": 1, "to": 2, "travelCost": 1, "status": "ACTIVE"}],
            "warehouses": {},
            "ui": {
                "activeTravel": None,
                "hoveredStationId": None,
                "selectedTargetStationId": None,
                "moveState": "idle",
                "pendingAction": {
                    "type": None,
                    "stationId": None,
                    "targetStationId": None,
                    "yearsCost": None,
                    "baseYearsSettled": True,
                },
                "encounter": {
                    "open": False,
                    "eventId": None,
                    "title": "",
                    "description": "",
                    "choices": [],
                    "selectedChoiceId": None,
                    "result": None,
                    "isResolving": False,
                },
                "tradeModal": {
                    "open": False,
                    "stationId": None,
                    "isLoading": False,
                    "selectedGoodsId": None,
                    "isSubmitting": False,
                    "errorMessage": None,
                },
                "ripple": {"affectedStationIds": [], "startedAt": None},
            },
            "stats": {"tradeCount": 0, "eventCount": 0},
            "stations": [
                {
                    "id": 1,
                    "name": "A",
                    "x": 0,
                    "y": 0,
                    "security": "A",
                    "faction": "X",
                    "independenceFactor": 1.0,
                    "inventory": [],
                },
                {
                    "id": 2,
                    "name": "B",
                    "x": 1,
                    "y": 1,
                    "security": "B",
                    "faction": "Y",
                    "independenceFactor": 1.0,
                    "inventory": [],
                },
            ],
            "goods": [],
        }

    async def test_start_move_auto_mode_returns_action_context(self):
        result = await DBGameplayGateway.execute(
            "start_move",
            self.build_session(),
            {"stationId": 1, "targetStationId": 2, "yearsCost": 1},
            execution_mode="auto",
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["actionContext"]["executorUsed"], "database_native")
        self.assertIn("encounterRoll", result["actionContext"]["randomControl"])
        self.assertIn("encounterIndex", result["actionContext"]["randomControl"])

    async def test_persist_session_returns_session_envelope(self):
        session = self.build_session(999)
        with patch("app.services.session_store.SessionStore.load", new=AsyncMock(return_value=session)), \
             patch("app.services.session_store.SessionStore.save", new=AsyncMock()) as save_mock:
            result = await GameplayService.persist_session("session-999", session)

        self.assertTrue(result["ok"])
        self.assertEqual(result["sessionId"], "session-999")
        self.assertEqual(result["session"]["meta"]["sessionId"], "session-999")
        save_mock.assert_awaited_once()

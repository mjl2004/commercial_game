import os
import sys
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("debug", "true")

from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.main import app


class SessionApiPhase1Test(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def build_session(self, seed: int = 777) -> dict[str, Any]:
        return {
            "meta": {
                "sessionVersion": 5,
                "sessionId": f"session-{seed}",
                "seed": seed,
                "generatedAt": "2026-06-03T00:00:00+00:00",
                "lastPersistedAt": "2026-06-03T00:00:00+00:00",
                "startYear": 2100,
                "currentYear": 2100,
                "endYear": 2200,
                "mapWidth": 2000,
                "mapHeight": 1320,
            },
            "goods": [{"id": 1, "name": "标准矿石", "shortName": "矿石", "isContraband": False, "basePrice": 280, "priceVariance": 70, "stockMin": 30, "stockMax": 110}],
            "stations": [
                {
                    "id": 1,
                    "name": "测试站",
                    "x": 100,
                    "y": 100,
                    "security": "A",
                    "faction": "联邦",
                    "independenceFactor": 1.2,
                    "inventory": [{"goodsId": 1, "stock": 50, "basePrice": 280, "currentPrice": 331, "priceHistory": [300, 320, 331]}],
                },
                {
                    "id": 2,
                    "name": "目标站",
                    "x": 200,
                    "y": 200,
                    "security": "B",
                    "faction": "中立",
                    "independenceFactor": 1.3,
                    "inventory": [{"goodsId": 1, "stock": 60, "basePrice": 280, "currentPrice": 280, "priceHistory": [270, 275, 280]}],
                },
            ],
            "routes": [{"from": 1, "to": 2, "travelCost": 2, "status": "ACTIVE"}],
            "player": {
                "id": 1,
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
            "warehouses": {"1": [], "2": []},
            "ui": {
                "hoveredStationId": None,
                "selectedTargetStationId": None,
                "moveState": "idle",
                "activeTravel": None,
                "pendingAction": {
                    "type": None,
                    "stationId": None,
                    "targetStationId": None,
                    "yearsCost": None,
                    "baseYearsSettled": True,
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
            },
            "stats": {"tradeCount": 0, "eventCount": 0},
        }

    def test_start_session_endpoint(self):
        session = self.build_session(888)
        response_payload = {"ok": True, "sessionId": "session-888", "session": session}
        with patch("app.api.routes.SessionService.start_session", new=AsyncMock(return_value=response_payload)):
            response = self.client.post("/api/session/start", json={"playerName": "Tester", "seed": 888})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["sessionId"], "session-888")
        self.assertEqual(body["session"]["meta"]["seed"], 888)

    def test_get_session_endpoint(self):
        session = self.build_session(889)
        response_payload = {"ok": True, "sessionId": "session-889", "session": session}
        with patch("app.api.routes.SessionService.get_session", new=AsyncMock(return_value=response_payload)):
            response = self.client.get("/api/session/session-889")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["session"]["meta"]["sessionId"], "session-889")

    def test_persist_session_endpoint(self):
        session = self.build_session(889)
        response_payload = {"ok": True, "sessionId": "session-889", "session": session}
        with patch("app.api.routes.GameplayService.persist_session", new=AsyncMock(return_value=response_payload)):
            response = self.client.post("/api/session/session-889/persist", json={"session": session})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])

    def test_trade_endpoint(self):
        session = self.build_session(890)
        session["player"]["credits"] = 9669
        session["player"]["cargo"] = [
            {
                "goodsId": 1,
                "goodsName": "标准矿石",
                "quantity": 1,
                "avgCost": 331,
                "isContraband": False,
            }
        ]
        session["meta"]["currentYear"] = 2101
        session["stats"]["tradeCount"] = 1
        payload = {"ok": True, "session": session, "rippleAffectedStationIds": [1, 2]}
        with patch("app.api.routes.GameplayService.execute_trade", new=AsyncMock(return_value=payload)):
            response = self.client.post(
                "/api/session/session-890/trade",
                json={"stationId": 1, "goodsId": 1, "quantity": 1, "tradeType": "buy"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["session"]["player"]["credits"], 9669)
        self.assertEqual(body["session"]["meta"]["currentYear"], 2101)
        self.assertEqual(body["session"]["stats"]["tradeCount"], 1)

    def test_warehouse_endpoints(self):
        session = self.build_session(891)
        deposit_payload = {"ok": True, "session": session}
        withdraw_payload = {"ok": True, "session": session, "taxPaid": 12}

        with patch("app.api.routes.GameplayService.deposit_warehouse", new=AsyncMock(return_value=deposit_payload)):
            deposit_response = self.client.post(
                "/api/session/session-891/warehouse/deposit",
                json={"stationId": 1, "goodsId": 1, "quantity": 1},
            )
        with patch("app.api.routes.GameplayService.withdraw_warehouse", new=AsyncMock(return_value=withdraw_payload)):
            withdraw_response = self.client.post(
                "/api/session/session-891/warehouse/withdraw",
                json={"stationId": 1, "goodsId": 1, "quantity": 1},
            )

        self.assertEqual(deposit_response.status_code, 200)
        self.assertEqual(withdraw_response.status_code, 200)
        self.assertEqual(withdraw_response.json()["taxPaid"], 12)

    def test_move_encounter_and_world_endpoints(self):
        session = self.build_session(892)
        move_payload = {
            "ok": True,
            "session": session,
            "encounter": {
                "id": "enc-patrol-check",
                "title": "临检巡逻队",
                "description": "测试事件",
                "choices": [{"choiceId": 1, "text": "支付", "consequenceHint": "失去 300 CR", "effect": {"creditsDelta": -300}}],
            },
        }
        resolve_payload = {"ok": True, "session": session, "result": {"success": True, "message": "你损失了 300 CR。"}}
        finalize_payload = {"ok": True, "session": session}
        advance_payload = {"ok": True, "session": session}

        with patch("app.api.routes.GameplayService.start_move", new=AsyncMock(return_value=move_payload)):
            move_response = self.client.post(
                "/api/session/session-892/move/start",
                json={"stationId": 1, "targetStationId": 2, "yearsCost": 2, "encounterRoll": 0.1, "encounterIndex": 1},
            )
        with patch("app.api.routes.GameplayService.resolve_encounter", new=AsyncMock(return_value=resolve_payload)):
            resolve_response = self.client.post(
                "/api/session/session-892/encounter/resolve",
                json={"choiceId": 1, "pendingAction": {"type": "move", "stationId": 1, "targetStationId": 2, "yearsCost": 2, "baseYearsSettled": False}},
            )
        with patch("app.api.routes.GameplayService.finalize_encounter", new=AsyncMock(return_value=finalize_payload)):
            finalize_response = self.client.post("/api/session/session-892/encounter/finalize")
        with patch("app.api.routes.GameplayService.advance_world", new=AsyncMock(return_value=advance_payload)):
            advance_response = self.client.post(
                "/api/session/session-892/world/advance",
                json={"yearsElapsed": 2, "source": "move"},
            )

        self.assertEqual(move_response.status_code, 200)
        self.assertEqual(resolve_response.status_code, 200)
        self.assertEqual(finalize_response.status_code, 200)
        self.assertEqual(advance_response.status_code, 200)
        self.assertEqual(move_response.json()["encounter"]["id"], "enc-patrol-check")
        self.assertTrue(resolve_response.json()["result"]["success"])

    def test_missing_session_returns_404(self):
        with patch("app.api.routes.SessionService.get_session", new=AsyncMock(side_effect=HTTPException(status_code=404, detail="Session not found"))):
            response = self.client.get("/api/session/session-missing")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Session not found")


if __name__ == "__main__":
    unittest.main()

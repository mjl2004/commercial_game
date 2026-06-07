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

from fastapi.testclient import TestClient

from app.main import app


class SettlementApiPhase2Test(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_evaluate_settlement_endpoint(self):
        session = {
            "meta": {"currentYear": 2103, "endYear": 2200},
            "player": {"name": "Demo", "credits": 9224, "detainedYears": 0, "status": "WON", "cargo": []},
            "stats": {"tradeCount": 2, "eventCount": 1},
            "goods": [],
            "stations": [],
            "warehouses": {},
        }
        with patch("app.api.routes.SettlementService.get_record", new=AsyncMock(return_value=None)):
            with patch("app.api.routes.SessionService.get_session", new=AsyncMock(return_value={"ok": True, "session": session})):
                response = self.client.get("/api/session/session-1/settlement")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertFalse(body["archived"])
        self.assertEqual(body["settlement"]["playerName"], "Demo")
        self.assertEqual(body["settlement"]["breakdown"]["total"], 5012)

    def test_evaluate_settlement_returns_archived_record_when_present(self):
        archived = {
            "result": "won",
            "playerName": "Demo",
            "finalCredits": 9224,
            "monopolyCount": 0,
            "tradeCount": 2,
            "eventCount": 1,
            "recordId": "stl-1",
            "finalizedAt": "2026-06-07T00:00:00+00:00",
            "accountId": "acc-1",
            "breakdown": {
                "creditsBonus": 4612,
                "monopolyBonus": 0,
                "tradeBonus": 200,
                "eventBonus": 200,
                "total": 5012,
            },
        }
        with patch("app.api.routes.SettlementService.get_record", new=AsyncMock(return_value=archived)):
            response = self.client.get("/api/session/session-1/settlement")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertTrue(body["archived"])
        self.assertEqual(body["settlement"]["recordId"], "stl-1")

    def test_complete_settlement_endpoint(self):
        session = {
            "meta": {"currentYear": 2103, "endYear": 2200},
            "player": {"name": "Demo", "credits": 9224, "detainedYears": 0, "status": "WON", "cargo": []},
            "stats": {"tradeCount": 2, "eventCount": 1},
            "goods": [],
            "stations": [],
            "warehouses": {},
        }
        result = {
            "ok": True,
            "archived": True,
            "account": {
                "id": "acc-1",
                "email": "demo@example.com",
                "passwordMock": "secret",
                "nickname": "Demo",
                "createdAt": "2026-06-06T00:00:00+00:00",
                "updatedAt": "2026-06-06T00:00:00+00:00",
                "bestScore": 5012,
                "bestScoreUpdatedAt": "2026-06-06T01:00:00+00:00",
            },
            "settlement": {
                "result": "won",
                "playerName": "Demo",
                "finalCredits": 9224,
                "monopolyCount": 0,
                "tradeCount": 2,
                "eventCount": 1,
                "recordId": "stl-1",
                "finalizedAt": "2026-06-07T00:00:00+00:00",
                "accountId": "acc-1",
                "breakdown": {
                    "creditsBonus": 4612,
                    "monopolyBonus": 0,
                    "tradeBonus": 200,
                    "eventBonus": 200,
                    "total": 5012,
                },
            },
        }
        with patch("app.api.routes.SessionService.get_session", new=AsyncMock(return_value={"ok": True, "session": session})):
            with patch("app.api.routes.SettlementService.complete", new=AsyncMock(return_value=result)):
                response = self.client.post("/api/session/session-1/complete", json={"accountId": "acc-1"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertTrue(body["archived"])
        self.assertEqual(body["account"]["id"], "acc-1")
        self.assertEqual(body["settlement"]["recordId"], "stl-1")

    def test_get_settlement_archive_endpoint(self):
        archived = {
            "result": "won",
            "playerName": "Demo",
            "finalCredits": 9224,
            "monopolyCount": 0,
            "tradeCount": 2,
            "eventCount": 1,
            "recordId": "stl-1",
            "finalizedAt": "2026-06-07T00:00:00+00:00",
            "accountId": "acc-1",
            "breakdown": {
                "creditsBonus": 4612,
                "monopolyBonus": 0,
                "tradeBonus": 200,
                "eventBonus": 200,
                "total": 5012,
            },
        }
        with patch("app.api.routes.SettlementService.get_record", new=AsyncMock(return_value=archived)):
            response = self.client.get("/api/session/session-1/archive")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertTrue(body["archived"])
        self.assertEqual(body["settlement"]["recordId"], "stl-1")

    def test_delete_session_endpoint(self):
        with patch("app.api.routes.SessionService.delete_session", new=AsyncMock(return_value={"ok": True})):
            response = self.client.delete("/api/session/session-1")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])

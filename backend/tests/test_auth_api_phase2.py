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


class AuthApiPhase2Test(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def build_account(self):
        return {
            "id": "acc-1",
            "email": "demo@example.com",
            "passwordMock": "secret",
            "nickname": "Demo",
            "createdAt": "2026-06-06T00:00:00+00:00",
            "updatedAt": "2026-06-06T00:00:00+00:00",
            "bestScore": 1200,
            "bestScoreUpdatedAt": "2026-06-06T01:00:00+00:00",
        }

    def test_register_endpoint(self):
        with patch("app.api.routes.AuthService.register", new=AsyncMock(return_value={"ok": True, "account": self.build_account()})):
            response = self.client.post("/api/auth/register", json={"email": "demo@example.com", "password": "secret", "nickname": "Demo"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])

    def test_login_endpoint(self):
        with patch("app.api.routes.AuthService.login", new=AsyncMock(return_value={"ok": True, "account": self.build_account()})):
            response = self.client.post("/api/auth/login", json={"email": "demo@example.com", "password": "secret"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["account"]["id"], "acc-1")

    def test_leaderboard_endpoint(self):
        entries = [{"rank": 1, "accountId": "acc-1", "nickname": "Demo", "emailMasked": "de***@example.com", "bestScore": 1200, "updatedAt": "2026-06-06T01:00:00+00:00"}]
        with patch("app.api.routes.AuthService.get_leaderboard", new=AsyncMock(return_value=entries)):
            response = self.client.get("/api/leaderboard")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["entries"][0]["accountId"], "acc-1")

    def test_account_settlements_endpoint(self):
        records = [{
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
        }]
        with patch("app.api.routes.AuthService.get_account", new=AsyncMock(return_value=self.build_account())):
            with patch("app.api.routes.SettlementService.list_records_by_account", new=AsyncMock(return_value=records)):
                response = self.client.get("/api/auth/accounts/acc-1/settlements?limit=5")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["accountId"], "acc-1")
        self.assertEqual(body["records"][0]["recordId"], "stl-1")

    def test_record_score_endpoint(self):
        with patch("app.api.routes.AuthService.record_score", new=AsyncMock(return_value=self.build_account())):
            response = self.client.post("/api/leaderboard/acc-1/score", json={"score": 1200})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
FRONTEND_ROOT = ROOT / "frontend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.session_engine import SessionEngine
from app.services.session_engine.types import RandomController
from app.services.session_store import SessionStore


class FrontendBackendParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = SessionStore.load_template()
        subprocess.run(
            ["node", str(FRONTEND_ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "build", "--config", "vite.parity.config.ts"],
            cwd=FRONTEND_ROOT,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

    def run_frontend(self, payload: dict):
        runner_path = FRONTEND_ROOT / ".parity-dist" / "parityRunner.js"
        completed = subprocess.run(
            ["node", str(runner_path)],
            input=json.dumps(payload, ensure_ascii=False),
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        return json.loads(completed.stdout)

    def create_backend_session(self, seed: int, player_name: str = "Tester"):
        return SessionEngine.create_session(self.template, player_name, seed)

    def assert_paths_equal(self, left, right, paths):
        for path in paths:
            current_left = left
            current_right = right
            for key in path:
                current_left = current_left[key]
                current_right = current_right[key]
            self.assertEqual(
                current_left,
                current_right,
                f"Mismatch at {'/'.join(str(part) for part in path)}: frontend={current_left!r}, backend={current_right!r}",
            )

    def test_create_session_parity(self):
        seed = 91001
        frontend = self.run_frontend({"action": "create_session", "playerName": "Tester", "seed": seed})
        backend = self.create_backend_session(seed)

        self.assert_paths_equal(
            frontend,
            backend,
            [
                ("meta", "sessionId"),
                ("meta", "seed"),
                ("meta", "startYear"),
                ("meta", "currentYear"),
                ("meta", "endYear"),
                ("player", "currentStationId"),
                ("player", "credits"),
                ("player", "status"),
                ("stats", "tradeCount"),
                ("stats", "eventCount"),
                ("ui", "pendingAction", "type"),
                ("ui", "pendingAction", "baseYearsSettled"),
                ("ui", "ripple", "affectedStationIds"),
            ],
        )
        self.assertEqual(frontend["stations"], backend["stations"])
        self.assertEqual(frontend["routes"], backend["routes"])
        self.assertEqual(frontend["goods"], backend["goods"])
        self.assertEqual(frontend["warehouses"], backend["warehouses"])

    def test_trade_buy_parity(self):
        seed = 91002
        frontend = self.run_frontend({"action": "trade_buy", "playerName": "Tester", "seed": seed, "quantity": 1})
        backend_session = self.create_backend_session(seed)
        goods_id = backend_session["stations"][backend_session["player"]["currentStationId"] - 1]["inventory"][0]["goodsId"]
        backend = SessionEngine.execute_trade(
            backend_session,
            {
                "stationId": backend_session["player"]["currentStationId"],
                "goodsId": goods_id,
                "quantity": 1,
                "tradeType": "buy",
            },
        )

        self.assertEqual(frontend["ok"], backend["ok"])
        self.assert_paths_equal(
            frontend["session"],
            backend["session"],
            [
                ("player", "credits"),
                ("player", "cargo"),
                ("meta", "currentYear"),
                ("stats", "tradeCount"),
                ("ui", "ripple", "affectedStationIds"),
            ],
        )

    def test_trade_sell_parity(self):
        seed = 91003
        frontend = self.run_frontend(
            {"action": "trade_sell", "playerName": "Tester", "seed": seed, "buyQuantity": 2, "sellQuantity": 1}
        )
        backend_session = self.create_backend_session(seed)
        goods_id = backend_session["stations"][backend_session["player"]["currentStationId"] - 1]["inventory"][0]["goodsId"]
        bought = SessionEngine.execute_trade(
            backend_session,
            {
                "stationId": backend_session["player"]["currentStationId"],
                "goodsId": goods_id,
                "quantity": 2,
                "tradeType": "buy",
            },
        )
        backend = SessionEngine.execute_trade(
            bought["session"],
            {
                "stationId": bought["session"]["player"]["currentStationId"],
                "goodsId": goods_id,
                "quantity": 1,
                "tradeType": "sell",
            },
        )

        self.assertEqual(frontend["ok"], backend["ok"])
        self.assert_paths_equal(
            frontend["session"],
            backend["session"],
            [
                ("player", "credits"),
                ("player", "cargo"),
                ("meta", "currentYear"),
                ("stats", "tradeCount"),
            ],
        )

    def test_warehouse_roundtrip_parity(self):
        seed = 91004
        frontend = self.run_frontend({"action": "warehouse_roundtrip", "playerName": "Tester", "seed": seed, "quantity": 1})
        backend_session = self.create_backend_session(seed)
        goods_id = backend_session["stations"][backend_session["player"]["currentStationId"] - 1]["inventory"][0]["goodsId"]
        bought = SessionEngine.execute_trade(
            backend_session,
            {
                "stationId": backend_session["player"]["currentStationId"],
                "goodsId": goods_id,
                "quantity": 1,
                "tradeType": "buy",
            },
        )
        deposited = SessionEngine.deposit_to_warehouse(
            bought["session"],
            {
                "stationId": bought["session"]["player"]["currentStationId"],
                "goodsId": goods_id,
                "quantity": 1,
            },
        )
        backend = SessionEngine.withdraw_from_warehouse(
            deposited["session"],
            {
                "stationId": deposited["session"]["player"]["currentStationId"],
                "goodsId": goods_id,
                "quantity": 1,
            },
        )

        self.assertEqual(frontend["ok"], backend["ok"])
        self.assertEqual(frontend["taxPaid"], backend["taxPaid"])
        self.assert_paths_equal(
            frontend["session"],
            backend["session"],
            [
                ("player", "credits"),
                ("player", "cargo"),
                ("warehouses", str(backend_session["player"]["currentStationId"])),
            ],
        )

    def test_encounter_flow_parity(self):
        seed = 91005
        base_session = self.create_backend_session(seed)
        route = base_session["routes"][0]
        frontend = self.run_frontend(
            {
                "action": "encounter_flow",
                "playerName": "Tester",
                "seed": seed,
                "encounterId": "enc-patrol-check",
                "choiceId": 1,
                "yearsCost": route["travelCost"],
                "targetStationId": route["to"],
            }
        )

        moved = SessionEngine.start_move(
            base_session,
            {"stationId": route["from"], "targetStationId": route["to"], "yearsCost": route["travelCost"]},
            RandomController(seed=seed, encounter_roll=0.1, encounter_index=1),
        )
        moved_session = moved["session"]
        moved_session["ui"]["moveState"] = "event_blocking"
        moved_session["ui"]["encounter"] = {
            "open": True,
            "eventId": moved["encounter"]["id"],
            "title": moved["encounter"]["title"],
            "description": moved["encounter"]["description"],
            "choices": moved["encounter"]["choices"],
            "selectedChoiceId": None,
            "result": None,
            "isResolving": False,
        }
        resolved = SessionEngine.resolve_encounter_choice(
            moved_session,
            1,
            moved_session["ui"]["pendingAction"],
        )
        finalized = SessionEngine.finalize_encounter_and_advance(resolved["session"])

        self.assert_paths_equal(
            frontend["resolved"]["session"],
            resolved["session"],
            [
                ("player", "credits"),
                ("player", "wantedLevel"),
                ("player", "suspicion"),
                ("stats", "eventCount"),
                ("ui", "encounter", "selectedChoiceId"),
                ("ui", "encounter", "result"),
            ],
        )
        self.assert_paths_equal(
            frontend["finalized"],
            finalized,
            [
                ("meta", "currentYear"),
                ("player", "wantedLevel"),
                ("player", "suspicion"),
                ("ui", "pendingAction", "baseYearsSettled"),
            ],
        )

    def test_advance_world_parity(self):
        seed = 91006
        frontend = self.run_frontend({"action": "advance_world", "playerName": "Tester", "seed": seed, "yearsElapsed": 3})
        backend = self.create_backend_session(seed)
        backend["warehouses"][str(backend["player"]["currentStationId"])] = [{"goodsId": 1, "quantity": 2, "storedTurns": 0}]
        advanced = SessionEngine.advance_world_state(backend, 3)

        self.assert_paths_equal(
            frontend,
            advanced,
            [
                ("meta", "currentYear"),
                ("player", "wantedLevel"),
                ("player", "suspicion"),
                ("warehouses", str(backend["player"]["currentStationId"])),
            ],
        )


if __name__ == "__main__":
    unittest.main()

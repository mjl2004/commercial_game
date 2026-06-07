import json
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("debug", "true")

from app.services.db_gameplay_gateway import DBGameplayGateway
from app.services.session_engine import SessionEngine
from app.services.session_engine.types import RandomController
from app.services.session_store import SessionStore
from app.db.connection import close_pool, init_pool


class DBBackendParityPhase1Test(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = SessionStore.load_template()

    async def asyncSetUp(self):
        await close_pool()
        await init_pool()
        await SessionStore.ensure_table()
        await close_pool()
        await init_pool()

    async def asyncTearDown(self):
        await close_pool()

    def create_session(self, seed: int = 12345) -> dict:
        return SessionEngine.create_session(self.template, "Tester", seed)

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
                f"Mismatch at {'/'.join(str(part) for part in path)}: expected {current_left!r}, actual {current_right!r}",
            )

    async def test_start_session_matches_reference_shape(self):
        session = self.create_session(91001)
        result = await DBGameplayGateway.start_session(session)

        self.assertTrue(result["ok"])
        self.assertEqual(result["sessionId"], session["meta"]["sessionId"])
        self.assert_paths_equal(
            result["session"],
            session,
            [
                ("meta", "sessionId"),
                ("meta", "seed"),
                ("meta", "startYear"),
                ("meta", "currentYear"),
                ("meta", "endYear"),
                ("player", "currentStationId"),
                ("player", "credits"),
                ("stats", "tradeCount"),
                ("stats", "eventCount"),
            ],
        )

    async def test_advance_world_matches_reference_when_years_zero(self):
        session = self.create_session(91002)
        backend = await DBGameplayGateway.execute("advance_world", session, {"yearsElapsed": 0, "source": "move"}, execution_mode="database_native")
        reference = SessionEngine.advance_world_state(session, 0)

        self.assertTrue(backend["ok"])
        self.assert_paths_equal(
            backend["session"],
            reference,
            [
                ("meta", "currentYear"),
                ("meta", "endYear"),
                ("player", "credits"),
                ("player", "status"),
                ("player", "suspicion"),
                ("player", "wantedLevel"),
                ("player", "detainedYears"),
                ("stats", "tradeCount"),
                ("stats", "eventCount"),
                ("ui", "moveState"),
                ("ui", "pendingAction"),
                ("warehouses",),
            ],
        )

    async def test_execute_trade_matches_reference(self):
        session = self.create_session(91003)
        station_id = session["player"]["currentStationId"]
        goods_id = session["stations"][station_id - 1]["inventory"][0]["goodsId"]

        backend = await DBGameplayGateway.call_action(
            "execute_trade",
            session,
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1, "tradeType": "buy"},
        )
        reference = SessionEngine.execute_trade(
            session,
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1, "tradeType": "buy"},
        )

        self.assertTrue(backend["ok"])
        self.assertTrue(reference["ok"])
        self.assertPaths = self.assert_paths_equal
        self.assert_paths_equal(
            backend["session"],
            reference["session"],
            [
                ("player", "credits"),
                ("player", "cargo"),
                ("meta", "currentYear"),
                ("stats", "tradeCount"),
                ("ui", "ripple", "affectedStationIds"),
            ],
        )
        self.assertEqual(backend["rippleAffectedStationIds"], reference["rippleAffectedStationIds"])

    async def test_start_move_matches_reference_key_fields(self):
        session = self.create_session(91004)
        route = session["routes"][0]

        backend = await DBGameplayGateway.execute(
            "start_move",
            session,
            {
                "stationId": route["from"],
                "targetStationId": route["to"],
                "yearsCost": route["travelCost"],
                "encounterRoll": 0.9,
                "encounterIndex": 0,
            },
            execution_mode="database_native",
        )
        reference = SessionEngine.start_move(
            session,
            {"stationId": route["from"], "targetStationId": route["to"], "yearsCost": route["travelCost"]},
            RandomController(seed=session["meta"]["seed"], encounter_roll=0.9, encounter_index=0),
        )

        self.assertTrue(backend["ok"])
        self.assertTrue(reference["ok"])
        self.assert_paths_equal(
            backend["session"],
            reference["session"],
            [
                ("player", "currentStationId"),
                ("player", "status"),
                ("ui", "moveState"),
                ("ui", "pendingAction"),
            ],
        )

    async def test_resolve_encounter_matches_reference_key_fields(self):
        session = self.create_session(91006)
        route = session["routes"][0]
        moved = SessionEngine.start_move(
            session,
            {"stationId": route["from"], "targetStationId": route["to"], "yearsCost": route["travelCost"]},
            RandomController(seed=session["meta"]["seed"], encounter_roll=0.1, encounter_index=1),
        )
        moved_session = moved["session"]
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
        backend = await DBGameplayGateway.execute(
            "resolve_encounter",
            moved_session,
            {"choiceId": 1, "pendingAction": moved_session["ui"]["pendingAction"]},
            execution_mode="database_native",
        )
        reference = SessionEngine.resolve_encounter_choice(
            moved_session,
            1,
            moved_session["ui"]["pendingAction"],
        )
        self.assertTrue(backend["ok"])
        self.assertTrue(reference["ok"])
        self.assertEqual(backend["result"], reference["result"])
        self.assert_paths_equal(
            backend["session"],
            reference["session"],
            [
                ("player", "credits"),
                ("player", "wantedLevel"),
                ("player", "suspicion"),
                ("meta", "currentYear"),
                ("meta", "endYear"),
                ("stats", "eventCount"),
                ("ui", "encounter", "selectedChoiceId"),
                ("ui", "encounter", "result"),
            ],
        )

    async def test_finalize_encounter_matches_reference_key_fields(self):
        session = self.create_session(91007)
        route = session["routes"][0]
        moved = SessionEngine.start_move(
            session,
            {"stationId": route["from"], "targetStationId": route["to"], "yearsCost": route["travelCost"]},
            RandomController(seed=session["meta"]["seed"], encounter_roll=0.1, encounter_index=0),
        )
        moved["session"]["ui"]["encounter"] = {
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
            moved["session"],
            1,
            moved["session"]["ui"]["pendingAction"],
        )
        backend = await DBGameplayGateway.execute(
            "finalize_encounter",
            resolved["session"],
            {},
            execution_mode="database_native",
        )
        reference = SessionEngine.finalize_encounter_and_advance(resolved["session"])
        self.assertTrue(backend["ok"])
        self.assert_paths_equal(
            backend["session"],
            reference,
            [
                ("meta", "currentYear"),
                ("player", "wantedLevel"),
                ("player", "suspicion"),
                ("ui", "pendingAction", "baseYearsSettled"),
            ],
        )

    async def test_warehouse_roundtrip_matches_reference(self):
        session = self.create_session(91005)
        station_id = session["player"]["currentStationId"]
        goods_id = session["stations"][station_id - 1]["inventory"][0]["goodsId"]

        traded_backend = await DBGameplayGateway.call_action(
            "execute_trade",
            session,
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1, "tradeType": "buy"},
        )
        traded_reference = SessionEngine.execute_trade(
            session,
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1, "tradeType": "buy"},
        )

        deposited_backend = await DBGameplayGateway.call_action(
            "deposit_warehouse",
            traded_backend["session"],
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1},
        )
        deposited_reference = SessionEngine.deposit_to_warehouse(
            traded_reference["session"],
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1},
        )

        withdrawn_backend = await DBGameplayGateway.call_action(
            "withdraw_warehouse",
            deposited_backend["session"],
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1},
        )
        withdrawn_reference = SessionEngine.withdraw_from_warehouse(
            deposited_reference["session"],
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1},
        )

        self.assertTrue(deposited_backend["ok"])
        self.assertTrue(deposited_reference["ok"])
        self.assertEqual(
            deposited_backend["session"]["warehouses"][str(station_id)],
            deposited_reference["session"]["warehouses"][str(station_id)],
        )
        self.assertEqual(deposited_backend["session"]["player"]["cargo"], deposited_reference["session"]["player"]["cargo"])

        self.assertTrue(withdrawn_backend["ok"])
        self.assertTrue(withdrawn_reference["ok"])
        self.assertEqual(withdrawn_backend["taxPaid"], withdrawn_reference["taxPaid"])
        self.assert_paths_equal(
            withdrawn_backend["session"],
            withdrawn_reference["session"],
            [
                ("player", "credits"),
                ("player", "cargo"),
                ("warehouses", str(station_id)),
            ],
        )


if __name__ == "__main__":
    unittest.main()

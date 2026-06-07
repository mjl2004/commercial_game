import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.session_engine import SessionEngine
from app.services.session_engine.types import RandomController
from app.services.session_store import SessionStore


def clone(value):
    return copy.deepcopy(value)


def set_path(target, path, value):
    current = target
    for key in path[:-1]:
        current = current[key]
    current[path[-1]] = value


class SessionEnginePhase1Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = SessionStore.load_template()

    def create_session(self, seed: int = 123456):
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

    def assert_core_session_shape(self, session):
        self.assertIn("meta", session)
        self.assertIn("player", session)
        self.assertIn("stations", session)
        self.assertIn("routes", session)
        self.assertIn("warehouses", session)
        self.assertIn("ui", session)
        self.assertIn("stats", session)
        self.assertIn("pendingAction", session["ui"])
        self.assertIn("ripple", session["ui"])
        self.assertIn("encounter", session["ui"])

    def apply_frontend_start_move(self, session, payload, encounter_roll, encounter_index):
        next_session = clone(session)
        next_session["player"]["currentStationId"] = payload["targetStationId"]
        next_session["player"]["status"] = "TRAVELING"
        next_session["ui"]["activeTravel"] = None
        next_session["ui"]["hoveredStationId"] = None
        next_session["ui"]["selectedTargetStationId"] = None
        next_session["ui"]["moveState"] = "traveling"
        next_session["ui"]["pendingAction"] = {
            "type": "move",
            "stationId": payload["stationId"],
            "targetStationId": payload["targetStationId"],
            "yearsCost": payload["yearsCost"],
            "baseYearsSettled": False,
        }

        encounter = None
        if encounter_roll <= 0.3:
            encounter = clone(SessionEngine.start_move(
                session,
                payload,
                RandomController(seed=session["meta"]["seed"], encounter_roll=encounter_roll, encounter_index=encounter_index),
            )["encounter"])
        return {"session": next_session, "encounter": encounter}

    def apply_frontend_resolve_encounter(self, session, choice_id):
        if not session["ui"]["encounter"]["eventId"]:
            return {
                "session": session,
                "result": {"success": False, "message": "当前没有可结算的遭遇事件。"},
            }

        next_session = clone(session)
        choice = next((item for item in next_session["ui"]["encounter"]["choices"] if item["choiceId"] == choice_id), None)
        if not choice:
            return {
                "session": session,
                "result": {"success": False, "message": "无效的事件选项。"},
            }

        effect = choice.get("effect", {})
        next_session["ui"]["encounter"]["selectedChoiceId"] = choice_id
        next_session["ui"]["encounter"]["isResolving"] = True
        next_session["player"]["credits"] += effect.get("creditsDelta", 0)
        next_session["meta"]["currentYear"] += max(0, effect.get("yearDelta", 0))
        next_session["meta"]["endYear"] += max(0, effect.get("endYearDelta", 0))
        next_session["player"]["wantedLevel"] = max(0, min(3, next_session["player"]["wantedLevel"] + effect.get("wantedLevelDelta", 0)))
        next_session["player"]["suspicion"] = max(
            0,
            min(999, next_session["player"]["suspicion"] + max(0, effect.get("wantedLevelDelta", 0) * 15)),
        )
        next_session["stats"]["eventCount"] += 1

        result_message = "事件处理完成。"
        if effect.get("creditsDelta", 0) > 0:
            result_message = f"你获得了 {effect['creditsDelta']:,} CR。"
        elif effect.get("yearDelta", 0) > 0:
            result_message = f"你额外消耗了 {effect['yearDelta']} 世界年份。"
        elif effect.get("endYearDelta", 0) > 0:
            result_message = f"终止年份延后了 {effect['endYearDelta']} 年。"
        elif effect.get("creditsDelta", 0) < 0:
            result_message = f"你损失了 {abs(effect['creditsDelta']):,} CR。"

        next_session["ui"]["encounter"]["result"] = {"success": True, "message": result_message}
        next_session = SessionEngine.check_failure_state(next_session)
        return {"session": next_session, "result": next_session["ui"]["encounter"]["result"]}

    def apply_frontend_finalize_encounter(self, session):
        years_elapsed = 0
        pending_action = session["ui"]["pendingAction"]
        if pending_action["type"] == "move" and not pending_action.get("baseYearsSettled", True):
            years_elapsed = pending_action.get("yearsCost") or 0

        next_session = SessionEngine.advance_world_state(session, years_elapsed)
        next_session["ui"]["pendingAction"] = {
            **next_session["ui"]["pendingAction"],
            "baseYearsSettled": True,
        }
        return next_session

    def test_start_session_is_deterministic_with_same_seed(self):
        left = self.create_session(42)
        right = self.create_session(42)
        self.assertEqual(left["stations"], right["stations"])
        self.assertEqual(left["routes"], right["routes"])
        self.assertEqual(left["goods"], right["goods"])
        self.assertEqual(left["warehouses"], right["warehouses"])
        self.assertEqual(left["player"], right["player"])
        self.assertEqual(left["stats"], right["stats"])
        self.assertEqual(left["ui"], right["ui"])
        self.assertEqual(left["meta"]["sessionId"], right["meta"]["sessionId"])
        self.assertEqual(left["meta"]["seed"], right["meta"]["seed"])
        self.assertEqual(left["meta"]["startYear"], right["meta"]["startYear"])
        self.assertEqual(left["meta"]["currentYear"], right["meta"]["currentYear"])
        self.assertEqual(left["meta"]["endYear"], right["meta"]["endYear"])
        self.assert_core_session_shape(left)

    def test_trade_buy_matches_expected_session_fields(self):
        session = self.create_session(100)
        station_id = session["player"]["currentStationId"]
        goods_id = session["stations"][station_id - 1]["inventory"][0]["goodsId"]

        result = SessionEngine.execute_trade(
            session,
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1, "tradeType": "buy"},
        )

        self.assertTrue(result["ok"])
        next_session = result["session"]
        self.assert_core_session_shape(next_session)
        self.assertEqual(next_session["stats"]["tradeCount"], 1)
        self.assertEqual(next_session["meta"]["currentYear"], 2101)
        self.assertEqual(next_session["player"]["cargo"][0]["goodsId"], goods_id)
        self.assertEqual(next_session["player"]["cargo"][0]["quantity"], 1)
        self.assertEqual(next_session["ui"]["pendingAction"]["type"], None)
        self.assertTrue(next_session["ui"]["ripple"]["affectedStationIds"])

    def test_trade_sell_matches_expected_session_fields(self):
        session = self.create_session(101)
        station_id = session["player"]["currentStationId"]
        goods_id = session["stations"][station_id - 1]["inventory"][0]["goodsId"]

        bought = SessionEngine.execute_trade(
            session,
            {"stationId": station_id, "goodsId": goods_id, "quantity": 2, "tradeType": "buy"},
        )["session"]
        sold = SessionEngine.execute_trade(
            bought,
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1, "tradeType": "sell"},
        )

        self.assertTrue(sold["ok"])
        sold_session = sold["session"]
        self.assertEqual(sold_session["stats"]["tradeCount"], 2)
        self.assertEqual(sold_session["player"]["cargo"][0]["quantity"], 1)

    def test_warehouse_roundtrip_matches_expected_fields(self):
        session = self.create_session(200)
        station_id = session["player"]["currentStationId"]
        goods_id = session["stations"][station_id - 1]["inventory"][0]["goodsId"]
        traded = SessionEngine.execute_trade(
            session,
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1, "tradeType": "buy"},
        )["session"]

        deposited = SessionEngine.deposit_to_warehouse(
            traded,
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1},
        )
        self.assertTrue(deposited["ok"])
        self.assertEqual(deposited["session"]["player"]["cargo"], [])
        self.assertEqual(deposited["session"]["warehouses"][str(station_id)][0]["goodsId"], goods_id)
        self.assertEqual(deposited["session"]["warehouses"][str(station_id)][0]["storedTurns"], 0)

        withdrawn = SessionEngine.withdraw_from_warehouse(
            deposited["session"],
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1},
        )
        self.assertTrue(withdrawn["ok"])
        self.assertEqual(withdrawn["session"]["player"]["cargo"][0]["goodsId"], goods_id)
        self.assertIn("taxPaid", withdrawn)

    def test_move_without_encounter_matches_frontend_shape(self):
        session = self.create_session(300)
        route = session["routes"][0]
        payload = {"stationId": route["from"], "targetStationId": route["to"], "yearsCost": route["travelCost"]}

        backend = SessionEngine.start_move(
            session,
            payload,
            RandomController(seed=session["meta"]["seed"], encounter_roll=0.9),
        )
        frontend_like = self.apply_frontend_start_move(session, payload, encounter_roll=0.9, encounter_index=0)

        self.assertTrue(backend["ok"])
        self.assertIsNone(backend["encounter"])
        self.assertEqual(backend["session"]["player"]["currentStationId"], route["to"])
        self.assertEqual(backend["session"]["ui"]["moveState"], "traveling")
        self.assert_paths_equal(
            frontend_like["session"],
            backend["session"],
            [
                ("player", "currentStationId"),
                ("player", "status"),
                ("ui", "moveState"),
                ("ui", "pendingAction"),
                ("ui", "selectedTargetStationId"),
                ("ui", "hoveredStationId"),
            ],
        )

    def test_move_with_encounter_resolve_and_finalize_matches_frontend_parity(self):
        session = self.create_session(400)
        route = session["routes"][0]
        payload = {"stationId": route["from"], "targetStationId": route["to"], "yearsCost": route["travelCost"]}

        moved = SessionEngine.start_move(
            session,
            payload,
            RandomController(seed=session["meta"]["seed"], encounter_roll=0.1, encounter_index=1),
        )
        self.assertTrue(moved["ok"])
        self.assertIsNotNone(moved["encounter"])

        moved_session = clone(moved["session"])
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

        backend_resolved = SessionEngine.resolve_encounter_choice(
            moved_session,
            1,
            moved_session["ui"]["pendingAction"],
        )
        frontend_resolved = self.apply_frontend_resolve_encounter(moved_session, 1)
        self.assertTrue(backend_resolved["ok"])
        self.assertEqual(backend_resolved["result"], frontend_resolved["result"])
        self.assert_paths_equal(
            frontend_resolved["session"],
            backend_resolved["session"],
            [
                ("player", "credits"),
                ("player", "wantedLevel"),
                ("player", "suspicion"),
                ("meta", "currentYear"),
                ("meta", "endYear"),
                ("stats", "eventCount"),
                ("ui", "encounter", "selectedChoiceId"),
                ("ui", "encounter", "isResolving"),
                ("ui", "encounter", "result"),
            ],
        )

        backend_finalized = SessionEngine.finalize_encounter_and_advance(backend_resolved["session"])
        frontend_finalized = self.apply_frontend_finalize_encounter(frontend_resolved["session"])
        self.assert_paths_equal(
            frontend_finalized,
            backend_finalized,
            [
                ("meta", "currentYear"),
                ("player", "wantedLevel"),
                ("player", "suspicion"),
                ("ui", "pendingAction", "baseYearsSettled"),
                ("ui", "encounter", "eventId"),
                ("ui", "encounter", "result"),
                ("ui", "moveState"),
            ],
        )

    def test_world_advance_updates_time_and_storage(self):
        session = self.create_session(500)
        station_id = session["player"]["currentStationId"]
        session["warehouses"][str(station_id)] = [{"goodsId": 1, "quantity": 2, "storedTurns": 0}]

        advanced = SessionEngine.advance_world_state(session, 3)
        self.assertEqual(advanced["meta"]["currentYear"], 2103)
        self.assertEqual(advanced["warehouses"][str(station_id)][0]["storedTurns"], 3)

    def test_known_trade_snapshot_matches_expected_business_values(self):
        session = self.create_session(600)
        station_id = session["player"]["currentStationId"]
        goods_id = session["stations"][station_id - 1]["inventory"][0]["goodsId"]
        unit_price = session["stations"][station_id - 1]["inventory"][0]["currentPrice"]

        result = SessionEngine.execute_trade(
            session,
            {"stationId": station_id, "goodsId": goods_id, "quantity": 1, "tradeType": "buy"},
        )
        self.assertTrue(result["ok"])
        next_session = result["session"]

        self.assertEqual(next_session["player"]["credits"], 10000 - unit_price)
        self.assertEqual(
            next_session["player"]["cargo"],
            [
                {
                    "goodsId": goods_id,
                    "goodsName": session["goods"][goods_id - 1]["name"],
                    "quantity": 1,
                    "avgCost": unit_price,
                    "isContraband": session["goods"][goods_id - 1]["isContraband"],
                }
            ],
        )
        self.assertEqual(next_session["meta"]["currentYear"], 2101)
        self.assertEqual(next_session["stats"]["tradeCount"], 1)


if __name__ == "__main__":
    unittest.main()

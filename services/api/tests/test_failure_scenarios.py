from __future__ import annotations

import sys
import types
import unittest

if "httpx" not in sys.modules:
    sys.modules["httpx"] = types.SimpleNamespace(post=lambda *args, **kwargs: None)
if "supabase" not in sys.modules:
    sys.modules["supabase"] = types.SimpleNamespace(Client=object)

from app.services import complete_practice_session


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, table_name: str, db: "FakeSupabase"):
        self.table_name = table_name
        self.db = db
        self._op = "select"

    def select(self, _fields):
        self._op = "select"
        return self

    def eq(self, _field, _value):
        return self

    def limit(self, _value):
        return self

    def update(self, _payload):
        self._op = "update"
        return self

    def execute(self):
        return FakeResult(self.db.rows_for(self.table_name, self._op))


class FakeSupabase:
    def __init__(self, rows):
        self._rows = rows

    def rows_for(self, table_name: str, op: str):
        return self._rows.get((table_name, op), [])

    def table(self, name):
        return FakeQuery(name, self)


class FailureScenarioTests(unittest.TestCase):
    def test_complete_session_returns_none_when_session_missing(self):
        supabase = FakeSupabase({("pg_mvp_practice_sessions", "select"): []})
        self.assertIsNone(complete_practice_session(supabase, "missing"))

    def test_malformed_numeric_values_fall_back_to_zero(self):
        supabase = FakeSupabase(
            {
                ("pg_mvp_practice_sessions", "select"): [
                    {
                        "id": "s1",
                        "drill_id": "d1",
                        "mode": "by_spot",
                        "difficulty": "beginner",
                        "status": "active",
                        "total_items": 10,
                        "answered_items": 2,
                        "started_at": "2026-02-28T00:00:00Z",
                        "completed_at": None,
                    }
                ],
                ("pg_mvp_practice_answers", "select"): [
                    {"correct": False, "ev_loss_bb100": "oops", "frequency_gap_pct": "oops", "decision_time_ms": "oops"}
                ],
                ("pg_mvp_practice_sessions", "update"): [
                    {
                        "id": "s1",
                        "drill_id": "d1",
                        "mode": "by_spot",
                        "difficulty": "beginner",
                        "status": "completed",
                        "total_items": 10,
                        "answered_items": 1,
                        "started_at": "2026-02-28T00:00:00Z",
                        "completed_at": "2026-02-28T00:10:00Z",
                    }
                ],
            }
        )

        result = complete_practice_session(supabase, "s1")

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.summary.totalEvLossBb100, 0.0)
        self.assertEqual(result.summary.averageFrequencyGapPct, 0.0)
        self.assertEqual(result.summary.averageDecisionTimeMs, 0)


if __name__ == "__main__":
    unittest.main()

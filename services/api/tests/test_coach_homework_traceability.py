from __future__ import annotations

import unittest
from copy import deepcopy
from uuid import uuid4

from app.schemas import CoachCreateDrillRequest
from app.services import coach_create_drill_action


class _FakeExecResult:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return self


class _FakeTable:
    def __init__(self, supabase: "_FakeSupabase", name: str):
        self._supabase = supabase
        self._name = name

    def insert(self, payload):
        self._supabase.insert_calls.append((self._name, deepcopy(payload)))
        if self._name == "pg_mvp_drills":
            row = deepcopy(payload)
            row["id"] = str(uuid4())
            row.setdefault("created_at", "2026-03-02T01:30:00+00:00")
            self._supabase.last_drill_row = row
            return _FakeExecResult([row])
        if self._name == "pg_mvp_drill_items":
            rows = []
            for item in payload:
                row = deepcopy(item)
                row.setdefault("id", str(uuid4()))
                rows.append(row)
            return _FakeExecResult(rows)
        raise AssertionError(f"unexpected table insert: {self._name}")

    def execute(self):
        return self


class _FakeSupabase:
    def __init__(self):
        self.insert_calls = []
        self.last_drill_row = None

    def table(self, name: str):
        return _FakeTable(self, name)


class CoachHomeworkTraceabilityTest(unittest.TestCase):
    def test_create_drill_keeps_mistake_cluster_lineage(self):
        supabase = _FakeSupabase()
        payload = CoachCreateDrillRequest(
            conversationId="conv-001",
            title="Fix over-bluff leaks",
            itemCount=5,
            sourceRefId="mistakes-summary-2026w09",
            mistakeCluster="over_bluff",
            sourceWindowDays=30,
            sourceSampleSize=42,
            sourceTotalEvLossBb100=128.4,
        )

        result = coach_create_drill_action(supabase, payload)

        self.assertFalse(isinstance(result, str))
        self.assertEqual(result.drill.traceability.mistakeCluster, "over_bluff")
        self.assertEqual(result.drill.traceability.sourceWindowDays, 30)
        self.assertEqual(result.drill.traceability.sourceSampleSize, 42)
        self.assertAlmostEqual(result.drill.traceability.sourceTotalEvLossBb100, 128.4)

        drill_insert = next(call for call in supabase.insert_calls if call[0] == "pg_mvp_drills")[1]
        self.assertEqual(drill_insert["mistake_cluster"], "over_bluff")
        self.assertEqual(drill_insert["source_window_days"], 30)
        self.assertEqual(drill_insert["source_sample_size"], 42)
        self.assertEqual(drill_insert["source_total_ev_loss_bb100"], 128.4)


if __name__ == "__main__":
    unittest.main()

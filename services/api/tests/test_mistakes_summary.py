from __future__ import annotations

import unittest

from app.services import build_mistakes_summary


class _FakeExecResult:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, data):
        self._data = data

    def select(self, *_args, **_kwargs):
        return self

    def gte(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        return _FakeExecResult(self._data)


class _FakeSupabase:
    def __init__(self, hands):
        self._hands = hands

    def table(self, name: str):
        if name != "pg_mvp_analyzed_hands":
            raise AssertionError(f"unexpected table: {name}")
        return _FakeTable(self._hands)


class MistakesSummaryServiceTest(unittest.TestCase):
    def test_groups_by_cluster_and_sorts_by_total_ev_loss(self):
        supabase = _FakeSupabase(
            [
                {
                    "tags": ["over_bluff"],
                    "ev_loss_bb100": 22.5,
                    "street": "turn",
                    "position": "BTN",
                },
                {
                    "tags": ["over_bluff", "size_mismatch"],
                    "ev_loss_bb100": 12.0,
                    "street": "river",
                    "position": "BB",
                },
                {
                    "tags": ["missed_value"],
                    "ev_loss_bb100": 9.0,
                    "street": "flop",
                    "position": "CO",
                },
            ],
        )

        response = build_mistakes_summary(supabase, window_days=30, limit=3)

        self.assertEqual(response.windowDays, 30)
        self.assertEqual(response.totalHands, 3)
        self.assertGreaterEqual(len(response.items), 2)
        self.assertEqual(response.items[0].cluster, "over_bluff")
        self.assertEqual(response.items[0].sampleSize, 2)
        self.assertAlmostEqual(response.items[0].totalEvLossBb100, 34.5)

    def test_empty_rows_returns_empty_items(self):
        response = build_mistakes_summary(_FakeSupabase([]), window_days=7, limit=5)
        self.assertEqual(response.windowDays, 7)
        self.assertEqual(response.totalHands, 0)
        self.assertEqual(response.items, [])


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import patch

if "httpx" not in sys.modules:
    sys.modules["httpx"] = types.ModuleType("httpx")
if "supabase" not in sys.modules:
    supabase_stub = types.ModuleType("supabase")
    supabase_stub.Client = object  # type: ignore[attr-defined]
    sys.modules["supabase"] = supabase_stub

from app import services


class FakeSupabase:
    def __init__(self, hands_rows: list[dict[str, object]]) -> None:
        self.hands_rows = hands_rows
        self.calls: dict[str, int] = {}
        self._active_table = ""

    def table(self, name: str) -> "FakeSupabase":
        self._active_table = name
        self.calls[name] = self.calls.get(name, 0) + 1
        return self

    def select(self, *_args, **_kwargs) -> "FakeSupabase":
        return self

    def order(self, *_args, **_kwargs) -> "FakeSupabase":
        return self

    def limit(self, *_args, **_kwargs) -> "FakeSupabase":
        return self

    def execute(self) -> SimpleNamespace:
        if self._active_table == "pg_mvp_analyzed_hands":
            return SimpleNamespace(data=self.hands_rows)
        return SimpleNamespace(data=[])


class HomeworkPersonalizationCacheTests(unittest.TestCase):
    def setUp(self) -> None:
        services.clear_homework_personalization_cache()

    def test_cache_miss_then_hit_then_ttl_expiry_recompute(self) -> None:
        fake_supabase = FakeSupabase(
            hands_rows=[
                {"street": "flop", "ev_loss_bb100": 18.0, "tags": ["over_bluff"]},
                {"street": "turn", "ev_loss_bb100": 9.0, "tags": ["over_fold"]},
            ],
        )

        start_ms = 10_000
        with patch.object(services, "_now_monotonic_ms") as mock_now:
            mock_now.return_value = start_ms
            first = services.get_admin_homework_personalization(fake_supabase)
            self.assertFalse(first.summary.cacheHit)
            self.assertEqual(first.summary.cacheAgeMs, 0)
            self.assertEqual(first.summary.cacheTtlMs, services._HOMEWORK_PERSONALIZATION_CACHE_TTL_MS)
            self.assertEqual(fake_supabase.calls.get("pg_mvp_analyzed_hands"), 1)

            mock_now.return_value = start_ms + 120
            second = services.get_admin_homework_personalization(fake_supabase)
            self.assertTrue(second.summary.cacheHit)
            self.assertEqual(second.summary.cacheAgeMs, 120)
            self.assertEqual(fake_supabase.calls.get("pg_mvp_analyzed_hands"), 1)

            mock_now.return_value = start_ms + services._HOMEWORK_PERSONALIZATION_CACHE_TTL_MS + 5
            third = services.get_admin_homework_personalization(fake_supabase)
            self.assertFalse(third.summary.cacheHit)
            self.assertEqual(third.summary.cacheAgeMs, 0)
            self.assertEqual(fake_supabase.calls.get("pg_mvp_analyzed_hands"), 2)


if __name__ == "__main__":
    unittest.main()

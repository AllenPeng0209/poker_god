from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest import TestCase
import sys
import types

sys.modules.setdefault("httpx", types.SimpleNamespace())
sys.modules.setdefault("supabase", types.SimpleNamespace(Client=object))

from app.services import ingest_events


class _Query:
    def __init__(self, table: "_Table") -> None:
        self.table = table
        self._fingerprints: list[str] = []

    def select(self, _fields: str) -> "_Query":
        return self

    def in_(self, _field: str, values: list[str]) -> "_Query":
        self._fingerprints = values
        return self

    def insert(self, rows: list[dict[str, Any]]) -> "_Query":
        self.table.rows.extend(rows)
        return self

    def execute(self):
        class _Result:
            def __init__(self, data: list[dict[str, Any]]) -> None:
                self.data = data

        existing = [
            {"event_fingerprint": row.get("event_fingerprint")}
            for row in self.table.rows
            if row.get("event_fingerprint") in self._fingerprints
        ]
        return _Result(existing)


class _Table:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def select(self, fields: str) -> _Query:
        return _Query(self).select(fields)

    def insert(self, rows: list[dict[str, Any]]) -> _Query:
        return _Query(self).insert(rows)


class _Supabase:
    def __init__(self) -> None:
        self.events = _Table()

    def table(self, name: str) -> _Table:
        assert name == "pg_mvp_events"
        return self.events


class AnalyticsEventDedupTests(TestCase):
    def test_ingest_events_deduplicates_event_id_and_hash(self) -> None:
        supabase = _Supabase()
        now = datetime.now(UTC)
        events = [
            {
                "eventName": "coach_message_sent",
                "eventTime": now,
                "sessionId": "s1",
                "route": "/app/reports",
                "module": "coach",
                "eventId": "evt-1",
                "payload": {"k": 1},
            },
            {
                "eventName": "coach_message_sent",
                "eventTime": now,
                "sessionId": "s1",
                "route": "/app/reports",
                "module": "coach",
                "eventId": "evt-1",
                "payload": {"k": 1},
            },
            {
                "eventName": "drill_started",
                "eventTime": now,
                "sessionId": "s1",
                "route": "/app/drills",
                "module": "practice",
                "payload": {"drillId": "d1"},
            },
            {
                "eventName": "drill_started",
                "eventTime": now,
                "sessionId": "s1",
                "route": "/app/drills",
                "module": "practice",
                "payload": {"drillId": "d1"},
            },
        ]

        accepted, deduplicated = ingest_events(supabase, events)

        self.assertEqual(accepted, 2)
        self.assertEqual(deduplicated, 2)
        self.assertEqual(len(supabase.events.rows), 2)

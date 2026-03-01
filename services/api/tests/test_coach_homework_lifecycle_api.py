from __future__ import annotations

import unittest

from app.schemas import CoachHomeworkCreateRequest, CoachHomeworkStatusUpdateRequest
from app.services import create_coach_homework, get_coach_homework, update_coach_homework_status


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, db: dict[str, list[dict]], name: str):
        self.db = db
        self.name = name
        self._rows = db.setdefault(name, [])
        self._eq_filters: list[tuple[str, object]] = []
        self._insert_payload = None
        self._update_payload = None

    def _apply_filters(self, rows: list[dict]) -> list[dict]:
        result = rows
        for key, value in self._eq_filters:
            result = [row for row in result if row.get(key) == value]
        return result

    def select(self, *_args, **_kwargs):
        return self

    def insert(self, payload: dict):
        self._insert_payload = payload
        return self

    def update(self, payload: dict):
        self._update_payload = payload
        return self

    def eq(self, key: str, value):
        self._eq_filters.append((key, value))
        return self

    def limit(self, _count: int):
        return self

    def execute(self):
        if self._insert_payload is not None:
            row = {
                "id": f"hw-{len(self._rows)+1}",
                "user_id": self._insert_payload["user_id"],
                "drill_id": self._insert_payload.get("drill_id"),
                "source_type": self._insert_payload["source_type"],
                "source_ref_id": self._insert_payload.get("source_ref_id"),
                "status": self._insert_payload.get("status", "queued"),
                "notes": self._insert_payload.get("notes"),
                "created_at": "2026-03-02T00:00:00Z",
                "updated_at": "2026-03-02T00:00:00Z",
                "completed_at": None,
            }
            self._rows.append(row)
            self._insert_payload = None
            return _FakeResult([row])

        if self._update_payload is not None:
            target = self._apply_filters(self._rows)
            if not target:
                self._update_payload = None
                return _FakeResult([])
            row = target[0]
            row.update(self._update_payload)
            self._update_payload = None
            return _FakeResult([row])

        return _FakeResult(self._apply_filters(self._rows))


class _FakeSupabase:
    def __init__(self):
        self.db: dict[str, list[dict]] = {"pg_mvp_coach_homeworks": []}

    def table(self, name: str):
        return _FakeTable(self.db, name)


class CoachHomeworkLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.supabase = _FakeSupabase()

    def test_create_get_and_complete_homework(self):
        created = create_coach_homework(
            self.supabase,
            CoachHomeworkCreateRequest(
                userId="user-1",
                sourceType="coach",
                sourceRefId="conv-1",
                notes="focus BTN vs BB",
            ),
        )
        homework_id = created.homework.id
        self.assertEqual(created.homework.status, "queued")

        started = update_coach_homework_status(
            self.supabase,
            homework_id,
            CoachHomeworkStatusUpdateRequest(status="in_progress"),
        )
        self.assertEqual(started.homework.status, "in_progress")

        completed = update_coach_homework_status(
            self.supabase,
            homework_id,
            CoachHomeworkStatusUpdateRequest(status="completed"),
        )
        self.assertEqual(completed.homework.status, "completed")

        loaded = get_coach_homework(self.supabase, homework_id)
        self.assertEqual(loaded.homework.id, homework_id)

    def test_invalid_transition_is_blocked(self):
        created = create_coach_homework(
            self.supabase,
            CoachHomeworkCreateRequest(userId="user-2", sourceType="manual"),
        )
        invalid = update_coach_homework_status(
            self.supabase,
            created.homework.id,
            CoachHomeworkStatusUpdateRequest(status="completed"),
        )
        self.assertIsInstance(invalid, str)
        self.assertIn("invalid transition", invalid)


if __name__ == "__main__":
    unittest.main()

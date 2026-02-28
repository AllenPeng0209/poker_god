from __future__ import annotations

import unittest

from app.schemas import CoachHomeworkCreateRequest, CoachHomeworkStatusUpdateRequest
from app.services import create_homework, update_homework_status


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, table_name: str, db: dict[str, list[dict]]):
        self.table_name = table_name
        self.db = db
        self._filters: dict[str, str] = {}
        self._insert_payload = None
        self._update_payload = None

    def insert(self, payload):
        self._insert_payload = payload
        return self

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self._filters[key] = value
        return self

    def limit(self, _n):
        return self

    def update(self, payload):
        self._update_payload = payload
        return self

    def execute(self):
        table = self.db.setdefault(self.table_name, [])
        if self._insert_payload is not None:
            row = {"id": "hw-1", **self._insert_payload}
            table.append(row)
            return _FakeResult([row])

        rows = [row for row in table if all(row.get(k) == v for k, v in self._filters.items())]
        if self._update_payload is not None and rows:
            rows[0].update(self._update_payload)
        return _FakeResult(rows)


class _FakeSupabase:
    def __init__(self):
        self.db: dict[str, list[dict]] = {}

    def table(self, name):
        return _FakeQuery(name, self.db)


class HomeworkLifecycleTest(unittest.TestCase):
    def test_create_homework_defaults_to_assigned(self):
        sb = _FakeSupabase()
        result = create_homework(
            sb,
            CoachHomeworkCreateRequest(
                userId="user-1",
                title="Fix BTN vs BB overfolding",
                sourceClusterId="cluster-overfold",
                createdBy="coach-admin",
            ),
        )
        self.assertEqual(result.homework.status, "assigned")
        self.assertEqual(result.homework.userId, "user-1")

    def test_invalid_transition_completed_to_in_progress_is_blocked(self):
        sb = _FakeSupabase()
        sb.db["pg_mvp_coach_homeworks"] = [
            {
                "id": "hw-2",
                "user_id": "user-2",
                "title": "River bluff catch drills",
                "status": "completed",
                "created_by": "coach-admin",
                "created_at": "2026-02-28T12:00:00Z",
                "updated_at": "2026-02-28T12:30:00Z",
            }
        ]
        result = update_homework_status(
            sb,
            "hw-2",
            CoachHomeworkStatusUpdateRequest(status="in_progress"),
        )
        self.assertIsInstance(result, str)
        assert isinstance(result, str)
        self.assertTrue(result.startswith("invalid_status_transition"))


if __name__ == "__main__":
    unittest.main()

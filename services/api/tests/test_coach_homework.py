from __future__ import annotations

import unittest
from copy import deepcopy
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import CoachHomeworkCreateRequest, CoachHomeworkStatusUpdateRequest
from app.services import (
    coach_create_homework_action,
    coach_list_homework_inbox,
    coach_update_homework_status,
)


class _Result:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, db: dict[str, list[dict]], name: str):
        self.db = db
        self.name = name
        self._rows = db.setdefault(name, [])
        self._filters: dict[str, str] = {}
        self._pending_insert = None
        self._pending_update = None

    def insert(self, payload):
        self._pending_insert = payload
        return self

    def select(self, _fields: str):
        return self

    def eq(self, key: str, value: str):
        self._filters[key] = value
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, _value: int):
        return self

    def update(self, payload):
        self._pending_update = payload
        return self

    def execute(self):
        if self._pending_insert is not None:
            row = deepcopy(self._pending_insert)
            row.setdefault("id", f"hw-{len(self._rows)+1}")
            row.setdefault("created_at", "2026-02-28T16:43:00+00:00")
            row.setdefault("updated_at", row["created_at"])
            self._rows.append(row)
            self._pending_insert = None
            return _Result([deepcopy(row)])

        rows = [deepcopy(r) for r in self._rows]
        for key, value in self._filters.items():
            rows = [r for r in rows if str(r.get(key)) == str(value)]

        if self._pending_update is not None:
            for index, raw in enumerate(self._rows):
                if all(str(raw.get(k)) == str(v) for k, v in self._filters.items()):
                    merged = deepcopy(raw)
                    merged.update(self._pending_update)
                    self._rows[index] = merged
                    self._pending_update = None
                    return _Result([deepcopy(merged)])
            self._pending_update = None
            return _Result([])

        return _Result(rows)


class _FakeSupabase:
    def __init__(self):
        self.db: dict[str, list[dict]] = {"pg_mvp_coach_homework_items": []}

    def table(self, name: str):
        return _FakeTable(self.db, name)


class CoachHomeworkServiceTests(unittest.TestCase):
    def test_create_and_list_homework(self):
        db = _FakeSupabase()
        created = coach_create_homework_action(
            db,
            CoachHomeworkCreateRequest(
                conversationId="conv-1",
                title="Fix BB defense",
                objective="Review flop check-raise node",
            ),
        )
        self.assertEqual(created.item.status, "pending")

        inbox = coach_list_homework_inbox(db, conversation_id="conv-1")
        self.assertEqual(inbox.total, 1)
        self.assertEqual(inbox.items[0].title, "Fix BB defense")

    def test_completed_homework_cannot_move_back(self):
        db = _FakeSupabase()
        db.db["pg_mvp_coach_homework_items"].append(
            {
                "id": "hw-1",
                "conversation_id": "conv-1",
                "title": "Done",
                "objective": "Done",
                "status": "completed",
                "created_at": "2026-02-28T16:43:00+00:00",
                "updated_at": "2026-02-28T16:43:00+00:00",
            }
        )
        result = coach_update_homework_status(
            db,
            item_id="hw-1",
            payload=CoachHomeworkStatusUpdateRequest(status="in_progress"),
        )
        self.assertIsInstance(result, str)
        self.assertIn("cannot move back", result)


class CoachHomeworkEndpointTests(unittest.TestCase):
    def test_not_found_status_update_returns_409(self):
        db = _FakeSupabase()
        with patch("app.main.get_supabase_client", return_value=db):
            client = TestClient(app)
            response = client.post(
                "/api/coach/homework/items/missing/status",
                json={"status": "in_progress"},
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "coach_homework_not_found")


if __name__ == "__main__":
    unittest.main()

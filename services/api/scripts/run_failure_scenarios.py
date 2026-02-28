from __future__ import annotations

from dataclasses import dataclass
import sys
import types

if "httpx" not in sys.modules:
    sys.modules["httpx"] = types.SimpleNamespace(post=lambda *args, **kwargs: None)
if "supabase" not in sys.modules:
    sys.modules["supabase"] = types.SimpleNamespace(Client=object)

from app.schemas import PracticeSubmitAnswerRequest
from app.services import complete_practice_session, submit_practice_answer


@dataclass
class ScenarioResult:
    name: str
    passed: bool
    detail: str


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

    def insert(self, _payload):
        self._op = "insert"
        return self

    def execute(self):
        return FakeResult(self.db.rows_for(self.table_name, self._op))


class FakeSupabase:
    def __init__(self, rows: dict[tuple[str, str], list[dict]]):
        self._rows = rows

    def rows_for(self, table_name: str, op: str) -> list[dict]:
        return self._rows.get((table_name, op), [])

    def table(self, table_name: str):
        return FakeQuery(table_name, self)


def run() -> int:
    results: list[ScenarioResult] = []

    missing_session_db = FakeSupabase(rows={("pg_mvp_practice_sessions", "select"): []})
    submit_result = submit_practice_answer(
        missing_session_db,
        "missing",
        PracticeSubmitAnswerRequest(itemId="i1", chosenAction="Call", decisionTimeMs=900),
    )
    results.append(
        ScenarioResult(
            "submit_answer_missing_session",
            submit_result is None,
            "submit_practice_answer returns None (API maps to session_not_found)",
        ),
    )

    complete_result = complete_practice_session(missing_session_db, "missing")
    results.append(
        ScenarioResult(
            "complete_session_missing_session",
            complete_result is None,
            "complete_practice_session returns None (API maps to session_not_found)",
        ),
    )

    malformed_answer_db = FakeSupabase(
        rows={
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
        },
    )

    try:
        response = complete_practice_session(malformed_answer_db, "s1")
        complete_safe = response is not None and response.summary.totalEvLossBb100 == 0.0
    except Exception:
        complete_safe = False

    results.append(
        ScenarioResult(
            "complete_session_malformed_numeric_payload",
            complete_safe,
            "malformed numeric rows degrade via safe parsers instead of crashing",
        ),
    )

    failed = [item for item in results if not item.passed]
    for item in results:
        status = "PASS" if item.passed else "FAIL"
        print(f"[{status}] {item.name}: {item.detail}")

    if failed:
        print(f"\nFailure scenarios failed: {len(failed)}")
        return 1

    print("\nAll failure scenarios passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())

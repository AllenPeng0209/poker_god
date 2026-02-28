from __future__ import annotations

from app.services import build_practice_session_diagnosis


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, _fields):
        return self

    def eq(self, _field, _value):
        return self

    def limit(self, _value):
        return self

    def execute(self):
        return FakeResult(self._rows)


class FakeSupabase:
    def __init__(self, session_rows, answer_rows):
        self._session_rows = session_rows
        self._answer_rows = answer_rows

    def table(self, name):
        if name == "pg_mvp_practice_sessions":
            return FakeQuery(self._session_rows)
        if name == "pg_mvp_practice_answers":
            return FakeQuery(self._answer_rows)
        raise AssertionError(f"unexpected table: {name}")


def test_build_practice_session_diagnosis_groups_top_mistakes():
    supabase = FakeSupabase(
        session_rows=[{"id": "s1", "drill_id": "d1"}],
        answer_rows=[
            {
                "chosen_action": "Check",
                "recommended_action": "Bet 33%",
                "correct": False,
                "ev_loss_bb100": 12.0,
                "frequency_gap_pct": 10.0,
            },
            {
                "chosen_action": "Check",
                "recommended_action": "Bet 33%",
                "correct": False,
                "ev_loss_bb100": 8.0,
                "frequency_gap_pct": 6.0,
            },
            {
                "chosen_action": "Call",
                "recommended_action": "Raise 3x",
                "correct": False,
                "ev_loss_bb100": 5.0,
                "frequency_gap_pct": 4.0,
            },
            {
                "chosen_action": "Bet 33%",
                "recommended_action": "Bet 33%",
                "correct": True,
                "ev_loss_bb100": 0.0,
                "frequency_gap_pct": 0.0,
            },
        ],
    )

    result = build_practice_session_diagnosis(supabase, "s1")

    assert result is not None
    assert result.diagnosis.sessionId == "s1"
    assert result.diagnosis.sampleSize == 4
    assert result.diagnosis.incorrectCount == 3
    assert result.diagnosis.accuracyPct == 25.0
    assert result.diagnosis.topMistakes[0].key == "check->bet 33%"
    assert result.diagnosis.topMistakes[0].count == 2
    assert result.diagnosis.topMistakes[0].avgEvLossBb100 == 10.0
    assert result.diagnosis.recommendedHomeworkFocus[0].startswith("Line drill")


def test_build_practice_session_diagnosis_empty_answers_returns_guidance():
    supabase = FakeSupabase(
        session_rows=[{"id": "s2", "drill_id": "d2"}],
        answer_rows=[],
    )

    result = build_practice_session_diagnosis(supabase, "s2")

    assert result is not None
    assert result.diagnosis.sampleSize == 0
    assert result.diagnosis.topMistakes == []
    assert result.diagnosis.recommendedHomeworkFocus == ["先完成至少 5 道题再生成诊断。"]

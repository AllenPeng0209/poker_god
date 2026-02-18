from __future__ import annotations

import hashlib
import json
import os
import time
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import httpx
from supabase import Client

from .config import Settings
from .schemas import (
    AnalyzeHandsResponse,
    AnalyzeUpload,
    AnalyzeUploadCreateRequest,
    AnalyzeUploadResponse,
    AnalyzedHand,
    CoachActionSuggestion,
    CoachChatRequest,
    CoachChatResponse,
    CoachCreateDrillRequest,
    CoachCreatePlanRequest,
    CoachCreatePlanResponse,
    CoachSection,
    Drill,
    DrillCreateRequest,
    DrillCreateResponse,
    DrillItem,
    DrillListResponse,
    LeakReportItem,
    LeakReportResponse,
    PracticeAnswerFeedback,
    PracticeCompleteSessionResponse,
    PracticeQuestion,
    PracticeSession,
    PracticeSessionStartRequest,
    PracticeSessionStartResponse,
    PracticeSessionSummary,
    PracticeSubmitAnswerRequest,
    PracticeSubmitAnswerResponse,
    StudySpot,
    StudySpotListResponse,
    StudySpotMatrixResponse,
    WeeklyPlan,
    ZenChatRequest,
    ZenChatResponse,
)


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def request_id() -> str:
    return str(uuid4())


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


_STUDY_SPOT_SEED: list[dict[str, Any]] = [
    {
        "id": "spot-001",
        "title": "SRP C-bet High Card Texture",
        "format": "Cash 6-max",
        "position": "BTN vs BB",
        "stackBb": 100,
        "street": "Flop",
        "node": {
            "nodeCode": "BTN_F_CBET_A74R",
            "board": "As 7d 4c",
            "hero": "BTN",
            "villain": "BB",
            "potBb": 6.5,
            "strategy": {
                "recommendedLine": "33% c-bet at mixed frequency",
                "aggregateEvBb": 1.38,
                "actionMix": [
                    {"action": "Bet 33%", "frequencyPct": 52, "evBb": 1.41},
                    {"action": "Check", "frequencyPct": 40, "evBb": 1.28},
                    {"action": "Bet 75%", "frequencyPct": 8, "evBb": 1.33},
                ],
            },
            "ranges": {
                "defenseFreqPct": 62,
                "buckets": [
                    {"bucket": "Value", "combos": 148, "frequencyPct": 31},
                    {"bucket": "Bluff", "combos": 122, "frequencyPct": 25},
                    {"bucket": "Protection", "combos": 96, "frequencyPct": 20},
                    {"bucket": "Check-back", "combos": 118, "frequencyPct": 24},
                ],
            },
            "breakdown": {
                "sampleSize": 8240,
                "avgEvLossBb100": 16.3,
                "confidence": "High",
                "leaks": [
                    {"label": "Over-check top pair weak kicker", "frequencyGapPct": 13, "evLossBb100": 6.2},
                    {"label": "Under-bluff wheel backdoors", "frequencyGapPct": 9, "evLossBb100": 4.1},
                ],
            },
        },
    },
    {
        "id": "spot-002",
        "title": "Delayed C-bet Double Barrel",
        "format": "Cash 6-max",
        "position": "CO vs BTN",
        "stackBb": 100,
        "street": "Turn",
        "node": {
            "nodeCode": "CO_T_DELAY_BRL_KJ5_9",
            "board": "Kd Jh 5s | 9c",
            "hero": "CO",
            "villain": "BTN",
            "potBb": 10.4,
            "strategy": {
                "recommendedLine": "Delay 60% turn stab after flop check-through",
                "aggregateEvBb": 1.02,
                "actionMix": [
                    {"action": "Bet 66%", "frequencyPct": 44, "evBb": 1.09},
                    {"action": "Bet 33%", "frequencyPct": 18, "evBb": 1.01},
                    {"action": "Check", "frequencyPct": 38, "evBb": 0.93},
                ],
            },
            "ranges": {
                "defenseFreqPct": 58,
                "buckets": [
                    {"bucket": "Merged value", "combos": 132, "frequencyPct": 29},
                    {"bucket": "Semi-bluff", "combos": 105, "frequencyPct": 23},
                    {"bucket": "Thin showdown", "combos": 119, "frequencyPct": 26},
                    {"bucket": "Air give-up", "combos": 101, "frequencyPct": 22},
                ],
            },
            "breakdown": {
                "sampleSize": 5660,
                "avgEvLossBb100": 19.8,
                "confidence": "Medium",
                "leaks": [
                    {"label": "Missed delayed stab vs capped ranges", "frequencyGapPct": 11, "evLossBb100": 5.7},
                    {"label": "Over-sized bluff region", "frequencyGapPct": 7, "evLossBb100": 3.6},
                ],
            },
        },
    },
    {
        "id": "spot-003",
        "title": "Turn XR Defense Node",
        "format": "Cash Heads-Up",
        "position": "BTN vs BB",
        "stackBb": 60,
        "street": "Turn",
        "node": {
            "nodeCode": "HU_BB_T_XR_DEF_Q83_6",
            "board": "Qs 8d 3h | 6h",
            "hero": "BB",
            "villain": "BTN",
            "potBb": 12.1,
            "strategy": {
                "recommendedLine": "Defend versus XR with condensed continue range",
                "aggregateEvBb": 0.74,
                "actionMix": [
                    {"action": "Call", "frequencyPct": 51, "evBb": 0.81},
                    {"action": "Jam", "frequencyPct": 12, "evBb": 0.88},
                    {"action": "Fold", "frequencyPct": 37, "evBb": 0.0},
                ],
            },
            "ranges": {
                "defenseFreqPct": 63,
                "buckets": [
                    {"bucket": "Strong draws", "combos": 86, "frequencyPct": 28},
                    {"bucket": "Top pair+", "combos": 102, "frequencyPct": 33},
                    {"bucket": "Pair+draw", "combos": 57, "frequencyPct": 18},
                    {"bucket": "Pure folds", "combos": 68, "frequencyPct": 21},
                ],
            },
            "breakdown": {
                "sampleSize": 3920,
                "avgEvLossBb100": 22.1,
                "confidence": "Medium",
                "leaks": [
                    {"label": "Under-jam nut draws", "frequencyGapPct": 8, "evLossBb100": 4.9},
                    {"label": "Over-fold middle pairs", "frequencyGapPct": 10, "evLossBb100": 5.4},
                ],
            },
        },
    },
    {
        "id": "spot-004",
        "title": "SB Open Pot Donk Response",
        "format": "Cash 6-max",
        "position": "SB vs BB",
        "stackBb": 40,
        "street": "Flop",
        "node": {
            "nodeCode": "SB_F_DONK_RESP_T96",
            "board": "Th 9s 6d",
            "hero": "BB",
            "villain": "SB",
            "potBb": 4.2,
            "strategy": {
                "recommendedLine": "Raise linear versus small donk sizing",
                "aggregateEvBb": 0.62,
                "actionMix": [
                    {"action": "Raise 3.5x", "frequencyPct": 34, "evBb": 0.71},
                    {"action": "Call", "frequencyPct": 46, "evBb": 0.60},
                    {"action": "Fold", "frequencyPct": 20, "evBb": 0.0},
                ],
            },
            "ranges": {
                "defenseFreqPct": 69,
                "buckets": [
                    {"bucket": "Value raises", "combos": 74, "frequencyPct": 27},
                    {"bucket": "Equity raises", "combos": 58, "frequencyPct": 21},
                    {"bucket": "Flat calls", "combos": 93, "frequencyPct": 34},
                    {"bucket": "Folds", "combos": 49, "frequencyPct": 18},
                ],
            },
            "breakdown": {
                "sampleSize": 4410,
                "avgEvLossBb100": 14.9,
                "confidence": "High",
                "leaks": [
                    {"label": "Passive continue with combo draws", "frequencyGapPct": 12, "evLossBb100": 4.4},
                    {"label": "Over-fold weak pair+gutshot", "frequencyGapPct": 6, "evLossBb100": 2.8},
                ],
            },
        },
    },
    {
        "id": "spot-005",
        "title": "Short Stack Jam or Fold",
        "format": "MTT 9-max",
        "position": "UTG vs BB",
        "stackBb": 20,
        "street": "River",
        "node": {
            "nodeCode": "MTT_UTG_R_JAM_20BB",
            "board": "Jc 7c 4s | Td | 2h",
            "hero": "UTG",
            "villain": "BB",
            "potBb": 8.9,
            "strategy": {
                "recommendedLine": "Polar jam with blocker-heavy misses",
                "aggregateEvBb": 0.29,
                "actionMix": [
                    {"action": "Jam", "frequencyPct": 41, "evBb": 0.42},
                    {"action": "Check", "frequencyPct": 59, "evBb": 0.20},
                ],
            },
            "ranges": {
                "defenseFreqPct": 47,
                "buckets": [
                    {"bucket": "Nut value", "combos": 39, "frequencyPct": 18},
                    {"bucket": "Thin value", "combos": 52, "frequencyPct": 24},
                    {"bucket": "Blocker bluffs", "combos": 44, "frequencyPct": 20},
                    {"bucket": "Check-back", "combos": 82, "frequencyPct": 38},
                ],
            },
            "breakdown": {
                "sampleSize": 2870,
                "avgEvLossBb100": 24.6,
                "confidence": "Low",
                "leaks": [
                    {"label": "Missed river jam with ace blockers", "frequencyGapPct": 15, "evLossBb100": 7.3},
                    {"label": "Over-jam thin value", "frequencyGapPct": 5, "evLossBb100": 2.9},
                ],
            },
        },
    },
    {
        "id": "spot-006",
        "title": "ICM Turn Probe Defense",
        "format": "MTT 9-max",
        "position": "CO vs BTN",
        "stackBb": 40,
        "street": "Turn",
        "node": {
            "nodeCode": "ICM_CO_T_PROBE_DEF_A95_J",
            "board": "Ac 9h 5d | Js",
            "hero": "BTN",
            "villain": "CO",
            "potBb": 7.6,
            "strategy": {
                "recommendedLine": "Tighten bluff raises, keep high-equity calls",
                "aggregateEvBb": 0.55,
                "actionMix": [
                    {"action": "Call", "frequencyPct": 49, "evBb": 0.61},
                    {"action": "Raise 2.8x", "frequencyPct": 16, "evBb": 0.58},
                    {"action": "Fold", "frequencyPct": 35, "evBb": 0.0},
                ],
            },
            "ranges": {
                "defenseFreqPct": 57,
                "buckets": [
                    {"bucket": "Top pair+", "combos": 91, "frequencyPct": 34},
                    {"bucket": "Draw continues", "combos": 63, "frequencyPct": 23},
                    {"bucket": "Delayed floats", "combos": 47, "frequencyPct": 18},
                    {"bucket": "Folds", "combos": 67, "frequencyPct": 25},
                ],
            },
            "breakdown": {
                "sampleSize": 3110,
                "avgEvLossBb100": 18.1,
                "confidence": "Medium",
                "leaks": [
                    {"label": "Raise frequency too high under ICM", "frequencyGapPct": 9, "evLossBb100": 4.8},
                    {"label": "Under-defend nut flush draws", "frequencyGapPct": 7, "evLossBb100": 3.1},
                ],
            },
        },
    },
    {
        "id": "spot-007",
        "title": "Triple Barrel Bluff Catch",
        "format": "Cash Heads-Up",
        "position": "BTN vs BB",
        "stackBb": 100,
        "street": "River",
        "node": {
            "nodeCode": "HU_BB_R_BLUFF_CATCH_8T5_2_A",
            "board": "8s Td 5h | 2d | As",
            "hero": "BB",
            "villain": "BTN",
            "potBb": 20.7,
            "strategy": {
                "recommendedLine": "Prioritize blocker-driven bluff catches",
                "aggregateEvBb": 0.18,
                "actionMix": [
                    {"action": "Call", "frequencyPct": 43, "evBb": 0.31},
                    {"action": "Fold", "frequencyPct": 57, "evBb": 0.0},
                ],
            },
            "ranges": {
                "defenseFreqPct": 41,
                "buckets": [
                    {"bucket": "Nut bluff-catch", "combos": 28, "frequencyPct": 16},
                    {"bucket": "Marginal bluff-catch", "combos": 46, "frequencyPct": 25},
                    {"bucket": "Pure folds", "combos": 109, "frequencyPct": 59},
                ],
            },
            "breakdown": {
                "sampleSize": 4870,
                "avgEvLossBb100": 21.4,
                "confidence": "High",
                "leaks": [
                    {"label": "Over-fold ace blockers", "frequencyGapPct": 12, "evLossBb100": 6.5},
                    {"label": "Over-call weak bluff catchers", "frequencyGapPct": 4, "evLossBb100": 2.1},
                ],
            },
        },
    },
    {
        "id": "spot-008",
        "title": "Low Board Small Bet Strategy",
        "format": "Cash 6-max",
        "position": "UTG vs BB",
        "stackBb": 60,
        "street": "Flop",
        "node": {
            "nodeCode": "UTG_F_SMALL_BET_652R",
            "board": "6c 5d 2s",
            "hero": "UTG",
            "villain": "BB",
            "potBb": 5.4,
            "strategy": {
                "recommendedLine": "High-frequency small c-bet with overpairs + overcards",
                "aggregateEvBb": 1.11,
                "actionMix": [
                    {"action": "Bet 25%", "frequencyPct": 67, "evBb": 1.18},
                    {"action": "Check", "frequencyPct": 33, "evBb": 0.97},
                ],
            },
            "ranges": {
                "defenseFreqPct": 66,
                "buckets": [
                    {"bucket": "Thin value", "combos": 124, "frequencyPct": 32},
                    {"bucket": "Board coverage bluffs", "combos": 133, "frequencyPct": 34},
                    {"bucket": "Check-back protections", "combos": 81, "frequencyPct": 21},
                    {"bucket": "Trap checks", "combos": 51, "frequencyPct": 13},
                ],
            },
            "breakdown": {
                "sampleSize": 7050,
                "avgEvLossBb100": 13.7,
                "confidence": "High",
                "leaks": [
                    {"label": "Too many flop checks with overcards", "frequencyGapPct": 10, "evLossBb100": 4.2},
                    {"label": "Under-bluff wheel gutters", "frequencyGapPct": 8, "evLossBb100": 3.4},
                ],
            },
        },
    },
    {
        "id": "spot-200-001",
        "title": "200bb BTN vs BB Deep SRP Probe",
        "format": "Cash 6-max",
        "position": "BTN vs BB",
        "stackBb": 200,
        "street": "Flop",
        "node": {
            "nodeCode": "DEEP200_BTN_BB_F_PROBE_K83R",
            "board": "Ks 8d 3c",
            "hero": "BTN",
            "villain": "BB",
            "potBb": 6.5,
            "strategy": {
                "recommendedLine": "Mix small c-bet and check with capped turn plans",
                "aggregateEvBb": 1.46,
                "actionMix": [
                    {"action": "Bet 33%", "frequencyPct": 47, "evBb": 1.52},
                    {"action": "Check", "frequencyPct": 38, "evBb": 1.34},
                    {"action": "Bet 75%", "frequencyPct": 15, "evBb": 1.41},
                ],
            },
            "ranges": {
                "defenseFreqPct": 64,
                "buckets": [
                    {"bucket": "Value", "combos": 156, "frequencyPct": 33},
                    {"bucket": "Semi-bluff", "combos": 118, "frequencyPct": 25},
                    {"bucket": "Delay-check", "combos": 132, "frequencyPct": 28},
                    {"bucket": "Backdoor give-up", "combos": 64, "frequencyPct": 14},
                ],
            },
            "breakdown": {
                "sampleSize": 9180,
                "avgEvLossBb100": 14.6,
                "confidence": "High",
                "leaks": [
                    {"label": "Over-delay turn on strong top pairs", "frequencyGapPct": 9, "evLossBb100": 4.1},
                    {"label": "Under-bluff low backdoor combos", "frequencyGapPct": 8, "evLossBb100": 3.6},
                ],
            },
        },
    },
    {
        "id": "spot-200-002",
        "title": "200bb CO vs BTN Turn Pressure",
        "format": "Cash 6-max",
        "position": "CO vs BTN",
        "stackBb": 200,
        "street": "Turn",
        "node": {
            "nodeCode": "DEEP200_CO_BTN_T_PRESS_QJ6_4",
            "board": "Qh Jd 6s | 4c",
            "hero": "CO",
            "villain": "BTN",
            "potBb": 11.8,
            "strategy": {
                "recommendedLine": "Keep medium sizing as baseline, polarize checks",
                "aggregateEvBb": 1.08,
                "actionMix": [
                    {"action": "Bet 66%", "frequencyPct": 42, "evBb": 1.16},
                    {"action": "Check", "frequencyPct": 34, "evBb": 0.96},
                    {"action": "Bet 125%", "frequencyPct": 24, "evBb": 1.09},
                ],
            },
            "ranges": {
                "defenseFreqPct": 59,
                "buckets": [
                    {"bucket": "Merged value", "combos": 143, "frequencyPct": 31},
                    {"bucket": "High-equity bluffs", "combos": 101, "frequencyPct": 22},
                    {"bucket": "Pot-control checks", "combos": 121, "frequencyPct": 26},
                    {"bucket": "Folds", "combos": 98, "frequencyPct": 21},
                ],
            },
            "breakdown": {
                "sampleSize": 6720,
                "avgEvLossBb100": 18.7,
                "confidence": "Medium",
                "leaks": [
                    {"label": "Under-polarize on dynamic turns", "frequencyGapPct": 10, "evLossBb100": 5.0},
                    {"label": "Over-barrel dominated top-pair", "frequencyGapPct": 6, "evLossBb100": 2.9},
                ],
            },
        },
    },
    {
        "id": "spot-200-003",
        "title": "200bb SB vs BB Deep Check-Raise Defense",
        "format": "Cash 6-max",
        "position": "SB vs BB",
        "stackBb": 200,
        "street": "Turn",
        "node": {
            "nodeCode": "DEEP200_SB_BB_T_XR_DEF_974_A",
            "board": "9s 7h 4d | Ac",
            "hero": "BB",
            "villain": "SB",
            "potBb": 9.6,
            "strategy": {
                "recommendedLine": "Defend with high-equity draws, fold capped bluff-catchers",
                "aggregateEvBb": 0.71,
                "actionMix": [
                    {"action": "Call", "frequencyPct": 49, "evBb": 0.81},
                    {"action": "Raise 2.8x", "frequencyPct": 17, "evBb": 0.89},
                    {"action": "Fold", "frequencyPct": 34, "evBb": 0.0},
                ],
            },
            "ranges": {
                "defenseFreqPct": 66,
                "buckets": [
                    {"bucket": "Strong continues", "combos": 118, "frequencyPct": 32},
                    {"bucket": "Raise mix", "combos": 62, "frequencyPct": 17},
                    {"bucket": "Marginal bluff-catch", "combos": 73, "frequencyPct": 20},
                    {"bucket": "Pure folds", "combos": 116, "frequencyPct": 31},
                ],
            },
            "breakdown": {
                "sampleSize": 5480,
                "avgEvLossBb100": 20.4,
                "confidence": "Medium",
                "leaks": [
                    {"label": "Over-fold nut gutshots + overcards", "frequencyGapPct": 11, "evLossBb100": 5.6},
                    {"label": "Under-raise pair + draw combos", "frequencyGapPct": 7, "evLossBb100": 3.3},
                ],
            },
        },
    },
]


def _build_default_drill_items(count: int) -> list[dict[str, Any]]:
    total = max(3, min(count, 40))
    rows: list[dict[str, Any]] = []
    for index in range(total):
        bucket = index % 4
        if bucket == 0:
            recommended_action = "Bet 33%"
            prompt = "BTN vs BB single-raised pot, flop A72r, hero in-position. 你的主线动作是什么？"
        elif bucket == 1:
            recommended_action = "Check"
            prompt = "CO vs BTN 3-bet pot, turn pairing card, OOP should choose what baseline action?"
        elif bucket == 2:
            recommended_action = "Call"
            prompt = "SB vs BB flop check-raise facing c-bet. 这一类中等强度牌常规处理？"
        else:
            recommended_action = "Raise 3x"
            prompt = "River bluff-catcher spot against polar bet. Which option protects EV best?"

        rows.append(
            {
                "id": str(uuid4()),
                "sort_index": index,
                "prompt": prompt,
                "options": ["Fold", "Call", "Check", "Bet 33%", "Raise 3x"],
                "recommended_action": recommended_action,
                "ev_loss_bb100": max(2, min(20, 4 + bucket * 2 + (index % 3))),
                "frequency_gap_pct": max(3, min(22, 6 + bucket * 3 + (index % 2))),
            },
        )
    return rows


def _drill_from_rows(drill_row: dict[str, Any], item_rows: list[dict[str, Any]]) -> Drill:
    item_rows_sorted = sorted(item_rows, key=lambda row: _safe_int(row.get("sort_index")))
    return Drill(
        id=str(drill_row["id"]),
        title=str(drill_row["title"]),
        sourceType=str(drill_row["source_type"]),  # type: ignore[arg-type]
        sourceRefId=drill_row.get("source_ref_id"),
        tags=list(drill_row.get("tags") or []),
        itemCount=_safe_int(drill_row.get("item_count")),
        createdAt=str(drill_row.get("created_at")),
        items=[
            DrillItem(
                id=str(item["id"]),
                prompt=str(item["prompt"]),
                options=list(item.get("options") or []),
                recommendedAction=str(item["recommended_action"]),
                evLossBb100=_safe_float(item.get("ev_loss_bb100")),
                frequencyGapPct=_safe_float(item.get("frequency_gap_pct")),
            )
            for item in item_rows_sorted
        ],
    )


def ensure_seed_drill(supabase: Client) -> None:
    existing = supabase.table("pg_mvp_drills").select("id").limit(1).execute().data or []
    if existing:
        return

    create_drill(
        supabase,
        DrillCreateRequest(
            title="BTN vs BB C-bet Foundation",
            sourceType="study",
            sourceRefId="seed-study-001",
            tags=["btn_vs_bb", "flop_cbet"],
            itemCount=8,
        ),
    )


def list_drills(supabase: Client) -> DrillListResponse:
    ensure_seed_drill(supabase)
    rid = request_id()
    drill_rows = (
        supabase.table("pg_mvp_drills")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )

    drill_ids = [str(row["id"]) for row in drill_rows]
    items_by_drill: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if drill_ids:
        item_rows = (
            supabase.table("pg_mvp_drill_items")
            .select("*")
            .in_("drill_id", drill_ids)
            .order("sort_index")
            .execute()
            .data
            or []
        )
        for row in item_rows:
            items_by_drill[str(row["drill_id"])].append(row)

    drills = [_drill_from_rows(row, items_by_drill.get(str(row["id"]), [])) for row in drill_rows]
    return DrillListResponse(requestId=rid, drills=drills)


def _ensure_seed_study_spots(supabase: Client) -> None:
    try:
        existing = supabase.table("pg_mvp_study_spots").select("id").limit(1).execute().data or []
    except Exception:
        return
    if existing:
        return

    rows = []
    for spot in _STUDY_SPOT_SEED:
        rows.append(
            {
                "id": spot["id"],
                "title": spot["title"],
                "format": spot["format"],
                "position": spot["position"],
                "stack_bb": spot["stackBb"],
                "street": spot["street"],
                "node": spot["node"],
            },
        )
    try:
        supabase.table("pg_mvp_study_spots").insert(rows).execute()
    except Exception:
        # Keep read path alive with in-memory fallback even when table/schema is missing.
        return


_STREET_TO_INDEX = {
    "Flop": 1,
    "Turn": 2,
    "River": 3,
}

_INDEX_TO_STREET = {
    1: "Flop",
    2: "Turn",
    3: "River",
}

_MATRIX_RANKS: tuple[str, ...] = ("A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2")
_RANK_TO_VALUE: dict[str, int] = {
    "A": 14,
    "K": 13,
    "Q": 12,
    "J": 11,
    "T": 10,
    "9": 9,
    "8": 8,
    "7": 7,
    "6": 6,
    "5": 5,
    "4": 4,
    "3": 3,
    "2": 2,
}

_ROBOPOKER_DEFAULT_FORMAT = "Cash 6-max"
_ROBOPOKER_DEFAULT_POSITION = "BTN vs BB"
_ROBOPOKER_DEFAULT_STACK_BB = 100

_EDGE_ACTION_LABELS = {
    1: "Fold",
    2: "Check",
    3: "Call",
    5: "Shove",
    22: "Open 2BB",
    30: "Open 3BB",
    38: "Open 4BB",
    70: "Open 8BB",
    2060: "Raise 1x pot",
    2068: "Raise 2x pot",
    4108: "Raise 1/2 pot",
    4124: "Raise 3/2 pot",
    6156: "Raise 1/3 pot",
    6164: "Raise 2/3 pot",
}


def _edge_action_label(edge: int) -> str:
    return _EDGE_ACTION_LABELS.get(edge, f"Edge {edge}")


def _action_bucket(action: str) -> str:
    lowered = action.strip().lower()
    if lowered == "fold":
        return "fold"
    if lowered in {"check", "call"}:
        return "passive"
    return "aggressive"


def _street_total_combos(street_index: int) -> int:
    # Shortdeck combo-count approximation used for range bucket rendering.
    if street_index == 1:
        return 465
    if street_index == 2:
        return 435
    return 406


def _robopoker_dataset_meta() -> tuple[str, str, int]:
    dataset_format = os.getenv("ROBOPOKER_FORMAT", _ROBOPOKER_DEFAULT_FORMAT).strip() or _ROBOPOKER_DEFAULT_FORMAT
    dataset_position = os.getenv("ROBOPOKER_POSITION", _ROBOPOKER_DEFAULT_POSITION).strip() or _ROBOPOKER_DEFAULT_POSITION
    stack_raw = os.getenv("ROBOPOKER_STACK_BB")
    dataset_stack = _safe_int(stack_raw, _ROBOPOKER_DEFAULT_STACK_BB) if stack_raw is not None else _ROBOPOKER_DEFAULT_STACK_BB
    if dataset_stack <= 0:
        dataset_stack = _ROBOPOKER_DEFAULT_STACK_BB
    return dataset_format, dataset_position, dataset_stack


def _position_actors(position: str) -> tuple[str, str]:
    if " vs " not in position:
        return ("BTN", "BB")
    hero, villain = [part.strip() for part in position.split(" vs ", 1)]
    if not hero or not villain:
        return ("BTN", "BB")
    return (hero, villain)


def _spot_confidence(sample_size: int) -> str:
    if sample_size >= 150:
        return "High"
    if sample_size >= 50:
        return "Medium"
    return "Low"


def _build_spot_leaks(aggressive_pct: float, passive_pct: float, fold_pct: float, ev_loss: float) -> list[dict[str, float | str]]:
    leaks: list[dict[str, float | str]] = []
    if fold_pct > 42:
        gap = fold_pct - 35
        leaks.append(
            {
                "label": "Over-folding against pressure",
                "frequencyGapPct": round(gap, 1),
                "evLossBb100": round(max(1.0, gap * 0.45 + ev_loss * 0.08), 1),
            },
        )
    if aggressive_pct < 24:
        gap = 24 - aggressive_pct
        leaks.append(
            {
                "label": "Under-aggression in value/bluff mix",
                "frequencyGapPct": round(gap, 1),
                "evLossBb100": round(max(0.8, gap * 0.35 + ev_loss * 0.06), 1),
            },
        )
    if passive_pct > 62:
        gap = passive_pct - 55
        leaks.append(
            {
                "label": "Over-passive continue range",
                "frequencyGapPct": round(gap, 1),
                "evLossBb100": round(max(0.7, gap * 0.28 + ev_loss * 0.05), 1),
            },
        )
    if not leaks:
        leaks.append(
            {
                "label": "Action mix still converging",
                "frequencyGapPct": round(max(2.0, ev_loss * 0.1), 1),
                "evLossBb100": round(max(0.5, ev_loss * 0.15), 1),
            },
        )
    return leaks[:2]


def _board_from_seed(street_index: int, present: int, past: int, choices: int) -> str:
    total_cards = {1: 3, 2: 4, 3: 5}.get(street_index, 3)
    ranks = "AKQJT98765432"
    suits = "shdc"
    deck = [f"{rank}{suit}" for rank in ranks for suit in suits]
    state = int(hashlib.sha256(f"{present}:{past}:{choices}:{street_index}".encode()).hexdigest()[:16], 16)
    cards: list[str] = []
    for _ in range(total_cards):
        idx = state % len(deck)
        cards.append(deck.pop(idx))
        state = (state * 1103515245 + 12345) & 0xFFFFFFFFFFFFFFFF
    if total_cards == 3:
        return f"{cards[0]} {cards[1]} {cards[2]}"
    if total_cards == 4:
        return f"{cards[0]} {cards[1]} {cards[2]} | {cards[3]}"
    return f"{cards[0]} {cards[1]} {cards[2]} | {cards[3]} | {cards[4]}"


def _build_matrix_hands() -> list[str]:
    hands: list[str] = []
    for row_index, row_rank in enumerate(_MATRIX_RANKS):
        for col_index, col_rank in enumerate(_MATRIX_RANKS):
            if row_index == col_index:
                hands.append(f"{row_rank}{col_rank}")
            elif row_index < col_index:
                hands.append(f"{row_rank}{col_rank}s")
            else:
                hands.append(f"{col_rank}{row_rank}o")
    return hands


_MATRIX_HANDS = _build_matrix_hands()


def _hand_strength(hand: str) -> float:
    first = hand[0:1]
    second = hand[1:2]
    first_value = _RANK_TO_VALUE.get(first, 2)
    second_value = _RANK_TO_VALUE.get(second, 2)
    suited = hand.endswith("s")
    pair = first == second
    high = max(first_value, second_value)
    low = min(first_value, second_value)
    gap = high - low

    if pair:
        return max(0.0, min(1.0, 0.58 + ((high - 2) / 12.0) * 0.42))

    connected_bonus = max(0.0, min(0.1, 0.1 - gap * 0.016))
    suited_bonus = 0.085 if suited else 0.0
    base = (high / 14.0) * 0.52 + (low / 14.0) * 0.31 + connected_bonus + suited_bonus
    return max(0.0, min(0.98, base))


def _board_texture_bias(board: str) -> float:
    tokens = [token for token in board.replace("|", " ").split(" ") if token]
    cards = [token for token in tokens if len(token) >= 2 and token[0:1].upper() in _RANK_TO_VALUE]
    if not cards:
        return 0.0

    ranks = [_RANK_TO_VALUE.get(card[0:1].upper(), 2) for card in cards]
    suits = [card[1:2].lower() for card in cards]
    high_card_count = len([rank for rank in ranks if rank >= 11])
    duplicate_count = len(ranks) - len(set(ranks))
    max_suit_count = 0
    for suit in ("s", "h", "d", "c"):
        max_suit_count = max(max_suit_count, len([value for value in suits if value == suit]))

    sorted_ranks = sorted(set(ranks))
    gaps = 0
    for index in range(1, len(sorted_ranks)):
        gaps += max(0, sorted_ranks[index] - sorted_ranks[index - 1] - 1)

    bias = 0.0
    bias += high_card_count * 0.055
    bias += 0.08 if max_suit_count >= 3 else 0.02 if max_suit_count >= 2 else 0.0
    bias -= duplicate_count * 0.07
    bias -= 0.03 if gaps <= 1 else 0.0
    return max(-0.22, min(0.22, bias))


def _normalize_frequencies(weights: list[float]) -> list[float]:
    if not weights:
        return []
    safe_weights = [max(0.0, weight) for weight in weights]
    total = sum(safe_weights)
    if total <= 0:
        equal = round(100.0 / len(safe_weights), 1)
        rounded = [equal for _ in safe_weights]
    else:
        rounded = [round((weight / total) * 100.0, 1) for weight in safe_weights]
    drift = round(100.0 - sum(rounded), 1)
    if rounded:
        max_index = max(range(len(rounded)), key=lambda idx: rounded[idx])
        rounded[max_index] = round(rounded[max_index] + drift, 1)
    return rounded


def _extract_spot_actions(spot: StudySpot) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for item in spot.node.strategy.actionMix:
        action = str(item.action).strip()
        key = action.lower()
        if not action or key in seen:
            continue
        seen.add(key)
        deduped.append(action)
    if not deduped:
        deduped = ["Raise", "Call", "Fold"]
    return deduped[:4]


def _base_action_mix(spot: StudySpot, actions: list[str]) -> dict[str, float]:
    raw_map: dict[str, float] = {action: 0.0 for action in actions}
    for item in spot.node.strategy.actionMix:
        action = str(item.action).strip()
        if action in raw_map:
            raw_map[action] += max(0.0, _safe_float(item.frequencyPct))
    if sum(raw_map.values()) <= 0:
        equal = 100.0 / max(1, len(actions))
        return {action: equal for action in actions}
    normalized = _normalize_frequencies([raw_map[action] for action in actions])
    return {action: normalized[index] for index, action in enumerate(actions)}


def _build_hand_strategy_for_spot(spot: StudySpot) -> tuple[list[str], list[dict[str, Any]]]:
    actions = _extract_spot_actions(spot)
    base_mix = _base_action_mix(spot, actions)
    texture_bias = _board_texture_bias(spot.node.board)

    hands: list[dict[str, Any]] = []
    for hand in _MATRIX_HANDS:
        strength = _hand_strength(hand)
        centered = (strength - 0.5) * 2.0
        weights: list[float] = []
        for action in actions:
            tone = _action_bucket(action)
            if tone == "aggressive":
                factor = max(0.15, min(1.85, 1.0 + centered * 0.56 + texture_bias * 0.35))
            elif tone == "passive":
                factor = max(0.2, min(1.45, 1.0 - abs(centered) * 0.34 + (0.14 if centered < 0 else 0.02)))
            else:
                factor = max(0.12, min(1.95, 1.0 - centered * 0.62 - texture_bias * 0.18))
            weights.append(base_mix[action] * factor)

        frequencies = _normalize_frequencies(weights)
        hand_frequencies = [
            {
                "action": action,
                "frequencyPct": frequencies[index],
            }
            for index, action in enumerate(actions)
        ]
        aggression_pct = round(
            sum(
                item["frequencyPct"]
                for item in hand_frequencies
                if _action_bucket(str(item["action"])) != "fold"
            ),
            1,
        )
        hands.append(
            {
                "hand": hand,
                "frequencies": hand_frequencies,
                "aggressionPct": aggression_pct,
            },
        )

    return actions, hands


def _list_study_spots_from_robopoker(
    format_filter: str | None,
    position_filter: str | None,
    stack_bb: int | None,
    street_filter: str | None,
    limit: int,
    offset: int,
) -> StudySpotListResponse | None:
    db_url = os.getenv("ROBOPOKER_DB_URL", "").strip()
    if not db_url:
        return None
    dataset_format, dataset_position, dataset_stack_bb = _robopoker_dataset_meta()
    hero, villain = _position_actors(dataset_position)
    # Bridge one training slice into a stable UI filter tuple.
    if format_filter and format_filter != dataset_format:
        return StudySpotListResponse(requestId=request_id(), total=0, spots=[])
    if position_filter and position_filter != dataset_position:
        return StudySpotListResponse(requestId=request_id(), total=0, spots=[])
    if stack_bb and stack_bb != dataset_stack_bb:
        return StudySpotListResponse(requestId=request_id(), total=0, spots=[])

    street_index = _STREET_TO_INDEX.get(street_filter) if street_filter else None
    if street_filter and street_index is None:
        return StudySpotListResponse(requestId=request_id(), total=0, spots=[])

    try:
        import psycopg
    except Exception:
        return None

    rid = request_id()
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    where_clauses = ["((present >> 8) & 255) BETWEEN 1 AND 3"]
    params: list[Any] = []
    if street_index is not None:
        where_clauses.append("((present >> 8) & 255) = %s")
        params.append(street_index)
    where_sql = " AND ".join(where_clauses)

    count_sql = f"""
        SELECT COUNT(*) FROM (
            SELECT 1
            FROM blueprint
            WHERE {where_sql}
            GROUP BY past, present, choices
        ) t
    """

    scenario_sql = f"""
        SELECT
            past,
            present,
            choices,
            COALESCE(SUM(counts), 0) AS visits,
            COALESCE(SUM(weight), 0) AS total_weight,
            ((present >> 8) & 255) AS street_index
        FROM blueprint
        WHERE {where_sql}
        GROUP BY past, present, choices
        ORDER BY visits DESC, total_weight DESC, present, past, choices
        LIMIT %s OFFSET %s
    """

    action_sql = """
        SELECT
            edge,
            COALESCE(SUM(weight), 0) AS action_weight,
            COALESCE(SUM(counts), 0) AS action_visits,
            COALESCE(SUM(evalue * weight) / NULLIF(SUM(weight), 0), AVG(evalue), 0) AS action_ev,
            COALESCE(SUM(regret), 0) AS total_regret
        FROM blueprint
        WHERE past = %s
          AND present = %s
          AND choices = %s
        GROUP BY edge
        ORDER BY action_weight DESC, edge
    """

    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cursor:
                cursor.execute(count_sql, params)
                total = _safe_int((cursor.fetchone() or [0])[0])
                if total == 0:
                    return StudySpotListResponse(requestId=rid, total=0, spots=[])

                cursor.execute(scenario_sql, [*params, safe_limit, safe_offset])
                scenarios = cursor.fetchall() or []

                spots: list[StudySpot] = []
                for past, present, choices, visits, _, st_idx in scenarios:
                    street_label = _INDEX_TO_STREET.get(_safe_int(st_idx), "Flop")
                    cursor.execute(action_sql, [past, present, choices])
                    action_rows = cursor.fetchall() or []
                    if not action_rows:
                        continue

                    total_weight = sum(max(0.0, _safe_float(row[1])) for row in action_rows)
                    if total_weight <= 0:
                        total_weight = float(len(action_rows))

                    action_mix: list[dict[str, float | str]] = []
                    action_rank: list[tuple[str, float]] = []
                    aggressive_pct = 0.0
                    passive_pct = 0.0
                    fold_pct = 0.0
                    weighted_ev = 0.0
                    best_ev = float("-inf")
                    for edge, action_weight, _, action_ev, _ in action_rows:
                        action = _edge_action_label(_safe_int(edge))
                        weight = max(0.0, _safe_float(action_weight))
                        frequency_pct = (weight / total_weight * 100.0) if total_weight > 0 else 0.0
                        ev_bb = _safe_float(action_ev)
                        weighted_ev += ev_bb * (frequency_pct / 100.0)
                        best_ev = max(best_ev, ev_bb)
                        action_mix.append(
                            {
                                "action": action,
                                "frequencyPct": round(frequency_pct, 1),
                                "evBb": round(ev_bb, 2),
                            },
                        )
                        action_rank.append((action, frequency_pct))
                        bucket = _action_bucket(action)
                        if bucket == "fold":
                            fold_pct += frequency_pct
                        elif bucket == "passive":
                            passive_pct += frequency_pct
                        else:
                            aggressive_pct += frequency_pct

                    action_rank.sort(key=lambda item: item[1], reverse=True)
                    top_actions = [item[0] for item in action_rank[:2]]
                    recommended_line = " -> ".join(top_actions) if top_actions else "Check"
                    aggregate_ev = round(weighted_ev, 2)
                    ev_loss_bb100 = max(0.0, (best_ev - weighted_ev) * 100.0)

                    total_combos = _street_total_combos(_safe_int(st_idx))
                    buckets = [
                        {
                            "bucket": "Aggressive",
                            "combos": int(round(total_combos * aggressive_pct / 100.0)),
                            "frequencyPct": round(aggressive_pct, 1),
                        },
                        {
                            "bucket": "Passive",
                            "combos": int(round(total_combos * passive_pct / 100.0)),
                            "frequencyPct": round(passive_pct, 1),
                        },
                        {
                            "bucket": "Fold",
                            "combos": int(round(total_combos * fold_pct / 100.0)),
                            "frequencyPct": round(fold_pct, 1),
                        },
                    ]

                    node = {
                        "nodeCode": f"RP_{street_label.upper()}_{present}_{past}_{choices}",
                        "board": _board_from_seed(_safe_int(st_idx), _safe_int(present), _safe_int(past), _safe_int(choices)),
                        "hero": hero,
                        "villain": villain,
                        "potBb": {1: 6.5, 2: 12.0, 3: 18.0}.get(_safe_int(st_idx), 6.5),
                        "strategy": {
                            "recommendedLine": recommended_line,
                            "aggregateEvBb": aggregate_ev,
                            "actionMix": action_mix,
                        },
                        "ranges": {
                            "defenseFreqPct": round(max(0.0, min(100.0, 100.0 - fold_pct)), 1),
                            "buckets": buckets,
                        },
                        "breakdown": {
                            "sampleSize": _safe_int(visits),
                            "avgEvLossBb100": round(ev_loss_bb100, 1),
                            "confidence": _spot_confidence(_safe_int(visits)),
                            "leaks": _build_spot_leaks(aggressive_pct, passive_pct, fold_pct, ev_loss_bb100),
                        },
                    }

                    spot = StudySpot.model_validate(
                        {
                            "id": f"rp-{_safe_int(st_idx)}-{_safe_int(present)}-{_safe_int(past)}-{_safe_int(choices)}",
                            "title": f"Robopoker {street_label} Spot {_safe_int(present)}",
                            "format": dataset_format,
                            "position": dataset_position,
                            "stackBb": dataset_stack_bb,
                            "street": street_label,
                            "node": node,
                        },
                    )
                    spots.append(spot)

                return StudySpotListResponse(requestId=rid, total=total, spots=spots)
    except Exception:
        return None


def list_study_spots(
    supabase: Client | None,
    format_filter: str | None,
    position_filter: str | None,
    stack_bb: int | None,
    street_filter: str | None,
    limit: int,
    offset: int,
) -> StudySpotListResponse:
    rid = request_id()
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    robopoker_spots = _list_study_spots_from_robopoker(
        format_filter=format_filter,
        position_filter=position_filter,
        stack_bb=stack_bb,
        street_filter=street_filter,
        limit=safe_limit,
        offset=safe_offset,
    )
    if robopoker_spots is not None:
        return robopoker_spots

    if supabase is not None:
        _ensure_seed_study_spots(supabase)
        try:
            query = supabase.table("pg_mvp_study_spots").select("*", count="exact")
            if format_filter:
                query = query.eq("format", format_filter)
            if position_filter:
                query = query.eq("position", position_filter)
            if stack_bb:
                query = query.eq("stack_bb", stack_bb)
            if street_filter:
                query = query.eq("street", street_filter)
            db_result = (
                query.order("id")
                .range(safe_offset, safe_offset + safe_limit - 1)
                .execute()
            )
            rows = db_result.data or []
            total = int(getattr(db_result, "count", None) or len(rows))
            if rows:
                spots = [
                    StudySpot.model_validate(
                        {
                            "id": str(row["id"]),
                            "title": str(row["title"]),
                            "format": str(row["format"]),
                            "position": str(row["position"]),
                            "stackBb": _safe_int(row.get("stack_bb")),
                            "street": str(row["street"]),
                            "node": row.get("node") or {},
                        },
                    )
                    for row in rows
                ]
                return StudySpotListResponse(requestId=rid, total=total, spots=spots)
        except Exception:
            # Fall back to in-memory seed to keep service available.
            pass

    filtered: list[dict[str, Any]] = []
    for spot in _STUDY_SPOT_SEED:
        if format_filter and spot["format"] != format_filter:
            continue
        if position_filter and spot["position"] != position_filter:
            continue
        if stack_bb and spot["stackBb"] != stack_bb:
            continue
        if street_filter and spot["street"] != street_filter:
            continue
        filtered.append(spot)

    page = filtered[safe_offset : safe_offset + safe_limit]

    spots = [StudySpot.model_validate(spot) for spot in page]
    return StudySpotListResponse(requestId=rid, total=len(filtered), spots=spots)


def _find_seed_spot(spot_id: str) -> StudySpot | None:
    for spot in _STUDY_SPOT_SEED:
        if str(spot.get("id")) == spot_id:
            try:
                return StudySpot.model_validate(spot)
            except Exception:
                return None
    return None


def _find_db_spot(supabase: Client, spot_id: str) -> StudySpot | None:
    try:
        row_list = (
            supabase.table("pg_mvp_study_spots")
            .select("*")
            .eq("id", spot_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception:
        return None

    if not row_list:
        return None
    row = row_list[0]
    try:
        return StudySpot.model_validate(
            {
                "id": str(row["id"]),
                "title": str(row["title"]),
                "format": str(row["format"]),
                "position": str(row["position"]),
                "stackBb": _safe_int(row.get("stack_bb")),
                "street": str(row["street"]),
                "node": row.get("node") or {},
            },
        )
    except Exception:
        return None


def _find_robopoker_spot(spot_id: str) -> StudySpot | None:
    if not spot_id.startswith("rp-"):
        return None
    response = _list_study_spots_from_robopoker(
        format_filter=None,
        position_filter=None,
        stack_bb=None,
        street_filter=None,
        limit=200,
        offset=0,
    )
    if response is None:
        return None
    for spot in response.spots:
        if spot.id == spot_id:
            return spot
    return None


def get_study_spot_matrix(supabase: Client | None, spot_id: str) -> StudySpotMatrixResponse | None:
    spot: StudySpot | None = None
    source = "seed"

    if supabase is not None:
        _ensure_seed_study_spots(supabase)
        spot = _find_db_spot(supabase, spot_id)

    if spot is None:
        spot = _find_seed_spot(spot_id)
        source = "seed"

    if spot is None:
        spot = _find_robopoker_spot(spot_id)
        source = "robopoker"

    if spot is None:
        return None

    actions, hands = _build_hand_strategy_for_spot(spot)
    return StudySpotMatrixResponse(
        requestId=request_id(),
        spotId=spot.id,
        nodeCode=spot.node.nodeCode,
        source="robopoker" if source == "robopoker" else "seed",
        actions=actions,
        hands=hands,
    )


def create_drill(supabase: Client, payload: DrillCreateRequest) -> DrillCreateResponse:
    rid = request_id()
    drill_row = (
        supabase.table("pg_mvp_drills")
        .insert(
            {
                "title": payload.title.strip() or "Untitled Drill",
                "source_type": payload.sourceType,
                "source_ref_id": payload.sourceRefId,
                "tags": payload.tags or [],
                "item_count": payload.itemCount,
            },
        )
        .execute()
        .data[0]
    )

    base_items = _build_default_drill_items(payload.itemCount)
    item_rows = []
    for item in base_items:
        item_rows.append(
            {
                "id": item["id"],
                "drill_id": drill_row["id"],
                "sort_index": item["sort_index"],
                "prompt": item["prompt"],
                "options": item["options"],
                "recommended_action": item["recommended_action"],
                "ev_loss_bb100": item["ev_loss_bb100"],
                "frequency_gap_pct": item["frequency_gap_pct"],
            },
        )

    created_items = supabase.table("pg_mvp_drill_items").insert(item_rows).execute().data or []
    drill = _drill_from_rows(drill_row, created_items)
    return DrillCreateResponse(requestId=rid, drill=drill)


def start_practice_session(supabase: Client, payload: PracticeSessionStartRequest) -> PracticeSessionStartResponse | None:
    rid = request_id()
    drill_rows = (
        supabase.table("pg_mvp_drills")
        .select("*")
        .eq("id", payload.drillId)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not drill_rows:
        return None

    drill_row = drill_rows[0]
    session_row = (
        supabase.table("pg_mvp_practice_sessions")
        .insert(
            {
                "drill_id": payload.drillId,
                "mode": payload.mode,
                "difficulty": payload.difficulty,
                "status": "active",
                "total_items": _safe_int(drill_row.get("item_count")),
                "answered_items": 0,
            },
        )
        .execute()
        .data[0]
    )

    question_rows = (
        supabase.table("pg_mvp_drill_items")
        .select("*")
        .eq("drill_id", payload.drillId)
        .eq("sort_index", 0)
        .limit(1)
        .execute()
        .data
        or []
    )
    next_question = (
        PracticeQuestion(
            itemId=str(question_rows[0]["id"]),
            prompt=str(question_rows[0]["prompt"]),
            options=list(question_rows[0].get("options") or []),
        )
        if question_rows
        else None
    )

    session = PracticeSession(
        id=str(session_row["id"]),
        drillId=str(session_row["drill_id"]),
        mode=str(session_row["mode"]),  # type: ignore[arg-type]
        difficulty=str(session_row["difficulty"]),  # type: ignore[arg-type]
        status=str(session_row["status"]),  # type: ignore[arg-type]
        totalItems=_safe_int(session_row.get("total_items")),
        answeredItems=_safe_int(session_row.get("answered_items")),
        startedAt=str(session_row.get("started_at")),
        completedAt=session_row.get("completed_at"),
    )
    return PracticeSessionStartResponse(requestId=rid, session=session, nextQuestion=next_question)


def _session_from_row(row: dict[str, Any]) -> PracticeSession:
    return PracticeSession(
        id=str(row["id"]),
        drillId=str(row["drill_id"]),
        mode=str(row["mode"]),  # type: ignore[arg-type]
        difficulty=str(row["difficulty"]),  # type: ignore[arg-type]
        status=str(row["status"]),  # type: ignore[arg-type]
        totalItems=_safe_int(row.get("total_items")),
        answeredItems=_safe_int(row.get("answered_items")),
        startedAt=str(row.get("started_at")),
        completedAt=row.get("completed_at"),
    )


def submit_practice_answer(
    supabase: Client,
    session_id: str,
    payload: PracticeSubmitAnswerRequest,
) -> PracticeSubmitAnswerResponse | None:
    rid = request_id()
    session_rows = (
        supabase.table("pg_mvp_practice_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("status", "active")
        .limit(1)
        .execute()
        .data
        or []
    )
    if not session_rows:
        return None
    session_row = session_rows[0]
    answered_items = _safe_int(session_row.get("answered_items"))

    item_rows = (
        supabase.table("pg_mvp_drill_items")
        .select("*")
        .eq("drill_id", session_row["drill_id"])
        .eq("sort_index", answered_items)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not item_rows:
        return None
    item_row = item_rows[0]

    recommended_action = str(item_row["recommended_action"])
    correct = payload.chosenAction == recommended_action
    ev_loss = 0.0 if correct else _safe_float(item_row.get("ev_loss_bb100"))
    frequency_gap = 0.0 if correct else _safe_float(item_row.get("frequency_gap_pct"))
    explanation = (
        "动作与 baseline 一致，继续保持当前频率执行。"
        if correct
        else f"该题推荐 {recommended_action}，你当前动作会导致 EV 下降。"
    )

    supabase.table("pg_mvp_practice_answers").insert(
        {
            "session_id": session_id,
            "item_id": item_row["id"],
            "chosen_action": payload.chosenAction,
            "decision_time_ms": payload.decisionTimeMs,
            "correct": correct,
            "recommended_action": recommended_action,
            "ev_loss_bb100": ev_loss,
            "frequency_gap_pct": frequency_gap,
            "explanation": explanation,
        },
    ).execute()

    updated_answered = answered_items + 1
    updated_row = (
        supabase.table("pg_mvp_practice_sessions")
        .update({"answered_items": updated_answered, "updated_at": now_iso()})
        .eq("id", session_id)
        .execute()
        .data[0]
    )

    next_rows = (
        supabase.table("pg_mvp_drill_items")
        .select("*")
        .eq("drill_id", session_row["drill_id"])
        .eq("sort_index", updated_answered)
        .limit(1)
        .execute()
        .data
        or []
    )
    next_question = (
        PracticeQuestion(
            itemId=str(next_rows[0]["id"]),
            prompt=str(next_rows[0]["prompt"]),
            options=list(next_rows[0].get("options") or []),
        )
        if next_rows
        else None
    )

    return PracticeSubmitAnswerResponse(
        requestId=rid,
        session=_session_from_row(updated_row),
        progress={"answered": updated_answered, "total": _safe_int(updated_row.get("total_items"))},
        feedback=PracticeAnswerFeedback(
            correct=correct,
            recommendedAction=recommended_action,
            evLossBb100=round(ev_loss, 1),
            frequencyGapPct=round(frequency_gap, 1),
            explanation=explanation,
        ),
        nextQuestion=next_question,
    )


def complete_practice_session(supabase: Client, session_id: str) -> PracticeCompleteSessionResponse | None:
    rid = request_id()
    session_rows = (
        supabase.table("pg_mvp_practice_sessions")
        .select("*")
        .eq("id", session_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not session_rows:
        return None
    session_row = session_rows[0]

    answer_rows = (
        supabase.table("pg_mvp_practice_answers")
        .select("*")
        .eq("session_id", session_id)
        .execute()
        .data
        or []
    )
    answered = max(len(answer_rows), 1)
    total_ev_loss = round(sum(_safe_float(row.get("ev_loss_bb100")) for row in answer_rows), 1)
    total_frequency_gap = sum(_safe_float(row.get("frequency_gap_pct")) for row in answer_rows)
    total_decision_time = sum(_safe_int(row.get("decision_time_ms")) for row in answer_rows)
    correct_count = len([row for row in answer_rows if bool(row.get("correct"))])
    score_pct = round((correct_count / answered) * 100)

    updated_row = (
        supabase.table("pg_mvp_practice_sessions")
        .update(
            {
                "status": "completed",
                "answered_items": len(answer_rows),
                "completed_at": now_iso(),
                "updated_at": now_iso(),
            },
        )
        .eq("id", session_id)
        .execute()
        .data[0]
    )

    summary = PracticeSessionSummary(
        totalItems=_safe_int(updated_row.get("total_items")),
        answeredItems=len(answer_rows),
        totalEvLossBb100=total_ev_loss,
        averageFrequencyGapPct=round(total_frequency_gap / answered, 1),
        averageDecisionTimeMs=round(total_decision_time / answered),
        scorePct=score_pct,
    )
    return PracticeCompleteSessionResponse(requestId=rid, session=_session_from_row(updated_row), summary=summary)


def _parse_hands_from_text(upload_id: str, raw: str) -> list[dict[str, Any]]:
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    total = max(6, min(len(lines) if lines else 8, 60))
    positions = ["UTG", "HJ", "CO", "BTN", "SB", "BB"]
    streets = ["preflop", "flop", "turn", "river"]
    tags = ["over_bluff", "under_bluff", "missed_value", "over_fold", "size_mismatch"]

    rows: list[dict[str, Any]] = []
    for index in range(total):
        base = lines[index] if index < len(lines) else f"{raw}:{index}"
        digest = hashlib.sha1(base.encode("utf-8")).hexdigest()
        score = int(digest[:8], 16)
        ev_loss = round((score % 350) / 10 + 2, 1)
        rows.append(
            {
                "id": str(uuid4()),
                "upload_id": upload_id,
                "played_at": datetime.now(UTC).isoformat(),
                "position": positions[index % len(positions)],
                "street": streets[index % len(streets)],
                "ev_loss_bb100": ev_loss,
                "tags": [tags[index % len(tags)], tags[(index + 2) % len(tags)]],
                "summary": lines[index] if index < len(lines) else f"Hand #{index + 1} parsed from upload",
            },
        )
    return rows


def create_analyze_upload(supabase: Client, payload: AnalyzeUploadCreateRequest) -> AnalyzeUploadResponse:
    rid = request_id()
    inserted = (
        supabase.table("pg_mvp_analyze_uploads")
        .insert(
            {
                "source_site": payload.sourceSite or "manual",
                "file_name": payload.fileName or "hand_history.txt",
                "status": "uploaded",
                "hands_count": 0,
                "raw_content": payload.content,
                "updated_at": now_iso(),
            },
        )
        .execute()
        .data[0]
    )
    upload = AnalyzeUpload(
        id=str(inserted["id"]),
        sourceSite=str(inserted["source_site"]),
        fileName=str(inserted["file_name"]),
        status=str(inserted["status"]),  # type: ignore[arg-type]
        handsCount=_safe_int(inserted.get("hands_count")),
        errorMessage=inserted.get("error_message"),
        createdAt=str(inserted["created_at"]),
        updatedAt=str(inserted["updated_at"]),
    )
    return AnalyzeUploadResponse(requestId=rid, upload=upload)


def process_analyze_upload(supabase: Client, upload_id: str) -> None:
    # Simulate async pipeline: uploaded -> parsing -> parsed/failed
    supabase.table("pg_mvp_analyze_uploads").update(
        {"status": "parsing", "updated_at": now_iso()},
    ).eq("id", upload_id).execute()

    time.sleep(0.9)
    rows = (
        supabase.table("pg_mvp_analyze_uploads")
        .select("*")
        .eq("id", upload_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return
    upload = rows[0]
    raw = str(upload.get("raw_content") or "").strip()
    if not raw:
        supabase.table("pg_mvp_analyze_uploads").update(
            {
                "status": "failed",
                "error_message": "无法从上传内容中解析出有效手牌，请检查格式。",
                "updated_at": now_iso(),
            },
        ).eq("id", upload_id).execute()
        return

    hand_rows = _parse_hands_from_text(upload_id, raw)
    if hand_rows:
        supabase.table("pg_mvp_analyzed_hands").insert(hand_rows).execute()
    supabase.table("pg_mvp_analyze_uploads").update(
        {
            "status": "parsed",
            "hands_count": len(hand_rows),
            "error_message": None,
            "updated_at": now_iso(),
        },
    ).eq("id", upload_id).execute()


def get_analyze_upload(supabase: Client, upload_id: str) -> AnalyzeUploadResponse | None:
    rid = request_id()
    rows = (
        supabase.table("pg_mvp_analyze_uploads")
        .select("*")
        .eq("id", upload_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    row = rows[0]
    return AnalyzeUploadResponse(
        requestId=rid,
        upload=AnalyzeUpload(
            id=str(row["id"]),
            sourceSite=str(row["source_site"]),
            fileName=str(row["file_name"]),
            status=str(row["status"]),  # type: ignore[arg-type]
            handsCount=_safe_int(row.get("hands_count")),
            errorMessage=row.get("error_message"),
            createdAt=str(row["created_at"]),
            updatedAt=str(row["updated_at"]),
        ),
    )


def list_analyze_hands(
    supabase: Client,
    upload_id: str | None,
    sort_by: str | None,
    position: str | None,
    tag: str | None,
) -> AnalyzeHandsResponse:
    rid = request_id()
    query = supabase.table("pg_mvp_analyzed_hands").select("*")
    if upload_id:
        query = query.eq("upload_id", upload_id)
    if position:
        query = query.eq("position", position)
    if sort_by == "played_at":
        query = query.order("played_at", desc=True)
    else:
        query = query.order("ev_loss_bb100", desc=True)

    rows = query.execute().data or []
    if tag:
        rows = [row for row in rows if tag in (row.get("tags") or [])]

    hands = [
        AnalyzedHand(
            id=str(row["id"]),
            uploadId=str(row["upload_id"]),
            playedAt=str(row["played_at"]),
            position=str(row["position"]),
            street=str(row["street"]),  # type: ignore[arg-type]
            evLossBb100=_safe_float(row.get("ev_loss_bb100")),
            tags=list(row.get("tags") or []),
            summary=str(row.get("summary") or ""),
        )
        for row in rows
    ]
    return AnalyzeHandsResponse(requestId=rid, hands=hands)


def build_leak_report(supabase: Client, window_days: int) -> LeakReportResponse:
    rid = request_id()
    cutoff = datetime.now(UTC) - timedelta(days=window_days)
    rows = (
        supabase.table("pg_mvp_analyzed_hands")
        .select("*")
        .gte("played_at", cutoff.isoformat())
        .execute()
        .data
        or []
    )

    grouped: dict[str, dict[str, float]] = {}
    for row in rows:
        for tag in row.get("tags") or []:
            if tag not in grouped:
                grouped[tag] = {"count": 0, "ev_total": 0.0}
            grouped[tag]["count"] += 1
            grouped[tag]["ev_total"] += _safe_float(row.get("ev_loss_bb100"))

    def confidence(sample_size: int) -> str:
        if sample_size >= 20:
            return "high"
        if sample_size >= 8:
            return "medium"
        return "low"

    def recommendation(tag: str) -> str:
        if tag == "over_bluff":
            return "收紧诈唬频率，优先保留具备阻断价值的组合。"
        if tag == "under_bluff":
            return "补足可盈利诈唬区间，避免对手无成本弃牌。"
        if tag == "missed_value":
            return "提升薄价值下注覆盖，减少 river 被动 check-back。"
        if tag == "over_fold":
            return "降低中等强度牌过度弃牌比例，扩大防守阈值。"
        return "统一 sizing 结构，减少同类牌型下注尺度漂移。"

    if not grouped:
        items = [
            LeakReportItem(
                id=str(uuid4()),
                title="数据不足：先完成首批 Analyze 上传",
                sampleSize=0,
                confidence="low",
                impactScore=0.0,
                evLossBb100=0.0,
                recommendation="建议先上传至少 1 份 hand history，再生成漏洞报告。",
                relatedTag="insufficient_data",
            ),
        ]
    else:
        items = []
        for tag, value in grouped.items():
            sample_size = int(value["count"])
            average_loss = value["ev_total"] / sample_size if sample_size > 0 else 0.0
            impact = round(average_loss * (sample_size + 1) ** 0.5 * 10, 1)
            items.append(
                LeakReportItem(
                    id=str(uuid4()),
                    title=f"Leak: {tag}",
                    sampleSize=sample_size,
                    confidence=confidence(sample_size),  # type: ignore[arg-type]
                    impactScore=impact,
                    evLossBb100=round(average_loss, 1),
                    recommendation=recommendation(tag),
                    relatedTag=tag,
                ),
            )
        items = sorted(items, key=lambda item: item.impactScore, reverse=True)[:8]

    return LeakReportResponse(
        requestId=rid,
        windowDays=7 if window_days == 7 else 90 if window_days == 90 else 30,
        generatedAt=now_iso(),
        items=items,
    )


def coach_chat(payload: CoachChatRequest) -> CoachChatResponse:
    rid = request_id()
    mode_hint = {
        "Fix": "当前优先修复 EV 损失最高的决策模式。",
        "Drill": "当前最优路径是把问题转为可执行训练题集。",
        "Plan": "当前建议输出一周计划并分配复训窗口。",
        "Explain": "先建立稳定 baseline，再根据样本偏差做 exploit 调整。",
    }[payload.mode]
    sections = [
        CoachSection(name="结论", content=mode_hint),
        CoachSection(
            name="依据数据",
            content="基于当前模块上下文、最近动作轨迹和已知样本趋势进行判断；若样本不足会降级为保守建议。",
        ),
        CoachSection(
            name="行动建议",
            content="优先执行 1 个主动作 + 1 个校验动作，并在下一次训练中复查频率偏差与 EV loss 变化。",
        ),
        CoachSection(
            name="风险提示",
            content="若样本量偏小或输入上下文缺失，建议先补充行动历史，避免把短期波动误判为稳定漏洞。",
        ),
        CoachSection(
            name="置信度",
            content="Medium-High" if payload.history and len(payload.history) >= 2 else "Medium",
        ),
    ]
    if payload.mode == "Plan":
        actions = [
            CoachActionSuggestion(
                type="create_plan",
                label="创建 7 天修复计划",
                requiresConfirmation=False,
                payload={"focus": f"{payload.module}-improvement", "overwrite": False},
            ),
        ]
    else:
        actions = [
            CoachActionSuggestion(
                type="create_drill",
                label="从当前上下文创建 Drill",
                requiresConfirmation=False,
                payload={"itemCount": 24 if payload.mode == "Drill" else 12, "sourceRefId": payload.conversationId},
            ),
        ]
    return CoachChatResponse(
        requestId=rid,
        conversationId=payload.conversationId,
        provider="heuristic",
        sections=sections,
        actions=actions,
        createdAt=now_iso(),
    )


def coach_create_drill_action(supabase: Client, payload: CoachCreateDrillRequest) -> DrillCreateResponse | str:
    if payload.itemCount > 100 and not payload.confirm:
        return "该动作将生成超过 100 题，需要二次确认。"

    return create_drill(
        supabase,
        DrillCreateRequest(
            title=payload.title or f"Coach Drill {payload.conversationId[:6]}",
            sourceType="coach",
            sourceRefId=payload.sourceRefId or payload.conversationId,
            itemCount=payload.itemCount,
        ),
    )


def coach_create_plan_action(supabase: Client, payload: CoachCreatePlanRequest) -> CoachCreatePlanResponse | str:
    if payload.overwrite and not payload.confirm:
        return "覆盖已有计划前需要二次确认。"

    rid = request_id()
    tasks = [
        "周一：复训 Top 10 EV loss spot",
        "周三：完成 1 次 20 题 Drill 并复盘错题",
        "周五：上传最新 HH 并对照报告修复",
        "周日：回顾本周执行偏差与下周目标",
    ]
    upserted = (
        supabase.table("pg_mvp_weekly_plans")
        .upsert(
            {
                "conversation_id": payload.conversationId,
                "focus": payload.focus,
                "week_start": payload.weekStart.isoformat(),
                "tasks": tasks,
                "updated_at": now_iso(),
            },
            on_conflict="week_start,focus",
        )
        .execute()
        .data[0]
    )
    plan = WeeklyPlan(
        id=str(upserted["id"]),
        focus=str(upserted["focus"]),
        weekStart=payload.weekStart,
        tasks=list(upserted.get("tasks") or []),
        createdAt=str(upserted["created_at"]),
    )
    return CoachCreatePlanResponse(requestId=rid, plan=plan)


def ingest_events(supabase: Client, events: list[dict[str, Any]]) -> int:
    if not events:
        return 0
    rows = []
    for event in events:
        rows.append(
            {
                "event_name": event["eventName"],
                "event_time": event["eventTime"].isoformat() if hasattr(event["eventTime"], "isoformat") else event["eventTime"],
                "session_id": event["sessionId"],
                "user_id": event.get("userId"),
                "route": event["route"],
                "module": event["module"],
                "request_id": event.get("requestId"),
                "payload": event.get("payload") or {},
            },
        )
    supabase.table("pg_mvp_events").insert(rows).execute()
    return len(rows)


def _build_chat_messages(payload: ZenChatRequest, content: str) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": "You are ZEN Chat, a world-class Texas Holdem strategy coach. Be concise and actionable.",
        },
    ]
    if payload.history:
        for message in payload.history[-12:]:
            text = message.content.strip()
            if not text:
                continue
            messages.append({"role": message.role, "content": text[:2000]})
    messages.append({"role": "user", "content": content})
    return messages


def _flatten_message_content(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for item in content:
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = str(item.get("text") or item.get("content") or "").strip()
        else:
            text = ""
        if text:
            parts.append(text)
    return "\n".join(parts).strip()


def _parse_json_object(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _is_invalid_workspace_header(raw: str) -> bool:
    lowered = raw.lower()
    return "x-dashscope-workspace" in lowered and "invalid header" in lowered


def _qwen_headers(settings: Settings, include_workspace: bool) -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.zen_qwen_api_key}",
    }
    if include_workspace and settings.zen_qwen_use_workspace and settings.zen_qwen_workspace_id:
        headers["X-DashScope-Workspace"] = settings.zen_qwen_workspace_id
    return headers


def generate_zen_chat(payload: ZenChatRequest, settings: Settings) -> ZenChatResponse:
    provider = "heuristic"
    content = payload.message.strip()

    def heuristic(locale: str) -> str:
        if locale == "en-US":
            return "\n".join(
                [
                    "Quick read:",
                    "- Prioritize low-variance lines unless you have a clear range advantage.",
                    "- Keep one baseline line and one exploit line.",
                    "- Validate by EV loss and frequency gap in your next drill.",
                ],
            )
        return "\n".join(
            [
                "快速结论：",
                "- 优先使用波动更可控的主线，除非你确认自己有明显范围优势。",
                "- 保留一条 baseline 线和一条 exploit 线，然后二选一执行。",
                "- 下一次训练用 EV loss 和频率偏差回看执行质量。",
            ],
        )

    locale = payload.locale or "zh-CN"
    reply = heuristic(locale)
    messages = _build_chat_messages(payload, content)

    if settings.zen_provider in {"openai", "auto"} and settings.zen_openai_api_key:
        try:
            response = httpx.post(
                settings.zen_openai_endpoint,
                timeout=12.0,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.zen_openai_api_key}",
                },
                json={
                    "model": settings.zen_openai_model,
                    "temperature": 0.35,
                    "messages": messages,
                },
            )
            raw_text = response.text
            data = _parse_json_object(raw_text)
            choices = data.get("choices") if isinstance(data.get("choices"), list) else []
            first = choices[0] if choices and isinstance(choices[0], dict) else {}
            message = first.get("message") if isinstance(first.get("message"), dict) else {}
            model_text = _flatten_message_content(message.get("content")).strip()
            if response.is_success and model_text:
                provider = "openai"
                reply = model_text
        except Exception:
            pass

    if provider == "heuristic" and settings.zen_provider in {"qwen", "auto"} and settings.zen_qwen_api_key:
        qwen_payload = {
            "model": settings.zen_qwen_model,
            "temperature": 0.35,
            "messages": messages,
        }
        try:
            response = httpx.post(
                settings.zen_qwen_endpoint,
                timeout=12.0,
                headers=_qwen_headers(settings, include_workspace=True),
                json=qwen_payload,
            )
            raw_text = response.text
            if response.status_code == 400 and _is_invalid_workspace_header(raw_text):
                response = httpx.post(
                    settings.zen_qwen_endpoint,
                    timeout=12.0,
                    headers=_qwen_headers(settings, include_workspace=False),
                    json=qwen_payload,
                )
                raw_text = response.text

            data = _parse_json_object(raw_text)
            choices = data.get("choices") if isinstance(data.get("choices"), list) else []
            first = choices[0] if choices and isinstance(choices[0], dict) else {}
            message = first.get("message") if isinstance(first.get("message"), dict) else {}
            model_text = _flatten_message_content(message.get("content")).strip()
            if response.is_success and model_text:
                provider = "qwen"
                reply = model_text
        except Exception:
            pass

    suggestions = (
        [
            "Should I split between call and raise here?",
            "How does this change if effective stack is 40bb?",
            "Give me exploit line versus overfolding big blind.",
        ]
        if locale == "en-US"
        else [
            "这里要不要混合 call 和 raise 频率？",
            "如果有效筹码变成 40bb，策略会怎么变？",
            "针对大盲过度弃牌，给我一条 exploit 线。",
        ]
    )

    return ZenChatResponse(
        sessionId=payload.sessionId,
        reply=reply,
        suggestions=suggestions,
        provider=provider,  # type: ignore[arg-type]
        createdAt=now_iso(),
    )

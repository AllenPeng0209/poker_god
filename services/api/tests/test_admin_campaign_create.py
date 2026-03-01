from __future__ import annotations

import unittest
from datetime import UTC, datetime
from unittest.mock import patch

from app.schemas import CoachCampaignCreateRequest
from app.services import create_coach_campaign


class _TableStub:
    def __init__(self, state: dict):
        self.state = state
        self.payload = None

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        now = datetime.now(UTC).isoformat()
        row = {
            "id": "campaign-001",
            "campaign_name": self.payload["campaign_name"],
            "target_cluster": self.payload["target_cluster"],
            "channel": self.payload["channel"],
            "source_window_days": self.payload["source_window_days"],
            "expected_attach_lift_pct": self.payload["expected_attach_lift_pct"],
            "status": self.payload["status"],
            "created_by": self.payload["created_by"],
            "notes": self.payload.get("notes"),
            "created_at": now,
            "updated_at": now,
            "launched_at": self.payload.get("launched_at"),
        }
        self.state["last_insert"] = row

        class _Result:
            data = [row]

        return _Result()


class _SupabaseStub:
    def __init__(self):
        self.state: dict = {}

    def table(self, name: str):
        self.state["table"] = name
        return _TableStub(self.state)


class AdminCampaignCreateTest(unittest.TestCase):
    def test_create_campaign_draft(self):
        supabase = _SupabaseStub()
        payload = CoachCampaignCreateRequest(
            campaignName="Morning recovery",
            targetCluster="over_fold",
            channel="in_app",
            sourceWindowDays=30,
            expectedAttachLiftPct=4.2,
            createdBy="ops-admin",
            launchNow=False,
        )

        with patch("app.services.request_id", return_value="rid-campaign"):
            response = create_coach_campaign(supabase, payload)

        self.assertEqual(supabase.state["table"], "pg_mvp_coach_campaigns")
        self.assertEqual(response.requestId, "rid-campaign")
        self.assertEqual(response.campaign.status, "draft")
        self.assertIsNone(response.campaign.launchedAt)

    def test_create_campaign_launch_now_sets_launched_status(self):
        supabase = _SupabaseStub()
        payload = CoachCampaignCreateRequest(
            campaignName="Leak nudge",
            targetCluster="missed_value",
            channel="push",
            sourceWindowDays=7,
            expectedAttachLiftPct=3.0,
            createdBy="ops-admin",
            launchNow=True,
        )

        response = create_coach_campaign(supabase, payload)
        self.assertEqual(response.campaign.status, "launched")
        self.assertIsNotNone(response.campaign.launchedAt)


if __name__ == "__main__":
    unittest.main()

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class CampaignReadinessApiTest(unittest.TestCase):
    def test_campaign_readiness_shape(self) -> None:
        class FakeSupabase:
            pass

        fake_response = {
            "requestId": "req-1",
            "windowDays": 30,
            "generatedAt": "2026-03-02T08:18:00+00:00",
            "items": [
                {
                    "leakTag": "over_bluff",
                    "sampleSize": 24,
                    "averageEvLossBb100": 12.4,
                    "recommendedChannel": "in_app",
                    "recommendedAction": "Launch blocker-focused bluff frequency refresher",
                    "expectedAttachLiftPct": 2.4,
                }
            ],
        }

        with patch("app.main.get_supabase_client", return_value=FakeSupabase()), patch(
            "app.main.build_campaign_readiness", return_value=fake_response
        ):
            client = TestClient(app)
            response = client.get("/api/admin/coach/campaign-readiness?windowDays=30")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["windowDays"], 30)
        self.assertEqual(body["items"][0]["leakTag"], "over_bluff")


if __name__ == "__main__":
    unittest.main()

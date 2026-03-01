from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app


class ValidationErrorCodeContractTest(unittest.TestCase):
    def test_invalid_payload_returns_stable_error_code(self) -> None:
        client = TestClient(app)

        response = client.post(
            "/api/coach/chat",
            json={"conversationId": "conv-1", "module": "study", "mode": "Fix"},
        )

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload.get("code"), "invalid_request_payload")
        self.assertIn("requestId", payload)
        self.assertTrue(payload.get("message"))


if __name__ == "__main__":
    unittest.main()

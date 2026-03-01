import unittest

from fastapi.testclient import TestClient

from app.main import app


class ValidationErrorCodesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_invalid_payload_returns_stable_error_code(self) -> None:
        response = self.client.post(
            "/api/coach/chat",
            json={
                "conversationId": "conv-1",
                "module": "coach",
                "mode": "Drill",
                "message": "",  # violates min_length=1
            },
        )

        self.assertEqual(response.status_code, 422)
        body = response.json()
        self.assertEqual(body.get("code"), "invalid_request_payload")
        self.assertIn("message", body)
        self.assertIn("requestId", body)


if __name__ == "__main__":
    unittest.main()

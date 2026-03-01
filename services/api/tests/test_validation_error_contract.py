from __future__ import annotations

import unittest
from pathlib import Path


class ValidationErrorContractTests(unittest.TestCase):
    def test_invalid_request_payload_code_is_declared(self) -> None:
        main_py = Path(__file__).resolve().parents[1] / "app" / "main.py"
        source = main_py.read_text(encoding="utf-8")

        self.assertIn("@app.exception_handler(RequestValidationError)", source)
        self.assertIn('return _error(422, "invalid_request_payload", message, rid)', source)


if __name__ == "__main__":
    unittest.main()

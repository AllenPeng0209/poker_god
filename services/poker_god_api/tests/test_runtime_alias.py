from __future__ import annotations

import unittest

from poker_god_api.main import app


class RuntimeAliasTest(unittest.TestCase):
    def test_runtime_alias_exports_fastapi_app(self) -> None:
        self.assertEqual(getattr(app, "title", ""), "poker-god-api")


if __name__ == "__main__":
    unittest.main()

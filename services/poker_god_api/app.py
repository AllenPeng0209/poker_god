"""Migration entrypoint scaffold for services/poker_god_api.

Use this module to host the canonical FastAPI app once service migration from
`services/api` is complete.
"""

from services.api.app.main import app  # re-export during migration

__all__ = ["app"]

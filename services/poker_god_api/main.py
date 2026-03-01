"""Architecture-aligned backend entrypoint for Poker God.

This module re-exports the existing FastAPI app from services/api during migration.
New deployment/runtime wiring should target ``services.poker_god_api.main:app``.
"""

from services.api.app.main import app

__all__ = ["app"]

from __future__ import annotations

"""Runtime alias to keep deployment entrypoint under services/<project>.

Current implementation reuses FastAPI app from services/api until full code move is complete.
"""

from api.app.main import app

__all__ = ["app"]

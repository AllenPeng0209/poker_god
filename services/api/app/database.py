from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from .config import load_settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    settings = load_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise RuntimeError(
            "Supabase credentials missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY).",
        )
    return create_client(settings.supabase_url, settings.supabase_key)

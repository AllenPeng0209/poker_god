from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    cors_origin: str
    app_version: str
    api_key_required: bool
    api_key: str
    max_request_body_bytes: int
    rate_limit_enabled: bool
    rate_limit_window_sec: int
    rate_limit_requests: int
    supabase_url: str
    supabase_key: str
    zen_openai_api_key: str
    zen_openai_endpoint: str
    zen_openai_model: str
    zen_qwen_api_key: str
    zen_qwen_endpoint: str
    zen_qwen_model: str
    zen_qwen_workspace_id: str
    zen_qwen_use_workspace: bool
    zen_provider: str


def _first_non_empty(*values: str) -> str:
    for value in values:
        stripped = value.strip()
        if stripped:
            return stripped
    return ""


def _as_bool(value: str, default: bool = False) -> bool:
    lowered = value.strip().lower()
    if lowered in {"1", "true", "yes", "on"}:
        return True
    if lowered in {"0", "false", "no", "off"}:
        return False
    return default


def _normalize_provider(raw: str) -> str:
    provider = raw.strip().lower()
    if provider in {"openai_omni", "openai"}:
        return "openai"
    if provider in {"qwen"}:
        return "qwen"
    if provider in {"auto"}:
        return "auto"
    return "heuristic"


def load_settings() -> Settings:
    bailian_endpoint = _first_non_empty(
        os.getenv("ZEN_BAILIAN_ENDPOINT", ""),
        os.getenv("EXPO_PUBLIC_BAILIAN_ENDPOINT", ""),
        "https://dashscope.aliyuncs.com",
    ).rstrip("/")
    qwen_endpoint = _first_non_empty(
        os.getenv("ZEN_QWEN_ENDPOINT", ""),
        os.getenv("EXPO_PUBLIC_QWEN_ENDPOINT", ""),
        f"{bailian_endpoint}/compatible-mode/v1/chat/completions",
    ).rstrip("/")

    return Settings(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "3001")),
        cors_origin=os.getenv("CORS_ORIGIN", "*"),
        app_version=os.getenv("APP_VERSION", "1.0.0"),
        api_key_required=_as_bool(os.getenv("API_KEY_REQUIRED", "false"), default=False),
        api_key=os.getenv("API_KEY", "").strip(),
        max_request_body_bytes=max(1024, int(os.getenv("MAX_REQUEST_BODY_BYTES", str(2 * 1024 * 1024)))),
        rate_limit_enabled=_as_bool(os.getenv("RATE_LIMIT_ENABLED", "true"), default=True),
        rate_limit_window_sec=max(1, int(os.getenv("RATE_LIMIT_WINDOW_SEC", "60"))),
        rate_limit_requests=max(1, int(os.getenv("RATE_LIMIT_REQUESTS", "120"))),
        supabase_url=_first_non_empty(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""),
        ),
        supabase_key=_first_non_empty(
            os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            os.getenv("SUPABASE_KEY", ""),
        ),
        zen_openai_api_key=_first_non_empty(
            os.getenv("ZEN_OPENAI_API_KEY", ""),
            os.getenv("OPENAI_API_KEY", ""),
            os.getenv("EXPO_PUBLIC_OPENAI_API_KEY", ""),
        ),
        zen_openai_endpoint=_first_non_empty(
            os.getenv("ZEN_OPENAI_ENDPOINT", ""),
            os.getenv("OPENAI_ENDPOINT", ""),
            os.getenv("EXPO_PUBLIC_OPENAI_ENDPOINT", ""),
            "https://api.openai.com/v1/chat/completions",
        ),
        zen_openai_model=_first_non_empty(
            os.getenv("ZEN_OPENAI_MODEL", ""),
            os.getenv("OPENAI_MODEL", ""),
            os.getenv("EXPO_PUBLIC_OPENAI_OMNI_MODEL", ""),
            "gpt-4o-mini",
        ),
        zen_qwen_api_key=_first_non_empty(
            os.getenv("ZEN_QWEN_API_KEY", ""),
            os.getenv("QWEN_API_KEY", ""),
            os.getenv("EXPO_PUBLIC_QWEN_API_KEY", ""),
            os.getenv("ZEN_BAILIAN_API_KEY", ""),
            os.getenv("EXPO_PUBLIC_BAILIAN_API_KEY", ""),
        ),
        zen_qwen_endpoint=qwen_endpoint,
        zen_qwen_model=_first_non_empty(
            os.getenv("ZEN_QWEN_MODEL", ""),
            os.getenv("QWEN_MODEL", ""),
            os.getenv("EXPO_PUBLIC_QWEN_MODEL", ""),
            "qwen3-max",
        ),
        zen_qwen_workspace_id=_first_non_empty(
            os.getenv("ZEN_BAILIAN_WORKSPACE_ID", ""),
            os.getenv("EXPO_PUBLIC_BAILIAN_WORKSPACE_ID", ""),
        ),
        zen_qwen_use_workspace=_as_bool(
            _first_non_empty(
                os.getenv("ZEN_BAILIAN_USE_WORKSPACE", ""),
                os.getenv("EXPO_PUBLIC_BAILIAN_USE_WORKSPACE", ""),
            ),
            default=False,
        ),
        zen_provider=_normalize_provider(
            _first_non_empty(
                os.getenv("ZEN_CHAT_PROVIDER", ""),
                os.getenv("COACH_VOICE_PROVIDER", ""),
                os.getenv("EXPO_PUBLIC_COACH_VOICE_PROVIDER", ""),
                "heuristic",
            ),
        ),
    )

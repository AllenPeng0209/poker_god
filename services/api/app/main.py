from __future__ import annotations

import logging
from collections import defaultdict, deque
from datetime import UTC, datetime
from threading import Lock
from time import perf_counter

from fastapi import BackgroundTasks, FastAPI, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import load_settings
from .database import get_supabase_client
from .schemas import (
    AnalyticsIngestRequest,
    AnalyticsIngestResponse,
    AnalyzeHandsResponse,
    AnalyzeUploadCreateRequest,
    AnalyzeUploadResponse,
    CoachChatRequest,
    CoachChatResponse,
    CoachCreateDrillRequest,
    CoachCreatePlanRequest,
    CoachCreatePlanResponse,
    DrillCreateRequest,
    DrillCreateResponse,
    DrillListResponse,
    ErrorBody,
    HealthResponse,
    LeakReportResponse,
    PracticeCompleteSessionResponse,
    PracticeSessionStartRequest,
    PracticeSessionStartResponse,
    PracticeSubmitAnswerRequest,
    PracticeSubmitAnswerResponse,
    StudySpotListResponse,
    TrainingZone,
    TrainingZonesResponse,
    ZenChatRequest,
    ZenChatResponse,
)
from .services import (
    build_leak_report,
    coach_chat,
    coach_create_drill_action,
    coach_create_plan_action,
    complete_practice_session,
    create_analyze_upload,
    create_drill,
    generate_zen_chat,
    get_analyze_upload,
    ingest_events,
    list_study_spots,
    list_analyze_hands,
    list_drills,
    process_analyze_upload,
    request_id,
    start_practice_session,
    submit_practice_answer,
)

settings = load_settings()
app = FastAPI(title="poker-god-api", version=settings.app_version)
logger = logging.getLogger("poker-god-api")

_rate_limit_lock = Lock()
_rate_limit_store: defaultdict[str, deque[float]] = defaultdict(deque)


def _parse_cors_origins(raw: str) -> list[str]:
    value = raw.strip()
    if value == "*" or not value:
        return ["*"]
    return [part.strip() for part in value.split(",") if part.strip()]


def _error(
    status_code: int,
    code: str,
    message: str,
    request_id_override: str | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body = ErrorBody(code=code, message=message, requestId=request_id_override or request_id())
    response = JSONResponse(status_code=status_code, content=body.model_dump())
    if headers:
        for key, value in headers.items():
            response.headers[key] = value
    return response


def _request_id_from_request(request: Request) -> str:
    rid = getattr(request.state, "request_id", "")
    if isinstance(rid, str) and rid:
        return rid
    return request_id()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _extract_api_key(request: Request) -> str:
    direct = request.headers.get("x-api-key", "").strip()
    if direct:
        return direct
    auth = request.headers.get("authorization", "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return ""


def _requires_api_key(request: Request) -> bool:
    return request.url.path.startswith("/api/") and request.method in {"POST", "PUT", "PATCH", "DELETE"}


def _rate_limit_key(request: Request) -> str:
    return f"{_client_ip(request)}:{request.method}:{request.url.path}"


@app.middleware("http")
async def security_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    rid = request.headers.get("x-request-id", "").strip() or request_id()
    request.state.request_id = rid
    started = perf_counter()

    content_length_raw = request.headers.get("content-length")
    if content_length_raw:
        try:
            content_length = int(content_length_raw)
        except ValueError:
            content_length = 0
        if content_length > settings.max_request_body_bytes:
            return _error(
                413,
                "payload_too_large",
                f"payload exceeds {settings.max_request_body_bytes} bytes",
                request_id_override=rid,
            )

    if settings.api_key_required and _requires_api_key(request):
        if not settings.api_key:
            return _error(500, "api_key_not_configured", "API key auth is enabled but API_KEY is empty", rid)
        token = _extract_api_key(request)
        if token != settings.api_key:
            return _error(401, "unauthorized", "missing or invalid API key", rid)

    if settings.rate_limit_enabled and request.url.path.startswith("/api/"):
        now = datetime.now(UTC).timestamp()
        window_start = now - float(settings.rate_limit_window_sec)
        key = _rate_limit_key(request)
        with _rate_limit_lock:
            bucket = _rate_limit_store[key]
            while bucket and bucket[0] < window_start:
                bucket.popleft()
            if len(bucket) >= settings.rate_limit_requests:
                retry_after = max(1, int(bucket[0] + settings.rate_limit_window_sec - now))
                return _error(
                    429,
                    "rate_limited",
                    "too many requests",
                    request_id_override=rid,
                    headers={"Retry-After": str(retry_after)},
                )
            bucket.append(now)

    response = await call_next(request)
    elapsed_ms = round((perf_counter() - started) * 1000, 2)
    response.headers["X-Request-Id"] = rid
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        response.headers["Cache-Control"] = "no-store"

    logger.info(
        "request completed",
        extra={
            "request_id": rid,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": elapsed_ms,
        },
    )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(settings.cors_origin),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TRAINING_ZONES = [
    TrainingZone(id="rookie", key="rookie", label="小白区"),
    TrainingZone(id="starter", key="starter", label="入门区"),
    TrainingZone(id="advanced", key="advanced", label="进阶区"),
    TrainingZone(id="pro", key="pro", label="高手区"),
    TrainingZone(id="legend", key="legend", label="大神区"),
]


@app.exception_handler(RuntimeError)
def runtime_error_handler(request: Request, exc: RuntimeError) -> JSONResponse:
    message = str(exc)
    rid = _request_id_from_request(request)
    if "Supabase credentials missing" in message:
        return _error(500, "supabase_config_error", message, rid)
    return _error(500, "internal_error", message, rid)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="poker-god-api",
        timestamp=datetime.now(UTC).isoformat(),
    )


@app.get("/ready")
def ready(request: Request) -> JSONResponse:
    rid = _request_id_from_request(request)
    try:
        supabase = get_supabase_client()
        # Readiness requires both credentials and live database connectivity.
        supabase.table("pg_mvp_drills").select("id").limit(1).execute()
    except Exception as exc:  # noqa: BLE001 - readiness should report all failures
        return _error(503, "not_ready", str(exc), rid)

    return JSONResponse(
        status_code=200,
        content={
            "status": "ready",
            "service": "poker-god-api",
            "version": settings.app_version,
            "requestId": rid,
            "timestamp": datetime.now(UTC).isoformat(),
        },
    )


@app.get("/api/training/zones", response_model=TrainingZonesResponse)
def training_zones() -> TrainingZonesResponse:
    return TrainingZonesResponse(zones=TRAINING_ZONES)


@app.get("/api/study/spots", response_model=StudySpotListResponse)
def study_spots(
    response: Response,
    format: str | None = Query(default=None),
    position: str | None = Query(default=None),
    stack_bb: int | None = Query(default=None, alias="stackBb"),
    street: str | None = Query(default=None),
    limit: int = Query(default=120),
    offset: int = Query(default=0),
) -> StudySpotListResponse | JSONResponse:
    allowed_formats = {"Cash 6-max", "Cash Heads-Up", "MTT 9-max"}
    allowed_positions = {"BTN vs BB", "CO vs BTN", "SB vs BB", "UTG vs BB"}
    allowed_streets = {"Flop", "Turn", "River"}
    allowed_stacks = {20, 40, 60, 100}

    if format and format not in allowed_formats:
        return _error(400, "invalid_format", f"unsupported format: {format}")
    if position and position not in allowed_positions:
        return _error(400, "invalid_position", f"unsupported position: {position}")
    if street and street not in allowed_streets:
        return _error(400, "invalid_street", f"unsupported street: {street}")
    if stack_bb is not None and stack_bb not in allowed_stacks:
        return _error(400, "invalid_stack_bb", f"unsupported stackBb: {stack_bb}")

    try:
        supabase = get_supabase_client()
    except RuntimeError:
        supabase = None

    result = list_study_spots(
        supabase=supabase,
        format_filter=format,
        position_filter=position,
        stack_bb=stack_bb,
        street_filter=street,
        limit=limit,
        offset=offset,
    )
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=120"
    return result


@app.post("/api/zen/chat", response_model=ZenChatResponse)
def zen_chat(payload: ZenChatRequest) -> ZenChatResponse | JSONResponse:
    message = payload.message.strip()
    if not message:
        return _error(400, "invalid_message", "message must be between 1 and 2000 chars")
    sanitized = payload.model_copy(update={"message": message})
    return generate_zen_chat(sanitized, settings)


@app.get("/api/practice/drills", response_model=DrillListResponse)
def practice_list_drills() -> DrillListResponse:
    supabase = get_supabase_client()
    return list_drills(supabase)


@app.post("/api/practice/drills", response_model=DrillCreateResponse)
def practice_create_drill(payload: DrillCreateRequest) -> DrillCreateResponse:
    supabase = get_supabase_client()
    return create_drill(supabase, payload)


@app.post("/api/practice/sessions/start", response_model=PracticeSessionStartResponse)
def practice_start_session(payload: PracticeSessionStartRequest) -> PracticeSessionStartResponse | JSONResponse:
    supabase = get_supabase_client()
    result = start_practice_session(supabase, payload)
    if not result:
        return _error(404, "drill_not_found", f"drill {payload.drillId} not found")
    return result


@app.post("/api/practice/sessions/{session_id}/answer", response_model=PracticeSubmitAnswerResponse)
def practice_submit_answer(session_id: str, payload: PracticeSubmitAnswerRequest) -> PracticeSubmitAnswerResponse | JSONResponse:
    supabase = get_supabase_client()
    result = submit_practice_answer(supabase, session_id, payload)
    if not result:
        return _error(404, "session_not_found", f"session {session_id} not found or already completed")
    return result


@app.post("/api/practice/sessions/{session_id}/complete", response_model=PracticeCompleteSessionResponse)
def practice_complete_session(session_id: str) -> PracticeCompleteSessionResponse | JSONResponse:
    supabase = get_supabase_client()
    result = complete_practice_session(supabase, session_id)
    if not result:
        return _error(404, "session_not_found", f"session {session_id} not found")
    return result


@app.post("/api/analyze/uploads", response_model=AnalyzeUploadResponse)
def analyze_create_upload(
    payload: AnalyzeUploadCreateRequest,
    background_tasks: BackgroundTasks,
) -> AnalyzeUploadResponse:
    supabase = get_supabase_client()
    result = create_analyze_upload(supabase, payload)
    background_tasks.add_task(process_analyze_upload, supabase, result.upload.id)
    return result


@app.get("/api/analyze/uploads/{upload_id}", response_model=AnalyzeUploadResponse)
def analyze_get_upload(upload_id: str) -> AnalyzeUploadResponse | JSONResponse:
    supabase = get_supabase_client()
    result = get_analyze_upload(supabase, upload_id)
    if not result:
        return _error(404, "upload_not_found", f"upload {upload_id} not found")
    return result


@app.get("/api/analyze/hands", response_model=AnalyzeHandsResponse)
def analyze_list_hands(
    upload_id: str | None = Query(default=None, alias="uploadId"),
    sort_by: str | None = Query(default=None, alias="sortBy"),
    position: str | None = Query(default=None),
    tag: str | None = Query(default=None),
) -> AnalyzeHandsResponse:
    supabase = get_supabase_client()
    return list_analyze_hands(supabase, upload_id, sort_by, position, tag)


@app.get("/api/reports/leaks", response_model=LeakReportResponse)
def reports_leaks(window_days: int = Query(default=30, alias="windowDays")) -> LeakReportResponse:
    supabase = get_supabase_client()
    parsed_window = 7 if window_days == 7 else 90 if window_days == 90 else 30
    return build_leak_report(supabase, parsed_window)


@app.post("/api/coach/chat", response_model=CoachChatResponse)
def coach_chat_endpoint(payload: CoachChatRequest) -> CoachChatResponse | JSONResponse:
    message = payload.message.strip()
    if not message:
        return _error(400, "invalid_message", "message must be between 1 and 2000 chars")
    return coach_chat(payload.model_copy(update={"message": message}))


@app.post("/api/coach/actions/create-drill", response_model=DrillCreateResponse)
def coach_create_drill(payload: CoachCreateDrillRequest) -> DrillCreateResponse | JSONResponse:
    supabase = get_supabase_client()
    result = coach_create_drill_action(supabase, payload)
    if isinstance(result, str):
        return _error(409, "confirmation_required", result)
    return result


@app.post("/api/coach/actions/create-plan", response_model=CoachCreatePlanResponse)
def coach_create_plan(payload: CoachCreatePlanRequest) -> CoachCreatePlanResponse | JSONResponse:
    supabase = get_supabase_client()
    result = coach_create_plan_action(supabase, payload)
    if isinstance(result, str):
        return _error(409, "confirmation_required", result)
    return result


@app.post("/api/events", response_model=AnalyticsIngestResponse)
def events_ingest(payload: AnalyticsIngestRequest) -> AnalyticsIngestResponse:
    supabase = get_supabase_client()
    accepted = ingest_events(supabase, [event.model_dump(mode="python") for event in payload.events])
    return AnalyticsIngestResponse(requestId=request_id(), accepted=accepted)

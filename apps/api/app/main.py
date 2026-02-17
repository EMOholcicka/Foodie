from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.errors import (
    http_exception_handler,
    request_validation_exception_handler,
    unhandled_exception_handler,
)
from app.core.logging import RequestIdMiddleware, setup_logging
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.settings import get_settings
from app.routes.auth import router as auth_router
from app.routes.days import router as days_router
from app.routes.foods import router as foods_router
from app.routes.health import router as health_router
from app.routes.plans import router as plans_router
from app.routes.recipes import router as recipes_router
from app.routes.targets import router as targets_router
from app.routes.weights import router as weights_router


def create_app() -> FastAPI:
    settings = get_settings()

    setup_logging(level=settings.log_level)

    app = FastAPI(title="Foodie API", version="0.1.0")


    # Must be first so request_id is available to exception handlers and logs.
    app.add_middleware(RequestIdMiddleware)

    # Security headers fallback (prefer edge nginx).
    app.add_middleware(SecurityHeadersMiddleware)

    # Standardized error responses.
    from fastapi import HTTPException
    from fastapi.exceptions import RequestValidationError

    app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    cors_origins = settings.cors_origins_list()
    if cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            # Starlette requires this header for preflight validation.
            # Without it, preflight requests may return 400.
            allow_origin_regex=None,
        )

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(weights_router)
    app.include_router(foods_router)
    app.include_router(days_router)
    app.include_router(targets_router)
    app.include_router(recipes_router)
    app.include_router(plans_router)

    return app


app = create_app()

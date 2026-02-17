from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import RequestIdMiddleware, setup_logging
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
    app.add_middleware(RequestIdMiddleware)

    cors_origins = settings.cors_origins_list()
    if cors_origins:
        # Guardrail: Starlette/FastAPI forbids allow_origins=['*'] when allow_credentials=True.
        # Treat '*' as an invalid configuration to avoid surprising runtime behavior.
        if "*" in cors_origins:
            raise ValueError(
                "Invalid CORS_ORIGINS: cannot include '*' when allow_credentials is enabled. "
                "Set explicit origins (comma-separated), e.g. http://localhost:5173"
            )

        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
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

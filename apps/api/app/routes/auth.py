from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.settings import Settings, get_settings
from app.crud.refresh_sessions import (
    create_refresh_session,
    get_refresh_session_by_jti_for_update,
    rotate_refresh_session,
)
from app.crud.users import create_user, get_user_by_email, get_user_by_id
from app.db.session import get_db_session
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    password_hash = hash_password(payload.password)

    try:
        user = await create_user(session=session, email=str(payload.email).lower(), password_hash=password_hash)
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    subject = str(user.id)
    access = create_access_token(
        subject=subject,
        secret=settings.jwt_access_secret,
        expires_seconds=settings.jwt_access_expires_seconds,
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )
    refresh, refresh_jti = create_refresh_token(
        subject=subject,
        secret=settings.jwt_refresh_secret,
        expires_seconds=settings.jwt_refresh_expires_seconds,
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )
    await create_refresh_session(session=session, user_id=user.id, current_jti=refresh_jti)
    await session.commit()

    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = await get_user_by_email(session=session, email=str(payload.email).lower())
    if user is None or not verify_password(password=payload.password, password_hash=user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    subject = str(user.id)
    access = create_access_token(
        subject=subject,
        secret=settings.jwt_access_secret,
        expires_seconds=settings.jwt_access_expires_seconds,
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )
    refresh, refresh_jti = create_refresh_token(
        subject=subject,
        secret=settings.jwt_refresh_secret,
        expires_seconds=settings.jwt_refresh_expires_seconds,
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )
    await create_refresh_session(session=session, user_id=user.id, current_jti=refresh_jti)
    await session.commit()

    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    try:
        decoded = decode_token(
            token=payload.refresh_token,
            secret=settings.jwt_refresh_secret,
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            required_type="refresh",
        )
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    subject = str(decoded.get("sub"))
    try:
        user_id = uuid.UUID(subject)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = await get_user_by_id(session=session, user_id=user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    jti = decoded.get("jti")
    if not isinstance(jti, str) or not jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    refresh_session = await get_refresh_session_by_jti_for_update(session=session, jti=jti)
    if refresh_session is None:
        # Either revoked, rotated already, or never issued by us.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    new_access = create_access_token(
        subject=str(user.id),
        secret=settings.jwt_access_secret,
        expires_seconds=settings.jwt_access_expires_seconds,
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )
    new_refresh, new_jti = create_refresh_token(
        subject=str(user.id),
        secret=settings.jwt_refresh_secret,
        expires_seconds=settings.jwt_refresh_expires_seconds,
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )

    await rotate_refresh_session(session=session, refresh_session=refresh_session, new_jti=new_jti)
    await session.commit()

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)

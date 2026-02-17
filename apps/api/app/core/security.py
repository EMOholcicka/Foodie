from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError


_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(*, password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def create_access_token(
    *,
    subject: str,
    secret: str,
    expires_seconds: int,
    issuer: str,
    audience: str,
) -> str:
    now = datetime.now(tz=UTC)
    payload = {
        "sub": subject,
        "type": "access",
        "iss": issuer,
        "aud": audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_seconds)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def create_refresh_token(
    *,
    subject: str,
    secret: str,
    expires_seconds: int,
    issuer: str,
    audience: str,
    jti: str | None = None,
) -> tuple[str, str]:
    now = datetime.now(tz=UTC)
    refresh_jti = jti or uuid.uuid4().hex
    payload = {
        "sub": subject,
        "type": "refresh",
        "iss": issuer,
        "aud": audience,
        "jti": refresh_jti,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_seconds)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256"), refresh_jti


def decode_token(
    *,
    token: str,
    secret: str,
    issuer: str,
    audience: str,
    required_type: str | None = None,
) -> dict:
    payload = jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        issuer=issuer,
        audience=audience,
        options={
            "require": ["exp", "iat", "sub", "iss", "aud"],
            "verify_signature": True,
            "verify_exp": True,
            "verify_iat": True,
            "verify_iss": True,
            "verify_aud": True,
        },
    )

    if required_type is not None and payload.get("type") != required_type:
        raise jwt.InvalidTokenError("Invalid token type")

    return payload

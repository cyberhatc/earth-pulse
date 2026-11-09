"""Authentication helpers for NASA Earthdata.

The bundled sample demo does not need credentials. Real downloads (earthaccess /
OPeNDAP / CMR) use EARTHDATA_USERNAME and EARTHDATA_PASSWORD from the environment
- never hardcode credentials.
"""
from __future__ import annotations

import os


def get_earthdata_credentials() -> tuple[str | None, str | None]:
    user = os.environ.get("EARTHDATA_USERNAME")
    password = os.environ.get("EARTHDATA_PASSWORD")
    return user, password


def have_earthdata_credentials() -> bool:
    user, password = get_earthdata_credentials()
    return bool(user and password)


def earthaccess_login():
    """Log in with earthaccess (optional dependency). Returns the auth object or None."""
    try:
        import earthaccess  # type: ignore
    except ImportError:
        return None
    user, password = get_earthdata_credentials()
    if not (user and password):
        return None
    return earthaccess.login(strategy="environment")

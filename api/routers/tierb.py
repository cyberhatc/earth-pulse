"""GET /tier-b — opt-in live checks (NASA POWER, FIRMS, CMR). Never required for the demo."""
from __future__ import annotations

from fastapi import APIRouter, Query

from api.services import ondemand

router = APIRouter()


@router.get("/tier-b")
def tier_b(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return {
        "point": {"lat": lat, "lon": lon},
        "note": "Opt-in live probes; results are cached. Failures are reported, never fabricated.",
        **ondemand.tier_b_summary(lat, lon),
    }

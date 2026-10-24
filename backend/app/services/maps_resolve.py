"""Resolve Google Maps share links / place URLs into latitude & longitude."""

from __future__ import annotations

import re
from urllib.parse import parse_qs, unquote, urlparse

import httpx

from app.services.errors import fail

_PATTERNS = (
    # Place pin: !3dLAT!4dLNG (preferred — exact marker)
    re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)"),
    # Map center: @LAT,LNG,zoom
    re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)"),
    # Query / destination coords
    re.compile(r"[?&](?:q|query|destination|ll)=(-?\d+\.\d+),(-?\d+\.\d+)"),
    # /search/LAT,LNG
    re.compile(r"/search/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)"),
)

_PLACE_NAME = re.compile(r"/place/([^/@]+)")


def _valid_pair(lat: float, lng: float) -> bool:
    if abs(lat) > 90 or abs(lng) > 180:
        return False
    # Reject Null Island
    if abs(lat) < 1e-6 and abs(lng) < 1e-6:
        return False
    return True


def _extract_from_text(text: str) -> tuple[float, float] | None:
    if not text:
        return None
    decoded = unquote(text)
    for pattern in _PATTERNS:
        match = pattern.search(decoded)
        if not match:
            continue
        try:
            lat = float(match.group(1))
            lng = float(match.group(2))
        except (TypeError, ValueError):
            continue
        if _valid_pair(lat, lng):
            return lat, lng
    return None


def _place_name_from_url(url: str) -> str:
    match = _PLACE_NAME.search(unquote(url or ""))
    if not match:
        return ""
    return match.group(1).replace("+", " ").strip()


def resolve_google_maps_url(url: str) -> dict:
    """
    Follow redirects for maps.app.goo.gl / goo.gl / google.com/maps links
    and return { lat, lng, name, finalUrl, sourceUrl }.
    """
    raw = str(url or "").strip()
    if not raw:
        fail(422, "invalid_body", "Paste a Google Maps link.")
    if not re.match(r"^https?://", raw, flags=re.I):
        raw = "https://" + raw

    host = (urlparse(raw).hostname or "").lower()
    if host and "google." not in host and "goo.gl" not in host:
        fail(422, "invalid_maps_url", "Only Google Maps links are supported.")

    # Fast path — coords already in the pasted URL
    direct = _extract_from_text(raw)
    if direct:
        lat, lng = direct
        return {
            "lat": lat,
            "lng": lng,
            "name": _place_name_from_url(raw),
            "finalUrl": raw,
            "sourceUrl": raw,
        }

    try:
        with httpx.Client(follow_redirects=True, timeout=20.0) as client:
            response = client.get(
                raw,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (compatible; QMIS-ERP/1.0; +https://localhost) "
                        "AppleWebKit/537.36 (KHTML, like Gecko)"
                    ),
                    "Accept": "text/html,application/xhtml+xml",
                },
            )
    except httpx.HTTPError as exc:
        fail(502, "maps_unreachable", f"Could not open the Google Maps link: {exc}")

    final_url = str(response.url)
    body = response.text or ""
    candidates = [final_url, body[:80000]]

    # Also inspect redirect chain history URLs
    for hop in response.history:
        candidates.append(str(hop.url))

    # Common meta refresh / canonical
    for meta in re.findall(
        r'(?:content|href)=["\']([^"\']*(?:google\.com/maps|!3d|@)[^"\']*)["\']',
        body,
        flags=re.I,
    ):
        candidates.append(meta)

    for text in candidates:
        pair = _extract_from_text(text)
        if pair:
            lat, lng = pair
            name = _place_name_from_url(final_url) or _place_name_from_url(raw)
            # Prefer !3d!4d from the richest candidate when multiple exist
            return {
                "lat": lat,
                "lng": lng,
                "name": name,
                "finalUrl": final_url,
                "sourceUrl": raw,
            }

    # Query param fallback on final URL
    query = parse_qs(urlparse(final_url).query)
    for key in ("q", "query", "destination", "ll"):
        values = query.get(key) or []
        for value in values:
            pair = _extract_from_text(value)
            if pair:
                lat, lng = pair
                return {
                    "lat": lat,
                    "lng": lng,
                    "name": _place_name_from_url(final_url),
                    "finalUrl": final_url,
                    "sourceUrl": raw,
                }

    fail(
        422,
        "maps_coords_not_found",
        "Could not read latitude/longitude from that Google Maps link. "
        "Open the place in Google Maps → Share → Copy link, then paste again.",
    )

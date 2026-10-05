#!/usr/bin/env python3
"""Headless balloon scan for the GitHub Actions tracker.

Appends FlightRadar24 balloon positions to app-data/balloon_tracks.json
and app-data/balloon_history.json, rotates the history file into numbered
shards once it exceeds SHARD_LIMIT_BYTES, and rewrites app-data/manifest.json.
No Telegram, no geopy, no secrets.
"""

import datetime
import json
import math
import os
import sys

from FlightRadar24 import FlightRadar24API

BASE = os.path.dirname(os.path.abspath(__file__))          # .../hot-air-balloon-tracking
DATA = os.path.join(BASE, "app-data")
TRACKS = os.path.join(DATA, "balloon_tracks.json")
HISTORY = os.path.join(DATA, "balloon_history.json")
MANIFEST = os.path.join(DATA, "manifest.json")

HOME_LAT, HOME_LON = 50.770592730763454, 6.0958551248722275   # Aachen
HISTORY_RADIUS_KM = 1000        # history keeps balloons within this radius of home
SHARD_LIMIT_BYTES = 20 * 1024 * 1024
MAX_TRACK_POINTS = 288          # 24 h at a 5 min interval
MAX_HISTORY_POINTS = 1_000_000  # hard safety cap per active file (ponytail: kills runaway growth)
BALLOON_TYPES = ("BAL", "BALLON", "HOT", "LTA", "HOTR", "LIGHTER", "BALL", "HBAL", "BALLOON")
BOUNDS_STAGES_KM = (500, 2000, 5000)


def log(msg: str) -> None:
    print(msg, flush=True)


def is_balloon(flight) -> bool:
    code = (flight.aircraft_code or "").upper()
    callsign = (flight.callsign or "").upper()
    return any(t in code for t in BALLOON_TYPES) or any(
        t in callsign for t in ("BAL", "BALLON", "BALLOON", "HBAL")
    )


def ft_to_m(ft) -> int:
    return round((ft or 0) * 0.3048)


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def load(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save(path, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def scan_balloons(fr_api) -> list:
    """Global snapshot plus staged bounds scan around home, deduplicated by id."""
    found, seen = [], set()

    def add(f):
        if is_balloon(f) and f.id not in seen:
            seen.add(f.id)
            found.append(f)

    for f in fr_api.get_flights():
        add(f)
    for km in BOUNDS_STAGES_KM:
        bounds = fr_api.get_bounds_by_point(HOME_LAT, HOME_LON, km * 1000)
        for f in fr_api.get_flights(bounds=bounds):
            add(f)
    return found


def history_entry(b, now: str) -> dict:
    dist = haversine_km(HOME_LAT, HOME_LON, b.latitude, b.longitude)
    return {
        "id": b.id,
        "callsign": b.callsign or "N/A",
        "registration": b.registration or "N/A",
        "lat": b.latitude,
        "lon": b.longitude,
        "altitude": b.altitude,
        "altitude_m": ft_to_m(b.altitude),
        "ground_speed": b.ground_speed,
        "aircraft_code": b.aircraft_code or "Unknown",
        "distance_km": round(dist, 1),
        "timestamp": now,
        "date": now[:10],
    }


def update_tracks(balloons, now: str) -> tuple[dict, int]:
    tracks = load(TRACKS, {})
    added = 0
    for b in balloons:
        key = b.callsign or str(b.id)
        points = tracks.setdefault(key, [])
        points.append({
            "lat": b.latitude,
            "lon": b.longitude,
            "alt": b.altitude,
            "alt_m": ft_to_m(b.altitude),
            "time": now,
        })
        if len(points) > MAX_TRACK_POINTS:
            del points[:-MAX_TRACK_POINTS]
        added += 1
    save(TRACKS, tracks)
    return tracks, added


def rotate_history_if_needed() -> None:
    """Move a too-large active history file into a numbered shard."""
    if not os.path.exists(HISTORY) or os.path.getsize(HISTORY) <= SHARD_LIMIT_BYTES:
        return
    idx = 1
    while os.path.exists(os.path.join(DATA, f"balloon_history_{idx:03d}.json")):
        idx += 1
    shard = os.path.join(DATA, f"balloon_history_{idx:03d}.json")
    os.replace(HISTORY, shard)
    log(f"rotated history -> {os.path.basename(shard)}")


def append_history(balloons, now: str) -> tuple[list, int]:
    history = load(HISTORY, [])
    added = 0
    for b in balloons:
        if haversine_km(HOME_LAT, HOME_LON, b.latitude, b.longitude) > HISTORY_RADIUS_KM:
            continue
        history.append(history_entry(b, now))
        added += 1
    if len(history) > MAX_HISTORY_POINTS:
        history = history[-MAX_HISTORY_POINTS:]
    save(HISTORY, history)
    return history, added


def shard_summary(path: str) -> dict:
    data = load(path, [])
    return {
        "file": os.path.basename(path),
        "points": len(data),
        "first": data[0]["timestamp"] if data else None,
        "last": data[-1]["timestamp"] if data else None,
    }


def write_manifest(tracks: dict, history: list) -> dict:
    # Rotated shards are immutable: reuse their entries from the old manifest.
    old = load(MANIFEST, {})
    known = {s.get("file"): s for s in old.get("shards", []) if isinstance(s, dict)}
    # Rotated shards first (oldest -> newest), active file last.
    shards = []
    for name in sorted(
        n for n in os.listdir(DATA)
        if n.startswith("balloon_history_") and n.endswith(".json")
    ):
        shards.append(known.get(name) or shard_summary(os.path.join(DATA, name)))
    shards.append({
        "file": "balloon_history.json",
        "points": len(history),
        "first": history[0]["timestamp"] if history else None,
        "last": history[-1]["timestamp"] if history else None,
    })

    manifest = {
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "shards": shards,
        "history_points": sum(s.get("points", 0) for s in shards),
        "tracks_points": sum(len(v) for v in tracks.values()),
        "balloons": len(tracks),
    }
    save(MANIFEST, manifest)
    return manifest


def main() -> int:
    os.makedirs(DATA, exist_ok=True)
    fr_api = FlightRadar24API()
    try:
        balloons = scan_balloons(fr_api)
    except Exception as exc:  # network/API hiccups must not fail the whole run
        log(f"scan failed ({exc}), keeping previous data")
        return 0
    if not balloons:
        log("no balloons found, keeping previous data")
        return 0

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    tracks, track_added = update_tracks(balloons, now)
    history, hist_added = append_history(balloons, now)
    rotate_history_if_needed()
    manifest = write_manifest(tracks, history)
    log(
        f"{len(balloons)} balloons | +{track_added} track points | "
        f"+{hist_added} history points | {manifest['history_points']} total | "
        f"shards: {[s['file'] for s in manifest['shards']]}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

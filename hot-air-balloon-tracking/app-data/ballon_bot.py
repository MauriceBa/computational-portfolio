import json
import os
import math
import time
import datetime
import logging
from zoneinfo import ZoneInfo

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
from FlightRadar24 import FlightRadar24API

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ballon_bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# --- EINSTELLUNGEN ---
TELEGRAM_TOKEN = "8745987610:AAFq8QjeUvhKGu7i9KOBvXURbov-01OT5io"
TIMEZONE = ZoneInfo("Europe/Berlin")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "bot_config.json")
STATE_FILE  = os.path.join(BASE_DIR, "known_balloons.json")
STATS_FILE  = os.path.join(BASE_DIR, "daily_stats.json")
MUTE_FILE   = os.path.join(BASE_DIR, "mute_until.json")

BALLOON_JSON_PATH    = os.path.join(BASE_DIR, 'ballons', 'balloon_flights.json')
BALLOON_TRACKS_PATH  = os.path.join(BASE_DIR, 'ballons', 'balloon_tracks.json')
BALLOON_HISTORY_PATH = '/home/ubuntu/VPS_Coding_full/ballons/balloon_history.json'

# History: nur Ballons innerhalb dieses Radius werden gespeichert
HISTORY_RADIUS_KM = 1000
# History wird für immer gespeichert (kein Cutoff)

config = {
    "home_lat":  50.770592730763454,
    "home_lon":  6.0958551248722275,
    "home_city": "Aachen",
    "temp_lat":  0.0,
    "temp_lon":  0.0,
    "temp_city": "",
    "temp_until": 0,
    "radius":    50,
    "chat_id":   None
}

if os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, "r") as f:
        config.update(json.load(f))


def save_data():
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def is_muted() -> bool:
    if not os.path.exists(MUTE_FILE):
        return False
    try:
        with open(MUTE_FILE, "r") as f:
            data = json.load(f)
        return data.get("until", 0) > time.time()
    except Exception:
        return False


def get_mute_remaining() -> int:
    if not os.path.exists(MUTE_FILE):
        return 0
    try:
        with open(MUTE_FILE, "r") as f:
            data = json.load(f)
        remaining = data.get("until", 0) - time.time()
        return max(0, int(remaining // 60))
    except Exception:
        return 0


def is_balloon(flight) -> bool:
    balloon_types = ["BAL", "BALLON", "HOT", "LTA", "HOTR", "LIGHTER", "BALL", "HBAL", "BALLOON"]
    if flight.aircraft_code and any(bt in flight.aircraft_code.upper() for bt in balloon_types):
        return True
    if flight.callsign and any(bt in flight.callsign.upper() for bt in ["BAL", "BALLON", "BALLOON", "HBAL"]):
        return True
    return False


def get_distance_and_direction(lat1, lon1, lat2, lon2):
    dist = geodesic((lat1, lon1), (lat2, lon2)).kilometers
    angle = math.degrees(math.atan2(lon2 - lon1, lat2 - lat1))
    if angle < 0:
        angle += 360
    directions = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"]
    idx = int((angle + 22.5) // 45) % 8
    return round(dist, 1), directions[idx]


def ft_to_m(ft) -> int:
    return round(ft * 0.3048)


def format_balloon_msg(b, dist_km, direction, active_city) -> str:
    aircraft_type = b.aircraft_code if b.aircraft_code else "Ballon (LTA)"
    callsign = b.callsign if b.callsign else "N/A"
    reg = b.registration if b.registration else "N/A"
    alt_m = ft_to_m(b.altitude)
    return (
        f"🎈 <b>BALLON BEI {active_city.upper()}!</b>\n\n"
        f"<b>Typ:</b> {aircraft_type}\n"
        f"<b>Callsign / Reg:</b> {callsign} / {reg}\n"
        f"<b>Position:</b> {dist_km} km in Richtung {direction}\n"
        f"<b>Höhe:</b> {alt_m} m ({b.altitude} ft)\n"
        f"<b>Speed:</b> {b.ground_speed} kts\n\n"
        f"📍 <a href='https://www.flightradar24.com/{b.id}'>FlightRadar24 öffnen</a>"
    )


def _active_location():
    """Gibt den aktuell aktiven Standort zurück (temp oder Heimat)."""
    if config["temp_until"] > time.time():
        return config["temp_lat"], config["temp_lon"], config["temp_city"]
    return config["home_lat"], config["home_lon"], config["home_city"]


def _ensure_ballons_dir():
    os.makedirs(os.path.dirname(BALLOON_JSON_PATH), exist_ok=True)


def _build_flight_entry(b, current_time: str) -> dict:
    dist_km = geodesic(
        (config["home_lat"], config["home_lon"]),
        (b.latitude, b.longitude)
    ).kilometers
    return {
        "id":            b.id,
        "callsign":      b.callsign or "N/A",
        "registration":  b.registration or "N/A",
        "lat":           b.latitude,
        "lon":           b.longitude,
        "altitude":      b.altitude,
        "altitude_m":    ft_to_m(b.altitude),
        "ground_speed":  b.ground_speed,
        "aircraft_code": b.aircraft_code or "Unknown",
        "distance_km":   round(dist_km, 1),
        "timestamp":     current_time,
        "date":          current_time[:10],
    }


def _update_history(balloons: list, current_time: str):
    """Fügt alle Ballons im 1000km-Radius zur History hinzu.
    Die History wird für immer gespeichert – kein Cutoff."""
    # Bestehende History laden
    history: list = []
    if os.path.exists(BALLOON_HISTORY_PATH):
        try:
            with open(BALLOON_HISTORY_PATH, "r") as f:
                history = json.load(f)
        except Exception:
            history = []

    # Neue Einträge für Ballons im 1000km-Radius anfügen
    added = 0
    for b in balloons:
        dist_km = geodesic(
            (config["home_lat"], config["home_lon"]),
            (b.latitude, b.longitude)
        ).kilometers
        if dist_km > HISTORY_RADIUS_KM:
            continue
        entry = _build_flight_entry(b, current_time)
        history.append(entry)
        added += 1

    with open(BALLOON_HISTORY_PATH, "w") as f:
        json.dump(history, f, indent=2)

    logger.info("%d History-Einträge hinzugefügt, %d Gesamt (für immer gespeichert)",
                added, len(history))


# ─────────────────────────────────────────────────────────────
# BEFEHLE
# ─────────────────────────────────────────────────────────────

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    config["chat_id"] = update.effective_chat.id
    save_data()
    await update.message.reply_text(
        "🎈 <b>Ballon-Bot aktiv!</b>\n\n"
        "<b>📡 Überwachung:</b>\n"
        "  /radar – Aktuelle Ballons in der Nähe\n"
        "  /global – Weltweiter Ballon-Scan\n"
        "  /naechste – Nächsten Ballon + ETA\n\n"
        "<b>✈️ Flugzeuge:</b>\n"
        "  /flugzeuge – 5 nächste Flugzeuge (100 km)\n\n"
        "<b>⚙️ Einstellungen:</b>\n"
        "  /radius [km] – Suchradius ändern\n"
        "  /stadt [Name] – Temporären Standort setzen (12 h)\n"
        "  /mute [Stunden] – Benachrichtigungen pausieren\n"
        "  /unmute – Stummschaltung aufheben\n\n"
        "<b>📊 Info & Statistiken:</b>\n"
        "  /status – Bot-Status & Einstellungen\n"
        "  /wo – Aktuell verwendeter Standort\n"
        "  /stats – Statistiken gesehener Ballons\n"
        "  /info [Callsign] – Details zu einem Ballon\n"
        "  /help – Diese Hilfe\n",
        parse_mode="HTML",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await start(update, context)


async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if config["temp_until"] > time.time():
        remaining_h = round((config["temp_until"] - time.time()) / 3600, 1)
        loc_str = f"📍 Temporär: <b>{config['temp_city']}</b> (noch {remaining_h} h)"
    else:
        loc_str = f"🏠 Heimatort: <b>{config['home_city']}</b>"

    mute_str = "🔔 Benachrichtigungen: <b>Aktiv</b>"
    if is_muted():
        mute_str = f"🔕 Benachrichtigungen: <b>Stummgeschaltet</b> (noch {get_mute_remaining()} min)"

    known_count = 0
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            known_count = len(json.load(f))

    history_count = 0
    if os.path.exists(BALLOON_HISTORY_PATH):
        try:
            with open(BALLOON_HISTORY_PATH, "r") as f:
                history_count = len(json.load(f))
        except Exception:
            pass

    await update.message.reply_text(
        "📊 <b>Bot-Status</b>\n\n"
        f"{loc_str}\n"
        f"📡 Radius: <b>{config['radius']} km</b>\n"
        f"{mute_str}\n"
        f"👁️ Aktuell bekannte Ballons: <b>{known_count}</b>\n"
        f"📅 History-Einträge (gesamt): <b>{history_count}</b>\n"
        f"🌍 Website: <a href='http://mauricefun.lol/ballon/'>mauricefun.lol/ballon/</a>\n"
        f"📝 JSON: <a href='http://mauricefun.lol/ballon/balloon_flights.json'>balloon_flights.json</a>",
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


async def wo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if config["temp_until"] > time.time():
        remaining_h = round((config["temp_until"] - time.time()) / 3600, 1)
        await update.message.reply_text(
            f"📍 Aktueller Standort: <b>{config['temp_city']}</b> (temporär, noch {remaining_h} h)\n"
            f"🏠 Danach wieder: <b>{config['home_city']}</b>",
            parse_mode="HTML",
        )
    else:
        await update.message.reply_text(
            f"🏠 Aktueller Standort: <b>{config['home_city']}</b>\n"
            "(Nutze /stadt [Name] um temporär zu wechseln)",
            parse_mode="HTML",
        )


async def radar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("📡 Scanne Radar...")
    active_lat, active_lon, active_city = _active_location()
    try:
        fr_api = FlightRadar24API()
        bounds = fr_api.get_bounds_by_point(active_lat, active_lon, config["radius"] * 1000)
        flights = fr_api.get_flights(bounds=bounds)
        balloons = [f for f in flights if is_balloon(f)]
    except Exception as e:
        await update.message.reply_text("❌ Fehler beim Abrufen der Daten.")
        logger.error("Fehler bei /radar: %s", e)
        return

    if not balloons:
        await update.message.reply_text(
            f"🎈 Keine Ballons im Umkreis von {config['radius']} km um {active_city}.\n"
            "Radius ändern mit /radius [km]"
        )
        return

    balloon_distances = sorted(
        [(get_distance_and_direction(active_lat, active_lon, b.latitude, b.longitude) + (b,)) for b in balloons],
        key=lambda x: x[0]
    )

    msg = f"📡 <b>{len(balloons)} Ballon(s) im Umkreis von {config['radius']} km ({active_city}):</b>\n\n"
    for i, (dist, direction, b) in enumerate(balloon_distances, 1):
        alt_m = ft_to_m(b.altitude)
        msg += (
            f"<b>{i}. {b.aircraft_code or 'Ballon'}</b> ({b.callsign or 'N/A'})\n"
            f"   📏 {dist} km {direction} | 🎚️ {alt_m} m | 💨 {b.ground_speed} kts\n"
            f"   🔗 <a href='https://www.flightradar24.com/{b.id}'>FlightRadar24</a>\n\n"
        )
    await update.message.reply_text(msg, parse_mode="HTML", disable_web_page_preview=True)


async def naechste(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🔍 Suche nächsten Ballon...")
    active_lat, active_lon, active_city = _active_location()
    try:
        fr_api = FlightRadar24API()
        bounds = fr_api.get_bounds_by_point(active_lat, active_lon, 300_000)
        flights = fr_api.get_flights(bounds=bounds)
        balloons = [f for f in flights if is_balloon(f)]
    except Exception as e:
        await update.message.reply_text("❌ Fehler beim Abrufen der Daten.")
        logger.error("Fehler bei /naechste: %s", e)
        return

    if not balloons:
        await update.message.reply_text("🎈 Keine Ballons in 300 km Umgebung gefunden.")
        return

    balloon_distances = sorted(
        [(get_distance_and_direction(active_lat, active_lon, b.latitude, b.longitude) + (b,)) for b in balloons],
        key=lambda x: x[0]
    )
    dist, direction, b = balloon_distances[0]
    alt_m = ft_to_m(b.altitude)
    speed_kmh = b.ground_speed * 1.852 if b.ground_speed else 0

    msg = (
        f"🎈 <b>Nächster Ballon zu {active_city}:</b>\n\n"
        f"<b>Typ:</b> {b.aircraft_code or 'Ballon'} ({b.callsign or 'N/A'})\n"
        f"<b>Entfernung:</b> {dist} km in Richtung {direction}\n"
        f"<b>Höhe:</b> {alt_m} m ({b.altitude} ft)\n"
        f"<b>Speed:</b> {b.ground_speed} kts ({round(speed_kmh, 1)} km/h)\n"
    )
    if speed_kmh > 1:
        eta_min = round((dist / speed_kmh) * 60)
        msg += f"<b>ETA (grob):</b> ~{eta_min} Minuten\n"
    else:
        msg += "<b>ETA:</b> Ballon steht nahezu still\n"
    msg += f"\n🔗 <a href='https://www.flightradar24.com/{b.id}'>FlightRadar24</a>"
    if len(balloon_distances) > 1:
        msg += f"\n\n<i>({len(balloon_distances) - 1} weitere Ballons in 300 km)</i>"

    await update.message.reply_text(msg, parse_mode="HTML", disable_web_page_preview=True)


async def info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            "Nutze: /info [Callsign oder Teil davon]\n"
            "Beispiel: /info DEOAB\n\n"
            "Tipp: Callsigns findest du mit /radar"
        )
        return

    search_term = context.args[0].upper()
    await update.message.reply_text(f"🔍 Suche nach Ballon mit Callsign '{search_term}'...")
    active_lat, active_lon, active_city = _active_location()

    try:
        fr_api = FlightRadar24API()
        balloons = [f for f in fr_api.get_flights() if is_balloon(f)]
    except Exception as e:
        await update.message.reply_text("❌ Fehler beim Abrufen der Daten.")
        logger.error("Fehler bei /info: %s", e)
        return

    matches = [
        b for b in balloons
        if (b.callsign and search_term in b.callsign.upper())
        or (b.registration and search_term in b.registration.upper())
        or (b.id and search_term in str(b.id).upper())
    ]

    if not matches:
        await update.message.reply_text(
            f"❌ Kein Ballon mit '{search_term}' gefunden.\n"
            "Tipp: /radar zeigt Ballons in deiner Nähe mit Callsigns."
        )
        return

    b = matches[0]
    dist_km, direction = get_distance_and_direction(active_lat, active_lon, b.latitude, b.longitude)
    alt_m = ft_to_m(b.altitude)
    speed_kmh = round(b.ground_speed * 1.852, 1) if b.ground_speed else 0

    await update.message.reply_text(
        f"🎈 <b>Ballon: {b.callsign or 'N/A'}</b>\n\n"
        f"<b>Registrierung:</b> {b.registration or 'N/A'}\n"
        f"<b>Typ:</b> {b.aircraft_code or 'Unbekannt'}\n"
        f"<b>📍 Position:</b> {b.latitude:.4f}°N, {b.longitude:.4f}°E\n"
        f"<b>Entfernung:</b> {dist_km} km {direction} von {active_city}\n\n"
        f"<b>🎚️ Höhe:</b> {alt_m} m ({b.altitude} ft)\n"
        f"<b>💨 Speed:</b> {b.ground_speed} kts ({speed_kmh} km/h)\n\n"
        f"🗺️ <a href='https://www.google.com/maps?q={b.latitude},{b.longitude}'>Google Maps</a>  |  "
        f"📡 <a href='https://www.flightradar24.com/{b.id}'>FlightRadar24</a>",
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    known_count = 0
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            known_count = len(json.load(f))

    total_global = 0
    closest_ever = None
    if os.path.exists(BALLOON_JSON_PATH):
        try:
            with open(BALLOON_JSON_PATH, "r") as f:
                flight_data = json.load(f)
            total_global = len(flight_data)
            if flight_data:
                closest_ever = sorted(flight_data, key=lambda x: x.get("distance_km", 9999))[0]
        except Exception:
            pass

    history_count = 0
    if os.path.exists(BALLOON_HISTORY_PATH):
        try:
            with open(BALLOON_HISTORY_PATH, "r") as f:
                history_count = len(json.load(f))
        except Exception:
            pass

    msg = (
        "📊 <b>Ballon-Statistiken</b>\n\n"
        f"👁️ Bekannte Ballons (lokal): <b>{known_count}</b>\n"
        f"🌍 Ballons im letzten Scan: <b>{total_global}</b>\n"
        f"📅 History-Einträge (gesamt, 1000 km): <b>{history_count}</b>\n"
    )
    if closest_ever:
        msg += f"📍 Nächster (letzter Scan): <b>{closest_ever.get('distance_km', '?')} km</b> ({closest_ever.get('callsign', 'N/A')})\n"

    msg += (
        f"\n🏠 Heimatort: <b>{config['home_city']}</b>\n"
        f"📡 Suchradius: <b>{config['radius']} km</b>\n"
        "🔄 Scan-Intervall: <b>5 Minuten</b>"
    )
    await update.message.reply_text(msg, parse_mode="HTML")


async def mute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    hours = 1.0
    if context.args:
        try:
            hours = float(context.args[0])
            if not (0 < hours <= 72):
                await update.message.reply_text("❌ Bitte einen Wert zwischen 0.5 und 72 Stunden angeben.")
                return
        except ValueError:
            await update.message.reply_text("❌ Bitte eine gültige Zahl angeben. Beispiel: /mute 2")
            return

    until = time.time() + hours * 3600
    with open(MUTE_FILE, "w") as f:
        json.dump({"until": until}, f)

    until_dt = datetime.datetime.fromtimestamp(until, tz=TIMEZONE)
    await update.message.reply_text(
        f"🔕 Benachrichtigungen für <b>{hours} h stummgeschaltet</b>.\n"
        f"Wieder aktiv um: <b>{until_dt.strftime('%H:%M Uhr')}</b>\n\n"
        "Aufheben mit: /unmute",
        parse_mode="HTML",
    )


async def unmute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if os.path.exists(MUTE_FILE):
        os.remove(MUTE_FILE)
    await update.message.reply_text("🔔 Benachrichtigungen wieder <b>aktiv</b>!", parse_mode="HTML")


async def set_radius(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            f"📡 Aktueller Radius: <b>{config['radius']} km</b>\n"
            "Ändern mit: /radius [km]  Beispiel: /radius 30",
            parse_mode="HTML",
        )
        return
    try:
        new_radius = int(context.args[0])
        if 10 <= new_radius <= 1000:
            config["radius"] = new_radius
            save_data()
            await update.message.reply_text(f"✅ Radius auf <b>{new_radius} km</b> gesetzt!", parse_mode="HTML")
        else:
            await update.message.reply_text("❌ Radius muss zwischen 10 und 1000 km liegen.")
    except ValueError:
        await update.message.reply_text("❌ Bitte eine gültige Zahl eingeben.")


async def set_city(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Nutze: /stadt [Stadtname]\nBeispiel: /stadt Köln")
        return

    city_name = " ".join(context.args)
    geolocator = Nominatim(user_agent="ballon_bot")
    try:
        location = geolocator.geocode(city_name, timeout=10)
    except Exception as e:
        await update.message.reply_text("❌ Geocoding-Fehler. Bitte später erneut versuchen.")
        logger.error("Geocoding Fehler: %s", e)
        return

    if location:
        config["temp_lat"]   = location.latitude
        config["temp_lon"]   = location.longitude
        config["temp_city"]  = city_name
        config["temp_until"] = time.time() + 12 * 3600
        save_data()
        await update.message.reply_text(
            f"✅ Standort <b>temporär für 12 Stunden</b> geändert auf:\n"
            f"📍 <b>{city_name}</b> ({location.latitude:.4f}°, {location.longitude:.4f}°)\n\n"
            "<i>Starte sofortigen Suchlauf...</i>",
            parse_mode="HTML",
        )
        context.job_queue.run_once(check_balloons_local_job, 1)
    else:
        await update.message.reply_text("❌ Stadt nicht gefunden. Bitte erneut versuchen.")


async def global_scan(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🌍 Scanne in mehreren Zoom-Stufen nach Ballons...")
    try:
        fr_api = FlightRadar24API()
        seen_ids: set = set()
        all_balloons = []
        for dist_km in (500, 2000, 5000):
            bounds = fr_api.get_bounds_by_point(config["home_lat"], config["home_lon"], dist_km * 1000)
            for f in fr_api.get_flights(bounds=bounds):
                if is_balloon(f) and f.id not in seen_ids:
                    seen_ids.add(f.id)
                    all_balloons.append(f)
    except Exception as e:
        await update.message.reply_text("❌ Fehler beim weltweiten Scan.")
        logger.error("Fehler beim globalen Scan: %s", e)
        return

    if not all_balloons:
        await update.message.reply_text("🌍 Keine Ballons gefunden!")
        return

    _ensure_ballons_dir()
    current_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
    balloon_data = sorted(
        [_build_flight_entry(b, current_time) for b in all_balloons],
        key=lambda x: x["distance_km"]
    )

    with open(BALLOON_JSON_PATH, "w") as f:
        json.dump(balloon_data, f, indent=2)

    top5 = "".join(
        f"{i}. <b>{b['aircraft_code']}</b> ({b['callsign']}) – {b['distance_km']} km – {b['altitude_m']} m\n"
        for i, b in enumerate(balloon_data[:5], 1)
    )
    await update.message.reply_text(
        f"✅ <b>{len(all_balloons)} Ballons</b> gefunden & gespeichert!\n"
        f"🌍 <a href='http://mauricefun.lol/ballon/'>Website anzeigen</a>\n"
        f"📊 <a href='http://mauricefun.lol/ballon/balloon_flights.json'>JSON anzeigen</a>\n\n"
        f"<b>Die 5 nächsten zu {config['home_city']}:</b>\n{top5}",
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


async def flugzeuge(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🛩️ Scanne den Luftraum...")
    active_lat, active_lon, active_city = _active_location()
    try:
        fr_api = FlightRadar24API()
        bounds = fr_api.get_bounds_by_point(active_lat, active_lon, 100_000)
        flights = fr_api.get_flights(bounds=bounds)
    except Exception as e:
        await update.message.reply_text("❌ Fehler beim Abrufen der Flightradar-Daten.")
        logger.error("Fehler bei /flugzeuge: %s", e)
        return

    if not flights:
        await update.message.reply_text(f"Kein Flugzeug im Umkreis von 100 km um {active_city}!")
        return

    top5 = sorted(
        [(get_distance_and_direction(active_lat, active_lon, f.latitude, f.longitude) + (f,)) for f in flights],
        key=lambda x: x[0]
    )[:5]

    msg = f"✈️ <b>Die {len(top5)} nächsten Flugzeuge bei {active_city}:</b>\n\n"
    for i, (dist, direction, f) in enumerate(top5, 1):
        alt_m = ft_to_m(f.altitude)
        msg += (
            f"<b>{i}. {f.aircraft_code or 'Unbekannt'}</b> ({f.callsign or 'N/A'})\n"
            f"   📏 {dist} km {direction} | 🎚️ {alt_m} m | 💨 {f.ground_speed} kts\n"
            f"   🔗 <a href='https://www.flightradar24.com/{f.id}'>FlightRadar24</a>\n\n"
        )
    await update.message.reply_text(msg, parse_mode="HTML", disable_web_page_preview=True)


# ─────────────────────────────────────────────────────────────
# JOB QUEUE TASKS
# ─────────────────────────────────────────────────────────────

async def check_balloons_job(context: ContextTypes.DEFAULT_TYPE):
    """Weltweiter Scan – speichert balloon_flights.json (Snapshot) + Tracks + History (für immer)."""
    try:
        fr_api = FlightRadar24API()
        seen_ids: set = set()
        balloons = []
        for dist_km in (500, 2000, 5000):
            bounds = fr_api.get_bounds_by_point(
                config["home_lat"], config["home_lon"], dist_km * 1000
            )
            for f in fr_api.get_flights(bounds=bounds):
                if is_balloon(f) and f.id not in seen_ids:
                    seen_ids.add(f.id)
                    balloons.append(f)
    except Exception as e:
        logger.error("Fehler beim weltweiten Scan: %s", e)
        return

    if not balloons:
        logger.info("Kein Ballon im Multi-Stufen-Scan gefunden, behalte vorherige Daten.")
        return

    _ensure_ballons_dir()
    current_time = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # --- Tracks aktualisieren ---
    tracks: dict = {}
    if os.path.exists(BALLOON_TRACKS_PATH):
        try:
            with open(BALLOON_TRACKS_PATH, "r") as f:
                tracks = json.load(f)
        except Exception:
            tracks = {}

    balloon_data = []
    for b in balloons:
        entry = _build_flight_entry(b, current_time)
        balloon_data.append(entry)

        key = b.callsign or str(b.id)
        if key not in tracks:
            tracks[key] = []
        tracks[key].append({
            "lat":   b.latitude,
            "lon":   b.longitude,
            "alt":   b.altitude,
            "alt_m": ft_to_m(b.altitude),
            "time":  current_time,
        })
        # Tracks: max 288 Punkte pro Ballon behalten (24h bei 5min-Intervall)
        if len(tracks[key]) > 288:
            tracks[key] = tracks[key][-288:]

    balloon_data.sort(key=lambda x: x["distance_km"])

    # --- Snapshot speichern (aktueller Stand für Live-Ansicht) ---
    with open(BALLOON_JSON_PATH, "w") as f:
        json.dump(balloon_data, f, indent=2)
    with open(BALLOON_TRACKS_PATH, "w") as f:
        json.dump(tracks, f, indent=2)

    # --- History anfügen (1000km-Radius, für immer gespeichert) ---
    _update_history(balloons, current_time)

    logger.info("%d Ballons gespeichert, Tracks + History (permanent) aktualisiert", len(balloon_data))


async def check_balloons_local_job(context: ContextTypes.DEFAULT_TYPE):
    """Lokaler Scan für Telegram-Benachrichtigungen."""
    if not config.get("chat_id"):
        return
    if is_muted():
        logger.info("Lokaler Scan übersprungen – stummgeschaltet")
        return

    if config["temp_until"] > 0 and time.time() > config["temp_until"]:
        config["temp_until"] = 0
        save_data()
        try:
            await context.bot.send_message(
                chat_id=config["chat_id"],
                text=f"⏱️ Temporärer Standort abgelaufen! Radar scannt wieder <b>{config['home_city']}</b>.",
                parse_mode="HTML",
            )
        except Exception as e:
            logger.warning("Ablauf-Nachricht fehlgeschlagen: %s", e)

    active_lat, active_lon, active_city = _active_location()

    try:
        fr_api = FlightRadar24API()
        bounds = fr_api.get_bounds_by_point(active_lat, active_lon, config["radius"] * 1000)
        balloons = [f for f in fr_api.get_flights(bounds=bounds) if is_balloon(f)]
    except Exception as e:
        logger.error("Fehler beim lokalen Scan: %s", e)
        return

    known_balloons: list = []
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            known_balloons = json.load(f)

    current_ids: list = []
    for b in balloons:
        dist_km, direction = get_distance_and_direction(active_lat, active_lon, b.latitude, b.longitude)
        if dist_km > config["radius"]:
            continue
        current_ids.append(b.id)
        if b.id not in known_balloons:
            try:
                await context.bot.send_message(
                    chat_id=config["chat_id"],
                    text=format_balloon_msg(b, dist_km, direction, active_city),
                    parse_mode="HTML",
                    disable_web_page_preview=True,
                )
            except Exception as e:
                logger.warning("Benachrichtigung fehlgeschlagen: %s", e)

    updated = [bid for bid in known_balloons if bid in current_ids]
    for bid in current_ids:
        if bid not in updated:
            updated.append(bid)
    with open(STATE_FILE, "w") as f:
        json.dump(updated, f)


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

def main():
    async def post_init(application: Application) -> None:
        if config.get("chat_id"):
            try:
                await application.bot.send_message(
                    chat_id=config["chat_id"],
                    text="🎈 <b>Ballon-Bot neu gestartet!</b>\n"
                         "📡 Automatischer Scan alle 5 Minuten aktiv.\n"
                         "Alle Befehle: /help",
                    parse_mode="HTML",
                )
            except Exception as e:
                logger.warning("Startup-Nachricht fehlgeschlagen: %s", e)

    app = (
        Application.builder()
        .token(TELEGRAM_TOKEN)
        .post_init(post_init)
        .build()
    )

    handlers = [
        ("start",     start),
        ("help",      help_command),
        ("status",    status),
        ("wo",        wo),
        ("radar",     radar),
        ("naechste",  naechste),
        ("info",      info),
        ("stats",     stats),
        ("mute",      mute),
        ("unmute",    unmute),
        ("radius",    set_radius),
        ("stadt",     set_city),
        ("global",    global_scan),
        ("flugzeuge", flugzeuge),
    ]
    for cmd, handler in handlers:
        app.add_handler(CommandHandler(cmd, handler))

    jq = app.job_queue
    jq.run_repeating(check_balloons_job,       interval=300, first=10,  job_kwargs={"misfire_grace_time": 60})
    jq.run_repeating(check_balloons_local_job, interval=300, first=20,  job_kwargs={"misfire_grace_time": 60})

    logger.info("Bot gestartet! Befehle: /help")
    app.run_polling()


if __name__ == "__main__":
    main()

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from starlette.routing import NoMatchFound
from motor.motor_asyncio import AsyncIOMotorClient
from replication.replicator import ReplicationManager, wrap_database
from replication.config_store import load_config, save_config
from replication.audit_logger import AUDIT_LOG_FILE
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, ValidationError
from typing import List, Optional, Union, Dict, Any, Set
from functools import partial
from enum import Enum
import uuid
from datetime import datetime, timezone, timedelta
from collections import deque
from jose import jwt
from jose.exceptions import JWTError, ExpiredSignatureError
from passlib.context import CryptContext
import asyncio
from concurrent.futures import ThreadPoolExecutor
import base64
import io
import csv
import secrets
import re
import httpx
import random
import string
import stripe
from urllib.parse import urlparse
import unicodedata

ROOT_DIR = Path(__file__).parent
MEDIA_ROOT = ROOT_DIR / "media"
AVATAR_MEDIA_ROOT = MEDIA_ROOT / "avatars"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
AVATAR_MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

# Load default env first (backwards compatibility), then env-specific overrides
default_env_file = ROOT_DIR / '.env'
if default_env_file.exists():
    # Ensure local .env takes precedence over any pre-set OS environment vars
    load_dotenv(default_env_file, override=True)

app_env = os.getenv('APP_ENV', 'development')
env_specific_file = ROOT_DIR / f'.env.{app_env}'
if env_specific_file.exists():
    load_dotenv(env_specific_file, override=True)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Thread pool for blocking operations like email sending
executor = ThreadPoolExecutor(max_workers=5)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
# Primary database (unwrapped)
_primary_db = client[os.environ['DB_NAME']]
logger.info("[Startup] Mongo primary database configured: DB_NAME=%s URL=%s", os.environ.get('DB_NAME'), mongo_url)

# Replication manager and wrapped database
replication_manager = ReplicationManager()
db = wrap_database(_primary_db, replication_manager)

# Buffer em memória para monitorar últimos eventos de webhook do Stripe
STRIPE_WEBHOOK_EVENTS_BUFFER = deque(maxlen=200)

# Simple cache for Stripe config to reduce DB lookups
STRIPE_CONFIG_CACHE_TTL_SECONDS = 300
_STRIPE_CONFIG_CACHE = {
    "api_key": None,
    "ts": 0,
}

INVITE_ID_PREFIX = "invite-"
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _sanitize_language_token(value: Optional[str]) -> str:
    if not value:
        return ""
    token = unicodedata.normalize("NFKD", value)
    token = "".join(ch for ch in token if not unicodedata.combining(ch))
    token = token.lower()
    token = token.replace("_", "-")
    token = re.sub(r"[^a-z0-9-]", "", token)
    return token


_SUPPORTED_LANGUAGES_RAW: Dict[str, Dict[str, Any]] = {
    "pt": {
        "label": "Português (Brasil)",
        "interface_locale": "pt-BR",
        "course_locales": ["pt", "pt-BR"],
        "aliases": [
            "pt",
            "pt-br",
            "pt_br",
            "portugues",
            "português",
            "portugues-br",
            "portugues (brasil)",
            "br",
            "bra",
            "brazil",
            "brasil",
        ],
        "prefixes": ["pt", "por", "port", "braz", "br"],
    },
    "en": {
        "label": "English (US)",
        "interface_locale": "en-US",
        "course_locales": ["en", "en-US"],
        "aliases": [
            "en",
            "en-us",
            "en_us",
            "english",
            "ingles",
            "inglês",
            "ing",
            "usa",
            "us",
        ],
        "prefixes": ["en", "eng", "ing"],
    },
    "es": {
        "label": "Español",
        "interface_locale": "es-ES",
        "course_locales": ["es", "es-ES"],
        "aliases": [
            "es",
            "es-es",
            "es_es",
            "espanol",
            "español",
            "esp",
            "spanish",
            "castellano",
        ],
        "prefixes": ["es", "esp", "span", "castel", "cast"],
    },
    "fr": {
        "label": "Français",
        "interface_locale": "fr-FR",
        "course_locales": ["fr", "fr-FR"],
        "aliases": [
            "fr",
            "fr-fr",
            "fr_fr",
            "french",
            "frances",
            "francês",
            "francais",
            "français",
        ],
        "prefixes": ["fr", "fre", "fra"],
    },
}

SUPPORTED_LANGUAGES: Dict[str, Dict[str, Any]] = {}
for base_code, data in _SUPPORTED_LANGUAGES_RAW.items():
    aliases: Set[str] = {
        _sanitize_language_token(alias) for alias in data.get("aliases", [])
    } | {base_code}
    prefixes = tuple(
        _sanitize_language_token(prefix)
        for prefix in data.get("prefixes", [])
        if _sanitize_language_token(prefix)
    )
    SUPPORTED_LANGUAGES[base_code] = {
        "label": data.get("label", base_code.upper()),
        "interface_locale": data.get("interface_locale"),
        "aliases": {alias for alias in aliases if alias},
        "prefixes": prefixes if prefixes else (base_code,),
        "course_locales": tuple(data.get("course_locales", [])),
    }

DEFAULT_LANGUAGE_ORDER: List[str] = [
    code for code in ("pt", "es", "en", "fr") if code in SUPPORTED_LANGUAGES
]
DEFAULT_INTERFACE_LOCALE = {
    code: info.get("interface_locale")
    for code, info in SUPPORTED_LANGUAGES.items()
    if info.get("interface_locale")
}


class SubscriptionStatus(str, Enum):
    INACTIVE = "inativa"
    ACTIVE = "ativa"
    ACTIVE_UNTIL_PERIOD_END = "ativa_ate_final_do_periodo"
    ACTIVE_WITH_AUTO_RENEW = "ativa_com_renovacao_automatica"


def parse_datetime(value: Optional[Union[str, datetime]]) -> Optional[datetime]:
    """Normalize a datetime that may arrive as string or naive datetime."""
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            value_str = str(value)
            if value_str.endswith("Z"):
                value_str = value_str[:-1] + "+00:00"
            dt = datetime.fromisoformat(value_str)
        except Exception:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def determine_subscription_status(
    plan_id: Optional[str],
    valid_until: Optional[datetime],
    auto_renew: Optional[bool],
    now: Optional[datetime] = None,
) -> str:
    """Return normalized subscription status based on plan, validity and renewal settings."""
    if not plan_id:
        return SubscriptionStatus.INACTIVE.value
    now = now or datetime.now(timezone.utc)
    if not valid_until or valid_until <= now:
        return SubscriptionStatus.INACTIVE.value
    if auto_renew is None:
        return SubscriptionStatus.ACTIVE.value
    if auto_renew:
        return SubscriptionStatus.ACTIVE_WITH_AUTO_RENEW.value
    return SubscriptionStatus.ACTIVE_UNTIL_PERIOD_END.value


def build_subscription_snapshot(user_doc: dict) -> dict:
    """Compose a normalized subscription snapshot for a user document."""
    plan_id = user_doc.get("subscription_plan_id")
    valid_until = parse_datetime(user_doc.get("subscription_valid_until"))
    auto_renew = user_doc.get("subscription_auto_renew")
    # Backwards compatibility with legacy cancel flags
    if auto_renew is None and plan_id is not None:
        if "subscription_cancel_at_period_end" in user_doc:
            auto_renew = not bool(user_doc.get("subscription_cancel_at_period_end"))
        elif "subscription_cancelled" in user_doc:
            auto_renew = not bool(user_doc.get("subscription_cancelled"))
    status = determine_subscription_status(plan_id, valid_until, auto_renew)
    is_active = status != SubscriptionStatus.INACTIVE.value
    return {
        "plan_id": plan_id,
        "valid_until": valid_until,
        "valid_until_iso": valid_until.isoformat() if valid_until else None,
        "auto_renew": auto_renew if plan_id else None,
        "status": status,
        "is_active": is_active,
    }


def format_datetime_human(value: Optional[Union[str, datetime]]) -> Optional[str]:
    """Convert ISO or datetime into a friendly dd/mm/YYYY HH:MM string (UTC)."""
    dt = parse_datetime(value)
    if not dt:
        return None
    try:
        display = dt.strftime("%d/%m/%Y %H:%M")
        if dt.tzinfo:
            return f"{display} UTC"
        return display
    except Exception:
        return None


async def get_bunny_config() -> Dict[str, Any]:
    """Fetch Bunny integration settings from database."""
    config = await db.bunny_config.find_one({}, {"_id": 0})
    if not config:
        return {}
    return config


def sanitize_filename(filename: str) -> str:
    """Return a safe filename by keeping only ascii letters, digits, dash and underscore."""
    base_name = Path(filename or "").name  # Drop any directory traversal
    stem = "".join(ch if ch.isalnum() else "-" for ch in Path(base_name).stem)
    stem = stem or datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    suffix = Path(base_name).suffix.lower()
    if not suffix or len(suffix) > 12:
        suffix = ""
    return f"{stem}{suffix}"


def _ensure_local_media_dirs() -> None:
    """Make sure local media directories exist before writing files."""
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    AVATAR_MEDIA_ROOT.mkdir(parents=True, exist_ok=True)


def _normalize_public_base_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    return stripped.rstrip("/")


def _build_media_url(relative_path: str, request: Optional[Request] = None) -> str:
    """Build a public URL for a relative media path."""
    clean_relative = relative_path.strip().lstrip("/").replace("\\", "/")

    explicit_base = _normalize_public_base_url(os.environ.get("PUBLIC_MEDIA_BASE_URL"))
    if explicit_base:
        return f"{explicit_base}/media/{clean_relative}"

    if request is not None:
        try:
            return str(request.url_for("media", path=clean_relative))
        except NoMatchFound:
            pass

        forwarded_host = request.headers.get("x-forwarded-host")
        forwarded_proto = request.headers.get("x-forwarded-proto")
        forwarded_port = request.headers.get("x-forwarded-port")

        if forwarded_host:
            scheme = forwarded_proto or request.url.scheme
            host = forwarded_host
            if forwarded_port and ":" not in host:
                host = f"{host}:{forwarded_port}"
            return f"{scheme}://{host}/media/{clean_relative}"

        base_url = str(request.base_url).rstrip("/")
        if base_url.endswith("/api"):
            base_url = base_url[: -len("/api")]
        return f"{base_url}/media/{clean_relative}"

    return f"/media/{clean_relative}"


def _is_valid_http_url(value: Optional[str]) -> bool:
    """Return True if value is an HTTP/HTTPS URL with a hostname."""
    if not value:
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


async def _save_avatar_locally(upload_file: UploadFile, user_id: str, request: Optional[Request]) -> Dict[str, str]:
    """Persist an uploaded avatar to the local media directory."""
    _ensure_local_media_dirs()
    sanitized_name = sanitize_filename(upload_file.filename or "avatar.png")
    suffix = Path(sanitized_name).suffix or ".png"
    unique_name = f"{user_id}-{uuid.uuid4().hex[:12]}{suffix}"
    relative_path = f"avatars/{unique_name}"
    destination = MEDIA_ROOT / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)

    await upload_file.seek(0)
    with destination.open("wb") as out_file:
        while True:
            chunk = await upload_file.read(1_048_576)
            if not chunk:
                break
            out_file.write(chunk)

    public_url = _build_media_url(relative_path, request)
    return {"relative_path": relative_path.replace("\\", "/"), "public_url": public_url}


def _delete_local_avatar(relative_path: str) -> None:
    """Remove a previously saved local avatar file."""
    clean_relative = relative_path.strip().lstrip("/").replace("\\", "/")
    target = MEDIA_ROOT / clean_relative
    try:
        target.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning("Could not delete local avatar %s: %s", target, exc)

def sanitize_slug(value: Optional[str]) -> str:
    """Sanitize a human name into an ASCII slug: lowercase, hyphens, no special chars."""
    if not value:
        return ""
    # Normalize and strip accents
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    # Replace non-alnum with hyphen
    chars = [ch if ch.isalnum() else '-' for ch in ascii_only]
    slug = "".join(chars).lower()
    # Collapse multiple hyphens
    while "--" in slug:
        slug = slug.replace("--", "-")
    # Trim hyphens
    return slug.strip('-')


LIBRARY_ALLOWED_STATUSES: Set[str] = {
    "pending",
    "under_review",
    "approved",
    "published",
    "rejected",
    "archived",
}
LIBRARY_PUBLISHED_STATUSES: Set[str] = {"approved", "published"}
DEFAULT_LIBRARY_STATUS = "pending"


def _parse_bool(value: Union[str, bool, None], default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return default


def format_file_size(size_bytes: Optional[int]) -> Optional[str]:
    if not size_bytes or size_bytes <= 0:
        return None
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(size_bytes)
    idx = 0
    while size >= 1024 and idx < len(units) - 1:
        size /= 1024.0
        idx += 1
    if idx == 0:
        return f"{int(size)} {units[idx]}"
    return f"{size:.1f} {units[idx]}"


def parse_tags(value: Optional[str]) -> List[str]:
    if not value:
        return []
    tags = [tag.strip() for tag in re.split(r"[;,]", value) if tag.strip()]
    seen = set()
    unique: List[str] = []
    for tag in tags:
        lower = tag.lower()
        if lower in seen:
            continue
        seen.add(lower)
        unique.append(tag)
    return unique


def _sanitize_storage_path(*segments: Optional[str]) -> str:
    parts: List[str] = []
    for segment in segments:
        if not segment:
            continue
        for piece in str(segment).split("/"):
            piece = piece.strip()
            if not piece:
                continue
            sanitized = sanitize_slug(piece)
            if sanitized:
                parts.append(sanitized)
    return "/".join(parts)


def user_has_library_privileges(user: "User") -> bool:
    if user.role == "admin":
        return True
    if user.has_full_access:
        return True
    try:
        snapshot = build_subscription_snapshot(user.model_dump())
        return bool(snapshot.get("is_active"))
    except Exception:
        return False


def build_bunny_embed_html(library_id: str, video_guid: str, player_domain: Optional[str] = None) -> str:
    """Generate Bunny.net iframe embed snippet."""
    embed_base = "https://iframe.mediadelivery.net"
    if player_domain:
        # Allow using custom domains like https://myplayer.mydomain.com
        embed_base = player_domain.rstrip("/")
    src = f"{embed_base}/embed/{library_id}/{video_guid}"
    return (
        '<div style="position:relative;width:100%;padding-top:56.25%;">'
        f'<iframe src="{src}" loading="lazy" '
        'allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" '
        'allowfullscreen '
        'style="border:none;position:absolute;top:0;left:0;width:100%;height:100%;">'
        "</iframe>"
        "</div>"
    )


def is_invite_id(user_id: str) -> bool:
    """Check whether the supplied identifier represents a pending invitation."""
    return isinstance(user_id, str) and user_id.startswith(INVITE_ID_PREFIX)


def extract_token_from_invite_id(user_id: str) -> Optional[str]:
    """Extract the invitation token portion from a synthetic invite user_id."""
    if not is_invite_id(user_id):
        return None
    return user_id[len(INVITE_ID_PREFIX) :]


async def get_invite_doc_by_user_id(user_id: str) -> Optional[dict]:
    """Fetch the invitation document associated with the synthetic user identifier."""
    token = extract_token_from_invite_id(user_id)
    if not token:
        return None
    return await db.password_tokens.find_one({"token": token})


def build_pending_user_payload(invite_doc: dict, valid_course_ids: Optional[set[str]] = None) -> dict:
    """Normalize invitation documents so they match the shape expected by admin consumers."""
    if not invite_doc or "token" not in invite_doc:
        raise ValueError("Invitation document missing token")

    created_at = parse_datetime(invite_doc.get("created_at")) or datetime.now(timezone.utc)

    course_ids = invite_doc.get("course_ids") or []
    if not course_ids and invite_doc.get("course_id"):
        course_ids = [invite_doc["course_id"]]
    if valid_course_ids is not None:
        course_ids = [course_id for course_id in course_ids if course_id in valid_course_ids]

    return {
        "id": f"{INVITE_ID_PREFIX}{invite_doc['token']}",
        "email": invite_doc.get("email"),
        "name": invite_doc.get("name") or invite_doc.get("email"),
        "role": invite_doc.get("role") or "student",
        "has_full_access": bool(invite_doc.get("has_full_access")),
        "avatar": None,
        "has_purchased": False,
        "enrolled_courses": course_ids,
        "invited": True,
        "password_created": False,
        "created_at": created_at,
        "preferred_language": invite_doc.get("preferred_language"),
        "subscription_plan_id": None,
        "subscription_valid_until": None,
        "subscription_status": SubscriptionStatus.INACTIVE.value,
        "subscription_auto_renew": None,
    }


async def stripe_call_with_retry(func, *args, max_retries: int = 3, initial_delay: float = 0.5, max_delay: float = 3.0, **kwargs):
    attempt = 0
    last_exc: Optional[Exception] = None
    while True:
        try:
            # Run blocking Stripe calls in a thread to avoid blocking the event loop
            return await asyncio.to_thread(func, *args, **kwargs)
        except stripe.error.RateLimitError as e:
            transient = True
            last_exc = e
        except stripe.error.APIConnectionError as e:
            transient = True
            last_exc = e
        except stripe.error.APIError as e:
            status = getattr(e, 'http_status', None)
            transient = (status is None) or (int(status) >= 500)
            last_exc = e
        except stripe.error.StripeError as e:
            transient = False
            last_exc = e
        except Exception as e:
            # Non-Stripe unexpected error; do not retry by default
            last_exc = e
            raise

        if not transient or attempt >= max_retries:
            # Re-raise last error if not transient or max retries reached
            if last_exc:
                raise last_exc
            raise

        # Exponential backoff with jitter
        delay = min(max_delay, initial_delay * (2 ** attempt))
        jitter = random.uniform(0, delay * 0.2)
        delay += jitter
        logger.warning(f"Stripe transient error; retrying in {delay:.2f}s (attempt {attempt + 1}/{max_retries})")
        await asyncio.sleep(delay)
        attempt += 1

def _record_stripe_event(entry: dict):
    try:
        entry["timestamp"] = datetime.now(timezone.utc).isoformat()
        STRIPE_WEBHOOK_EVENTS_BUFFER.append(entry)
    except Exception:
        # Evita que falhas de monitoramento quebrem o fluxo do webhook
        pass

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
LEGACY_SECRET_KEYS = [
    key.strip()
    for key in os.environ.get('SECRET_KEY_FALLBACKS', '').split(',')
    if key.strip()
]
_KNOWN_SECRET_KEYS = [SECRET_KEY] + [k for k in LEGACY_SECRET_KEYS if k != SECRET_KEY]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

# Stripe Configuration
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
    stripe.api_version = '2025-10-29'

# Helper to ensure Stripe is configured with the latest available key
# Tries env -> existing api_key -> payment_settings in DB
async def ensure_stripe_config():
    # Use cached api_key if still valid
    try:
        now = datetime.now(timezone.utc).timestamp()
        if _STRIPE_CONFIG_CACHE.get("api_key") and (_STRIPE_CONFIG_CACHE.get("ts", 0) + STRIPE_CONFIG_CACHE_TTL_SECONDS > now):
            key = _STRIPE_CONFIG_CACHE.get("api_key")
            try:
                stripe.api_key = key
            except Exception:
                pass
            try:
                replication_manager.audit.info("stripe_config cache_hit source=memory")
            except Exception:
                pass
            return key
    except Exception:
        # Ignore cache errors
        pass
    # 1) Try environment variable
    key = os.environ.get('STRIPE_SECRET_KEY')
    if key:
        try:
            stripe.api_key = key
        except Exception:
            pass
        try:
            _STRIPE_CONFIG_CACHE["api_key"] = key
            _STRIPE_CONFIG_CACHE["ts"] = datetime.now(timezone.utc).timestamp()
        except Exception:
            pass
        try:
            replication_manager.audit.info("stripe_config env_key_used")
        except Exception:
            pass
        return key

    # 2) Try already configured api_key
    if getattr(stripe, 'api_key', None):
        try:
            _STRIPE_CONFIG_CACHE["api_key"] = stripe.api_key
            _STRIPE_CONFIG_CACHE["ts"] = datetime.now(timezone.utc).timestamp()
        except Exception:
            pass
        try:
            replication_manager.audit.info("stripe_config existing_key_used")
        except Exception:
            pass
        return stripe.api_key

    # 3) Fallback: read from payment_settings in DB
    try:
        settings = await db.payment_settings.find_one({}, {"_id": 0})
        if settings and settings.get("stripe_secret_key"):
            key = settings["stripe_secret_key"]
            try:
                stripe.api_key = key
            except Exception:
                pass
            # also set env to keep process aligned
            os.environ['STRIPE_SECRET_KEY'] = key
            try:
                _STRIPE_CONFIG_CACHE["api_key"] = key
                _STRIPE_CONFIG_CACHE["ts"] = datetime.now(timezone.utc).timestamp()
            except Exception:
                pass
            try:
                replication_manager.audit.info("stripe_config db_key_used")
            except Exception:
                pass
            return key
    except Exception:
        # Swallow DB errors here; the caller will handle missing config
        pass

    try:
        replication_manager.audit.error("stripe_config missing_key")
    except Exception:
        pass
    return None

# Helper to get frontend base URL with sensible default
def get_frontend_url():
    raw = (os.environ.get('FRONTEND_URL') or "http://localhost:3000").strip()
    # Allow comma-separated list; pick the first valid http/https base
    candidates = [p.strip() for p in raw.split(',') if p.strip()]
    for cand in candidates:
        url = cand[:-1] if cand.endswith('/') else cand
        if _is_valid_base_url(url):
            return url
    # Fallback to localhost if none valid
    return "http://localhost:3000"

def _is_valid_base_url(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.scheme in ("http", "https") and bool(p.netloc)
    except Exception:
        return False

# Create the main app
app = FastAPI()
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "student"  # admin or student
    has_full_access: bool = False  # Access to all courses
    preferred_language: Optional[str] = None  # User's preferred language (pt, en, es, etc.) - None means show all courses
    preferred_locale: Optional[str] = None  # Preferred interface locale (pt-BR, en-US, etc.)

class UserCreate(UserBase):
    password: Optional[str] = None  # Optional when inviting, but required for direct creation

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    has_full_access: Optional[bool] = None
    password: Optional[str] = None
    subscription_plan_id: Optional[str] = None
    subscription_valid_until: Optional[datetime] = None
    preferred_language: Optional[str] = None  # User's preferred language (pt, en, es, etc.) - None means show all courses
    preferred_locale: Optional[str] = None
    avatar: Optional[str] = None
    avatar_url: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    avatar: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_path: Optional[str] = None
    has_purchased: bool = False  # Whether user has made any purchase
    enrolled_courses: list[str] = []  # List of course IDs user is enrolled in
    invited: bool = False  # Whether user was invited
    password_created: bool = False  # Whether user created password from invitation
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    subscription_plan_id: Optional[str] = None
    subscription_valid_until: Optional[datetime] = None
    subscription_status: Optional[str] = None  # inativa, ativa, ativa_ate_final_do_periodo, ativa_com_renovacao_automatica
    subscription_auto_renew: Optional[bool] = None  # True quando renovação automática estiver ativa

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class AdminUserCreateResponse(BaseModel):
    user: User
    email_status: Optional[str] = None
    invitation_token: Optional[str] = None

# Enrollment Models
class EnrollmentBase(BaseModel):
    user_id: str
    course_id: str

class Enrollment(EnrollmentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enrolled_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Course Models
class CourseBase(BaseModel):
    title: str
    description: str
    thumbnail_url: Optional[str] = None
    category: Optional[str] = None
    categories: List[str] = []
    published: bool = False
    price_brl: Optional[float] = 0.0  # Price in BRL (R$)
    language: Optional[str] = None  # Course language (pt, en, es, etc.) - None means available for all languages
    # Bunny Stream per-course overrides (optional)
    bunny_stream_library_id: Optional[str] = None
    bunny_stream_api_key: Optional[str] = None
    bunny_stream_player_domain: Optional[str] = None

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    category: Optional[str] = None
    categories: Optional[List[str]] = None
    published: Optional[bool] = None
    price_brl: Optional[float] = None
    language: Optional[str] = None  # Course language (pt, en, es, etc.) - None means available for all languages
    bunny_stream_library_id: Optional[str] = None
    bunny_stream_api_key: Optional[str] = None
    bunny_stream_player_domain: Optional[str] = None

class Course(CourseBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    instructor_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Category Models
class CategoryBase(BaseModel):
    name: str
    description: str
    icon: Optional[str] = None  # lucide-react icon name
    color: Optional[str] = None  # optional tailwind color class

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None

class Category(CategoryBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Module Models
class ModuleBase(BaseModel):
    title: str
    description: Optional[str] = None
    order: int = 0
    # Bunny Stream per-module collection (optional)
    bunny_stream_collection_id: Optional[str] = None

class ModuleCreate(ModuleBase):
    course_id: str

class Module(ModuleBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Certificate Models
CERTIFICATE_BINDINGS = {
    "student_name",
    "course_title",
    "completion_date",
    "issued_date",
    "validation_code",
    "hours",
    "instructor_name",
    "custom",
}

CERTIFICATE_TEMPLATE_STATUSES = {"draft", "published"}


class CertificateTextElement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    binding: str = "custom"  # determines whether backend fills content dynamically
    content: Optional[str] = None
    font_family: str = "Poppins"
    font_weight: str = "600"
    font_size: int = 32
    color: str = "#0f172a"
    align: str = "center"
    uppercase: bool = False
    letter_spacing: float = 0.5
    width: float = 60.0  # percentage
    x: float = 20.0  # percentage
    y: float = 20.0  # percentage
    z_index: int = 1

    @classmethod
    def validate_binding(cls, value: str) -> str:
        normalized = (value or "custom").strip().lower()
        if normalized not in CERTIFICATE_BINDINGS:
            return "custom"
        return normalized

    def model_post_init(self, __context):
        object.__setattr__(self, "binding", self.validate_binding(self.binding))
        if not self.label:
            object.__setattr__(self, "label", self.binding.title())


class CertificateTemplateBase(BaseModel):
    name: str
    course_id: str
    description: Optional[str] = None
    background_url: Optional[str] = None
    background_path: Optional[str] = None
    badge_url: Optional[str] = None
    accent_color: str = "#10b981"
    text_elements: List[CertificateTextElement] = Field(default_factory=list)
    status: str = "draft"
    workload_hours: Optional[int] = None
    validation_message: Optional[str] = None
    signature_images: List[str] = Field(default_factory=list)


class CertificateTemplate(CertificateTemplateBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


class CertificateTemplateCreate(CertificateTemplateBase):
    pass


class CertificateTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    background_url: Optional[str] = None
    background_path: Optional[str] = None
    badge_url: Optional[str] = None
    accent_color: Optional[str] = None
    text_elements: Optional[List[CertificateTextElement]] = None
    status: Optional[str] = None
    workload_hours: Optional[int] = None
    validation_message: Optional[str] = None
    signature_images: Optional[List[str]] = None


class CertificateIssue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    template_id: str
    course_id: str
    user_id: str
    student_name: str
    student_email: str
    course_title: str
    workload_hours: Optional[int] = None
    token: str = Field(default_factory=lambda: secrets.token_urlsafe(12))
    validation_url: Optional[str] = None
    metadata: Dict[str, Any] = {}
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    template_snapshot: Optional[Dict[str, Any]] = None


class CertificateIssueWithTemplate(CertificateIssue):
    template: Optional[CertificateTemplate] = None


class AdminIssueCertificatePayload(BaseModel):
    user_id: Optional[str] = None
    email: Optional[EmailStr] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    completed_at: Optional[datetime] = None
    force_new: bool = False


class StudentCertificateIssuePayload(BaseModel):
    course_id: str
    force_new: bool = False

# Link Model for lessons
class LinkItem(BaseModel):
    title: str
    url: str

# Library Models
class LibraryFile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    url: str
    path: Optional[str] = None
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    size: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LibraryComment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: Optional[str] = None
    author_name: str
    author_avatar: Optional[str] = None
    message: str
    rating: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LibraryContributor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None


class LibraryResourceBase(BaseModel):
    title: str
    description: str
    category: Optional[str] = None
    type: Optional[str] = "project"
    tags: List[str] = []
    allow_download: bool = True
    status: str = DEFAULT_LIBRARY_STATUS
    demo_url: Optional[str] = None


class LibraryResourceCreate(LibraryResourceBase):
    pass


class LibraryResource(LibraryResourceBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    featured: bool = False
    is_community: bool = True
    cover_url: Optional[str] = None
    preview_url: Optional[str] = None
    average_rating: float = 0.0
    rating_count: int = 0
    downloads: int = 0
    comment_count: int = 0
    files: List[LibraryFile] = []
    comments: List[LibraryComment] = []
    ratings: List[Dict[str, Any]] = []
    contributor: Optional[LibraryContributor] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_moderation_note: Optional[str] = None


class LibraryRatingRequest(BaseModel):
    rating: int = Field(ge=1, le=5)


class LibraryCommentRequest(BaseModel):
    message: str
    rating: Optional[int] = Field(default=None, ge=1, le=5)

# Email Configuration Model
class EmailConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    brevo_api_key: Optional[str] = None  # API key for bulk operations
    brevo_smtp_key: Optional[str] = None  # SMTP key for transactional emails (deprecated - use smtp_password)
    smtp_username: Optional[str] = None  # SMTP username (e.g., 8cda09001@smtp-brevo.com)
    smtp_password: Optional[str] = None  # SMTP master password
    smtp_server: str = "smtp-relay.brevo.com"  # SMTP server
    smtp_port: int = 587  # SMTP port
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None


class BunnyConfig(BaseModel):
    """Configuration to integrate Bunny stream/storage services."""

    model_config = ConfigDict(extra="ignore")

    stream_library_id: Optional[str] = None
    stream_api_key: Optional[str] = None
    stream_collection_id: Optional[str] = None
    stream_player_domain: Optional[str] = None

    storage_zone_name: Optional[str] = None
    storage_api_key: Optional[str] = None
    storage_base_url: Optional[str] = None
    storage_directory: Optional[str] = None
    storage_host: Optional[str] = None

    default_upload_prefix: str = "uploads"

# Bulk Import Models
class BulkImportRequest(BaseModel):
    has_full_access: bool = False
    course_ids: list[str] = []
    csv_content: str  # Base64 encoded CSV

class PasswordCreationToken(BaseModel):
    token: str
    email: str
    name: str
    has_full_access: bool = False
    course_ids: list[str] = []
    expires_at: datetime
    token_history: List[str] = Field(default_factory=list)


class PasswordTokenResendRequest(BaseModel):
    token: str

# Lesson Models
class LessonBase(BaseModel):
    title: str
    type: str  # video, text, file
    content: str  # video URL, text content, or file URL
    duration: Optional[int] = 0  # in seconds
    order: int = 0
    links: List[LinkItem] = []  # Additional links for the lesson
    post_to_social: bool = True  # Control if lesson creation posts to community

class LessonCreate(LessonBase):
    module_id: str

class Lesson(LessonBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    module_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Comment Models
class CommentBase(BaseModel):
    content: str
    parent_id: Optional[str] = None
    resource_id: Optional[str] = None
    resource_title: Optional[str] = None
    resource_type: Optional[str] = None
    resource_category: Optional[str] = None
    resource_cover_url: Optional[str] = None

class CommentCreate(CommentBase):
    lesson_id: Optional[str] = None  # Optional for social posts

class Comment(CommentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lesson_id: Optional[str] = None  # Optional for social posts
    user_id: str
    user_name: str
    user_avatar: Optional[str] = None
    likes: int = 0
    replies_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Progress Models
class ProgressBase(BaseModel):
    lesson_id: str
    completed: bool = False
    last_position: int = 0  # in seconds

class Progress(ProgressBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== SUBSCRIPTION MODELS ====================

class SubscriptionPlanBase(BaseModel):
    name: str
    description: Optional[str] = None
    price_brl: float
    duration_days: int # Access duration in days
    is_active: bool = True # To easily enable/disable plans
    stripe_price_id: Optional[str] = None  # Price ID (recorrente) para checkout
    stripe_product_id: Optional[str] = None
    # Access scope
    access_scope: str = "full"  # "full" para toda plataforma, "specific" para cursos específicos
    course_ids: List[str] = []  # cursos liberados quando access_scope == "specific"

class SubscriptionPlanCreate(SubscriptionPlanBase):
    pass

class SubscriptionPlan(SubscriptionPlanBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreateBillingRequest(BaseModel):
    course_id: Optional[str] = None  # For buying course directly
    subscription_plan_id: Optional[str] = None  # For buying platform subscription
    customer_name: str
    customer_email: EmailStr

# Gamification Configuration
class GamificationSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    create_post: int = 10
    create_comment: int = 5
    receive_like: int = 2
    complete_course: int = 30
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

# (Support configuration routes moved below get_current_admin)

# Feature Flag Configuration
class FeatureFlag(BaseModel):
    model_config = ConfigDict(extra="ignore")
    key: str
    description: Optional[str] = None
    enabled_for_all: bool = False
    enabled_users: List[str] = []  # emails ou IDs de usuários
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

# Analytics Configuration
class AnalyticsConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    provider: Optional[str] = "posthog"
    send_events_enabled: bool = True
    allowed_events: List[str] = [
        "PageView","CourseView","LessonStart","LessonComplete","Like","Comment",
        "LeadCapture","Subscribe","Purchase","Login"
    ]
    allowed_fields: List[str] = [
        "user_id","user_email","user_name","user_role","course_id","lesson_id",
        "category","plan_id","has_full_access","language","referrer","utm_source",
        "utm_campaign","utm_medium","price_brl","subscription_status","subscription_auto_renew"
    ]
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

# Lead Capture Models
class LeadCaptureRequest(BaseModel):
    name: str
    email: str
    whatsapp: str

class BrevoConfig(BaseModel):
    api_key: str
    list_id: Optional[int] = None
    sales_page_url: Optional[str] = None

class BrevoListResponse(BaseModel):
    id: int
    name: str
    folder_id: Optional[int] = None

# Stripe Validation Models
class StripeMetadata(BaseModel):
    user_id: Optional[str] = None
    subscription_plan_id: Optional[str] = None
    access_scope: Optional[str] = "full"
    course_ids: Optional[Union[str, List[str]]] = None
    duration_days: Optional[Union[int, str]] = None

class StripeCheckoutSession(BaseModel):
    id: str
    object: str = "checkout.session"
    amount_total: Optional[int] = None
    amount_subtotal: Optional[int] = None
    currency: Optional[str] = None
    customer: Optional[str] = None
    customer_email: Optional[str] = None
    metadata: Optional[StripeMetadata] = None
    subscription: Optional[str] = None
    customer_details: Optional[dict] = None

class StripeInvoice(BaseModel):
    id: str
    object: str = "invoice"
    amount_paid: Optional[int] = None
    amount_due: Optional[int] = None
    currency: Optional[str] = None
    customer: Optional[str] = None
    customer_email: Optional[str] = None
    metadata: Optional[StripeMetadata] = None
    subscription: Optional[str] = None
    lines: Optional[dict] = None

# ==================== AUTH HELPERS ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def _authenticate_credentials(credentials: HTTPAuthorizationCredentials) -> "User":
    if not credentials:
        raise HTTPException(status_code=401, detail="Credenciais de autenticação são necessárias.")

    token = credentials.credentials
    last_error = None

    for key in _KNOWN_SECRET_KEYS:
        try:
            payload = jwt.decode(token, key, algorithms=[ALGORITHM])
            if key != SECRET_KEY:
                logger.warning("Token validated using fallback secret key")
            break
        except ExpiredSignatureError as exc:
            raise HTTPException(status_code=401, detail="Token expired") from exc
        except JWTError as exc:
            last_error = exc
            continue
    else:
        logger.exception("Failed to authenticate token: %s", last_error)
        raise HTTPException(status_code=401, detail="Invalid token") from last_error

    try:
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")

        # Ensure subscription users do not keep lifetime access once the plan ends
        snapshot = build_subscription_snapshot(user)
        if snapshot["plan_id"] and not snapshot["is_active"] and user.get("has_full_access"):
            await db.users.update_one({"id": user_id}, {"$set": {"has_full_access": False}})
            user["has_full_access"] = False

        return User(**user)
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as exc:
        logger.exception("Failed to authenticate token: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid token") from exc


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return await _authenticate_credentials(credentials)


async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)) -> Optional["User"]:
    if not credentials:
        return None
    return await _authenticate_credentials(credentials)


async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# (Feature flags removidos)

# Support Configuration
class SupportConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    support_url: str = "https://wa.me/5511999999999"  # Default WhatsApp
    support_text: str = "Suporte"
    enabled: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

@api_router.get("/support/config")
async def get_support_config():
    """Get public support button configuration"""
    cfg = await db.support_config.find_one({}, {"_id": 0})
    if not cfg:
        return SupportConfig().model_dump()
    # Ensure defaults if older docs are missing fields
    base = SupportConfig(**cfg).model_dump()
    return base

@api_router.post("/admin/support/config")
async def update_support_config(
    support_url: Optional[str] = None,
    support_text: Optional[str] = None,
    enabled: Optional[bool] = None,
    current_user: User = Depends(get_current_admin)
):
    """Update support button configuration (admin only).

    Accepts query params to match current frontend usage.
    """
    # Load existing or defaults
    existing = await db.support_config.find_one({}, {"_id": 0}) or {}
    cfg = SupportConfig(**{
        **existing,
        **({"support_url": support_url} if support_url is not None else {}),
        **({"support_text": support_text} if support_text is not None else {}),
        **({"enabled": enabled} if enabled is not None else {}),
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.email,
    }).model_dump()

    await db.support_config.replace_one({}, cfg, upsert=True)
    logger.info(f"Admin {current_user.email} updated support config")
    return {"message": "Support configuration updated successfully", "config": cfg}

# Backward-compatible non-prefixed route used by some frontend screens
@app.get("/support/config")
async def get_support_config_legacy():
    return await get_support_config()

# Helper function to check if user has access to a course (backward compatible)
async def user_has_course_access(user_id: str, course_id: str, has_full_access: bool = False) -> bool:
    """
    Check if user has access to a course.
    Checks BOTH enrollments collection (new system) and enrolled_courses field (legacy system)
    for backward compatibility with existing production data.
    """
    # Load user document to check subscription state, lifetime access and enrollments
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        return False

    snapshot = build_subscription_snapshot(user_doc)
    plan_id = snapshot["plan_id"]
    valid_until_dt = snapshot["valid_until"]

    has_lifetime_access = bool(user_doc.get("has_full_access")) and snapshot["status"] == SubscriptionStatus.INACTIVE.value

    if has_lifetime_access or (has_full_access and snapshot["status"] == SubscriptionStatus.INACTIVE.value):
        return True

    if plan_id:
        if snapshot["is_active"]:
            # Subscription is active regardless of auto-renew flag
            return True

        # Se assinatura não está mais ativa, remove o flag de acesso amplo herdado
        if user_doc.get("has_full_access"):
            await db.users.update_one({"id": user_id}, {"$set": {"has_full_access": False}})

    # Check enrollments collection (new system)
    enrollment = await db.enrollments.find_one({
        "user_id": user_id,
        "course_id": course_id
    })
    if enrollment:
        return True

    # Check user's enrolled_courses field (legacy system)
    if "enrolled_courses" in user_doc:
        return course_id in user_doc.get("enrolled_courses", [])

    return False

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # SECURITY: Force role to "student" for public registrations
    # Only admins can create other admin users via the admin panel
    user_data_dict = user_data.model_dump(exclude={"password"})
    user_data_dict["role"] = "student"  # Force student role for public registrations
    user_data_dict["full_access"] = False  # Force full_access to False
    
    user = User(**user_data_dict)
    user_dict = user.model_dump()
    user_dict['password_hash'] = get_password_hash(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_data = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_data['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**user_data)
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

def _normalize_language(code: Optional[str]) -> Optional[str]:
    """Normalize language codes to base values used for filtering.

    Accepts extended codes like 'pt-BR', 'en-US', 'es-ES' and returns
    base codes 'pt', 'en', 'es'. Returns None when input is falsy.
    """
    if not code:
        return None
    try:
        token = _sanitize_language_token(str(code))
    except Exception:
        return None

    if not token:
        return None

    if token in {"all", "any", "todos", "todas", "todo"}:
        return None

    ordered_codes = DEFAULT_LANGUAGE_ORDER + [
        base for base in SUPPORTED_LANGUAGES.keys() if base not in DEFAULT_LANGUAGE_ORDER
    ]

    for base_code in ordered_codes:
        info = SUPPORTED_LANGUAGES.get(base_code)
        if not info:
            continue
        if token in info["aliases"]:
            return base_code
        if any(token.startswith(prefix) for prefix in info["prefixes"]):
            return base_code

    if "-" in token:
        return _normalize_language(token.split("-")[0])

    return None

def _language_variants(base_code: Optional[str]) -> List[str]:
    """Return acceptable variants for a base language code.

    Ensures filtering matches both base and extended locale codes stored
    in course documents, e.g., 'pt' and 'pt-BR'.
    """
    if not base_code:
        return []
    info = SUPPORTED_LANGUAGES.get(base_code)
    if not info:
        return [base_code]
    variants = {base_code}
    interface_locale = info.get("interface_locale")
    if interface_locale:
        variants.add(interface_locale)
    for variant in info.get("course_locales", []):
        if variant:
            variants.add(variant)
    return list(variants)


def _default_locale_for(base_code: Optional[str]) -> Optional[str]:
    if not base_code:
        return None
    return DEFAULT_INTERFACE_LOCALE.get(base_code)


def _course_language_matches(course_language: Optional[str], preferred_base: str) -> bool:
    """Return True when the stored course language matches the preferred base code."""
    if not preferred_base:
        return True
    if not course_language:
        # Courses without language should always be shown
        return True

    normalized = _normalize_language(course_language)
    if normalized is None:
        return False
    return normalized == preferred_base

@api_router.put("/auth/language", response_model=User)
async def update_user_language(request: dict, current_user: User = Depends(get_current_user)):
    """Update user's preferred language (accepts base or extended codes)."""
    language = request.get('language')
    normalized = _normalize_language(language)

    if language is None:
        normalized = None
    elif isinstance(language, str):
        sanitized = _sanitize_language_token(language)
        if sanitized in {"", "all", "any", "todos", "todas", "todo"}:
            normalized = None
        elif normalized is None:
            raise HTTPException(
                status_code=400,
                detail="Unsupported language code",
            )
    elif normalized is None:
        # Non-string provided but did not normalize to a supported language
        raise HTTPException(
            status_code=400,
            detail="Unsupported language code",
        )

    locale = _default_locale_for(normalized)

    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"preferred_language": normalized, "preferred_locale": locale}}
    )

    # Return updated user
    updated_user = await db.users.find_one({"id": current_user.id})
    return User(**updated_user)

# ==================== USER PROFILE ROUTES ====================

@api_router.put("/user/profile", response_model=User)
async def update_user_profile(profile_data: UserUpdate, current_user: User = Depends(get_current_user)):
    """Update user profile information (normalizes preferred_language)."""
    update_fields: dict = {}

    if profile_data.name is not None:
        update_fields["name"] = profile_data.name

    if profile_data.email is not None:
        existing_user = await db.users.find_one({"email": profile_data.email, "id": {"$ne": current_user.id}})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already in use by another user")
        update_fields["email"] = profile_data.email

    if profile_data.preferred_language is not None:
        normalized = _normalize_language(profile_data.preferred_language)
        sanitized = (
            _sanitize_language_token(str(profile_data.preferred_language))
            if profile_data.preferred_language is not None
            else ""
        )
        if normalized is None and sanitized not in {"", "all", "any", "todos", "todas", "todo"}:
            raise HTTPException(status_code=400, detail="Unsupported language code")
        update_fields["preferred_language"] = normalized
        update_fields["preferred_locale"] = _default_locale_for(normalized)

    if profile_data.preferred_locale is not None:
        update_fields["preferred_locale"] = profile_data.preferred_locale

    if profile_data.avatar is not None:
        if profile_data.avatar and not _is_valid_http_url(profile_data.avatar):
            raise HTTPException(status_code=400, detail="URL de avatar inválida.")
        update_fields["avatar"] = profile_data.avatar or None
        update_fields["avatar_url"] = profile_data.avatar or None

    if profile_data.avatar_url is not None:
        if profile_data.avatar_url and not _is_valid_http_url(profile_data.avatar_url):
            raise HTTPException(status_code=400, detail="URL de avatar inválida.")
        update_fields["avatar"] = profile_data.avatar_url or None
        update_fields["avatar_url"] = profile_data.avatar_url or None

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db.users.update_one(
        {"id": current_user.id},
        {"$set": update_fields}
    )

    updated_user = await db.users.find_one({"id": current_user.id})
    return User(**updated_user)


@api_router.post("/user/avatar")
async def upload_user_avatar(
    avatar_file: UploadFile = File(None, alias="file"),
    legacy_avatar_file: UploadFile = File(None, alias="avatar_file"),
    request: Request = None,
    current_user: User = Depends(get_current_user),
):
    """Upload and set the user's profile avatar, storing the file on Bunny Storage."""
    file_obj = avatar_file or legacy_avatar_file
    if not file_obj or not file_obj.filename:
        raise HTTPException(status_code=400, detail="Nenhum arquivo foi enviado.")

    content_type = (file_obj.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Envie um arquivo de imagem (JPG ou PNG).")

    file_obj.file.seek(0, os.SEEK_END)
    size = file_obj.file.tell()
    file_obj.file.seek(0)
    if size and size > MAX_AVATAR_SIZE_BYTES:
        await file_obj.close()
        raise HTTPException(status_code=400, detail="A imagem deve ter no máximo 5 MB.")
    await file_obj.seek(0)

    config = await get_bunny_config()
    bunny_config = None
    use_bunny = False
    if config:
        try:
            bunny_config = _ensure_bunny_storage_ready(config)
            use_bunny = True
        except HTTPException as exc:
            logger.warning("Bunny storage config incompleto. Usando armazenamento local de avatar. Motivo: %s", exc.detail)

    existing = await db.users.find_one({"id": current_user.id}, {"_id": 0, "avatar_path": 1})

    sanitized_name = sanitize_filename(file_obj.filename or "avatar.png")

    if use_bunny and bunny_config:
        upload_result = await _upload_to_bunny_storage(
            file_obj,
            prefix=f"avatars/{current_user.id}",
            config=bunny_config,
            filename=sanitized_name,
        )
        avatar_url = upload_result["public_url"]
        avatar_path = upload_result["relative_path"]
    else:
        upload_result = await _save_avatar_locally(file_obj, current_user.id, request)
        avatar_url = upload_result["public_url"]
        avatar_path = f"local:{upload_result['relative_path']}"

    await db.users.update_one(
        {"id": current_user.id},
        {
            "$set": {
                "avatar": avatar_url,
                "avatar_url": avatar_url,
                "avatar_path": avatar_path,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    existing_path = (existing or {}).get("avatar_path")
    if existing_path and existing_path != avatar_path:
        if existing_path.startswith("local:"):
            _delete_local_avatar(existing_path.split("local:", 1)[1])
        elif bunny_config:
            await _delete_from_bunny_storage(existing_path, config=bunny_config)

    return {"avatar_url": avatar_url, "avatar": avatar_url}

@api_router.put("/user/password")
async def update_user_password(password_data: dict, current_user: User = Depends(get_current_user)):
    """Update user password"""
    current_password = password_data.get('current_password')
    new_password = password_data.get('new_password')
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current password and new password are required")
    
    # Get current user from database to verify password
    user_data = await db.users.find_one({"id": current_user.id})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(current_password, user_data['password_hash']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password length
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long")
    
    # Update password
    new_password_hash = get_password_hash(new_password)
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    return {"message": "Password updated successfully"}

@api_router.put("/user/preferences")
async def update_user_preferences(preferences: dict, current_user: User = Depends(get_current_user)):
    """Update user preferences"""
    # For now, we'll store preferences in the user document
    # In the future, this could be moved to a separate preferences collection
    
    allowed_preferences = [
        'email_notifications',
        'course_reminders', 
        'social_notifications',
        'marketing_emails'
    ]
    
    # Filter only allowed preferences
    filtered_preferences = {k: v for k, v in preferences.items() if k in allowed_preferences}
    
    if not filtered_preferences:
        raise HTTPException(status_code=400, detail="No valid preferences provided")
    
    # Update user preferences
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"preferences": filtered_preferences}}
    )
    
    return {"message": "Preferences updated successfully", "preferences": filtered_preferences}

@api_router.get("/user/preferences")
async def get_user_preferences(current_user: User = Depends(get_current_user)):
    """Get user preferences"""
    user_data = await db.users.find_one({"id": current_user.id})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return default preferences if none exist
    default_preferences = {
        'email_notifications': True,
        'course_reminders': True,
        'social_notifications': True,
        'marketing_emails': False
    }
    
    preferences = user_data.get('preferences', default_preferences)
    return preferences

# ==================== PASSWORD RECOVERY ====================

@api_router.post("/auth/forgot-password")
async def forgot_password(email: str):
    """Request password reset - public endpoint"""
    user = await db.users.find_one({"email": email})
    
    # Always return success to prevent email enumeration
    if not user:
        logger.info(f"Password reset requested for non-existent email: {email}")
        return {"message": "Se o email existir, você receberá instruções para redefinir sua senha"}
    
    # Get email settings
    email_settings = await db.email_config.find_one({})
    
    if not email_settings:
        logger.error(f"❌ CRITICAL: Email settings not configured! Cannot send password reset to {email}")
        logger.error("⚠️  Admin needs to configure email settings at /admin/email-settings")
        # Still return success to prevent email enumeration
        return {"message": "Se o email existir, você receberá instruções para redefinir sua senha"}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    reset_token_expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    
    # Save token to user
    await db.users.update_one(
        {"email": email},
        {
            "$set": {
                "password_reset_token": reset_token,
                "password_reset_expires": reset_token_expires
            }
        }
    )
    
    # Send email
    try:
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        
        # Send email using SMTP
        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            executor,
            send_brevo_email,
            email,
            user.get('name', 'Usuário'),
            "Recuperação de Senha",
            f"""
            <h2>Olá {user.get('name', 'Usuário')}!</h2>
            <p>Você solicitou a recuperação de senha da sua conta na plataforma Hiperautomação.</p>
            <p>Clique no link abaixo para redefinir sua senha (válido por 1 hora):</p>
            <p><a href="{reset_link}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Redefinir Senha</a></p>
            <p>Ou copie e cole este link no navegador:</p>
            <p>{reset_link}</p>
            <p>Se você não solicitou esta recuperação, ignore este email.</p>
            <p>Atenciosamente,<br>Equipe Hiperautomação</p>
            """,
            email_settings.get('smtp_username'),
            email_settings.get('smtp_password'),
            email_settings.get('sender_email', 'noreply@hiperautomacao.com'),
            email_settings.get('sender_name', 'Hiperautomação'),
            email_settings.get('smtp_server', 'smtp-relay.brevo.com'),
            email_settings.get('smtp_port', 587)
        )
        
        logger.info(f"✅ Password reset email sent to {email}")
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Error sending password reset email to {email}: {str(e)}")
    
    return {"message": "Se o email existir, você receberá instruções para redefinir sua senha"}

@api_router.post("/auth/reset-password")
async def reset_password(token: str, new_password: str):
    """Reset password using token - public endpoint"""
    # Find user with valid token
    user = await db.users.find_one({
        "password_reset_token": token,
        "password_reset_expires": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado")
    
    # Update password
    password_hash = get_password_hash(new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "password_hash": password_hash
            },
            "$unset": {
                "password_reset_token": "",
                "password_reset_expires": ""
            }
        }
    )
    
    logger.info(f"Password reset successful for user {user['email']}")
    
    return {"message": "Senha redefinida com sucesso!"}

# ==================== USER ROUTES ====================

@api_router.get("/user/subscription-status")
async def get_user_subscription_status(current_user: User = Depends(get_current_user)):
    """Get current user's subscription status"""
    try:
        # Get user's current subscription data
        user_data = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")

        has_full_access = user_data.get("has_full_access", False)
        snapshot = build_subscription_snapshot(user_data)
        plan_id = snapshot["plan_id"]
        now = datetime.now(timezone.utc)
        valid_until_dt = snapshot["valid_until"]
        valid_until_iso = valid_until_dt.isoformat() if valid_until_dt else None
        days_remaining = 0
        if valid_until_dt and valid_until_dt > now:
            days_remaining = max(0, (valid_until_dt - now).days)

        cancellation_type = None
        cancellation_note = None

        if snapshot["status"] == SubscriptionStatus.ACTIVE_UNTIL_PERIOD_END.value:
            cancellation_type = "period_end"
            cancellation_note = "Cancelamento programado ao final do ciclo atual."
        elif snapshot["status"] == SubscriptionStatus.INACTIVE.value and plan_id:
            cancellation_type = "expired"
            cancellation_note = "Assinatura expirada ou cancelada."

        if not plan_id:
            return {
                "has_subscription": False,
                "status": snapshot["status"],
                "subscription_plan": None,
                "valid_until": valid_until_iso,
                "is_active": False,
                "days_remaining": 0,
                "has_full_access": has_full_access,
                "subscription_plan_id": None,
                "subscription_valid_until": valid_until_iso,
                "subscription_cancel_at_period_end": False,
                "subscription_cancelled": snapshot["status"] == SubscriptionStatus.INACTIVE.value,
                "auto_renews": snapshot["auto_renew"],
                "renewal_date": None,
                "cancellation_type": cancellation_type,
                "cancellation_note": cancellation_note,
            }

        plan = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})

        return {
            "has_subscription": True,
            "status": snapshot["status"],
            "subscription_plan": plan,
            "valid_until": valid_until_iso,
            "is_active": snapshot["is_active"],
            "days_remaining": days_remaining,
            "has_full_access": has_full_access,
            "subscription_plan_id": plan_id,
            "subscription_valid_until": valid_until_iso,
            "subscription_cancel_at_period_end": snapshot["status"] == SubscriptionStatus.ACTIVE_UNTIL_PERIOD_END.value,
            "subscription_cancelled": snapshot["status"] == SubscriptionStatus.INACTIVE.value,
            "auto_renews": snapshot["auto_renew"],
            "renewal_date": valid_until_iso if snapshot["auto_renew"] else None,
            "cancellation_type": cancellation_type,
            "cancellation_note": cancellation_note,
        }

    except Exception as e:
        logger.error(f"Error getting subscription status for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving subscription status")

@api_router.get("/user/preferences")
async def get_user_preferences(current_user: User = Depends(get_current_user)):
    """Get current user's preferences"""
    try:
        user_data = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Return user preferences with defaults
        return {
            "email_notifications": user_data.get("email_notifications", True),
            "course_reminders": user_data.get("course_reminders", True),
            "social_notifications": user_data.get("social_notifications", True),
            "marketing_emails": user_data.get("marketing_emails", False)
        }
        
    except Exception as e:
        logger.error(f"Error getting preferences for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving user preferences")

@api_router.put("/user/preferences")
async def update_user_preferences(
    preferences: dict,
    current_user: User = Depends(get_current_user)
):
    """Update current user's preferences"""
    try:
        # Validate preferences keys
        valid_keys = {"email_notifications", "course_reminders", "social_notifications", "marketing_emails"}
        update_data = {k: v for k, v in preferences.items() if k in valid_keys and isinstance(v, bool)}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid preferences provided")
        
        # Update user preferences
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
        
        logger.info(f"Updated preferences for user {current_user.email}: {update_data}")
        return {"message": "Preferences updated successfully", "preferences": update_data}
        
    except Exception as e:
        logger.error(f"Error updating preferences for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Error updating user preferences")

@api_router.put("/user/password")
async def update_user_password(
    password_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update current user's password"""
    try:
        current_password = password_data.get("current_password")
        new_password = password_data.get("new_password")
        
        if not current_password or not new_password:
            raise HTTPException(status_code=400, detail="Current password and new password are required")
        
        # Get user data
        user_data = await db.users.find_one({"id": current_user.id})
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify current password
        if not verify_password(current_password, user_data["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Hash new password
        new_password_hash = get_password_hash(new_password)
        
        # Update password
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"password_hash": new_password_hash}}
        )
        
        logger.info(f"Password updated for user {current_user.email}")
        return {"message": "Password updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating password for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Error updating password")

# ==================== SUBSCRIPTION MANAGEMENT ENDPOINTS ====================

@api_router.get("/user/subscriptions")
async def get_user_subscriptions(current_user: User = Depends(get_current_user)):
    """Get current user's active subscriptions"""
    try:
        # Get user data
        user_data = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        
        subscriptions = []
        
        snapshot = build_subscription_snapshot(user_data)
        if snapshot["plan_id"]:
            plan = await db.subscription_plans.find_one(
                {"id": snapshot["plan_id"]},
                {"_id": 0},
            )
            if plan:
                valid_until_dt = snapshot["valid_until"]
                days_remaining = 0
                if valid_until_dt:
                    days_remaining = max(0, (valid_until_dt - datetime.now(timezone.utc)).days)
                subscription_info = {
                    "id": plan["id"],
                    "name": plan["name"],
                    "description": plan.get("description", ""),
                    "price_brl": plan.get("price_brl", 0),
                    "duration_days": plan.get("duration_days", 0),
                    "access_scope": plan.get("access_scope", "full"),
                    "course_ids": plan.get("course_ids", []),
                    "valid_until": valid_until_dt.isoformat() if valid_until_dt else None,
                    "is_active": snapshot["is_active"],
                    "days_remaining": days_remaining,
                    "stripe_price_id": plan.get("stripe_price_id"),
                    "can_cancel": bool(plan.get("stripe_price_id")),
                    "status": snapshot["status"],
                    "auto_renews": snapshot["auto_renew"],
                }
                subscriptions.append(subscription_info)
        
        return {"subscriptions": subscriptions}
        
    except Exception as e:
        logger.error(f"Error getting subscriptions for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving subscriptions")

@api_router.post("/user/subscriptions/{subscription_id}/cancel")
async def cancel_user_subscription(
    subscription_id: str,
    current_user: User = Depends(get_current_user)
):
    """Cancel a user's Stripe subscription"""
    try:
        # Verify user has this subscription
        user_data = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        if not user_data or user_data.get("subscription_plan_id") != subscription_id:
            raise HTTPException(status_code=404, detail="Subscription not found")
        
        # Get subscription plan
        plan = await db.subscription_plans.find_one({"id": subscription_id}, {"_id": 0})
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")
        
        # Only Stripe subscriptions can be cancelled through API
        if not plan.get("stripe_price_id"):
            raise HTTPException(status_code=400, detail="This subscription cannot be cancelled through the API")
        
        # Initialize Stripe
        stripe_key = await ensure_stripe_config()
        if not stripe_key:
            raise HTTPException(status_code=500, detail="Stripe not configured")
        
        # Find active Stripe subscription for this user
        try:
            # Search for subscriptions by customer email
            customers = await stripe_call_with_retry(stripe.Customer.list, email=current_user.email, limit=1)
            if not customers.data:
                raise HTTPException(status_code=404, detail="No Stripe customer found")
            
            customer = customers.data[0]
            subscriptions = await stripe_call_with_retry(stripe.Subscription.list, customer=customer.id, status='active')
            
            # Find subscription with matching price ID
            target_subscription = None
            for sub in subscriptions.data:
                for item in sub['items']['data']:
                    if item['price']['id'] == plan['stripe_price_id']:
                        target_subscription = sub
                        break
                if target_subscription:
                    break
            
            if not target_subscription:
                raise HTTPException(status_code=404, detail="Active Stripe subscription not found")
            
            # Cancel the subscription at period end
            cancelled_subscription = await stripe_call_with_retry(
                stripe.Subscription.modify,
                target_subscription.id,
                cancel_at_period_end=True
            )

            period_end = datetime.fromtimestamp(cancelled_subscription.current_period_end, timezone.utc)

            # Update user record to reflect cancellation
            await db.users.update_one(
                {"id": current_user.id},
                {
                    "$set": {
                        "subscription_auto_renew": False,
                        "subscription_status": SubscriptionStatus.ACTIVE_UNTIL_PERIOD_END.value,
                        "subscription_valid_until": period_end.isoformat(),
                    },
                    "$unset": {
                        "subscription_cancelled": "",
                        "subscription_cancel_at_period_end": "",
                    },
                },
            )

            logger.info(f"Subscription {subscription_id} cancelled for user {current_user.id}")
            
            return {
                "message": "Subscription cancelled successfully",
                "cancelled_at_period_end": True,
                "period_end": period_end.isoformat(),
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error cancelling subscription: {e}")
            raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error cancelling subscription for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Error cancelling subscription")

@api_router.get("/billing/{billing_id}/check-status")
async def check_billing_status(
    billing_id: str,
    current_user: User = Depends(get_current_user)
):
    """Check the status of a billing/payment"""
    try:
        # Find billing record
        billing = await db.billings.find_one({"billing_id": billing_id}, {"_id": 0})
        if not billing:
            raise HTTPException(status_code=404, detail="Billing not found")
        
        # Verify billing belongs to current user
        if billing.get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {
            "billing_id": billing["billing_id"],
            "status": billing.get("status", "pending"),
            "amount_brl": billing.get("amount_brl", 0),
            "created_at": billing.get("created_at"),
            "paid_at": billing.get("paid_at"),
            "course_id": billing.get("course_id"),
            "subscription_plan_id": billing.get("subscription_plan_id")
        }
        
    except Exception as e:
        logger.error(f"Error checking billing status {billing_id}: {e}")
        raise HTTPException(status_code=500, detail="Error checking billing status")

# ==================== ADMIN ROUTES - COURSES ====================

async def convert_category_names_to_ids(category_names: List[str]) -> List[str]:
    """
    Função auxiliar para converter nomes de categorias em IDs (retrocompatibilidade)
    """
    if not category_names:
        return []
    
    # Buscar categorias por nome
    existing_categories = await db.categories.find({"name": {"$in": category_names}}).to_list(None)
    category_name_to_id = {cat["name"]: cat["id"] for cat in existing_categories}
    
    # Converter nomes para IDs
    category_ids = []
    for name in category_names:
        if name in category_name_to_id:
            category_ids.append(category_name_to_id[name])
    
    return category_ids

@api_router.post("/admin/courses", response_model=Course)
async def create_course(course_data: CourseCreate, current_user: User = Depends(get_current_admin)):
    # Validation: ensure at least one category (new list or legacy field)
    payload = course_data.model_dump()
    # Normalize and validate language field for consistency
    if "language" in payload:
        raw_lang = payload.get("language")
        if raw_lang is None:
            normalized_lang = None
        elif isinstance(raw_lang, str):
            sanitized = _sanitize_language_token(raw_lang)
            normalized_lang = _normalize_language(sanitized)
            if sanitized in {"", "all", "any", "todos", "todas", "todo"}:
                normalized_lang = None
        else:
            normalized_lang = _normalize_language(raw_lang)

        if normalized_lang is None and raw_lang not in (None, "", "all", "any", "todos", "todas", "todo"):
            raise HTTPException(status_code=400, detail="Unsupported course language")
        payload["language"] = normalized_lang
    has_categories = bool(payload.get("categories"))
    has_legacy_category = bool(payload.get("category"))
    if not has_categories and not has_legacy_category:
        raise HTTPException(status_code=400, detail="Course must have at least one category")

    # Validate that all provided categories exist in the database
    if has_categories:
        category_ids = payload.get("categories", [])
        if category_ids:
            # Check if all category IDs exist
            existing_categories = await db.categories.find({"id": {"$in": category_ids}}).to_list(None)
            existing_category_ids = {cat["id"] for cat in existing_categories}
            invalid_categories = [cat_id for cat_id in category_ids if cat_id not in existing_category_ids]
            
            if invalid_categories:
                print(f"⚠️  UNAUTHORIZED CATEGORY CREATION ATTEMPT: User {current_user.email} tried to create course with invalid categories: {invalid_categories}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid category IDs: {invalid_categories}. Only existing categories are allowed."
                )

    # Backward compatibility: accept legacy 'category' field without populating 'categories'
    course = Course(**payload, instructor_id=current_user.id)
    course_dict = course.model_dump()
    course_dict['created_at'] = course_dict['created_at'].isoformat()
    
    await db.courses.insert_one(course_dict)
    print(f"✅ Course created successfully: {course.title} by {current_user.email}")
    return course

@api_router.get("/admin/courses", response_model=List[Course])
async def get_admin_courses(current_user: User = Depends(get_current_admin)):
    courses = await db.courses.find({}, {"_id": 0}).to_list(1000)
    for course in courses:
        if isinstance(course['created_at'], str):
            course['created_at'] = datetime.fromisoformat(course['created_at'])
    return courses

@api_router.get("/admin/courses/{course_id}", response_model=Course)
async def get_admin_course(course_id: str, current_user: User = Depends(get_current_admin)):
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if isinstance(course['created_at'], str):
        course['created_at'] = datetime.fromisoformat(course['created_at'])
    return Course(**course)

@api_router.put("/admin/courses/{course_id}", response_model=Course)
async def update_course(course_id: str, course_data: CourseUpdate, current_user: User = Depends(get_current_admin)):
    existing = await db.courses.find_one({"id": course_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Course not found")
    
    update_data = course_data.model_dump(exclude_unset=True)

    # Normalize and validate language updates
    if "language" in update_data:
        raw_lang = update_data.get("language")
        if raw_lang is None:
            normalized_lang = None
        elif isinstance(raw_lang, str):
            sanitized = _sanitize_language_token(raw_lang)
            normalized_lang = _normalize_language(sanitized)
            if sanitized in {"", "all", "any", "todos", "todas", "todo"}:
                normalized_lang = None
        else:
            normalized_lang = _normalize_language(raw_lang)

        if normalized_lang is None and raw_lang not in (None, "", "all", "any", "todos", "todas", "todo"):
            raise HTTPException(status_code=400, detail="Unsupported course language")
        update_data["language"] = normalized_lang

    # RETROCOMPATIBILIDADE: Detectar se categories contém nomes em vez de IDs
    prospective_categories = update_data.get("categories")
    if prospective_categories is not None and prospective_categories:
        # Verificar se algum item em categories parece ser um nome (não é um UUID)
        potential_names = []
        valid_ids = []
        
        for item in prospective_categories:
            # Se não parece ser um UUID (muito simples: se não tem hífens), trata como nome
            if '-' not in str(item) or len(str(item)) < 30:
                potential_names.append(str(item))
            else:
                valid_ids.append(item)
        
        # Se encontrou nomes, converter para IDs
        if potential_names:
            print(f"🔄 RETROCOMPATIBILIDADE: Convertendo nomes de categorias para IDs: {potential_names}")
            converted_ids = await convert_category_names_to_ids(potential_names)
            
            if len(converted_ids) != len(potential_names):
                # Alguns nomes não foram encontrados
                all_categories = await db.categories.find({}).to_list(None)
                available_names = [cat["name"] for cat in all_categories]
                print(f"⚠️  Nomes de categorias não encontrados. Disponíveis: {available_names}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Algumas categorias não foram encontradas: {potential_names}. Categorias disponíveis: {available_names}"
                )
            
            # Combinar IDs convertidos com IDs válidos
            update_data["categories"] = valid_ids + converted_ids
            prospective_categories = update_data["categories"]

    # Validation: ensure categories after update (consider legacy field)
    prospective_legacy = update_data.get("category")
    if prospective_categories is not None or prospective_legacy is not None:
        # If either field is being modified, ensure result has at least one category
        final_categories = prospective_categories if prospective_categories is not None else existing.get("categories", [])
        final_legacy = prospective_legacy if prospective_legacy is not None else existing.get("category")
        if not final_categories and not final_legacy:
            raise HTTPException(status_code=400, detail="Course must have at least one category")
    
    # Validate that all provided categories exist in the database (agora só IDs válidos)
    if prospective_categories is not None and prospective_categories:
        # Check if all category IDs exist
        existing_categories = await db.categories.find({"id": {"$in": prospective_categories}}).to_list(None)
        existing_category_ids = {cat["id"] for cat in existing_categories}
        invalid_categories = [cat_id for cat_id in prospective_categories if cat_id not in existing_category_ids]
        
        if invalid_categories:
            print(f"⚠️  UNAUTHORIZED CATEGORY UPDATE ATTEMPT: User {current_user.email} tried to update course {course_id} with invalid categories: {invalid_categories}")
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid category IDs: {invalid_categories}. Only existing categories are allowed."
            )
    
    await db.courses.update_one({"id": course_id}, {"$set": update_data})
    
    updated = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    print(f"✅ Course updated successfully: {updated.get('title', course_id)} by {current_user.email}")
    return Course(**updated)

@api_router.delete("/admin/courses/{course_id}")
async def delete_course(course_id: str, current_user: User = Depends(get_current_admin)):
    result = await db.courses.delete_one({"id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Delete associated modules and lessons
    await db.modules.delete_many({"course_id": course_id})
    modules = await db.modules.find({"course_id": course_id}).to_list(1000)
    for module in modules:
        await db.lessons.delete_many({"module_id": module['id']})
    
    return {"message": "Course deleted successfully"}

# ==================== ADMIN ROUTES - CATEGORIES ====================

@api_router.post("/admin/categories", response_model=Category)
async def create_category(category_data: CategoryCreate, current_user: User = Depends(get_current_admin)):
    # Ensure unique name
    existing = await db.categories.find_one({"name": category_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")

    category = Category(**category_data.model_dump())
    cat_dict = category.model_dump()
    cat_dict["created_at"] = cat_dict["created_at"].isoformat()
    await db.categories.insert_one(cat_dict)
    return category

@api_router.get("/admin/categories", response_model=List[Category])
async def list_categories(current_user: User = Depends(get_current_admin)):
    items = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    for c in items:
        if isinstance(c.get("created_at"), str):
            c["created_at"] = datetime.fromisoformat(c["created_at"])
    return [Category(**c) for c in items]

# Public categories listing for students (read-only)
@api_router.get("/categories", response_model=List[Category])
async def public_list_categories():
    items = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    for c in items:
        if isinstance(c.get("created_at"), str):
            c["created_at"] = datetime.fromisoformat(c["created_at"])
    return [Category(**c) for c in items]

@api_router.put("/admin/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, category_data: CategoryUpdate, current_user: User = Depends(get_current_admin)):
    existing = await db.categories.find_one({"id": category_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = category_data.model_dump(exclude_unset=True)
    # If renaming, ensure unique
    if "name" in update_data:
        dup = await db.categories.find_one({"name": update_data["name"], "id": {"$ne": category_id}})
        if dup:
            raise HTTPException(status_code=400, detail="Another category with this name already exists")

    await db.categories.update_one({"id": category_id}, {"$set": update_data})
    updated = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    return Category(**updated)

@api_router.delete("/admin/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_admin)):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    # Remove this category from all courses' categories lists
    await db.courses.update_many({}, {"$pull": {"categories": category_id}})
    return {"message": "Category deleted successfully"}

# ==================== ADMIN ROUTES - MODULES ====================

@api_router.post("/admin/modules", response_model=Module)
async def create_module(module_data: ModuleCreate, current_user: User = Depends(get_current_admin)):
    module = Module(**module_data.model_dump())
    module_dict = module.model_dump()
    module_dict['created_at'] = module_dict['created_at'].isoformat()
    
    await db.modules.insert_one(module_dict)
    return module

@api_router.get("/admin/modules/{course_id}", response_model=List[Module])
async def get_course_modules(course_id: str, current_user: User = Depends(get_current_admin)):
    modules = await db.modules.find({"course_id": course_id}, {"_id": 0}).sort("order", 1).to_list(1000)
    for module in modules:
        if isinstance(module['created_at'], str):
            module['created_at'] = datetime.fromisoformat(module['created_at'])
    return modules

@api_router.put("/admin/modules/{module_id}", response_model=Module)
async def update_module(module_id: str, module_data: ModuleBase, current_user: User = Depends(get_current_admin)):
    existing = await db.modules.find_one({"id": module_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Module not found")
    
    update_data = module_data.model_dump()
    await db.modules.update_one({"id": module_id}, {"$set": update_data})
    
    updated = await db.modules.find_one({"id": module_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Module(**updated)

@api_router.delete("/admin/modules/{module_id}")
async def delete_module(module_id: str, current_user: User = Depends(get_current_admin)):
    result = await db.modules.delete_one({"id": module_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Delete associated lessons
    await db.lessons.delete_many({"module_id": module_id})
    return {"message": "Module deleted successfully"}

# ==================== ADMIN ROUTES - LESSONS ====================

@api_router.post("/admin/lessons", response_model=Lesson)
async def create_lesson(lesson_data: LessonCreate, current_user: User = Depends(get_current_admin)):
    lesson = Lesson(**lesson_data.model_dump())
    lesson_dict = lesson.model_dump()
    lesson_dict['created_at'] = lesson_dict['created_at'].isoformat()
    
    await db.lessons.insert_one(lesson_dict)
    
    # Create automatic social post for the new lesson if enabled
    if lesson.post_to_social:
        await create_lesson_social_post(lesson, current_user)
    
    return lesson

async def create_lesson_social_post(lesson: Lesson, admin_user: User):
    """Create an automatic social post when a new lesson is published"""
    try:
        # Get module and course information
        module = await db.modules.find_one({"id": lesson.module_id}, {"_id": 0})
        if not module:
            return
            
        course = await db.courses.find_one({"id": module["course_id"]}, {"_id": 0})
        if not course:
            return
        
        # Create social post content
        post_content = f"🎓 Nova aula disponível!\n\n📚 **{lesson.title}**\n\n"
        
        if lesson.type == "video":
            post_content += "🎥 Aula em vídeo"
        elif lesson.type == "text":
            post_content += "📖 Conteúdo textual"
        elif lesson.type == "file":
            post_content += "📁 Material para download"
        
        post_content += f"\n\n🏷️ Curso: {course['title']}"
        post_content += f"\n📂 Módulo: {module['title']}"
        
        # Create the social post
        social_post = Comment(
            content=post_content,
            lesson_id=lesson.id,
            user_id=admin_user.id,
            user_name=admin_user.name,
            user_avatar=admin_user.avatar,
            parent_id=None  # This makes it a top-level post
        )
        
        post_dict = social_post.model_dump()
        post_dict['created_at'] = post_dict['created_at'].isoformat()
        
        await db.comments.insert_one(post_dict)
        
    except Exception as e:
        # Log error but don't fail lesson creation
        logger.error(f"Failed to create social post for lesson {lesson.id}: {str(e)}")

@api_router.get("/admin/lessons/{module_id}", response_model=List[Lesson])
async def get_module_lessons(module_id: str, current_user: User = Depends(get_current_admin)):
    lessons = await db.lessons.find({"module_id": module_id}, {"_id": 0}).sort("order", 1).to_list(1000)
    for lesson in lessons:
        if isinstance(lesson['created_at'], str):
            lesson['created_at'] = datetime.fromisoformat(lesson['created_at'])
    return lessons

@api_router.put("/admin/lessons/{lesson_id}", response_model=Lesson)
async def update_lesson(lesson_id: str, lesson_data: LessonBase, current_user: User = Depends(get_current_admin)):
    existing = await db.lessons.find_one({"id": lesson_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    update_data = lesson_data.model_dump()
    await db.lessons.update_one({"id": lesson_id}, {"$set": update_data})
    
    updated = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Lesson(**updated)

@api_router.delete("/admin/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, current_user: User = Depends(get_current_admin)):
    result = await db.lessons.delete_one({"id": lesson_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"message": "Lesson deleted successfully"}

# ==================== ADMIN ROUTES - USER MANAGEMENT ====================

@api_router.get("/admin/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(get_current_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    # Get all existing course IDs to filter out deleted courses
    existing_courses = await db.courses.find({}, {"_id": 0, "id": 1}).to_list(1000)
    valid_course_ids = {course['id'] for course in existing_courses}
    existing_emails = set()
    
    # For each user, get their enrolled courses (only valid ones)
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        
        # Skip users without 'id' field (legacy users)
        if 'id' not in user:
            # Generate a temporary ID for legacy users or skip them
            user['id'] = f"legacy-{user.get('email', 'unknown')}"
            user['enrolled_courses'] = []
            # Mesmo usuários legados podem não ter dados de assinatura
            user['subscription_status'] = SubscriptionStatus.INACTIVE.value
            user['subscription_auto_renew'] = None
            continue
        
        # Get enrolled courses from enrollments collection
        enrollments = await db.enrollments.find({"user_id": user['id']}).to_list(1000)
        # Filter to only include courses that still exist
        user['enrolled_courses'] = [
            enrollment['course_id'] 
            for enrollment in enrollments 
            if enrollment['course_id'] in valid_course_ids
        ]

        # Enriquecer com informações de assinatura
        try:
            snapshot = build_subscription_snapshot(user)
            user['subscription_status'] = snapshot['status']
            user['subscription_auto_renew'] = snapshot['auto_renew']
            user['subscription_valid_until'] = snapshot['valid_until']
        except Exception as e:
            # Não quebra a listagem se houver erro ao enriquecer assinatura
            logger.warning(f"Falha ao enriquecer assinatura de usuário {user.get('id')}: {e}")

        if user.get("email"):
            existing_emails.add(user["email"].lower())
    
    # Include pending invitations (users who received an invite link but have
    # not created their password / first login yet)
    pending_invites = await db.password_tokens.find({}, {"_id": 0}).to_list(1000)
    for invite in pending_invites:
        email = (invite.get("email") or "").lower()
        if email and email in existing_emails:
            logger.warning(
                "Pending invitation for %s ignored because an active user with the same email already exists",
                invite.get("email"),
            )
            continue

        try:
            pending_user = build_pending_user_payload(invite, valid_course_ids)
        except Exception as exc:
            logger.error("Failed to normalize invitation %s: %s", invite.get("token"), exc)
            continue

        if pending_user.get("email"):
            existing_emails.add(pending_user["email"].lower())
        users.append(pending_user)
    
    return users

@api_router.post("/admin/users", response_model=AdminUserCreateResponse)
async def create_user_by_admin(user_data: UserCreate, current_user: User = Depends(get_current_admin)):
    # Check if user exists
    normalized_email = user_data.email.lower()
    existing_user = await db.users.find_one({"email": normalized_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_invite = await db.password_tokens.find_one({"email": normalized_email})
    
    # Decide whether to create full account or invitation
    is_direct_creation = bool(user_data.password)
    
    if is_direct_creation:
        user_payload = user_data.model_dump(exclude={"password"})
        user_payload["email"] = normalized_email
        if user_payload.get("referral_code") is None:
            user_payload.pop("referral_code", None)

        if existing_invite:
            logger.info("Removing stale invitation for %s before creating full account", normalized_email)
            await db.password_tokens.delete_many({"email": normalized_email})
        user = User(**user_payload)
        user_dict = user.model_dump()
        user_dict['password_hash'] = get_password_hash(user_data.password)
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        await db.users.insert_one(user_dict)
        return AdminUserCreateResponse(user=user, email_status="not_applicable")
    
    # Invitation flow (no password provided)
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    now_iso = datetime.now(timezone.utc).isoformat()
    if existing_invite:
        logger.info("Refreshing existing invitation for %s via admin UI", normalized_email)
        combined_history = [token] + existing_invite.get("token_history", [])
        # Preserve original creation date if available
        created_at = existing_invite.get("created_at", now_iso)
        update_doc = {
            "$set": {
                "token": token,
                "email": normalized_email,
                "name": user_data.name,
                "has_full_access": user_data.has_full_access,
                "course_ids": existing_invite.get("course_ids", []),
                "expires_at": expires_at.isoformat(),
                "updated_at": now_iso,
                "token_history": list(dict.fromkeys(combined_history)),
                "created_at": created_at,
            }
        }
        await db.password_tokens.update_one({"_id": existing_invite["_id"]}, update_doc, upsert=True)
        token_data = await db.password_tokens.find_one({"_id": existing_invite["_id"]}, {"_id": 0})
    else:
        token_data = {
            "token": token,
            "email": normalized_email,
            "name": user_data.name,
            "has_full_access": user_data.has_full_access,
            "course_ids": [],
            "expires_at": expires_at.isoformat(),
            "created_at": now_iso,
            "updated_at": now_iso,
            "token_history": [token],
        }
        await db.password_tokens.insert_one(token_data)
    
    # Prepare response-like structure
    pending_payload = build_pending_user_payload(token_data)
    invited_user = User(**pending_payload)
    
    # Attempt to send invitation email if configuration exists
    email_config = await db.email_config.find_one({})
    email_info = None
    if email_config and email_config.get('sender_email'):
        password_link = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/create-password?token={token}"
        access_description = "acesso completo à plataforma" if user_data.has_full_access else "acesso a cursos específicos"
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #10b981;">Bem-vindo à Hiperautomação!</h2>
                    <p>Olá <strong>{user_data.name}</strong>,</p>
                    <p>Você foi convidado para a plataforma Hiperautomação com {access_description}.</p>
                    <p>Para acessar sua conta, crie sua senha:</p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="{password_link}" style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Criar Minha Senha
                        </a>
                    </div>
                    <p>Link direto: {password_link}</p>
                    <p><strong>Este link expira em 7 dias.</strong></p>
                </div>
            </body>
        </html>
        """
        loop = asyncio.get_event_loop()
        try:
            smtp_username = email_config.get('smtp_username') or email_config.get('sender_email')
            smtp_password = email_config.get('smtp_password') or email_config.get('brevo_smtp_key') or email_config.get('brevo_api_key')
            smtp_server = email_config.get('smtp_server', 'smtp-relay.brevo.com')
            smtp_port = email_config.get('smtp_port', 587)
            if smtp_username and smtp_password:
                email_sent = await loop.run_in_executor(
                    executor,
                    send_brevo_email,
                    normalized_email,
                    user_data.name,
                    "Bem-vindo à Hiperautomação - Crie sua senha",
                    html_content,
                    smtp_username,
                    smtp_password,
                    email_config['sender_email'],
                    email_config.get('sender_name'),
                    smtp_server,
                    smtp_port
                )
                email_info = "sent" if email_sent else "failed"
            else:
                email_info = "missing_credentials"
        except Exception as email_error:
            logger.error(f"Error sending invitation email to {normalized_email}: {email_error}")
            email_info = "error"
    else:
        email_info = "config_missing"
    
    return AdminUserCreateResponse(
        user=invited_user,
        email_status=email_info,
        invitation_token=token
    )

@api_router.put("/admin/users/{user_id}", response_model=User)
async def update_user_by_admin(user_id: str, user_data: UserUpdate, current_user: User = Depends(get_current_admin)):
    update_data = user_data.model_dump(exclude_unset=True)

    if is_invite_id(user_id):
        invite_doc = await get_invite_doc_by_user_id(user_id)
        if not invite_doc:
            raise HTTPException(status_code=404, detail="Invitation not found")

        invite_updates = {}

        if "email" in update_data and update_data["email"]:
            new_email = update_data["email"].lower()
            current_email = (invite_doc.get("email") or "").lower()
            if new_email != current_email:
                if await db.users.find_one({"email": new_email}):
                    raise HTTPException(status_code=400, detail="Email already registered")
                other_invite = await db.password_tokens.find_one(
                    {"email": new_email, "token": {"$ne": invite_doc["token"]}}
                )
                if other_invite:
                    raise HTTPException(
                        status_code=400,
                        detail="Another invitation already exists for this email",
                    )
                invite_updates["email"] = new_email

        if "name" in update_data and update_data["name"]:
            invite_updates["name"] = update_data["name"]

        if "has_full_access" in update_data:
            has_full = bool(update_data["has_full_access"])
            invite_updates["has_full_access"] = has_full
            if has_full:
                invite_updates["course_ids"] = []

        if not invite_updates:
            payload = build_pending_user_payload(invite_doc)
            return User(**payload)

        invite_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.password_tokens.update_one({"token": invite_doc["token"]}, {"$set": invite_updates})
        refreshed_invite = await db.password_tokens.find_one({"token": invite_doc["token"]}, {"_id": 0})
        payload = build_pending_user_payload(refreshed_invite)
        return User(**payload)

    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If password is being updated, hash it
    if "password" in update_data and update_data["password"]:
        update_data["password_hash"] = get_password_hash(update_data["password"])
        del update_data["password"]

    if "email" in update_data and update_data["email"]:
        new_email = update_data["email"].lower()
        if new_email != existing.get("email"):
            duplicate_user = await db.users.find_one({"email": new_email, "id": {"$ne": user_id}})
            if duplicate_user:
                raise HTTPException(status_code=400, detail="Email already registered")
            duplicate_invite = await db.password_tokens.find_one({"email": new_email})
            if duplicate_invite:
                logger.info(
                    "Removing invitation %s because email now belongs to user %s",
                    duplicate_invite.get("token"),
                    user_id,
                )
                await db.password_tokens.delete_many({"email": new_email})
        update_data["email"] = new_email
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return User(**updated)

@api_router.delete("/admin/users/{user_id}")
async def delete_user_by_admin(user_id: str, current_user: User = Depends(get_current_admin)):
    # Don't allow deleting yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    if is_invite_id(user_id):
        invite_doc = await get_invite_doc_by_user_id(user_id)
        if not invite_doc:
            raise HTTPException(status_code=404, detail="Invitation not found")
        await db.password_tokens.delete_one({"token": invite_doc["token"]})
        logger.info("Deleted pending invitation %s by admin %s", invite_doc.get("email"), current_user.email)
        return {"message": "Pending invitation deleted successfully"}
    
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete user's enrollments
    await db.enrollments.delete_many({"user_id": user_id})

    # Remove any stale invitations tied to the same email
    user_email = user_doc.get("email")
    if user_email:
        await db.password_tokens.delete_many({"email": user_email.lower()})

    return {"message": "User deleted successfully"}

# ==================== ADMIN ROUTES - SUBSCRIPTION PLANS ====================

@api_router.post("/admin/subscription-plans", response_model=SubscriptionPlan)
async def create_subscription_plan(plan_data: SubscriptionPlanCreate, current_user: User = Depends(get_current_admin)):
    plan = SubscriptionPlan(**plan_data.model_dump())
    plan_dict = plan.model_dump()
    plan_dict['created_at'] = plan_dict['created_at'].isoformat()
    
    await db.subscription_plans.insert_one(plan_dict)
    return plan

@api_router.get("/admin/subscription-plans", response_model=List[SubscriptionPlan])
async def get_subscription_plans(current_user: User = Depends(get_current_admin)):
    plans = await db.subscription_plans.find({}, {"_id": 0}).to_list(1000)
    for plan in plans:
        if isinstance(plan['created_at'], str):
            plan['created_at'] = datetime.fromisoformat(plan['created_at'])
    return plans

@api_router.put("/admin/subscription-plans/{plan_id}", response_model=SubscriptionPlan)
async def update_subscription_plan(plan_id: str, plan_data: SubscriptionPlanBase, current_user: User = Depends(get_current_admin)):
    existing = await db.subscription_plans.find_one({"id": plan_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    
    update_data = plan_data.model_dump(exclude_unset=True)
    await db.subscription_plans.update_one({"id": plan_id}, {"$set": update_data})
    
    updated = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return SubscriptionPlan(**updated)

@api_router.delete("/admin/subscription-plans/{plan_id}")
async def delete_subscription_plan(plan_id: str, current_user: User = Depends(get_current_admin)):
    result = await db.subscription_plans.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    return {"message": "Subscription plan deleted successfully"}

# Public: List active subscription plans for students to subscribe
@api_router.get("/subscriptions/plans")
async def list_active_subscription_plans():
    plans = await db.subscription_plans.find({"is_active": True}, {"_id": 0}).to_list(100)
    return plans

# ==================== ADMIN ROUTES - ENROLLMENT MANAGEMENT ====================

@api_router.post("/admin/enrollments")
async def enroll_user_in_course(enrollment: EnrollmentBase, current_user: User = Depends(get_current_admin)):
    # Verify course exists first
    course = await db.courses.find_one({"id": enrollment.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if is_invite_id(enrollment.user_id):
        invite_doc = await get_invite_doc_by_user_id(enrollment.user_id)
        if not invite_doc:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if invite_doc.get("has_full_access"):
            raise HTTPException(
                status_code=400,
                detail="Invitation already grants full access",
            )
        pending_courses = invite_doc.get("course_ids") or []
        if enrollment.course_id in pending_courses:
            raise HTTPException(status_code=400, detail="Invitation already includes this course")
        await db.password_tokens.update_one(
            {"token": invite_doc["token"]},
            {
                "$addToSet": {"course_ids": enrollment.course_id},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
            },
        )
        return {"message": "Course linked to pending invitation"}

    # Check if enrollment already exists
    existing = await db.enrollments.find_one({
        "user_id": enrollment.user_id,
        "course_id": enrollment.course_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="User already enrolled in this course")
    
    # Verify user exists
    user = await db.users.find_one({"id": enrollment.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create enrollment
    enroll_obj = Enrollment(**enrollment.model_dump())
    enroll_dict = enroll_obj.model_dump()
    enroll_dict['enrolled_at'] = enroll_dict['enrolled_at'].isoformat()
    
    await db.enrollments.insert_one(enroll_dict)
    return {"message": "User enrolled successfully"}

@api_router.get("/admin/enrollments/{user_id}")
async def get_user_enrollments(user_id: str, current_user: User = Depends(get_current_admin)):
    if is_invite_id(user_id):
        invite_doc = await get_invite_doc_by_user_id(user_id)
        if not invite_doc:
            raise HTTPException(status_code=404, detail="Invitation not found")
        course_ids = invite_doc.get("course_ids") or []
        # Backwards compatibility with single course field
        if not course_ids and invite_doc.get("course_id"):
            course_ids = [invite_doc["course_id"]]

        result = []
        for course_id in course_ids:
            course = await db.courses.find_one({"id": course_id}, {"_id": 0})
            if course:
                result.append(
                    {
                        "enrollment_id": f"invite_{course_id}",
                        "course_id": course_id,
                        "course_title": course["title"],
                        "enrolled_at": invite_doc.get("created_at"),
                    }
                )
        return result

    # First, try to get from enrollments collection (old method)
    enrollments = await db.enrollments.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    
    # Get course details for each enrollment
    result = []
    for enrollment in enrollments:
        course = await db.courses.find_one({"id": enrollment["course_id"]}, {"_id": 0})
        if course:
            result.append({
                "enrollment_id": enrollment["id"],
                "course_id": enrollment["course_id"],
                "course_title": course["title"],
                "enrolled_at": enrollment["enrolled_at"]
            })
    
    # Also get courses from user's enrolled_courses field (legacy direct grants)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user and user.get("enrolled_courses"):
        for course_id in user.get("enrolled_courses", []):
            # Check if already in result
            if not any(e["course_id"] == course_id for e in result):
                course = await db.courses.find_one({"id": course_id}, {"_id": 0})
                if course:
                    result.append({
                        "enrollment_id": f"direct_{course_id}",  # Synthetic ID for direct enrollments
                        "course_id": course_id,
                        "course_title": course["title"],
                        "enrolled_at": user.get("created_at", "")  # Use user creation date as fallback
                    })
    
    return result

@api_router.delete("/admin/enrollments/{enrollment_id}")
async def remove_enrollment(enrollment_id: str, current_user: User = Depends(get_current_admin)):
    result = await db.enrollments.delete_one({"id": enrollment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return {"message": "Enrollment removed successfully"}

@api_router.delete("/admin/enrollments/user/{user_id}/course/{course_id}")
async def remove_user_from_course(user_id: str, course_id: str, current_user: User = Depends(get_current_admin)):
    if is_invite_id(user_id):
        invite_doc = await get_invite_doc_by_user_id(user_id)
        if not invite_doc:
            raise HTTPException(status_code=404, detail="Invitation not found")
        await db.password_tokens.update_one(
            {"token": invite_doc["token"]},
            {"$pull": {"course_ids": course_id}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"message": "Course removed from pending invitation"}

    result = await db.enrollments.delete_one({"user_id": user_id, "course_id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return {"message": "User removed from course successfully"}

# ==================== STUDENT ROUTES ====================

@api_router.get("/student/courses")
async def get_published_courses(
    language: Optional[str] = Query(
        None,
        description="Optional language code (pt, en, es) overriding the user's preference.",
    ),
    include_all_languages: bool = Query(
        False,
        description="Return all published courses without applying the preferred language filter.",
    ),
    current_user: User = Depends(get_current_user),
):
    """Get all published courses with enrollment status.

    By default the result is filtered by the user's preferred language (base or extended code).
    """
    requested_language = _normalize_language(language)
    preferred = (
        requested_language
        if requested_language is not None
        else _normalize_language(current_user.preferred_language)
    )

    courses = await db.courses.find({"published": True}, {"_id": 0}).to_list(1000)
    if preferred and not include_all_languages:
        # Strict filtering: only include courses explicitly tagged with a matching language
        courses = [
            course
            for course in courses
            if (course.get("language") is not None) and _course_language_matches(course.get("language"), preferred)
        ]
    
    # Get user's enrollments from BOTH sources for backward compatibility
    # 1. From enrollments collection (new system)
    enrollments = await db.enrollments.find({"user_id": current_user.id}).to_list(1000)
    enrolled_course_ids = [e["course_id"] for e in enrollments]
    
    # 2. From user's enrolled_courses field (legacy system)
    user_doc = await db.users.find_one({"id": current_user.id})
    if user_doc and "enrolled_courses" in user_doc and user_doc["enrolled_courses"]:
        # Merge with enrollments collection data
        legacy_courses = set(user_doc["enrolled_courses"])
        enrolled_course_ids = list(set(enrolled_course_ids) | legacy_courses)
    
    # Determine subscription state
    subscription_snapshot = build_subscription_snapshot(user_doc or {})
    has_subscription = bool(subscription_snapshot["plan_id"])
    subscription_active = bool(subscription_snapshot["is_active"])
    subscription_access_scope = "full"
    subscription_course_ids: set[str] = set()
    if has_subscription and subscription_snapshot["plan_id"]:
        plan_doc = await db.subscription_plans.find_one(
            {"id": subscription_snapshot["plan_id"]},
            {"_id": 0, "access_scope": 1, "course_ids": 1},
        )
        if plan_doc:
            subscription_access_scope = plan_doc.get("access_scope", "full")
            if subscription_access_scope == "specific":
                subscription_course_ids = {cid for cid in plan_doc.get("course_ids", []) if cid}

    # Add enrollment status to each course
    result = []
    has_lifetime_access = bool(
        (user_doc.get("has_full_access") if user_doc else current_user.has_full_access)
        and not has_subscription
    )
    for course in courses:
        if isinstance(course['created_at'], str):
            course['created_at'] = datetime.fromisoformat(course['created_at'])
        
        # Add enrollment info
        course_data = dict(course)
        course_data['is_enrolled'] = course['id'] in enrolled_course_ids or has_lifetime_access
        # Access rules:
        # - lifetime full access: sempre True
        # - assinatura cancelada para o fim do ciclo: acesso continua até expirar
        # - assinatura cancelada imediatamente: bloqueia
        # - assinatura ativa: True apenas se matriculado
        # - no subscription: True if enrolled (legacy/lifetime purchases)
        if has_lifetime_access:
            course_data['has_access'] = True
        elif has_subscription:
            if not subscription_active:
                course_data['has_access'] = False
            elif subscription_access_scope == "specific":
                course_data['has_access'] = course['id'] in subscription_course_ids
            else:
                course_data['has_access'] = True
        else:
            course_data['has_access'] = course['id'] in enrolled_course_ids

        result.append(course_data)
    
    return result

@api_router.get("/student/courses/{course_id}")
async def get_course_detail(course_id: str, current_user: User = Depends(get_current_user)):
    # Allow fetching course details regardless of published status when the user has access
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check if user has access to this course (backward compatible check)
    has_access = await user_has_course_access(current_user.id, course_id, current_user.has_full_access)
    if not has_access:
        raise HTTPException(status_code=403, detail="You don't have access to this course")
    
    if isinstance(course['created_at'], str):
        course['created_at'] = datetime.fromisoformat(course['created_at'])
    
    # Get modules with lessons
    modules = await db.modules.find({"course_id": course_id}, {"_id": 0}).sort("order", 1).to_list(1000)
    for module in modules:
        if isinstance(module['created_at'], str):
            module['created_at'] = datetime.fromisoformat(module['created_at'])
        
        lessons = await db.lessons.find({"module_id": module['id']}, {"_id": 0}).sort("order", 1).to_list(1000)
        for lesson in lessons:
            if isinstance(lesson['created_at'], str):
                lesson['created_at'] = datetime.fromisoformat(lesson['created_at'])
        
        module['lessons'] = lessons
    
    course['modules'] = modules
    return course

@api_router.get("/student/lessons/{lesson_id}")
async def get_lesson_detail(lesson_id: str, current_user: User = Depends(get_current_user)):
    lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Get module to find course_id
    module = await db.modules.find_one({"id": lesson['module_id']}, {"_id": 0})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    course_id = module['course_id']
    
    # Check if user has access to this course (backward compatible check)
    has_access = await user_has_course_access(current_user.id, course_id, current_user.has_full_access)
    if not has_access:
        raise HTTPException(
            status_code=403, 
            detail="You need to be enrolled in this course to access this lesson"
        )
    
    course = await db.courses.find_one({"id": course_id}, {"_id": 0, "title": 1})

    if isinstance(lesson['created_at'], str):
        lesson['created_at'] = datetime.fromisoformat(lesson['created_at'])
    
    lesson['course_id'] = course_id
    if course and course.get('title'):
        lesson['course_title'] = course['title']

    return lesson

# ==================== PROGRESS ROUTES ====================

@api_router.post("/progress")
async def update_progress(progress_data: ProgressBase, current_user: User = Depends(get_current_user)):
    existing = await db.progress.find_one({"user_id": current_user.id, "lesson_id": progress_data.lesson_id})
    
    progress_dict = progress_data.model_dump()
    progress_dict['user_id'] = current_user.id
    progress_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    if existing:
        await db.progress.update_one(
            {"user_id": current_user.id, "lesson_id": progress_data.lesson_id},
            {"$set": progress_dict}
        )
    else:
        progress_dict['id'] = str(uuid.uuid4())
        await db.progress.insert_one(progress_dict)
    
    # Check if user completed a course
    # Get lesson to find course
    lesson = await db.lessons.find_one({"id": progress_data.lesson_id})
    if lesson:
        module = await db.modules.find_one({"id": lesson['module_id']})
        if module:
            course_id = module['course_id']
            
            # Get all lessons for this course
            modules = await db.modules.find({"course_id": course_id}).to_list(1000)
            module_ids = [m['id'] for m in modules]
            lessons = await db.lessons.find({"module_id": {"$in": module_ids}}).to_list(1000)
            lesson_ids = [l['id'] for l in lessons]
            
            # Get user's progress on all lessons
            all_progress = await db.progress.find({
                "user_id": current_user.id, 
                "lesson_id": {"$in": lesson_ids}
            }).to_list(1000)
            
            # Check if all lessons are completed
            completed_lessons = [p for p in all_progress if p.get('completed', False)]
            
            if len(completed_lessons) == len(lesson_ids) and len(lesson_ids) > 0:
                # Course completed! Log completion
                course = await db.courses.find_one({"id": course_id})
                course_title = course.get("title", "Unknown Course") if course else "Unknown Course"
                completion_ts = datetime.now(timezone.utc)
                
                logger.info(f"User {current_user.id} completed course {course_id}: {course_title}")
                
                # Auto-issue certificate when template is available
                try:
                    certificate = await issue_certificate_for_completion(
                        user=current_user,
                        course_id=course_id,
                        completed_at=completion_ts,
                        metadata={"source": "auto-progress"},
                    )
                    if certificate:
                        logger.info(
                            "Certificate %s issued automatically for user %s course %s",
                            certificate["id"],
                            current_user.email,
                            course_id,
                        )
                except Exception as exc:
                    logger.exception("Failed to issue certificate automatically: %s", exc)
                
                # Trigger gamification reward (now just logs)
                await give_gamification_reward(
                    current_user.id, 
                    "complete_course", 
                    f"Conclusão do curso: {course_title}"
                )
    
    return {"message": "Progress updated"}

@api_router.get("/progress/{course_id}")
async def get_course_progress(course_id: str, current_user: User = Depends(get_current_user)):
    # Get all lessons for this course
    modules = await db.modules.find({"course_id": course_id}).to_list(1000)
    module_ids = [m['id'] for m in modules]
    
    lessons = await db.lessons.find({"module_id": {"$in": module_ids}}).to_list(1000)
    lesson_ids = [l['id'] for l in lessons]
    
    # Get progress for these lessons
    progress = await db.progress.find({"user_id": current_user.id, "lesson_id": {"$in": lesson_ids}}, {"_id": 0}).to_list(1000)
    
    return progress

# ==================== HELPER FUNCTIONS ====================

async def user_has_access(user_id: str) -> bool:
    """Check if user has access to at least one course or has full access"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return False
    
    snapshot = build_subscription_snapshot(user)
    has_full_access = bool(user.get("has_full_access"))
    has_lifetime_access = has_full_access and snapshot["status"] == SubscriptionStatus.INACTIVE.value

    if has_lifetime_access:
        return True

    if snapshot["plan_id"]:
        if snapshot["is_active"]:
            return True

        if has_full_access:
            await db.users.update_one({"id": user_id}, {"$set": {"has_full_access": False}})

    # No subscription or inactive subscription: fall back to enrollment-based access (legacy behavior)
    enrollment = await db.enrollments.find_one({"user_id": user_id})
    return enrollment is not None


def _normalize_certificate_status(value: Optional[str]) -> str:
    status = (value or "draft").strip().lower()
    if status not in CERTIFICATE_TEMPLATE_STATUSES:
        return "draft"
    return status


def _serialize_certificate_elements(elements: Optional[List[Union[CertificateTextElement, Dict[str, Any]]]]) -> List[Dict[str, Any]]:
    if not elements:
        return []
    serialized: List[Dict[str, Any]] = []
    for element in elements:
        if isinstance(element, CertificateTextElement):
            serialized.append(element.model_dump())
        else:
            serialized.append(CertificateTextElement(**element).model_dump())
    return serialized


def _build_template_snapshot(template_doc: Dict[str, Any]) -> Dict[str, Any]:
    if not template_doc:
        return {}
    keys = [
        "id",
        "name",
        "description",
        "background_url",
        "background_path",
        "badge_url",
        "accent_color",
        "text_elements",
        "status",
        "workload_hours",
        "validation_message",
        "signature_images",
    ]
    snapshot = {key: template_doc.get(key) for key in keys if key in template_doc}
    snapshot["text_elements"] = _serialize_certificate_elements(snapshot.get("text_elements"))
    return snapshot


async def _get_active_certificate_template(course_id: str) -> Optional[Dict[str, Any]]:
    template = await db.certificate_templates.find_one(
        {
            "course_id": course_id,
            "status": {"$in": ["published", "ativo", "active"]},
        },
        {"_id": 0},
    )
    if template:
        template["status"] = "published"
        template["text_elements"] = _serialize_certificate_elements(template.get("text_elements"))
    return template


async def _get_template_or_404(template_id: str) -> Dict[str, Any]:
    template = await db.certificate_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Modelo de certificado não encontrado")
    template["text_elements"] = _serialize_certificate_elements(template.get("text_elements"))
    return template


async def issue_certificate_for_completion(
    *,
    user: User,
    course_id: str,
    completed_at: Optional[datetime] = None,
    metadata: Optional[Dict[str, Any]] = None,
    template: Optional[Dict[str, Any]] = None,
    force_new: bool = False,
) -> Optional[Dict[str, Any]]:
    template_doc = template or await _get_active_certificate_template(course_id)
    if not template_doc:
        return None

    if not force_new:
        existing = await db.certificates.find_one(
            {"user_id": user.id, "course_id": course_id},
            {"_id": 0},
        )
        if existing:
            return existing

    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        return None

    student_name = user.name or user.email
    instructor_name = course.get("instructor_name") or course.get("instructor") or ""
    issued_at = datetime.now(timezone.utc)
    completion_ts = completed_at or issued_at
    token = secrets.token_urlsafe(16)
    validation_url = f"{get_frontend_url()}/certificates/validate?token={token}"
    metadata_payload = {
        "instructor_name": instructor_name,
        "course_id": course_id,
        **(metadata or {}),
    }

    certificate = CertificateIssue(
        template_id=template_doc["id"],
        course_id=course_id,
        user_id=user.id,
        student_name=student_name,
        student_email=user.email,
        course_title=course.get("title", "Curso"),
        workload_hours=template_doc.get("workload_hours"),
        token=token,
        validation_url=validation_url,
        metadata=metadata_payload,
        issued_at=issued_at,
        completed_at=completion_ts,
    ).model_dump()
    certificate["template_snapshot"] = _build_template_snapshot(template_doc)

    await db.certificates.insert_one(certificate)
    logger.info("Certificate issued user=%s course=%s template=%s", user.email, course_id, template_doc["id"])
    return certificate


async def _user_completed_course(user_id: str, course_id: str) -> bool:
    modules = await db.modules.find({"course_id": course_id}).to_list(1000)
    if not modules:
        return False

    module_ids = [module["id"] for module in modules]
    lessons = await db.lessons.find({"module_id": {"$in": module_ids}}).to_list(5000)
    if not lessons:
        return False

    lesson_ids = [lesson["id"] for lesson in lessons]
    progresses = await db.progress.find({
        "user_id": user_id,
        "lesson_id": {"$in": lesson_ids}
    }).to_list(len(lesson_ids))

    completed = [item for item in progresses if item.get("completed")]
    return len(completed) == len(lesson_ids)


# ==================== CERTIFICATE ROUTES ====================


@api_router.post("/admin/certificates/uploads")
async def upload_certificate_asset(
    file: UploadFile = File(...),
    asset_type: str = Query("background", alias="type"),
    current_user: User = Depends(get_current_admin),
):
    prefix_map = {
        "background": "certificates/backgrounds",
        "badge": "certificates/badges",
        "signature": "certificates/signatures",
    }
    normalized_type = (asset_type or "background").lower()
    prefix = prefix_map.get(normalized_type, "certificates/assets")
    upload = await _upload_to_bunny_storage(file, prefix=prefix)
    return {
        "url": upload["public_url"],
        "path": upload["relative_path"],
        "content_type": upload["content_type"],
        "size_bytes": upload["size_bytes"],
        "type": normalized_type,
        "original_name": upload["original_name"],
    }


@api_router.post("/admin/certificates/templates", response_model=CertificateTemplate)
async def create_certificate_template(
    template_data: CertificateTemplateCreate,
    current_user: User = Depends(get_current_admin),
):
    course = await db.courses.find_one({"id": template_data.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Curso não encontrado para vincular certificado")

    payload = template_data.model_dump()
    payload["status"] = _normalize_certificate_status(payload.get("status"))
    payload["text_elements"] = _serialize_certificate_elements(payload.get("text_elements"))

    template = CertificateTemplate(
        **payload,
        created_by=current_user.email,
        updated_by=current_user.email,
    )
    template_dict = template.model_dump()
    await db.certificate_templates.insert_one(template_dict)
    return template


@api_router.get("/admin/certificates/templates", response_model=List[CertificateTemplate])
async def list_certificate_templates(
    course_id: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
):
    query: Dict[str, Any] = {}
    if course_id:
        query["course_id"] = course_id
    templates = (
        await db.certificate_templates.find(query, {"_id": 0})
        .sort("updated_at", -1)
        .to_list(200)
    )
    return [CertificateTemplate(**tpl) for tpl in templates]


@api_router.get("/admin/certificates/templates/{template_id}", response_model=CertificateTemplate)
async def get_certificate_template(template_id: str, current_user: User = Depends(get_current_admin)):
    template = await _get_template_or_404(template_id)
    return CertificateTemplate(**template)


@api_router.put("/admin/certificates/templates/{template_id}", response_model=CertificateTemplate)
async def update_certificate_template(
    template_id: str,
    template_data: CertificateTemplateUpdate,
    current_user: User = Depends(get_current_admin),
):
    template = await _get_template_or_404(template_id)
    update_payload = template_data.model_dump(exclude_unset=True)

    if "status" in update_payload:
        update_payload["status"] = _normalize_certificate_status(update_payload["status"])
    if "text_elements" in update_payload and update_payload["text_elements"] is not None:
        update_payload["text_elements"] = _serialize_certificate_elements(update_payload["text_elements"])

    update_payload["updated_at"] = datetime.now(timezone.utc)
    update_payload["updated_by"] = current_user.email

    await db.certificate_templates.update_one({"id": template_id}, {"$set": update_payload})
    template.update(update_payload)
    template["text_elements"] = _serialize_certificate_elements(template.get("text_elements"))
    return CertificateTemplate(**template)


@api_router.delete("/admin/certificates/templates/{template_id}")
async def delete_certificate_template(template_id: str, current_user: User = Depends(get_current_admin)):
    await _get_template_or_404(template_id)
    issued_count = await db.certificates.count_documents({"template_id": template_id})
    if issued_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Não é possível excluir: existem certificados emitidos com este modelo. Desative ou crie outro modelo.",
        )
    await db.certificate_templates.delete_one({"id": template_id})
    return {"message": "Modelo removido com sucesso"}


@api_router.post("/admin/certificates/templates/{template_id}/issue", response_model=CertificateIssue)
async def admin_issue_certificate(
    template_id: str,
    payload: AdminIssueCertificatePayload,
    current_user: User = Depends(get_current_admin),
):
    template = await _get_template_or_404(template_id)
    user_doc = None
    if payload.user_id:
        user_doc = await db.users.find_one({"id": payload.user_id})
    elif payload.email:
        user_doc = await db.users.find_one({"email": payload.email.lower()})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    user_model = User(**user_doc)
    certificate = await issue_certificate_for_completion(
        user=user_model,
        course_id=template["course_id"],
        completed_at=payload.completed_at,
        metadata={**payload.metadata, "source": "admin"},
        template=template,
        force_new=payload.force_new,
    )
    if not certificate:
        raise HTTPException(status_code=400, detail="Não foi possível emitir o certificado")
    return CertificateIssue(**certificate)


@api_router.get("/admin/certificates/issues", response_model=List[CertificateIssueWithTemplate])
async def list_issued_certificates(
    template_id: Optional[str] = None,
    course_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
):
    query: Dict[str, Any] = {}
    if template_id:
        query["template_id"] = template_id
    if course_id:
        query["course_id"] = course_id
    if search:
        regex = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [
            {"student_name": regex},
            {"student_email": regex},
            {"token": regex},
        ]

    certificates = (
        await db.certificates.find(query, {"_id": 0})
        .sort("issued_at", -1)
        .limit(200)
        .to_list(200)
    )
    template_ids = {c.get("template_id") for c in certificates if c.get("template_id")}
    templates = (
        await db.certificate_templates.find({"id": {"$in": list(template_ids)}}, {"_id": 0}).to_list(len(template_ids) or 0)
        if template_ids
        else []
    )
    template_map = {tpl["id"]: CertificateTemplate(**tpl).model_dump() for tpl in templates}

    enriched: List[CertificateIssueWithTemplate] = []
    for cert in certificates:
        template_payload = template_map.get(cert.get("template_id")) or cert.get("template_snapshot")
        cert["template"] = template_payload
        enriched.append(CertificateIssueWithTemplate(**cert))
    return enriched


@api_router.get("/certificates/me", response_model=List[CertificateIssueWithTemplate])
async def get_my_certificates(current_user: User = Depends(get_current_user)):
    certificates = (
        await db.certificates.find({"user_id": current_user.id}, {"_id": 0})
        .sort("issued_at", -1)
        .to_list(100)
    )
    template_ids = {c.get("template_id") for c in certificates if c.get("template_id")}
    templates = (
        await db.certificate_templates.find({"id": {"$in": list(template_ids)}}, {"_id": 0}).to_list(len(template_ids) or 0)
        if template_ids
        else []
    )
    template_map = {tpl["id"]: CertificateTemplate(**tpl).model_dump() for tpl in templates}

    response: List[CertificateIssueWithTemplate] = []
    for cert in certificates:
        template_payload = template_map.get(cert.get("template_id")) or cert.get("template_snapshot")
        cert["template"] = template_payload
        response.append(CertificateIssueWithTemplate(**cert))
    return response


@api_router.post("/certificates/issue", response_model=CertificateIssueWithTemplate)
async def issue_certificate_for_user(
    payload: StudentCertificateIssuePayload,
    current_user: User = Depends(get_current_user),
):
    has_completed = await _user_completed_course(current_user.id, payload.course_id)
    if not has_completed:
        raise HTTPException(
            status_code=400,
            detail="Você precisa concluir todas as aulas do curso antes de emitir o certificado.",
        )

    template = await _get_active_certificate_template(payload.course_id)
    if not template:
        raise HTTPException(
            status_code=404,
            detail="Ainda não há um modelo de certificado publicado para este curso.",
        )

    certificate = await issue_certificate_for_completion(
        user=current_user,
        course_id=payload.course_id,
        template=template,
        force_new=payload.force_new,
    )
    if not certificate:
        raise HTTPException(status_code=400, detail="Não foi possível emitir o certificado no momento.")

    certificate["template"] = template or certificate.get("template_snapshot")
    return CertificateIssueWithTemplate(**certificate)


@api_router.get("/certificates/validate")
async def validate_certificate(token: str = Query(..., min_length=6)):
    token = token.strip()
    cert = await db.certificates.find_one({"token": token}, {"_id": 0})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado não encontrado ou inválido")
    template_payload = await db.certificate_templates.find_one({"id": cert.get("template_id")}, {"_id": 0})
    cert["template"] = template_payload or cert.get("template_snapshot")
    validation_message = ""
    if cert["template"] and cert["template"].get("validation_message"):
        validation_message = cert["template"]["validation_message"]
    return {
        "valid": True,
        "validation_message": validation_message or "Certificado localizado e válido.",
        "certificate": CertificateIssueWithTemplate(**cert),
    }


@api_router.get("/certificates/{certificate_id}", response_model=CertificateIssueWithTemplate)
async def get_certificate_detail(
    certificate_id: str,
    current_user: User = Depends(get_current_user),
):
    cert = await db.certificates.find_one({"id": certificate_id}, {"_id": 0})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado não encontrado")
    if current_user.role != "admin" and cert.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado a este certificado")

    template_payload = await db.certificate_templates.find_one({"id": cert.get("template_id")}, {"_id": 0})
    cert["template"] = template_payload or cert.get("template_snapshot")
    return CertificateIssueWithTemplate(**cert)

# ==================== COMMENT ROUTES ====================

@api_router.post("/comments", response_model=Comment)
async def create_comment(comment_data: CommentCreate, current_user: User = Depends(get_current_user)):
    # Check if user has access to at least one course
    has_access = await user_has_access(current_user.id)
    # Allow administrators to participate regardless of course enrollment
    if current_user.role != "admin" and not has_access:
        raise HTTPException(
            status_code=403, 
            detail="Você precisa estar matriculado em pelo menos um curso para participar da comunidade!"
        )
    
    payload = comment_data.model_dump()
    for field in ("resource_id", "resource_title", "resource_type", "resource_category", "resource_cover_url"):
        payload.pop(field, None)

    comment = Comment(
        **payload,
        user_id=current_user.id,
        user_name=current_user.name,
        user_avatar=current_user.avatar
    )
    comment_dict = comment.model_dump()
    comment_dict['created_at'] = comment_dict['created_at'].isoformat()
    
    await db.comments.insert_one(comment_dict)
    
    # Update replies count for parent if this is a reply
    if comment.parent_id:
        await db.comments.update_one(
            {"id": comment.parent_id},
            {"$inc": {"replies_count": 1}}
        )
    
    # Give gamification reward
    if comment.parent_id:
        # This is a reply/comment
        await give_gamification_reward(
            user_id=current_user.id,
            action_type="create_comment",
            description="Comentário na comunidade"
        )
    else:
        # This is a new post/discussion
        await give_gamification_reward(
            user_id=current_user.id,
            action_type="create_post",
            description="Nova discussão criada"
        )
    
    return comment

@api_router.get("/comments/{lesson_id}", response_model=List[Comment])
async def get_lesson_comments(lesson_id: str, current_user: User = Depends(get_current_user)):
    comments = await db.comments.find({"lesson_id": lesson_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for comment in comments:
        if isinstance(comment['created_at'], str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
    return comments

@api_router.get("/comments/{comment_id}/liked")
async def check_if_liked(comment_id: str, current_user: User = Depends(get_current_user)):
    """Check if current user has liked this comment"""
    like = await db.likes.find_one({
        "comment_id": comment_id,
        "user_id": current_user.id
    })
    return {"liked": like is not None}

@api_router.post("/comments/{comment_id}/like")
async def like_comment(comment_id: str, current_user: User = Depends(get_current_user)):
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user already liked this comment
    existing_like = await db.likes.find_one({
        "comment_id": comment_id,
        "user_id": current_user.id
    })
    
    if existing_like:
        raise HTTPException(
            status_code=400, 
            detail="Você já curtiu este comentário"
        )
    
    # Record the like
    like_record = {
        "id": str(uuid.uuid4()),
        "comment_id": comment_id,
        "user_id": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.likes.insert_one(like_record)
    
    # Increment like count
    await db.comments.update_one({"id": comment_id}, {"$inc": {"likes": 1}})
    
    # Give gamification reward to the comment author (not the liker) - only once per unique like
    comment_author_id = comment.get("user_id")
    if comment_author_id and comment_author_id != current_user.id:  # Don't reward self-likes
        await give_gamification_reward(
            user_id=comment_author_id,
            action_type="receive_like",
            description="Like recebido na comunidade"
        )
    
    return {"message": "Comment liked"}

@api_router.delete("/comments/{comment_id}/like")
async def unlike_comment(comment_id: str, current_user: User = Depends(get_current_user)):
    """Remove a like from a comment"""
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user has liked this comment
    existing_like = await db.likes.find_one({
        "comment_id": comment_id,
        "user_id": current_user.id
    })
    
    if not existing_like:
        raise HTTPException(
            status_code=400, 
            detail="Você não curtiu este comentário"
        )
    
    # Remove the like record
    await db.likes.delete_one({
        "comment_id": comment_id,
        "user_id": current_user.id
    })
    
    # Decrement like count (don't go below 0)
    await db.comments.update_one(
        {"id": comment_id, "likes": {"$gt": 0}}, 
        {"$inc": {"likes": -1}}
    )
    
    return {"message": "Like removed"}

@api_router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, current_user: User = Depends(get_current_user)):
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment['user_id'] != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.comments.delete_one({"id": comment_id})
    # Delete replies too
    await db.comments.delete_many({"parent_id": comment_id})
    return {"message": "Comment deleted"}

# ==================== EMAIL CONFIGURATION ====================

@api_router.get("/admin/email-config")
async def get_email_config(current_user: User = Depends(get_current_admin)):
    config = await db.email_config.find_one({}, {"_id": 0})
    if not config:
        return {"brevo_api_key": "", "sender_email": "", "sender_name": ""}
    # Don't expose the full API key
    # config['brevo_api_key'] = config.get('brevo_api_key', '')[:10] + '...' if config.get('brevo_api_key') else ''
    return config

@api_router.post("/admin/email-config")
async def save_email_config(config: EmailConfig, current_user: User = Depends(get_current_admin)):
    try:
        config_dict = config.model_dump()

        sanitized_log_payload = {
            key: "***" if any(secret_key in key for secret_key in ["password", "api_key", "token"]) else value
            for key, value in config_dict.items()
        }

        logger.debug(
            "Admin %s saving email configuration with payload: %s",
            current_user.id,
            sanitized_log_payload,
        )

        result = await db.email_config.replace_one({}, config_dict, upsert=True)
        logger.info(
            "Email configuration saved by admin %s (matched=%s, modified=%s, upserted_id=%s)",
            current_user.id,
            result.matched_count,
            getattr(result, "modified_count", None),
            getattr(result, "upserted_id", None),
        )

        return {"message": "Email configuration saved successfully"}
    except Exception as exc:
        logger.exception("Error saving email configuration: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save email configuration",
        ) from exc

# ==================== BUNNY MEDIA CONFIGURATION ====================

@api_router.get("/admin/media/bunny/config")
async def get_bunny_media_config(current_user: User = Depends(get_current_admin)):
    config = await get_bunny_config()
    if not config:
        return BunnyConfig().model_dump()
    try:
        return BunnyConfig(**config).model_dump()
    except ValidationError as exc:
        logger.warning("Stored Bunny configuration is invalid: %s", exc)
        return BunnyConfig().model_dump()


@api_router.post("/admin/media/bunny/config")
async def save_bunny_media_config(config: BunnyConfig, current_user: User = Depends(get_current_admin)):
    config_dict = config.model_dump()

    sanitized_log_payload = {
        key: "***" if "key" in key.lower() else value
        for key, value in config_dict.items()
    }

    logger.info("Admin %s updating Bunny media configuration: %s", current_user.email, sanitized_log_payload)

    await db.bunny_config.replace_one({}, config_dict, upsert=True)
    return {"message": "Configurações do Bunny salvas com sucesso"}


@api_router.get("/admin/media/bunny/validate/stream")
async def validate_bunny_stream(current_user: User = Depends(get_current_admin)):
    """Valida Library ID e AccessKey da Bunny Stream realizando uma chamada simples.
    Retorna detalhes para ajudar no diagnóstico de 401/403 e problemas de conectividade.
    """
    config = await get_bunny_config()
    config = _ensure_bunny_stream_ready(config)

    library_id = config["stream_library_id"]
    access_key = config["stream_api_key"]
    headers_local = {"AccessKey": access_key, "Accept": "application/json"}
    timeout_local = httpx.Timeout(20.0, connect=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout_local) as client:
            url = f"https://video.bunnycdn.com/library/{library_id}/collections"
            resp = await client.get(url, headers=headers_local)
            if resp.status_code == 200:
                data = resp.json() or {}
                items = data.get("items") if isinstance(data, dict) else (data if isinstance(data, list) else [])
                return {
                    "ok": True,
                    "library_id": library_id,
                    "collections_count": len(items) if isinstance(items, list) else 0,
                    "message": "Credenciais válidas e comunicação com Bunny Stream está funcional."
                }
            elif resp.status_code in (401, 403):
                return {
                    "ok": False,
                    "library_id": library_id,
                    "status": resp.status_code,
                    "message": "Acesso negado pela Bunny Stream. Verifique se o Library ID e a AccessKey (API Key da Library) estão corretos.",
                }
            else:
                return {
                    "ok": False,
                    "library_id": library_id,
                    "status": resp.status_code,
                    "message": f"Falha ao consultar coleções: {resp.text[:200]}",
                }
    except httpx.HTTPError as exc:
        logger.exception("Erro de rede ao validar Bunny Stream: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível comunicar com Bunny Stream.") from exc


@api_router.get("/admin/media/bunny/validate/storage")
async def validate_bunny_storage(current_user: User = Depends(get_current_admin)):
    """Valida Storage Zone e AccessKey da Bunny Storage com uma requisição não-destrutiva.
    Usa GET no diretório raiz da zone para checar autorização e conectividade.
    """
    config = await get_bunny_config()
    config = _ensure_bunny_storage_ready(config)

    zone_name = config["storage_zone_name"]
    access_key = config["storage_api_key"]
    storage_host = config.get("storage_host") or "storage.bunnycdn.com"
    base = storage_host.rstrip("/")
    storage_base_endpoint = base if base.startswith("http://") or base.startswith("https://") else f"https://{base}"
    url = f"{storage_base_endpoint}/{zone_name}/"
    headers_local = {"AccessKey": access_key, "Accept": "application/json"}
    timeout_local = httpx.Timeout(20.0, connect=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout_local) as client:
            resp = await client.get(url, headers=headers_local)
            if resp.status_code in (200, 404):
                # 200: diretório listado com sucesso; 404: raiz sem index, mas credenciais aceitas
                return {
                    "ok": True,
                    "zone": zone_name,
                    "status": resp.status_code,
                    "message": "Credenciais válidas e comunicação com Bunny Storage está funcional."
                }
            elif resp.status_code in (401, 403):
                return {
                    "ok": False,
                    "zone": zone_name,
                    "status": resp.status_code,
                    "message": "Acesso negado pela Bunny Storage. Confirme o nome da Storage Zone e a Storage Password (AccessKey).",
                }
            else:
                return {
                    "ok": False,
                    "zone": zone_name,
                    "status": resp.status_code,
                    "message": f"Falha ao validar storage: {resp.text[:200]}",
                }
    except httpx.HTTPError as exc:
        logger.exception("Erro de rede ao validar Bunny Storage: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível comunicar com Bunny Storage.") from exc


def _ensure_bunny_stream_ready(config: Dict[str, Any]) -> Dict[str, Any]:
    if not config.get("stream_library_id") or not config.get("stream_api_key"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configurações da Bunny Stream incompletas. Defina o Library ID e a API Key."
        )
    return config


def _ensure_bunny_storage_ready(config: Dict[str, Any]) -> Dict[str, Any]:
    if not config.get("storage_zone_name") or not config.get("storage_api_key"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configurações de armazenamento Bunny incompletas. Defina Storage Zone e Access Key."
        )
    return config


async def _chunked_file_reader(upload_file: UploadFile, chunk_size: int = 1024 * 1024):
    """Async generator that yields chunks from an UploadFile."""
    await upload_file.seek(0)
    while True:
        chunk = await upload_file.read(chunk_size)
        if not chunk:
            break
        yield chunk


async def _upload_to_bunny_storage(
    upload_file: UploadFile,
    *,
    prefix: str,
    config: Optional[Dict[str, Any]] = None,
    filename: Optional[str] = None,
) -> Dict[str, Any]:
    """Upload a file to Bunny storage using the configured credentials."""
    cfg = config or await get_bunny_config()
    cfg = _ensure_bunny_storage_ready(cfg)

    zone_name = cfg["storage_zone_name"]
    access_key = cfg["storage_api_key"]
    storage_host = cfg.get("storage_host") or "storage.bunnycdn.com"
    base_prefix = cfg.get("library_storage_prefix") or cfg.get("storage_directory") or "library"
    storage_prefix = _sanitize_storage_path(base_prefix, prefix)
    if not storage_prefix:
        storage_prefix = "library"

    original_name = filename or upload_file.filename or "recurso"
    sanitized_name = sanitize_filename(original_name)
    extension = Path(sanitized_name).suffix
    unique_name = f"{uuid.uuid4().hex[:16]}{extension}"
    relative_path = "/".join(part for part in [storage_prefix, unique_name] if part)

    if storage_host.startswith("http://") or storage_host.startswith("https://"):
        storage_base_endpoint = storage_host.rstrip("/")
    else:
        storage_base_endpoint = f"https://{storage_host.rstrip('/')}"

    storage_url = f"{storage_base_endpoint}/{zone_name}/{relative_path}"
    headers = {
        "AccessKey": access_key,
        "Content-Type": upload_file.content_type or "application/octet-stream",
    }
    timeout = httpx.Timeout(120.0, connect=30.0)

    size_counter = 0

    async def data_iterator(chunk_size: int = 1024 * 1024):
        nonlocal size_counter
        await upload_file.seek(0)
        while True:
            chunk = await upload_file.read(chunk_size)
            if not chunk:
                break
            size_counter += len(chunk)
            yield chunk

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            upload_resp = await client.put(storage_url, headers=headers, data=data_iterator())
            upload_resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("Bunny storage upload failed (status=%s response=%s)", exc.response.status_code, exc.response.text)
        detail_message = exc.response.text
        if exc.response.status_code in (401, 403):
            detail_message = (
                "Credenciais da Bunny Storage rejeitadas. "
                "Confirme o nome da Storage Zone e a Storage Password (AccessKey) configurados na Bunny."
            )
        else:
            detail_message = f"Falha ao enviar arquivo para Bunny: {exc.response.text}"
        raise HTTPException(status_code=exc.response.status_code, detail=detail_message) from exc
    except httpx.HTTPError as exc:
        logger.exception("Network error uploading file to Bunny: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível comunicar com Bunny para upload do arquivo.",
        ) from exc
    finally:
        await upload_file.close()

    base_url = cfg.get("storage_base_url")
    if base_url:
        base_url = base_url.rstrip("/")
        public_url = f"{base_url}/{relative_path}"
    else:
        public_url = f"https://{zone_name}.b-cdn.net/{relative_path}"

    return {
        "public_url": public_url,
        "relative_path": relative_path,
        "content_type": headers["Content-Type"],
        "size_bytes": size_counter,
        "original_name": original_name,
        "sanitized_name": sanitized_name,
    }


async def _delete_from_bunny_storage(
    relative_path: Optional[str],
    *,
    config: Optional[Dict[str, Any]] = None,
) -> bool:
    """Remove a file from Bunny storage. Returns True when deletion succeeded or file missing."""
    if not relative_path:
        return False

    cfg = config or await get_bunny_config()
    cfg = _ensure_bunny_storage_ready(cfg)

    zone_name = cfg["storage_zone_name"]
    access_key = cfg["storage_api_key"]
    storage_host = cfg.get("storage_host") or "storage.bunnycdn.com"
    if storage_host.startswith("http://") or storage_host.startswith("https://"):
        storage_base_endpoint = storage_host.rstrip("/")
    else:
        storage_base_endpoint = f"https://{storage_host.rstrip('/')}"

    target_url = f"{storage_base_endpoint}/{zone_name}/{relative_path.lstrip('/')}"
    headers = {"AccessKey": access_key}
    timeout = httpx.Timeout(30.0, connect=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.delete(target_url, headers=headers)
            if resp.status_code in (200, 204, 404):
                return True
            logger.warning(
                "Bunny storage delete failed path=%s status=%s body=%s",
                relative_path,
                resp.status_code,
                resp.text[:200],
            )
            return False
    except httpx.HTTPError as exc:
        logger.warning("Network error deleting file from Bunny storage (%s): %s", relative_path, exc)
        return False


def serialize_library_resource(doc: Dict[str, Any], *, include_private: bool = False) -> Dict[str, Any]:
    if not doc:
        return {}
    data = dict(doc)
    data.pop("_id", None)
    for key in ("submitted_at", "updated_at"):
        value = data.get(key)
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    if not include_private:
        data.pop("ratings", None)
        data.pop("internal_notes", None)
    comments = []
    for comment in data.get("comments", []) or []:
        item = dict(comment)
        if isinstance(item.get("created_at"), datetime):
            item["created_at"] = item["created_at"].isoformat()
        comments.append(item)
    data["comments"] = comments
    if "comment_count" not in data:
        data["comment_count"] = len(comments)
    files = []
    for file_entry in data.get("files", []) or []:
        item = dict(file_entry)
        if isinstance(item.get("uploaded_at"), datetime):
            item["uploaded_at"] = item["uploaded_at"].isoformat()
        if not item.get("size"):
            item["size"] = format_file_size(item.get("size_bytes"))
        item["downloads"] = int(item.get("downloads", 0))
        files.append(item)
    data["files"] = files
    data["average_rating"] = float(data.get("average_rating", 0.0))
    data["rating_count"] = int(data.get("rating_count", len(data.get("ratings", []) or [])))
    data["downloads"] = int(data.get("downloads", 0))
    data["featured"] = bool(data.get("featured"))
    data["allow_download"] = bool(data.get("allow_download", True))
    data["allowCommunityDownload"] = data["allow_download"]
    if isinstance(data.get("community_post_created_at"), datetime):
        data["community_post_created_at"] = data["community_post_created_at"].isoformat()
    data["community_post_id"] = data.get("community_post_id")
    contributor = data.get("contributor")
    if isinstance(contributor, dict) and contributor:
        avatar = contributor.get("avatar") or contributor.get("avatar_url")
        if avatar:
            contributor.setdefault("avatar", avatar)
            contributor.setdefault("avatar_url", avatar)
    return data


async def _hydrate_resource_contributors(resources: List[Dict[str, Any]]) -> None:
    if not resources:
        return

    contributor_ids: set[str] = set()
    for resource in resources:
        contributor = resource.get("contributor") or {}
        if contributor.get("id") and not contributor.get("avatar"):
            contributor_ids.add(contributor["id"])

    if not contributor_ids:
        return

    cursor = db.users.find(
        {"id": {"$in": list(contributor_ids)}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "avatar_url": 1},
    )
    user_map: Dict[str, Dict[str, Any]] = {}
    async for user_doc in cursor:
        user_map[user_doc["id"]] = user_doc

    for resource in resources:
        contributor = resource.get("contributor")
        if not contributor or not contributor.get("id"):
            continue
        user_doc = user_map.get(contributor["id"])
        if not user_doc:
            continue
        contributor.setdefault("name", user_doc.get("name"))
        avatar = contributor.get("avatar") or user_doc.get("avatar") or user_doc.get("avatar_url")
        if avatar:
            contributor["avatar"] = avatar
            contributor.setdefault("avatar_url", avatar)
            resource.setdefault("author_avatar", avatar)
            resource.setdefault("author_avatar_url", avatar)


async def _get_library_resource_or_404(resource_id: str) -> Dict[str, Any]:
    resource = await db.library_resources.find_one({"id": resource_id})
    if not resource:
        raise HTTPException(status_code=404, detail="Recurso da biblioteca não encontrado.")
    return resource


async def ensure_library_social_post(resource: Dict[str, Any], *, actor: User) -> Optional[str]:
    """Create a social post highlighting the resource when it is approved/published."""
    if not resource:
        return None

    if resource.get("community_post_id"):
        return resource["community_post_id"]

    status = (resource.get("status") or "").lower()
    if status not in LIBRARY_PUBLISHED_STATUSES:
        return None

    contributor = resource.get("contributor") or {}
    author_id = contributor.get("id") or actor.id
    author_name = contributor.get("name") or actor.name
    author_avatar = contributor.get("avatar") or getattr(actor, "avatar", None)

    try:
        if author_id:
            contributor_doc = await db.users.find_one(
                {"id": author_id},
                {"_id": 0, "id": 1, "name": 1, "avatar": 1},
            )
            if contributor_doc:
                author_name = contributor_doc.get("name") or author_name
                author_avatar = contributor_doc.get("avatar") or author_avatar
        else:
            author_id = actor.id

        title = (resource.get("title") or "").strip() or "Recurso da comunidade"
        description = (resource.get("description") or "").strip()
        if len(description) > 280:
            description = description[:277].rstrip() + "..."

        lines: List[str] = []
        lines.append("📚 Novo recurso aprovado na Biblioteca da Comunidade!")
        lines.append("")
        lines.append(f"**{title}**")
        if description:
            lines.append("")
            lines.append(description)

        extra_details: List[str] = []
        if resource.get("category"):
            extra_details.append(f"🏷️ Categoria: {resource['category']}")
        if resource.get("type"):
            resource_type_label = str(resource["type"]).replace("_", " ").title()
            extra_details.append(f"📦 Tipo: {resource_type_label}")
        if extra_details:
            lines.append("")
            lines.extend(extra_details)

        lines.append("")
        lines.append("Acesse a Biblioteca para baixar, avaliar e comentar este recurso.")

        content = "\n".join(lines)

        post = Comment(
            content=content,
            lesson_id=None,
            user_id=author_id,
            user_name=author_name or actor.name,
            user_avatar=author_avatar,
            parent_id=None,
            resource_id=resource.get("id"),
            resource_title=title,
            resource_type=resource.get("type"),
            resource_category=resource.get("category"),
            resource_cover_url=resource.get("cover_url") or resource.get("preview_url"),
        )
        post_doc = post.model_dump()
        post_doc["created_at"] = post_doc["created_at"].isoformat()
        await db.comments.insert_one(post_doc)

        await db.library_resources.update_one(
            {"id": resource["id"]},
            {
                "$set": {
                    "community_post_id": post_doc["id"],
                    "community_post_created_at": datetime.now(timezone.utc),
                }
            },
        )

        logger.info("Library resource %s publicado na comunidade (post %s)", resource["id"], post_doc["id"])
        return post_doc["id"]
    except Exception:
        logger.exception("Failed to create community post for library resource %s", resource.get("id"))
        return None


async def _create_library_resource_document(
    *,
    file: UploadFile,
    cover: Optional[UploadFile],
    title: str,
    description: str,
    category: Optional[str],
    resource_type: Optional[str],
    tags_raw: Optional[str],
    allow_download: bool,
    demo_url: Optional[str],
    status_value: Optional[str],
    current_user: Optional[User],
    is_community: bool,
) -> Dict[str, Any]:
    config = await get_bunny_config()
    config = _ensure_bunny_storage_ready(config)

    prefix_role = "community" if is_community else "admin"
    user_segment = sanitize_slug(current_user.id) if current_user and current_user.id else "system"
    file_upload = await _upload_to_bunny_storage(
        file,
        prefix=f"{prefix_role}/{user_segment}",
        config=config,
    )

    cover_upload = None
    if cover is not None:
        try:
            cover_upload = await _upload_to_bunny_storage(
                cover,
                prefix=f"{prefix_role}/{user_segment}/cover",
                config=config,
            )
        except HTTPException:
            # If cover upload fails we still persist the resource without cover
            logger.exception("Falha ao enviar capa para Bunny; continuando sem capa.")
            cover_upload = None

    now = datetime.now(timezone.utc)
    category_value = (category or "").strip() or None
    type_value = (resource_type or "project").strip() or "project"
    tags_list = parse_tags(tags_raw)
    status_clean = (status_value or DEFAULT_LIBRARY_STATUS).strip().lower()
    if status_clean not in LIBRARY_ALLOWED_STATUSES:
        status_clean = DEFAULT_LIBRARY_STATUS
    if is_community and status_clean not in {"pending", "under_review"}:
        # Community submissions always start pending
        status_clean = DEFAULT_LIBRARY_STATUS

    file_entry = {
        "id": str(uuid.uuid4()),
        "name": file_upload["original_name"],
        "url": file_upload["public_url"],
        "path": file_upload["relative_path"],
        "content_type": file_upload["content_type"],
        "size_bytes": file_upload["size_bytes"],
        "size": format_file_size(file_upload["size_bytes"]),
        "uploaded_at": now,
        "downloads": 0,
    }

    preview_url = demo_url or None
    cover_url = None
    cover_path = None
    if cover_upload:
        cover_url = cover_upload["public_url"]
        cover_path = cover_upload["relative_path"]
        if not preview_url and cover_upload["content_type"].startswith("video/"):
            preview_url = cover_url

    resource_doc: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "title": title.strip(),
        "description": description.strip(),
        "category": category_value,
        "type": type_value,
        "tags": tags_list,
        "allow_download": allow_download,
        "status": status_clean,
        "demo_url": demo_url,
        "featured": False,
        "is_community": is_community,
        "cover_url": cover_url,
        "cover_path": cover_path,
        "preview_url": preview_url,
        "average_rating": 0.0,
        "rating_count": 0,
        "downloads": 0,
        "comment_count": 0,
        "files": [file_entry],
        "comments": [],
        "ratings": [],
        "submitted_at": now,
        "updated_at": now,
        "last_moderation_note": None,
        "internal_notes": [],
        "community_post_id": None,
        "community_post_created_at": None,
    }

    if current_user:
        resource_doc["contributor"] = {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "avatar": getattr(current_user, "avatar", None),
        }
    else:
        resource_doc["contributor"] = None

    return resource_doc


@api_router.post("/admin/media/bunny/upload/video")
async def upload_bunny_video(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    collection_id: Optional[str] = Form(None),
    course_name: Optional[str] = Form(None),
    module_name: Optional[str] = Form(None),
    current_user: User = Depends(get_current_admin),
):
    config = await get_bunny_config()
    config = _ensure_bunny_stream_ready(config)

    library_id = config["stream_library_id"]
    access_key = config["stream_api_key"]
    resolved_title = title or (Path(file.filename or "video").stem or "Aula em vídeo")
    resolved_collection = collection_id or config.get("stream_collection_id")

    # Determine target collection based on course/module names if none provided
    course_slug = sanitize_slug(course_name)
    module_slug = sanitize_slug(module_name)
    derived_collection_name = None
    if course_slug and module_slug:
        derived_collection_name = f"{course_slug}/{module_slug}"
    elif course_slug:
        derived_collection_name = course_slug

    async def _ensure_stream_collection(library_id: str, access_key: str, name: str) -> Optional[str]:
        headers_local = {"AccessKey": access_key, "Accept": "application/json"}
        timeout_local = httpx.Timeout(30.0, connect=10.0)
        try:
            async with httpx.AsyncClient(timeout=timeout_local) as client_local:
                list_url = f"https://video.bunnycdn.com/library/{library_id}/collections"
                list_resp = await client_local.get(list_url, headers=headers_local)
                list_resp.raise_for_status()
                data = list_resp.json() or []
                # Bunny Stream may return { items: [...] } or a raw list
                if isinstance(data, dict):
                    collections_list = data.get("items") or []
                elif isinstance(data, list):
                    collections_list = data
                else:
                    collections_list = []

                for c in collections_list:
                    if isinstance(c, dict):
                        n = (c.get("name") or "")
                        if isinstance(n, str) and n.lower() == name.lower():
                            return c.get("id") or c.get("collectionId") or c.get("guid")
                # Not found, create
                create_resp = await client_local.post(list_url, headers=headers_local, json={"name": name})
                create_resp.raise_for_status()
                created = create_resp.json() or {}
                return created.get("id") or created.get("collectionId") or created.get("guid")
        except httpx.HTTPError as exc:
            logger.warning("Bunny Stream collection ensure failed for '%s': %s", name, exc)
            return None

    headers = {
        "AccessKey": access_key,
        "Accept": "application/json",
    }

    # Resolve collection id: existing configured id, or dynamically ensured by course/module
    if not resolved_collection and derived_collection_name:
        maybe_collection_id = await _ensure_stream_collection(library_id, access_key, derived_collection_name)
        if maybe_collection_id:
            resolved_collection = maybe_collection_id

    payload = {"title": resolved_title}
    if resolved_collection:
        payload["collectionId"] = resolved_collection

    timeout = httpx.Timeout(120.0, connect=30.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            create_url = f"https://video.bunnycdn.com/library/{library_id}/videos"
            create_resp = await client.post(create_url, json=payload, headers=headers)
            create_resp.raise_for_status()
            video_meta = create_resp.json()
            video_guid = (
                video_meta.get("guid")
                or video_meta.get("videoGuid")
                or video_meta.get("video_id")
                or video_meta.get("id")
            )
            if not video_guid:
                logger.error("Unexpected Bunny video response payload: %s", video_meta)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Bunny não retornou o identificador do vídeo."
                )

            upload_url = f"https://video.bunnycdn.com/library/{library_id}/videos/{video_guid}"
            upload_headers = {
                **headers,
                "Content-Type": "application/octet-stream",
            }

            upload_resp = await client.put(
                upload_url,
                headers=upload_headers,
                data=_chunked_file_reader(file),
            )
            upload_resp.raise_for_status()

            metadata = {}
            duration_seconds = None
            try:
                metadata_url = f"https://video.bunnycdn.com/library/{library_id}/videos/{video_guid}"
                metadata_resp = await client.get(metadata_url, headers=headers)
                metadata_resp.raise_for_status()
                metadata = metadata_resp.json()
                duration_val = metadata.get("length") or metadata.get("lengthInSeconds")
                if isinstance(duration_val, (int, float)):
                    duration_seconds = int(duration_val)
            except httpx.HTTPError as meta_exc:
                logger.warning("Failed to fetch Bunny video metadata for %s: %s", video_guid, meta_exc)

    except httpx.HTTPStatusError as exc:
        logger.error("Bunny video upload failed (status=%s response=%s)", exc.response.status_code, exc.response.text)
        # Provide clearer message for auth/credential issues
        if exc.response.status_code in (401, 403):
            bunny_msg = (exc.response.text or "").strip()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    "Falha ao enviar vídeo para Bunny. Verifique as credenciais nas configurações. "
                    f"(Library ID: {library_id}) "
                    + (f"Resposta Bunny: {bunny_msg[:200]}" if bunny_msg else "")
                ).strip(),
            ) from exc
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Falha ao enviar vídeo para Bunny: {exc.response.text}",
        ) from exc
    except httpx.HTTPError as exc:
        logger.exception("Network error uploading video to Bunny: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível comunicar com Bunny para upload do vídeo.",
        ) from exc
    finally:
        await file.close()

    embed_html = build_bunny_embed_html(
        library_id=library_id,
        video_guid=video_guid,
        player_domain=config.get("stream_player_domain"),
    )
    playback_url = f"https://iframe.mediadelivery.net/embed/{library_id}/{video_guid}"

    return {
        "message": "Upload de vídeo concluído com sucesso",
        "video_guid": video_guid,
        "library_id": library_id,
        "title": resolved_title,
        "collection_id": resolved_collection,
        "embed_html": embed_html,
        "playback_url": playback_url,
        "duration_seconds": duration_seconds,
        "video_metadata": metadata,
    }


@api_router.post("/admin/media/bunny/upload/file")
async def upload_bunny_file(
    file: UploadFile = File(...),
    directory: Optional[str] = Form(None),
    course_name: Optional[str] = Form(None),
    module_name: Optional[str] = Form(None),
    current_user: User = Depends(get_current_admin),
):
    config = await get_bunny_config()
    config = _ensure_bunny_storage_ready(config)

    zone_name = config["storage_zone_name"]
    access_key = config["storage_api_key"]
    content_type = file.content_type or "application/octet-stream"
    storage_host = config.get("storage_host") or "storage.bunnycdn.com"

    default_prefix = config.get("storage_directory") or config.get("default_upload_prefix") or "uploads"

    # Build path prefix: default/uploads + sanitized course/module OR sanitized provided directory
    if directory:
        parts = [p for p in directory.split("/") if p.strip()]
        sanitized_parts = [sanitize_slug(p) for p in parts]
        requested_prefix = "/".join(sanitized_parts)
    else:
        course_slug = sanitize_slug(course_name)
        module_slug = sanitize_slug(module_name)
        path_parts = [default_prefix]
        if course_slug:
            path_parts.append(course_slug)
        if module_slug:
            path_parts.append(module_slug)
        requested_prefix = "/".join(path_parts)

    safe_prefix = "/".join(part.strip("/ ").replace("..", "") for part in requested_prefix.split("/") if part.strip())

    sanitized_original = sanitize_filename(file.filename or "material")
    extension = Path(sanitized_original).suffix
    unique_name = f"{uuid.uuid4().hex[:12]}{extension}"

    relative_path_parts = [safe_prefix, unique_name] if safe_prefix else [unique_name]
    relative_path = "/".join(relative_path_parts)

    if storage_host.startswith("http://") or storage_host.startswith("https://"):
        storage_base_endpoint = storage_host.rstrip("/")
    else:
        storage_base_endpoint = f"https://{storage_host.rstrip('/')}"

    storage_url = f"{storage_base_endpoint}/{zone_name}/{relative_path}"
    headers = {
        "AccessKey": access_key,
        "Content-Type": content_type,
    }

    timeout = httpx.Timeout(120.0, connect=30.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            upload_resp = await client.put(
                storage_url,
                headers=headers,
                data=_chunked_file_reader(file),
            )
            upload_resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("Bunny file upload failed (status=%s response=%s)", exc.response.status_code, exc.response.text)
        detail_message = exc.response.text
        if exc.response.status_code in (401, 403):
            detail_message = (
                "Credenciais da Bunny Storage rejeitadas. "
                "Confirme o nome da Storage Zone e a Storage Password (AccessKey) configurados na Bunny."
            )
        else:
            detail_message = f"Falha ao enviar arquivo para Bunny: {exc.response.text}"
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=detail_message,
        ) from exc
    except httpx.HTTPError as exc:
        logger.exception("Network error uploading file to Bunny: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível comunicar com Bunny para upload do arquivo.",
        ) from exc
    finally:
        await file.close()

    base_url = config.get("storage_base_url")
    if base_url:
        base_url = base_url.rstrip("/")
        public_url = f"{base_url}/{relative_path}"
    else:
        public_url = f"https://{zone_name}.b-cdn.net/{relative_path}"

    return {
        "message": "Upload de arquivo concluído com sucesso",
        "path": relative_path,
        "public_url": public_url,
        "content_type": content_type,
    }

# ==================== LIBRARY RESOURCES ====================

@api_router.get("/library/resources")
async def list_library_resources(
    status: Optional[str] = Query(None),
    include_all: bool = Query(False),
    current_user: Optional[User] = Depends(get_optional_user),
):
    query: Dict[str, Any] = {}
    if include_all:
        if not current_user or current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Somente administradores podem visualizar todos os recursos.",
            )
        # Allow viewing all except hard archived when explicitly requested
        query["status"] = {"$ne": "archived"}
    else:
        query["status"] = {"$in": list(LIBRARY_PUBLISHED_STATUSES)}

    if status:
        status_normalized = status.strip().lower()
        if status_normalized in LIBRARY_ALLOWED_STATUSES:
            query["status"] = status_normalized

    cursor = (
        db.library_resources.find(query)
        .sort([("updated_at", -1), ("submitted_at", -1)])
    )
    resources = await cursor.to_list(length=500)
    await _hydrate_resource_contributors(resources)
    return [serialize_library_resource(resource) for resource in resources]


@api_router.get("/library/categories")
async def list_library_categories():
    filter_query = {"status": {"$in": list(LIBRARY_PUBLISHED_STATUSES)}}
    categories = await db.library_resources.distinct("category", filter_query)
    result = []
    for idx, category in enumerate(categories or []):
        if not category:
            continue
        slug = sanitize_slug(category) or f"category-{idx}"
        result.append({"id": slug, "name": category})
    return result


@api_router.post("/library/resources")
async def create_library_resource(
    title: str = Form(...),
    description: str = Form(...),
    category: Optional[str] = Form(None),
    resource_type: Optional[str] = Form("project", alias="type"),
    tags: Optional[str] = Form(None),
    demo_url: Optional[str] = Form(None, alias="demoUrl"),
    allow_download_raw: Optional[str] = Form(None, alias="allowCommunityDownload"),
    status_value: Optional[str] = Form(None, alias="status"),
    file: UploadFile = File(...),
    cover: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
):
    allow_download = _parse_bool(allow_download_raw, True)
    resource_doc = await _create_library_resource_document(
        file=file,
        cover=cover,
        title=title,
        description=description,
        category=category,
        resource_type=resource_type,
        tags_raw=tags,
        allow_download=allow_download,
        demo_url=demo_url,
        status_value=status_value,
        current_user=current_user,
        is_community=True,
    )
    await db.library_resources.insert_one(resource_doc)
    await _hydrate_resource_contributors([resource_doc])
    return serialize_library_resource(resource_doc)


@api_router.post("/library/resources/{resource_id}/ratings")
async def rate_library_resource(
    resource_id: str,
    rating_request: LibraryRatingRequest,
    current_user: User = Depends(get_current_user),
):
    if not user_has_library_privileges(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assinatura ativa necessária para interagir com a biblioteca.",
        )
    resource = await _get_library_resource_or_404(resource_id)
    status_value = resource.get("status")
    contributor_id = (resource.get("contributor") or {}).get("id")
    if (
        status_value not in LIBRARY_PUBLISHED_STATUSES
        and current_user.role != "admin"
        and contributor_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível avaliar este recurso no momento.",
        )

    ratings = resource.get("ratings") or []
    now = datetime.now(timezone.utc)
    updated = False
    for entry in ratings:
        if entry.get("user_id") == current_user.id:
            entry["rating"] = rating_request.rating
            entry["updated_at"] = now
            updated = True
            break
    if not updated:
        ratings.append(
            {
                "id": str(uuid.uuid4()),
                "user_id": current_user.id,
                "rating": rating_request.rating,
                "created_at": now,
                "updated_at": now,
            }
        )

    rating_count = len(ratings) or 1
    average_rating = round(
        sum(entry.get("rating", 0) for entry in ratings) / rating_count, 2
    )

    await db.library_resources.update_one(
        {"id": resource_id},
        {
            "$set": {
                "ratings": ratings,
                "average_rating": float(average_rating),
                "rating_count": rating_count,
                "updated_at": now,
            }
        },
    )
    return {"average_rating": average_rating, "rating_count": rating_count}


@api_router.post("/library/resources/{resource_id}/comments")
async def comment_library_resource(
    resource_id: str,
    comment_request: LibraryCommentRequest,
    current_user: User = Depends(get_current_user),
):
    if not user_has_library_privileges(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assinatura ativa necessária para interagir com a biblioteca.",
        )
    resource = await _get_library_resource_or_404(resource_id)
    status_value = resource.get("status")
    contributor_id = (resource.get("contributor") or {}).get("id")
    if (
        status_value not in LIBRARY_PUBLISHED_STATUSES
        and current_user.role != "admin"
        and contributor_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível comentar este recurso no momento.",
        )

    message = (comment_request.message or "").strip()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O comentário não pode estar vazio.",
        )

    now = datetime.now(timezone.utc)
    comment_entry = {
        "id": str(uuid.uuid4()),
        "author_id": current_user.id,
        "author_name": current_user.name,
        "author_avatar": getattr(current_user, "avatar", None),
        "message": message,
        "rating": comment_request.rating,
        "created_at": now,
    }

    await db.library_resources.update_one(
        {"id": resource_id},
        {
            "$push": {"comments": comment_entry},
            "$set": {"updated_at": now},
            "$inc": {"comment_count": 1},
        },
    )
    return {"message": "Comentário registrado com sucesso."}


@api_router.post("/library/resources/{resource_id}/files/{file_id}/download")
async def download_library_file(
    resource_id: str,
    file_id: str,
    current_user: User = Depends(get_current_user),
):
    if not user_has_library_privileges(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assinatura ativa necessária para acessar este arquivo.",
        )
    resource = await _get_library_resource_or_404(resource_id)
    status_value = resource.get("status")
    contributor_id = (resource.get("contributor") or {}).get("id")
    if (
        status_value not in LIBRARY_PUBLISHED_STATUSES
        and current_user.role != "admin"
        and contributor_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recurso ainda não disponível para download.",
        )

    allow_download = bool(resource.get("allow_download", True))
    is_admin = current_user.role == "admin"
    if not allow_download and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Download desabilitado para este recurso.",
        )

    file_entry = None
    for entry in resource.get("files", []) or []:
        if str(entry.get("id")) == file_id:
            file_entry = entry
            break
    if not file_entry:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")

    file_url = file_entry.get("url")
    if not file_url:
        raise HTTPException(status_code=404, detail="URL do arquivo indisponível.")

    now = datetime.now(timezone.utc)
    await db.library_resources.update_one(
        {"id": resource_id, "files.id": file_id},
        {
            "$inc": {
                "downloads": 1,
                "files.$.downloads": 1,
            },
            "$set": {"updated_at": now},
        },
    )

    return {
        "url": file_url,
        "downloads": int(resource.get("downloads", 0)) + 1,
        "fileDownloads": int(file_entry.get("downloads", 0)) + 1,
    }


@api_router.get("/admin/library/resources")
async def admin_list_library_resources(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_admin),
):
    query: Dict[str, Any] = {}
    if status:
        status_normalized = status.strip().lower()
        if status_normalized in LIBRARY_ALLOWED_STATUSES:
            query["status"] = status_normalized
    cursor = (
        db.library_resources.find(query)
        .sort([("submitted_at", -1), ("updated_at", -1)])
    )
    resources = await cursor.to_list(length=1000)
    await _hydrate_resource_contributors(resources)
    return [serialize_library_resource(resource, include_private=True) for resource in resources]


@api_router.post("/admin/library/resources")
async def admin_create_library_resource(
    title: str = Form(...),
    description: str = Form(...),
    category: Optional[str] = Form(None),
    resource_type: Optional[str] = Form("project", alias="type"),
    tags: Optional[str] = Form(None),
    demo_url: Optional[str] = Form(None, alias="demoUrl"),
    allow_download_raw: Optional[str] = Form(None, alias="allowCommunityDownload"),
    status_value: Optional[str] = Form("published", alias="status"),
    file: UploadFile = File(...),
    cover: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_admin),
):
    allow_download = _parse_bool(allow_download_raw, True)
    resource_doc = await _create_library_resource_document(
        file=file,
        cover=cover,
        title=title,
        description=description,
        category=category,
        resource_type=resource_type,
        tags_raw=tags,
        allow_download=allow_download,
        demo_url=demo_url,
        status_value=status_value,
        current_user=current_user,
        is_community=False,
    )
    await db.library_resources.insert_one(resource_doc)
    inserted_resource = await _get_library_resource_or_404(resource_doc["id"])
    if not inserted_resource.get("community_post_id") and inserted_resource.get("status") in LIBRARY_PUBLISHED_STATUSES:
        await ensure_library_social_post(inserted_resource, actor=current_user)
        inserted_resource = await _get_library_resource_or_404(resource_doc["id"])
    await _hydrate_resource_contributors([inserted_resource])
    return serialize_library_resource(inserted_resource, include_private=True)


@api_router.patch("/admin/library/resources/{resource_id}")
async def admin_update_library_resource(
    resource_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_admin),
):
    existing_resource = await _get_library_resource_or_404(resource_id)
    allowed_updates: Dict[str, Any] = {}
    if "status" in payload and isinstance(payload["status"], str):
        status_normalized = payload["status"].strip().lower()
        if status_normalized not in LIBRARY_ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="Status inválido.")
        allowed_updates["status"] = status_normalized
    if "featured" in payload:
        allowed_updates["featured"] = bool(payload["featured"])
    if "allow_download" in payload or "allowCommunityDownload" in payload:
        allowed_updates["allow_download"] = _parse_bool(
            payload.get("allow_download", payload.get("allowCommunityDownload")), True
        )
    if "category" in payload:
        category_value = (payload["category"] or "").strip()
        allowed_updates["category"] = category_value or None
    if "tags" in payload:
        tags_value = payload["tags"]
        if isinstance(tags_value, str):
            allowed_updates["tags"] = parse_tags(tags_value)
        elif isinstance(tags_value, list):
            allowed_updates["tags"] = [str(tag) for tag in tags_value if str(tag).strip()]

    if not allowed_updates:
        await _hydrate_resource_contributors([existing_resource])
        return serialize_library_resource(existing_resource, include_private=True)

    allowed_updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.library_resources.update_one({"id": resource_id}, {"$set": allowed_updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recurso da biblioteca não encontrado.")
    updated_resource = await _get_library_resource_or_404(resource_id)
    if not updated_resource.get("community_post_id") and updated_resource.get("status") in LIBRARY_PUBLISHED_STATUSES:
        await ensure_library_social_post(updated_resource, actor=current_user)
        updated_resource = await _get_library_resource_or_404(resource_id)
    await _hydrate_resource_contributors([updated_resource])
    return serialize_library_resource(updated_resource, include_private=True)


@api_router.post("/admin/library/resources/{resource_id}/feature")
async def admin_feature_library_resource(
    resource_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_admin),
):
    featured = bool(payload.get("featured", True))
    result = await db.library_resources.update_one(
        {"id": resource_id},
        {"$set": {"featured": featured, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recurso da biblioteca não encontrado.")
    updated = await _get_library_resource_or_404(resource_id)
    await _hydrate_resource_contributors([updated])
    return serialize_library_resource(updated, include_private=True)


@api_router.delete("/admin/library/resources/{resource_id}")
async def admin_delete_library_resource(
    resource_id: str,
    current_user: User = Depends(get_current_admin),
):
    resource = await _get_library_resource_or_404(resource_id)
    result = await db.library_resources.delete_one({"id": resource_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recurso da biblioteca não encontrado.")
    # Optionally: trigger background cleanup of Bunny assets using resource["files"] / cover_path
    logger.info("Library resource %s removido por %s", resource_id, current_user.email)
    return {"message": "Recurso removido com sucesso."}


@api_router.post("/admin/library/resources/{resource_id}/notes")
async def admin_add_library_note(
    resource_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_admin),
):
    note = (payload.get("note") or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="A nota não pode estar vazia.")
    now = datetime.now(timezone.utc)
    note_entry = {
        "id": str(uuid.uuid4()),
        "note": note,
        "author_id": current_user.id,
        "author_name": current_user.name,
        "created_at": now,
    }
    result = await db.library_resources.update_one(
        {"id": resource_id},
        {
            "$set": {
                "last_moderation_note": note,
                "updated_at": now,
            },
            "$push": {"internal_notes": note_entry},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recurso da biblioteca não encontrado.")
    updated = await _get_library_resource_or_404(resource_id)
    await _hydrate_resource_contributors([updated])
    return serialize_library_resource(updated, include_private=True)

@api_router.post("/admin/media/bunny/sync-collection")
async def sync_bunny_collection(
    module_id: str = Form(...),
    collection_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_admin),
):
    """Synchronize Bunny Stream videos from a collection into lessons of a module.

    - Lists videos in the specified Bunny collection.
    - Creates lessons for videos not yet present in the module (by GUID).
    - Uses Bunny embed HTML and duration when available.
    """
    # Validate module
    module_doc = await db.modules.find_one({"id": module_id}, {"_id": 0})
    if not module_doc:
        raise HTTPException(status_code=404, detail="Module not found")

    # Ensure Bunny Stream config
    config = await get_bunny_config()
    config = _ensure_bunny_stream_ready(config)

    # Load course to check for per-course overrides
    course_doc = await db.courses.find_one({"id": module_doc["course_id"]}, {"_id": 0})

    # Determine effective library and access key (course overrides if provided)
    library_id = (course_doc or {}).get("bunny_stream_library_id") or config["stream_library_id"]
    access_key = (course_doc or {}).get("bunny_stream_api_key") or config["stream_api_key"]
    player_domain = (course_doc or {}).get("bunny_stream_player_domain") or config.get("stream_player_domain")

    # Determine effective collection (explicit form > module override > global default)
    effective_collection_id = (
        collection_id
        or module_doc.get("bunny_stream_collection_id")
        or config.get("stream_collection_id")
    )
    if not effective_collection_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Nenhuma Collection ID fornecida e nenhuma coleção padrão configurada. "
                "Informe o Collection ID ou defina uma coleção padrão em Configurações do Bunny."
            ),
        )

    headers = {"AccessKey": access_key, "Accept": "application/json"}
    timeout = httpx.Timeout(60.0, connect=20.0)

    videos: List[Dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            list_url = f"https://video.bunnycdn.com/library/{library_id}/videos"
            # Try with collection filter param; fall back to local filtering if API ignores param
            resp = await client.get(list_url, headers=headers, params={"collectionId": effective_collection_id, "itemsPerPage": 1000})
            resp.raise_for_status()
            payload = resp.json() or {}
            if isinstance(payload, dict) and "items" in payload:
                videos = payload.get("items") or []
            elif isinstance(payload, list):
                videos = payload
            else:
                videos = []

            # If API ignored the collection filter and returned mixed videos,
            # enforce filtering client-side by matching collectionId
            if videos and any(isinstance(v, dict) for v in videos):
                # If any item has a different collectionId than requested, filter explicitly
                has_mixed_collections = any(
                    v.get("collectionId") is not None and v.get("collectionId") != effective_collection_id
                    for v in videos
                    if isinstance(v, dict)
                )
                if has_mixed_collections:
                    videos = [
                        v for v in videos
                        if isinstance(v, dict) and v.get("collectionId") == effective_collection_id
                    ]
    except httpx.HTTPStatusError as exc:
        logger.error("Bunny list videos failed (status=%s response=%s)", exc.response.status_code, exc.response.text)
        detail_message = exc.response.text
        if exc.response.status_code in (401, 403):
            detail_message = (
                "Credenciais da Bunny Stream rejeitadas. Verifique o Library ID e Access Key nas configurações."
            )
        raise HTTPException(status_code=exc.response.status_code, detail=detail_message) from exc
    except httpx.HTTPError as exc:
        logger.exception("Network error listing Bunny videos: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Falha ao listar vídeos na Bunny Stream.") from exc

    # Load existing lessons and collect GUIDs already present
    existing_lessons = await db.lessons.find({"module_id": module_id}, {"_id": 0}).to_list(1000)
    import re
    guid_pattern = re.compile(r"/embed/[^/]+/([a-zA-Z0-9-]+)")
    existing_guids: set[str] = set()
    for lesson in existing_lessons:
        content = lesson.get("content") or ""
        if isinstance(content, str):
            match = guid_pattern.search(content)
            if match:
                existing_guids.add(match.group(1))

    next_order = 1 + max([int(l.get("order") or 0) for l in existing_lessons] or [0])

    created_count = 0
    skipped_count = 0
    created_lessons: List[Dict[str, Any]] = []

    for v in videos:
        if not isinstance(v, dict):
            continue
        video_guid = v.get("guid") or v.get("videoGuid") or v.get("id")
        if not video_guid:
            continue
        if video_guid in existing_guids:
            skipped_count += 1
            continue
        title = v.get("title") or "Aula em vídeo"
        duration_val = v.get("length") or v.get("lengthInSeconds")
        try:
            duration_seconds = int(duration_val) if isinstance(duration_val, (int, float)) else 0
        except Exception:
            duration_seconds = 0

        embed_html = build_bunny_embed_html(
            library_id=library_id,
            video_guid=video_guid,
            player_domain=player_domain,
        )

        lesson_obj = Lesson(
            title=title,
            type="video",
            content=embed_html,
            duration=duration_seconds,
            order=next_order,
            links=[],
            post_to_social=False,
            module_id=module_id,
        )
        # Prepare insert data
        lesson_dict = lesson_obj.model_dump()
        lesson_dict["created_at"] = lesson_dict["created_at"].isoformat()

        await db.lessons.insert_one(lesson_dict)

        created_count += 1
        next_order += 1
        created_lessons.append({"id": lesson_obj.id, "title": title, "video_guid": video_guid})

    return {
        "message": "Sincronização concluída",
        "collection_id": effective_collection_id,
        "total_videos": len(videos),
        "created_count": created_count,
        "skipped_count": skipped_count,
        "created_lessons": created_lessons,
    }

# ==================== ANALYTICS CONFIGURATION ====================

@api_router.get("/analytics/config")
async def get_public_analytics_config():
    """Public endpoint: returns analytics configuration or sensible defaults."""
    doc = await db.analytics_config.find_one({}, {"_id": 0})
    if not doc:
        doc = AnalyticsConfig().model_dump()
    return doc

@api_router.get("/admin/analytics/config")
async def admin_get_analytics_config(current_user: User = Depends(get_current_admin)):
    """Admin-only endpoint to fetch analytics configuration."""
    doc = await db.analytics_config.find_one({}, {"_id": 0})
    if not doc:
        doc = AnalyticsConfig().model_dump()
    return doc

@api_router.post("/admin/analytics/config")
async def admin_save_analytics_config(config: AnalyticsConfig, current_user: User = Depends(get_current_admin)):
    """Admin-only endpoint to save analytics configuration."""
    payload = config.model_dump()
    payload["updated_at"] = datetime.now(timezone.utc)
    payload["updated_by"] = getattr(current_user, "email", None) or current_user.id
    await db.analytics_config.update_one({}, {"$set": payload}, upsert=True)
    return {"message": "Analytics configuration saved successfully"}

# ==================== BULK IMPORT ====================

def send_brevo_email(to_email: str, to_name: str, subject: str, html_content: str, smtp_username: str, smtp_password: str, sender_email: str, sender_name: str, smtp_server: str = 'smtp-relay.brevo.com', smtp_port: int = 587):
    """Send email using SMTP"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{sender_name} <{sender_email}>"
        msg['To'] = to_email
        
        part = MIMEText(html_content, 'html')
        msg.attach(part)
        
        # Send via SMTP
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
        
        logger.info(f"Email sent successfully to {to_email} via SMTP")
        return True
    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {str(e)}")
        return False

@api_router.post("/admin/bulk-import")
async def bulk_import_users(request: BulkImportRequest, current_user: User = Depends(get_current_admin)):
    """
    Import users in bulk from CSV
    CSV format: name,email
    """
    try:
        logger.info("Starting bulk import...")
        # Get email configuration (optional)
        email_config = await db.email_config.find_one({})
        if not email_config:
            logger.warning("Email configuration not found. Invitations will be created but emails will not be sent.")
        else:
            logger.info(f"Email config found for: {email_config.get('sender_email')}")
        
        email_sending_enabled = bool(
            email_config
            and email_config.get('sender_email')
            and (
                email_config.get('smtp_password')
                or email_config.get('brevo_smtp_key')
                or email_config.get('brevo_api_key')
            )
        )
        
        # Decode CSV with error handling for different encodings
        try:
            csv_bytes = base64.b64decode(request.csv_content)
            # Try UTF-8 first
            csv_content = csv_bytes.decode('utf-8')
        except UnicodeDecodeError:
            # Fallback to latin-1 if UTF-8 fails
            try:
                csv_content = csv_bytes.decode('latin-1')
                logger.info("CSV decoded using latin-1 encoding")
            except Exception as e:
                logger.error(f"Failed to decode CSV: {e}")
                raise HTTPException(status_code=400, detail="Invalid CSV encoding. Please use UTF-8 or Latin-1.")
        
        csv_file = io.StringIO(csv_content)
        csv_reader = csv.DictReader(csv_file)
        
        logger.info(f"CSV decoded successfully, has_full_access: {request.has_full_access}, course_ids: {request.course_ids}")
        
        imported_count = 0
        errors = []
        
        for row in csv_reader:
            try:
                name = row.get('name', '').strip()
                email = row.get('email', '').strip().lower()
                
                if not name or not email:
                    errors.append(f"Missing name or email in row: {row}")
                    continue
                
                # Check if user already exists
                existing_user = await db.users.find_one({"email": email})
                if existing_user:
                    user_id = existing_user['id']
                    
                    if request.has_full_access and not existing_user.get('has_full_access'):
                        await db.users.update_one(
                            {"id": user_id},
                            {"$set": {"has_full_access": True}}
                        )
                    
                    if not request.has_full_access and request.course_ids:
                        for course_id in request.course_ids:
                            existing_enrollment = await db.enrollments.find_one({
                                "user_id": user_id,
                                "course_id": course_id
                            })
                            if not existing_enrollment:
                                enrollment = {
                                    "id": str(uuid.uuid4()),
                                    "user_id": user_id,
                                    "course_id": course_id,
                                    "enrolled_at": datetime.now(timezone.utc).isoformat()
                                }
                                await db.enrollments.insert_one(enrollment)
                    imported_count += 1
                    continue

                existing_invite = await db.password_tokens.find_one({"email": email})

                now = datetime.now(timezone.utc)
                now_iso = now.isoformat()
                expires_at = (now + timedelta(days=7)).isoformat()
                token = secrets.token_urlsafe(32)

                if existing_invite:
                    logger.info("Updating existing invitation for %s during import", email)
                    base_courses = existing_invite.get("course_ids", [])
                    if not base_courses and existing_invite.get("course_id"):
                        base_courses = [existing_invite["course_id"]]
                    new_courses = base_courses
                    if not request.has_full_access:
                        new_courses = sorted({*base_courses, *(request.course_ids or [])})
                    update_doc = {
                        "token": token,
                        "email": email,
                        "name": name,
                        "has_full_access": request.has_full_access,
                        "course_ids": [] if request.has_full_access else new_courses,
                        "expires_at": expires_at,
                        "updated_at": now_iso,
                        "token_history": list(dict.fromkeys([token] + existing_invite.get("token_history", []))),
                        "created_at": existing_invite.get("created_at", now_iso),
                    }
                    await db.password_tokens.update_one({"_id": existing_invite["_id"]}, {"$set": update_doc})
                    token_data = update_doc
                else:
                    token_data = {
                        "token": token,
                        "email": email,
                        "name": name,
                        "has_full_access": request.has_full_access,
                        "course_ids": [] if request.has_full_access else (request.course_ids or []),
                        "expires_at": expires_at,
                        "created_at": now_iso,
                        "updated_at": now_iso,
                        "token_history": [token],
                    }
                    await db.password_tokens.insert_one(token_data)
                
                password_link = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/create-password?token={token}"
                course_count = len(token_data.get("course_ids", []))
                access_description = (
                    "acesso completo à plataforma" if token_data.get("has_full_access")
                    else f"{course_count} curso(s)"
                )
                
                html_content = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #10b981;">Bem-vindo à Hiperautomação!</h2>
                            <p>Olá <strong>{name}</strong>,</p>
                            <p>Você foi convidado para a plataforma Hiperautomação com {access_description}.</p>
                            <p>Para acessar sua conta e começar a aprender, você precisa criar sua senha.</p>
                            <div style="margin: 30px 0; text-align: center;">
                                <a href="{password_link}" 
                                   style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Criar Minha Senha
                                </a>
                            </div>
                            <p>Ou copie e cole este link no seu navegador:</p>
                            <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">
                                {password_link}
                            </p>
                            <p><strong>Este link expira em 7 dias.</strong></p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                            <p style="color: #666; font-size: 12px;">
                                Se você não solicitou esta matrícula, pode ignorar este email.
                            </p>
                        </div>
                    </body>
                </html>
                """

                if email_sending_enabled:
                    loop = asyncio.get_event_loop()
                    try:
                        smtp_username = email_config.get('smtp_username')
                        smtp_password = email_config.get('smtp_password')
                        smtp_server = email_config.get('smtp_server', 'smtp-relay.brevo.com')
                        smtp_port = email_config.get('smtp_port', 587)
                        
                        if not smtp_username or not smtp_password:
                            smtp_username = email_config.get('sender_email')
                            smtp_password = email_config.get('brevo_smtp_key') or email_config.get('brevo_api_key')
                        
                        email_sent = await loop.run_in_executor(
                            executor,
                            send_brevo_email,
                            email,
                            name,
                            "Bem-vindo à Hiperautomação - Crie sua senha",
                            html_content,
                            smtp_username,
                            smtp_password,
                            email_config['sender_email'],
                            email_config.get('sender_name'),
                            smtp_server,
                            smtp_port
                        )
                        if email_sent:
                            logger.info("Successfully sent invitation email to %s", email)
                        else:
                            logger.warning("Failed to send email to %s, but continuing import", email)
                            errors.append(f"Failed to send email to {email}")
                    except Exception as email_error:
                        logger.error("Error sending email to %s: %s", email, email_error)
                        errors.append(f"Email error for {email}: {str(email_error)}")
                else:
                    logger.warning("Skipping email sending for %s because email configuration is missing.", email)
                    errors.append(f"Email not sent to {email}: email configuration not set.")

                imported_count += 1
                
            except Exception as e:
                logger.error(f"Error processing row: {e}")
                errors.append(f"Error processing {email if 'email' in locals() else 'unknown'}: {str(e)}")
        
        logger.info(f"Import completed. {imported_count} users processed.")
        return {
            "message": f"Import completed. {imported_count} users processed.",
            "imported_count": imported_count,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Bulk import failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@api_router.post("/create-password")
async def create_password_from_token(token: str, password: str):
    """Create user account from invitation token"""
    token_data = await db.password_tokens.find_one({"token": token}, {"_id": 0})
    now = datetime.now(timezone.utc)
    
    if token_data:
        # Check expiration
        expires_at = parse_datetime(token_data.get('expires_at'))
        if not expires_at or now > expires_at:
            raise HTTPException(status_code=400, detail="Token has expired")
        
        # Create user from invitation payload
        user = User(
            email=token_data['email'],
            name=token_data['name'],
            role="student",
            has_full_access=token_data.get('has_full_access', False)
        )
        
        user_dict = user.model_dump()
        user_dict['password_hash'] = get_password_hash(password)
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        user_dict['invited'] = True
        user_dict['password_created'] = True
        
        await db.users.insert_one(user_dict)
        
        # Enroll in courses if not full access
        if not token_data.get('has_full_access', False):
            course_ids = token_data.get('course_ids', [])
            # Support old format with single course_id
            if not course_ids and token_data.get('course_id'):
                course_ids = [token_data['course_id']]
            
            for course_id in course_ids:
                enrollment = {
                    "id": str(uuid.uuid4()),
                    "user_id": user.id,
                    "course_id": course_id,
                    "enrolled_at": now.isoformat()
                }
                await db.enrollments.insert_one(enrollment)
        
        # Delete used token
        await db.password_tokens.delete_one({"token": token})
        
        # Create access token
        access_token = create_access_token(data={"sub": user.id})
        return Token(access_token=access_token, token_type="bearer", user=user)
    
    # Fallback: token attached directly to user document (e.g., Stripe checkout)
    user_doc = await db.users.find_one(
        {
            "$or": [
                {"password_creation_token": token},
                {"password_token_history": token},
            ]
        }
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    
    current_token = user_doc.get("password_creation_token")
    if current_token != token:
        raise HTTPException(status_code=400, detail="Token has expired")
    
    expires_at = parse_datetime(user_doc.get("password_token_expires"))
    if not expires_at or now > expires_at:
        raise HTTPException(status_code=400, detail="Token has expired")
    
    password_hash = get_password_hash(password)
    update_doc = {
        "$set": {
            "password_hash": password_hash,
            "password_created": True,
            "invited": False,
            "updated_at": now.isoformat(),
        },
        "$unset": {
            "password_creation_token": "",
            "password_token_expires": "",
        },
    }
    
    await db.users.update_one({"id": user_doc.get("id")}, update_doc)
    
    updated_user = await db.users.find_one({"id": user_doc.get("id")}, {"_id": 0, "password_hash": 0})
    if not updated_user:
        raise HTTPException(status_code=500, detail="Erro ao atualizar usuário.")
    
    user_model = User(**updated_user)
    access_token = create_access_token(data={"sub": user_model.id})
    return Token(access_token=access_token, token_type="bearer", user=user_model)


@api_router.post("/create-password/resend")
async def resend_password_token(request: PasswordTokenResendRequest):
    """Regenerate and resend a password creation token when the original has expired."""
    match_query = {
        "$or": [
            {"token": request.token},
            {"token_history": request.token},
        ]
    }

    new_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    new_expiration = (now + timedelta(days=7)).isoformat()
    now_iso = now.isoformat()

    token_doc = await db.password_tokens.find_one(match_query)
    if token_doc:
        current_token = token_doc.get("token")
        email = token_doc.get("email")
        name = token_doc.get("name")

        update_filter = {"_id": token_doc["_id"]} if "_id" in token_doc else {"token": current_token}
        history_tokens = [new_token]
        if current_token and current_token != new_token:
            history_tokens.append(current_token)

        update_result = await db.password_tokens.update_one(
            update_filter,
            {
                "$set": {
                    "token": new_token,
                    "expires_at": new_expiration,
                    "updated_at": now_iso,
                },
                "$addToSet": {
                    "token_history": {"$each": history_tokens}
                },
            },
        )

        if update_result.modified_count == 0:
            logger.error("Password token resend failed to update document for %s", email)
            raise HTTPException(status_code=500, detail="Não foi possível gerar um novo token.")

        try:
            frontend_url = get_frontend_url()
            password_link = f"{frontend_url}/create-password?token={new_token}"
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                executor,
                partial(
                    send_password_creation_email,
                    email,
                    name,
                    password_link,
                ),
            )
            logger.info("Reenviado link de criação de senha para %s", email)
        except Exception as exc:
            logger.warning(f"Falha ao reenviar token de criação de senha para {email}: {exc}")

        return {
            "message": "Novo link enviado para o e-mail informado.",
            "token": new_token,
        }

    # Fallback path: resend for existing user token (e.g., Stripe checkout)
    user_doc = await db.users.find_one(
        {
            "$or": [
                {"password_creation_token": request.token},
                {"password_token_history": request.token},
            ]
        }
    )

    if not user_doc:
        logger.info("Password token resend requested for unknown token.")
        raise HTTPException(status_code=404, detail="Token não encontrado ou já utilizado.")

    email = user_doc.get("email")
    name = user_doc.get("name")
    current_token = user_doc.get("password_creation_token")
    history_tokens = [new_token]
    if current_token:
        history_tokens.append(current_token)

    update_doc = {
        "$set": {
            "password_creation_token": new_token,
            "password_token_expires": new_expiration,
            "updated_at": now_iso,
        },
        "$addToSet": {
            "password_token_history": {"$each": history_tokens},
        },
    }

    update_result = await db.users.update_one({"id": user_doc.get("id")}, update_doc)
    if update_result.modified_count == 0:
        logger.error("Password token resend failed on user document for %s", email)
        raise HTTPException(status_code=500, detail="Não foi possível gerar um novo token.")

    try:
        frontend_url = get_frontend_url()
        password_link = f"{frontend_url}/create-password?token={new_token}"
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            executor,
            partial(
                send_password_creation_email,
                email,
                name,
                password_link,
            ),
        )
        logger.info("Reenviado link de criação de senha (user_doc) para %s", email)
    except Exception as exc:
        logger.warning(f"Falha ao reenviar token de criação de senha para {email}: {exc}")

    return {
        "message": "Novo link enviado para o e-mail informado.",
        "token": new_token,
    }

# ==================== SOCIAL FEED ====================

@api_router.get("/social/feed", response_model=List[Comment])
async def get_social_feed(current_user: User = Depends(get_current_user), filter: Optional[str] = None):
    # Restrict feed reading to users with access (except admins)
    if current_user.role != "admin":
        has_access = await user_has_access(current_user.id)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="Você precisa ter acesso a pelo menos um curso ou assinatura ativa para ver a comunidade"
            )

    # Get all top-level comments/posts (no parent_id) with reply counts
    query = {"parent_id": None}
    if filter == "discussions":
        query["lesson_id"] = None  # Only social posts
    elif filter == "lessons":
        query["lesson_id"] = {"$ne": None}  # Only lesson comments
    
    comments = await db.comments.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)

    missing_avatar_user_ids: set[str] = set()
    for comment in comments:
        if isinstance(comment['created_at'], str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
        if comment.get("user_avatar") and not comment.get("avatar_url"):
            comment["avatar_url"] = comment["user_avatar"]
        if not comment.get("user_avatar"):
            missing_avatar_user_ids.add(comment["user_id"])

        # Count replies
        replies_count = await db.comments.count_documents({"parent_id": comment['id']})
        comment['replies_count'] = replies_count
    if missing_avatar_user_ids:
        user_cursor = db.users.find(
            {"id": {"$in": list(missing_avatar_user_ids)}},
            {"_id": 0, "id": 1, "avatar": 1, "avatar_url": 1}
        )
        avatars_map = {}
        async for user_doc in user_cursor:
            avatar = user_doc.get("avatar") or user_doc.get("avatar_url")
            if avatar:
                avatars_map[user_doc["id"]] = avatar
        for comment in comments:
            avatar = comment.get("user_avatar") or avatars_map.get(comment["user_id"])
            if avatar:
                comment["user_avatar"] = avatar
                comment.setdefault("avatar_url", avatar)

    return comments

@api_router.get("/social/post/{post_id}")
async def get_post_detail(post_id: str, current_user: User = Depends(get_current_user)):
    # Restrict post detail to users with access (except admins)
    if current_user.role != "admin":
        has_access = await user_has_access(current_user.id)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="Você precisa ter acesso a pelo menos um curso ou assinatura ativa para ver a comunidade"
            )

    # Get the post
    post = await db.comments.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if isinstance(post['created_at'], str):
        post['created_at'] = datetime.fromisoformat(post['created_at'])
    if post.get("user_avatar") and not post.get("avatar_url"):
        post["avatar_url"] = post["user_avatar"]
    if not post.get("user_avatar"):
        user_doc = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "avatar": 1, "avatar_url": 1})
        if user_doc:
            avatar = user_doc.get("avatar") or user_doc.get("avatar_url")
            if avatar:
                post["user_avatar"] = avatar
                post.setdefault("avatar_url", avatar)
    
    # Get replies
    replies = await db.comments.find({"parent_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    missing_replies_avatar_ids: set[str] = set()
    for reply in replies:
        if isinstance(reply['created_at'], str):
            reply['created_at'] = datetime.fromisoformat(reply['created_at'])
        if reply.get("user_avatar") and not reply.get("avatar_url"):
            reply["avatar_url"] = reply["user_avatar"]
        if not reply.get("user_avatar"):
            missing_replies_avatar_ids.add(reply["user_id"])
    if missing_replies_avatar_ids:
        reply_users_cursor = db.users.find(
            {"id": {"$in": list(missing_replies_avatar_ids)}},
            {"_id": 0, "id": 1, "avatar": 1, "avatar_url": 1}
        )
        reply_avatar_map = {}
        async for user_doc in reply_users_cursor:
            avatar = user_doc.get("avatar") or user_doc.get("avatar_url")
            if avatar:
                reply_avatar_map[user_doc["id"]] = avatar
        for reply in replies:
            avatar = reply.get("user_avatar") or reply_avatar_map.get(reply["user_id"])
            if avatar:
                reply["user_avatar"] = avatar
                reply.setdefault("avatar_url", avatar)
    
    # Get lesson info if applicable
    lesson_info = None
    if post.get('lesson_id'):
        lesson = await db.lessons.find_one({"id": post['lesson_id']}, {"_id": 0})
        if lesson:
            lesson_info = {
                "lesson_id": lesson['id'],
                "lesson_title": lesson['title']
            }
    
    return {
        "post": post,
        "replies": replies,
        "lesson_info": lesson_info
    }


# ==================== STRIPE BILLING ====================

@api_router.post("/billing/create")
async def create_billing(request: CreateBillingRequest, current_user: User = Depends(get_current_user)):
    """Create a Stripe Checkout session for subscription purchase."""
    if not request.subscription_plan_id:
        raise HTTPException(status_code=400, detail="Stripe billing requer um subscription_plan_id válido")

    plan = await db.subscription_plans.find_one(
        {"id": request.subscription_plan_id, "is_active": True},
        {"_id": 0},
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Plano de assinatura não encontrado ou inativo")
    if not plan.get("stripe_price_id"):
        raise HTTPException(status_code=400, detail="Plano de assinatura sem stripe_price_id configurado")

    stripe_key = await ensure_stripe_config()
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Stripe não configurado no backend")

    if request.customer_email.lower() != current_user.email.lower():
        logger.info(
            "Atualizando email de checkout para email do usuário autenticado. "
            "customer_email=%s authenticated_email=%s",
            request.customer_email,
            current_user.email,
        )
        customer_email = current_user.email
    else:
        customer_email = request.customer_email

    amount_brl = float(plan.get("price_brl", 0) or 0)
    if amount_brl <= 0:
        raise HTTPException(status_code=400, detail="Plano de assinatura sem valor definido")

    try:
        frontend_url = get_frontend_url()
        if not _is_valid_base_url(frontend_url):
            logger.error("FRONTEND_URL inválido para Stripe: %s", frontend_url)
            raise HTTPException(status_code=500, detail="FRONTEND_URL inválido para checkout Stripe")

        metadata = {
            "user_id": current_user.id,
            "subscription_plan_id": request.subscription_plan_id,
            "access_scope": plan.get("access_scope", "full"),
            "course_ids": ",".join(plan.get("course_ids", [])),
            "duration_days": str(plan.get("duration_days", 0)),
        }

        session = await stripe_call_with_retry(
            stripe.checkout.Session.create,
            mode="subscription",
            customer_email=customer_email,
            line_items=[
                {
                    "price": plan["stripe_price_id"],
                    "quantity": 1,
                }
            ],
            metadata=metadata,
            client_reference_id=current_user.id,
            success_url=f"{frontend_url}/subscription-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/payment-cancelled",
            payment_method_types=["card"],
        )

        billing_record = {
            "billing_id": session.id,
            "user_id": current_user.id,
            "amount_brl": amount_brl,
            "course_id": None,
            "subscription_plan_id": request.subscription_plan_id,
            "status": "pending",
            "payment_url": session.url,
            "gateway": "stripe",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        await db.billings.update_one(
            {"billing_id": session.id},
            {"$set": billing_record},
            upsert=True,
        )

        return {"payment_url": session.url, "billing_id": session.id}
    except stripe.error.StripeError as e:
        logger.error("Stripe error creating session: %s", e)
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    except Exception as exc:
        logger.exception("Erro criando checkout Stripe")
        raise HTTPException(status_code=500, detail=f"Não foi possível criar o checkout: {exc}")

# ==================== ADMIN PAYMENTS MANAGEMENT ====================

# Admin: Get all billings/purchases
@api_router.get("/admin/billings")
async def admin_get_all_billings(current_user: User = Depends(get_current_admin)):
    """Get all billings (admin only)"""
    billings = await db.billings.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    
    # Enrich with user info
    for billing in billings:
        user = await db.users.find_one({"id": billing["user_id"]}, {"_id": 0, "name": 1, "email": 1})
        if user:
            billing["user_name"] = user["name"]
            billing["user_email"] = user["email"]
    
    return {"billings": billings}

# Admin: Get payment settings
@api_router.get("/admin/payment-settings")
async def get_payment_settings(current_user: User = Depends(get_current_admin)):
    """Get Stripe payment settings (admin only)"""
    settings = await db.payment_settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "stripe_secret_key": os.environ.get("STRIPE_SECRET_KEY", ""),
            "stripe_webhook_secret": os.environ.get("STRIPE_WEBHOOK_SECRET", ""),
            "forward_webhook_url": os.environ.get("FORWARD_WEBHOOK_URL"),
            "forward_test_events": os.environ.get("FORWARD_TEST_EVENTS") == "true",
        }
    settings.setdefault("forward_webhook_url", None)
    settings.setdefault("forward_test_events", False)
    return settings


# Admin: Update payment settings
@api_router.post("/admin/payment-settings")
async def update_payment_settings(
    stripe_secret_key: Optional[str] = None,
    stripe_webhook_secret: Optional[str] = None,
    forward_webhook_url: Optional[str] = None,
    forward_test_events: Optional[bool] = False,
    current_user: User = Depends(get_current_admin),
):
    """Update Stripe payment settings (admin only)"""
    settings = {
        "stripe_secret_key": stripe_secret_key,
        "stripe_webhook_secret": stripe_webhook_secret,
        "forward_webhook_url": forward_webhook_url,
        "forward_test_events": bool(forward_test_events or False),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.email,
    }

    await db.payment_settings.update_one({}, {"$set": settings}, upsert=True)

    if stripe_secret_key:
        os.environ["STRIPE_SECRET_KEY"] = stripe_secret_key
        try:
            stripe.api_key = stripe_secret_key
        except Exception:
            pass
    if stripe_webhook_secret:
        os.environ["STRIPE_WEBHOOK_SECRET"] = stripe_webhook_secret
    if forward_webhook_url is not None:
        os.environ["FORWARD_WEBHOOK_URL"] = forward_webhook_url or ""
    os.environ["FORWARD_TEST_EVENTS"] = "true" if (forward_test_events or False) else "false"

    logger.info("Admin %s updated Stripe payment settings", current_user.email)

    return {"message": "Stripe settings updated. Reinicie o backend para garantir que variáveis sejam recarregadas."}

async def _forward_status_to_client(payload: dict):
    """Forward normalized payment/subscription status to external webhook if configured.
    Respects 'forward_test_events' to skip test-mode events when disabled.
    """
    try:
        settings = await db.payment_settings.find_one({}, {"_id": 0})
        url = (settings or {}).get("forward_webhook_url")
        allow_test = bool((settings or {}).get("forward_test_events", False))
        if not url:
            return
        # If test events should be skipped
        if (payload.get("livemode") is False) and (not allow_test):
            return
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=5.0)
    except Exception:
        # Don't break webhook processing if forwarding fails
        logger.warning("Failed to forward status to external webhook", exc_info=True)

# Admin: Get statistics
@api_router.get("/admin/statistics")
async def get_admin_statistics(current_user: User = Depends(get_current_admin)):
    """Get platform statistics (admin only)"""
    # Total users
    total_users = await db.users.count_documents({})
    
    # Total courses
    total_courses = await db.courses.count_documents({})
    
    # Total billings
    total_billings = await db.billings.count_documents({})
    paid_billings = await db.billings.count_documents({"status": "paid"})
    pending_billings = await db.billings.count_documents({"status": "pending"})
    
    # Total revenue (from paid billings)
    billings_list = await db.billings.find({"status": "paid"}, {"_id": 0, "amount_brl": 1}).to_list(length=None)
    total_revenue = sum(b.get("amount_brl", 0) for b in billings_list)
    
    return {
        "users": {
            "total": total_users
        },
        "courses": {
            "total": total_courses
        },
        "billings": {
            "total": total_billings,
            "paid": paid_billings,
            "pending": pending_billings
        },
        "revenue": {
            "total_brl": total_revenue
        }
    }



# Admin: Manually mark billing as paid
@api_router.post("/admin/billings/{billing_id}/mark-paid")
async def admin_mark_billing_paid(billing_id: str, current_user: User = Depends(get_current_admin)):
    """Manually mark a billing as paid and process enrollment (admin only)"""
    try:
        # Get billing from database
        billing = await db.billings.find_one({"billing_id": billing_id}, {"_id": 0})
        
        if not billing:
            raise HTTPException(status_code=404, detail="Billing not found")
        
        # Check if already paid
        if billing.get("status") == "paid":
            return {"message": "Billing already marked as paid"}
        
        # Update billing status
        await db.billings.update_one(
            {"billing_id": billing_id},
            {"$set": {
                "status": "paid",
                "paid_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        user_id = billing["user_id"]
        
        # Mark user as having made a purchase FIRST
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"has_purchased": True}}
        )
        
        # Process based on purchase type
        if billing.get("course_id"):
            # Direct course purchase - create enrollment
            course_id = billing["course_id"]
            
            # Mark user as having made a purchase
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"has_purchased": True}}
            )
            
            # Check if already enrolled
            existing_enrollment = await db.enrollments.find_one({
                "user_id": user_id,
                "course_id": course_id
            })
            
            if not existing_enrollment:
                enrollment = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "course_id": course_id,
                    "enrolled_at": datetime.now(timezone.utc).isoformat()
                }
                await db.enrollments.insert_one(enrollment)
                logger.info(f"Admin {current_user.email} manually confirmed billing {billing_id} - enrolled user {user_id} in course {course_id}")
        elif billing.get("subscription_plan_id"):
            plan_id = billing["subscription_plan_id"]
            plan = await db.subscription_plans.find_one(
                {"id": plan_id},
                {"_id": 0, "access_scope": 1, "course_ids": 1, "duration_days": 1},
            )
            if not plan:
                raise HTTPException(status_code=404, detail="Subscription plan not found for billing")

            duration_days = int(plan.get("duration_days", 0) or 0)
            valid_until = datetime.now(timezone.utc) + timedelta(days=duration_days) if duration_days > 0 else None
            auto_renew = True
            status_value = determine_subscription_status(plan_id, valid_until, auto_renew)
            if valid_until is None:
                status_value = SubscriptionStatus.ACTIVE_WITH_AUTO_RENEW.value

            update_ops = {
                "$set": {
                    "has_purchased": True,
                    "subscription_plan_id": plan_id,
                    "subscription_valid_until": valid_until.isoformat() if valid_until else None,
                    "subscription_auto_renew": auto_renew,
                    "subscription_status": status_value,
                },
                "$unset": {
                    "subscription_cancelled": "",
                    "subscription_cancel_at_period_end": "",
                },
            }
            if plan.get("access_scope", "full") == "full":
                update_ops["$set"]["has_full_access"] = True
            elif plan.get("access_scope") == "specific":
                course_ids = [cid for cid in plan.get("course_ids", []) if cid]
                if course_ids:
                    update_ops.setdefault("$addToSet", {})["enrolled_courses"] = {"$each": course_ids}
            await db.users.update_one({"id": user_id}, update_ops)
            logger.info(f"Admin {current_user.email} manually activated subscription {plan_id} for user {user_id}")
        
        return {
            "message": "Billing marked as paid successfully",
            "course_enrolled": billing.get("course_id"),
            "subscription_plan_id": billing.get("subscription_plan_id"),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking billing as paid: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to mark billing as paid: {str(e)}")


# ==================== ADMIN ROUTES - STRIPE ====================

@api_router.post("/admin/stripe/sync-user-subscription")
async def admin_sync_user_subscription(email: EmailStr, current_user: User = Depends(get_current_admin)):
    """Synchronize a user's subscription status with Stripe based on email.

    - Finds Stripe customer by email
    - Retrieves active subscription and maps price to local subscription plan
    - Updates user's Stripe customer id, plan id, access scope, and valid_until
    """
    try:
        # Ensure Stripe configured
        stripe_key = await ensure_stripe_config()
        if not stripe_key:
            raise HTTPException(status_code=500, detail="Stripe not configured")

        # Find local user
        user_doc = await db.users.find_one({"email": str(email)}, {"_id": 0, "id": 1})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user_doc["id"]

        # Lookup Stripe customer by email
        customers = await stripe_call_with_retry(stripe.Customer.list, email=str(email), limit=1)
        if not getattr(customers, "data", []):
            raise HTTPException(status_code=404, detail="No Stripe customer found for email")
        customer = customers.data[0]

        # List active subscriptions
        subs = await stripe_call_with_retry(stripe.Subscription.list, customer=customer.id, status="active")
        if not getattr(subs, "data", []):
            raise HTTPException(status_code=404, detail="No active Stripe subscriptions for customer")
        subscription = subs.data[0]

        # Determine plan via price id
        price_id = None
        try:
            first_item = (subscription.get("items", {}) or {}).get("data", [{}])[0]
            price_id = ((first_item or {}).get("price") or {}).get("id")
        except Exception:
            price_id = None

        plan_doc = None
        if price_id:
            plan_doc = await db.subscription_plans.find_one(
                {"stripe_price_id": price_id},
                {"_id": 0, "id": 1, "access_scope": 1, "course_ids": 1, "duration_days": 1},
            )

        # Compute validity
        valid_until = None
        current_period_end = subscription.get("current_period_end")
        if current_period_end:
            try:
                valid_until = datetime.fromtimestamp(int(current_period_end), tz=timezone.utc)
            except Exception:
                valid_until = None

        # Default if missing: use plan duration
        if not valid_until and plan_doc and int(plan_doc.get("duration_days", 0) or 0) > 0:
            valid_until = datetime.now(timezone.utc) + timedelta(days=int(plan_doc.get("duration_days", 0)))

        auto_renew = None
        if subscription.get("cancel_at_period_end") is not None:
            auto_renew = not bool(subscription.get("cancel_at_period_end"))

        status_value = determine_subscription_status(
            plan_doc.get("id") if plan_doc else None,
            valid_until,
            auto_renew,
        )

        # Prepare updates
        updates = {
            "has_purchased": True,
            "stripe_customer_id": customer.id,
            "subscription_status": status_value,
        }
        if auto_renew is not None:
            updates["subscription_auto_renew"] = auto_renew
        if valid_until:
            updates["subscription_valid_until"] = valid_until.isoformat()
        if plan_doc:
            updates["subscription_plan_id"] = plan_doc.get("id")
            if plan_doc.get("access_scope", "full") == "full":
                updates["has_full_access"] = True

        await db.users.update_one(
            {"id": user_id},
            {
                "$set": updates,
                "$unset": {
                    "subscription_cancelled": "",
                    "subscription_cancel_at_period_end": "",
                },
            },
        )

        try:
            replication_manager.audit.info(
                f"stripe_sync_user email={email} customer={customer.id} plan={plan_doc.get('id') if plan_doc else 'unknown'}"
            )
        except Exception:
            pass

        return {
            "message": "User subscription synchronized",
            "user_id": user_id,
            "stripe_customer_id": customer.id,
            "subscription_id": subscription.get("id"),
            "subscription_plan_id": (plan_doc or {}).get("id"),
            "valid_until": (valid_until.isoformat() if valid_until else None),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin Stripe sync error: {e}", exc_info=True)
        try:
            replication_manager.audit.error(f"stripe_sync_user_error email={email} error={e}")
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Failed to sync user subscription with Stripe")

# ==================== STRIPE WEBHOOK ====================

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    logger.info("🔔 Received Stripe webhook request")
    
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET') or STRIPE_WEBHOOK_SECRET
    if not webhook_secret:
        # Try reading from payment_settings in DB as a fallback
        try:
            settings = await db.payment_settings.find_one({}, {"_id": 0})
            if settings and settings.get("stripe_webhook_secret"):
                webhook_secret = settings["stripe_webhook_secret"]
                os.environ['STRIPE_WEBHOOK_SECRET'] = webhook_secret
        except Exception:
            pass
    if not webhook_secret:
        logger.error("Stripe webhook secret not configured")
        raise HTTPException(status_code=500, detail="Stripe webhook not configured")

    payload = await request.body()
    payload_text = ""
    payload_json = None
    if payload:
        try:
            payload_text = payload.decode("utf-8")
        except Exception:
            payload_text = payload.decode("utf-8", errors="replace")
        try:
            payload_json = json.loads(payload_text)
        except Exception:
            payload_json = None
    sig_header = request.headers.get("Stripe-Signature")

    logger.info(f"📝 Webhook payload size: {len(payload)} bytes")
    logger.info(f"🔐 Signature header present: {bool(sig_header)}")
    logger.info(f"🔑 Using webhook secret: {webhook_secret[:10]}...")
    try:
        replication_manager.audit.info(
            f"stripe_webhook_received size={len(payload)} signature_present={bool(sig_header)}"
        )
    except Exception:
        pass
    _record_stripe_event({
        "stage": "received",
        "type": "unknown",
        "payload_size": len(payload),
        "signature_present": bool(sig_header),
        "payload_json": payload_json,
        "payload_raw": payload_text if payload_json is None else None,
    })

    try:
        event = await stripe_call_with_retry(
            stripe.Webhook.construct_event,
            payload=payload,
            sig_header=sig_header,
            secret=webhook_secret,
        )
        logger.info(f"✅ Webhook signature verified successfully")
        try:
            replication_manager.audit.info(
                f"stripe_webhook_verified type={event.get('type')} id={event.get('id')} livemode={bool(event.get('livemode', False))}"
            )
        except Exception:
            pass
        _record_stripe_event({
            "stage": "verified",
            "type": event.get("type"),
            "event_id": event.get("id"),
            "livemode": bool(event.get("livemode", False)),
            "payload_json": payload_json,
        })
    except ValueError as e:
        logger.error(f"❌ Invalid payload: {e}")
        try:
            replication_manager.audit.error(f"stripe_webhook_invalid_payload error={e}")
        except Exception:
            pass
        _record_stripe_event({
            "stage": "error",
            "type": "invalid_payload",
            "error": str(e),
            "payload_json": payload_json,
            "payload_raw": payload_text if payload_json is None else None,
        })
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"❌ Invalid signature: {e}")
        try:
            replication_manager.audit.error(f"stripe_webhook_invalid_signature error={e}")
        except Exception:
            pass
        _record_stripe_event({
            "stage": "error",
            "type": "invalid_signature",
            "error": str(e),
            "payload_json": payload_json,
            "payload_raw": payload_text if payload_json is None else None,
        })
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Ensure Stripe SDK is configured with a valid key (covers restarts and DB-provided keys)
    try:
        await ensure_stripe_config()
    except Exception:
        pass

    event_type = event.get("type")
    data_obj = (event.get("data", {}) or {}).get("object", {})
    
    # Validate payload using Pydantic models
    try:
        if event_type == "checkout.session.completed":
            validated_data = StripeCheckoutSession(**data_obj)
        elif event_type in ("invoice.payment_succeeded", "invoice.paid"):
            validated_data = StripeInvoice(**data_obj)
        else:
            validated_data = None
            logger.info(f"Stripe: skipping structured validation for event type: {event_type}")
    except ValidationError as e:
        logger.error(f"Stripe payload validation failed: {e}")
        _record_stripe_event({
            "stage": "error",
            "type": "validation_failed",
            "error": str(e),
            "payload_json": data_obj,
        })
        raise HTTPException(status_code=400, detail="Invalid payload structure")

    # Use validated data if available
    if validated_data:
        data_obj = validated_data.model_dump()

    try:
        invoice_success_events = ("invoice.payment_succeeded", "invoice.paid")
        if event_type in ("checkout.session.completed", *invoice_success_events):
            meta = data_obj.get("metadata") or {}
            user_id = meta.get("user_id") or data_obj.get("client_reference_id")
            plan_id = meta.get("subscription_plan_id")
            access_scope = meta.get("access_scope") or "full"
            raw_course_ids = meta.get("course_ids") or ""
            if isinstance(raw_course_ids, list):
                course_ids = [str(c) for c in raw_course_ids if c]
            else:
                course_ids = [c for c in str(raw_course_ids).split(",") if c]
            try:
                duration_days = int(meta.get("duration_days") or 0)
            except (TypeError, ValueError):
                duration_days = 0
            customer_id = data_obj.get("customer")
            customer_email = data_obj.get("customer_email") or ((data_obj.get("customer_details") or {}).get("email"))

            # Capture monetary information (Stripe reports cents)
            amount_cents = None
            currency = None
            if event_type == "checkout.session.completed":
                amount_cents = data_obj.get("amount_total") or data_obj.get("amount_subtotal")
                if data_obj.get("currency"):
                    currency = data_obj["currency"].upper()
            else:
                amount_cents = data_obj.get("amount_paid") or data_obj.get("amount_due")
                if data_obj.get("currency"):
                    currency = data_obj["currency"].upper()

            price_id = None
            sub = None
            if event_type in invoice_success_events:
                line_items = ((data_obj.get("lines") or {}).get("data") or [])
                if line_items:
                    first_line = line_items[0] or {}
                    price_data = first_line.get("price") or {}
                    price_id = price_data.get("id") or price_data.get("price_id")
                    if not currency:
                        price_currency = price_data.get("currency")
                        if price_currency:
                            currency = price_currency.upper()

            subscription_id = data_obj.get("subscription")
            if not subscription_id and event_type == "checkout.session.completed":
                session_id = data_obj.get("id")
                if session_id:
                    try:
                        session_lookup = await stripe_call_with_retry(
                            stripe.checkout.Session.retrieve,
                            session_id,
                            expand=["subscription"],
                        )
                        sub_obj = session_lookup.get("subscription")
                        if sub_obj and isinstance(sub_obj, dict):
                            subscription_id = sub_obj.get("id")
                            sub = sub_obj
                    except Exception as e:
                        logger.warning(f"Stripe: failed to expand subscription from session {session_id}: {e}")
            if subscription_id and sub is None:
                try:
                    sub = await stripe_call_with_retry(stripe.Subscription.retrieve, subscription_id)
                except Exception as e:
                    logger.warning(f"Could not retrieve Stripe subscription {subscription_id}: {e}")

            if not price_id and sub is not None:
                try:
                    sub_items = ((sub or {}).get("items", {}) or {}).get("data", [])
                    if sub_items:
                        price_obj = sub_items[0].get("price") or {}
                        price_id = price_obj.get("id") or price_obj.get("price_id")
                except Exception:
                    price_id = price_id

            plan_doc = None
            if plan_id:
                plan_doc = await db.subscription_plans.find_one(
                    {"id": plan_id},
                    {"_id": 0, "id": 1, "access_scope": 1, "course_ids": 1, "duration_days": 1, "stripe_price_id": 1},
                )
            if not plan_doc and price_id:
                plan_doc = await db.subscription_plans.find_one(
                    {"stripe_price_id": price_id},
                    {"_id": 0, "id": 1, "access_scope": 1, "course_ids": 1, "duration_days": 1, "stripe_price_id": 1},
                )
                if plan_doc:
                    plan_id = plan_doc.get("id")

            if plan_doc:
                access_scope = plan_doc.get("access_scope", access_scope or "full")
                if access_scope == "specific" and not course_ids:
                    course_ids = [str(c) for c in plan_doc.get("course_ids", []) if c]
                if duration_days <= 0:
                    duration_days = int(plan_doc.get("duration_days", 0) or 0)

            if access_scope != "specific":
                course_ids = []

            if not user_id and customer_id:
                user_doc = await db.users.find_one(
                    {"stripe_customer_id": customer_id},
                    {"_id": 0, "id": 1, "email": 1, "subscription_plan_id": 1},
                )
                if user_doc:
                    user_id = user_doc.get("id")
                    if not plan_id:
                        plan_id = user_doc.get("subscription_plan_id") or plan_id
                    if not customer_email:
                        customer_email = user_doc.get("email")
            if not user_id and customer_email:
                user_doc = await db.users.find_one(
                    {"email": customer_email},
                    {"_id": 0, "id": 1, "subscription_plan_id": 1},
                )
                if user_doc:
                    user_id = user_doc.get("id")
                    if not plan_id:
                        plan_id = user_doc.get("subscription_plan_id") or plan_id

            if not user_id or not plan_id:
                # If we have customer email and a plan, create a new user automatically
                if customer_email and plan_id:
                    try:
                        logger.info(f"Stripe: creating user for {customer_email} from webhook event {event_type}")
                        new_user_id = str(uuid.uuid4())
                        # Generate password creation token
                        password_token = secrets.token_urlsafe(32)
                        # Try to derive a display name from email
                        display_name = (customer_email.split("@", 1)[0] or "").replace(".", " ").title()
                        # Build base user doc
                        base_user = {
                            "id": new_user_id,
                            "email": customer_email,
                            "name": display_name,
                            "password": None,
                            "role": "student",
                            "avatar": None,
                            "has_purchased": True,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "created_via": "stripe",
                            "password_creation_token": password_token,
                            "password_token_expires": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                            "password_token_history": [password_token],
                            "stripe_customer_id": customer_id,
                        }
                        await db.users.insert_one(base_user)
                        user_id = new_user_id
                        # Send password creation email
                        try:
                            frontend_url = get_frontend_url()
                            password_link = f"{frontend_url}/create-password?token={password_token}"
                            loop = asyncio.get_event_loop()
                            loop.run_in_executor(
                                executor,
                                send_password_creation_email,
                                customer_email,
                                display_name,
                                password_link
                            )
                        except Exception as e:
                            logger.warning(f"Stripe: failed to enqueue password creation email: {e}")
                    except Exception as e:
                        logger.warning(f"Stripe: could not create user for {customer_email}: {e}")
                else:
                    logger.warning(
                        f"Stripe webhook missing identifiers after resolution (event={event_type}, customer={customer_id}, email={customer_email}, price_id={price_id})"
                    )
                    _record_stripe_event({
                        "stage": "ignored",
                        "type": event_type,
                        "event_id": event.get("id"),
                        "reason": "missing_identifiers",
                        "customer_id": customer_id,
                        "customer_email": customer_email,
                        "payload_json": payload_json,
                        "payload_raw": payload_text if payload_json is None else None,
                    })
                    return {"status": "ignored"}

            # Try to derive validity from Stripe subscription if available
            valid_until = None
            if sub is not None:
                current_period_end = sub.get("current_period_end")
                if current_period_end:
                    try:
                        valid_until = datetime.fromtimestamp(int(current_period_end), tz=timezone.utc)
                        logger.info(f"Stripe: derived valid_until from subscription {subscription_id}: {valid_until.isoformat()}")
                    except Exception as e:
                        logger.warning(f"Stripe: failed to parse current_period_end for {subscription_id}: {e}")

            subscription_auto_renew = None
            if sub is not None:
                subscription_auto_renew = not bool(sub.get("cancel_at_period_end"))
            elif subscription_id:
                subscription_auto_renew = True

            if not valid_until and duration_days > 0:
                valid_until = datetime.now(timezone.utc) + timedelta(days=duration_days)
            status_value = determine_subscription_status(plan_id, valid_until, subscription_auto_renew)
            update_payload_base = {
                "has_purchased": True,
                "subscription_plan_id": plan_id,
                "subscription_auto_renew": subscription_auto_renew,
                "subscription_status": status_value,
                **({"stripe_customer_id": customer_id} if customer_id else {}),
            }
            if valid_until:
                update_payload_base["subscription_valid_until"] = valid_until.isoformat()

            if access_scope == "full":
                update_payload = {
                    **update_payload_base,
                    "has_full_access": True,
                }
                await db.users.update_one(
                    {"id": user_id},
                    {
                        "$set": update_payload,
                        "$unset": {
                            "subscription_cancelled": "",
                            "subscription_cancel_at_period_end": "",
                        },
                    },
                )
                logger.info(f"Stripe: full access activated for user {user_id} until {valid_until.isoformat() if valid_until else 'unknown'}")
                try:
                    login_url = f"{get_frontend_url()}/login"
                    loop = asyncio.get_event_loop()
                    loop.run_in_executor(
                        executor,
                        partial(
                            send_subscription_activation_email,
                            customer_email or (user_doc.get("email") if 'user_doc' in locals() and user_doc else None),
                            (user_doc.get("name") if 'user_doc' in locals() and user_doc else ""),
                            login_url,
                            valid_until_iso=valid_until.isoformat() if valid_until else None,
                            auto_renew=subscription_auto_renew,
                        ),
                    )
                except Exception:
                    pass
            else:
                update_payload = update_payload_base
                update_ops = {
                    "$set": update_payload,
                    "$unset": {
                        "subscription_cancelled": "",
                        "subscription_cancel_at_period_end": "",
                    },
                }
                if course_ids:
                    update_ops["$addToSet"] = {"enrolled_courses": {"$each": course_ids}}
                await db.users.update_one({"id": user_id}, update_ops)
                logger.info(f"Stripe: specific courses granted to user {user_id}: {course_ids}")

            billing_id = data_obj.get("id") or data_obj.get("subscription") or data_obj.get("payment_intent")
            if billing_id:
                billing_updates = {
                    "status": "paid",
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                    "gateway": "stripe",
                }
                billing_updates["user_id"] = user_id
                billing_updates["subscription_plan_id"] = plan_id
                if customer_id:
                    billing_updates["stripe_customer_id"] = customer_id
                if amount_cents is not None:
                    try:
                        billing_updates["amount_brl"] = round(float(amount_cents) / 100, 2)
                    except (TypeError, ValueError):
                        pass
                if currency:
                    billing_updates["currency"] = currency

                await db.billings.update_one(
                    {"billing_id": billing_id},
                    {
                        "$set": billing_updates,
                        "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()},
                    },
                    upsert=True,
                )

            try:
                normalized_valid_until = valid_until or (datetime.now(timezone.utc) + timedelta(days=duration_days) if duration_days > 0 else None)
                payload = {
                    "source": "stripe",
                    "type": event_type,
                    "status": "checkout_completed" if event_type == "checkout.session.completed" else "payment_succeeded",
                    "user_id": user_id,
                    "subscription_plan_id": plan_id,
                    "subscription_id": subscription_id or data_obj.get("subscription"),
                    "valid_until": (normalized_valid_until.isoformat() if normalized_valid_until else None),
                    "access_scope": access_scope,
                    "course_ids": course_ids,
                    "livemode": bool(event.get("livemode", False)),
                    "metadata": meta,
                }
                if price_id:
                    payload["price_id"] = price_id
                await _forward_status_to_client(payload)
                _record_stripe_event({
                    "stage": "processed",
                    "type": event_type,
                    "event_id": event.get("id"),
                    "result": "forwarded_status",
                    "payload_json": payload_json,
                    "data_object": data_obj,
                    "metadata": meta,
                })
            except Exception:
                pass

        # Handle subscription lifecycle events to reflect cancellations/updates
        elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
            status = data_obj.get("status")
            cancel_at_period_end = bool(data_obj.get("cancel_at_period_end"))
            current_period_end_ts = data_obj.get("current_period_end")
            canceled_at_ts = data_obj.get("canceled_at") or data_obj.get("ended_at")

            # If current_period_end isn't present in payload, try retrieving from Stripe
            # This covers API versions or payloads where the timestamp may be nested/missing
            try:
                if not current_period_end_ts:
                    sub_id_probe = data_obj.get("id") or data_obj.get("subscription")
                    if sub_id_probe:
                        sub_probe = await stripe_call_with_retry(stripe.Subscription.retrieve, sub_id_probe)
                        current_period_end_ts = sub_probe.get("current_period_end") or current_period_end_ts
            except Exception as e:
                logger.warning(f"Could not derive current_period_end from Stripe: {e}")

            # Resolve customer email
            email = data_obj.get("customer_email")
            cust_id = data_obj.get("customer")
            # Try to resolve user by stored stripe_customer_id first (does not require Stripe API)
            user_filter = None
            user_doc = None
            if cust_id:
                try:
                    user_doc = await db.users.find_one({"stripe_customer_id": cust_id}, {"_id": 0, "id": 1, "email": 1})
                    if user_doc and user_doc.get("id"):
                        user_filter = {"id": user_doc["id"]}
                        if not email:
                            email = user_doc.get("email")
                except Exception:
                    pass
            # Fallback to retrieving email from Stripe API if no user found by customer id
            if not user_filter and not email:
                try:
                    if cust_id:
                        cust = await stripe_call_with_retry(stripe.Customer.retrieve, cust_id)
                        email = cust.get("email")
                except Exception as e:
                    logger.warning(f"Could not retrieve Stripe customer email: {e}")
            # If still no way to identify the user, ignore
            if not user_filter and not email:
                logger.warning("Stripe subscription event without resolvable customer identifier; skipping user update")
                return {"status": "ignored"}

            # Update user subscription flags and validity
            lookup_filter = user_filter if user_filter else {"email": email}
            existing_user = await db.users.find_one(
                lookup_filter,
                {"_id": 0, "subscription_plan_id": 1, "subscription_valid_until": 1, "has_full_access": 1},
            )

            auto_renew = None
            if cancel_at_period_end is not None:
                auto_renew = not bool(cancel_at_period_end)
            if status == "canceled" and not cancel_at_period_end:
                auto_renew = False

            effective_end_ts = None
            if status == "canceled" and canceled_at_ts and not cancel_at_period_end:
                effective_end_ts = canceled_at_ts
            elif current_period_end_ts:
                effective_end_ts = current_period_end_ts
            elif canceled_at_ts:
                effective_end_ts = canceled_at_ts

            valid_until_dt = None
            if effective_end_ts:
                try:
                    valid_until_dt = datetime.fromtimestamp(int(effective_end_ts), tz=timezone.utc)
                except Exception:
                    valid_until_dt = None
            elif existing_user:
                valid_until_dt = parse_datetime(existing_user.get("subscription_valid_until"))

            plan_id = (existing_user or {}).get("subscription_plan_id")
            if not plan_id:
                price_id = None
                try:
                    price_id = (((data_obj.get("items") or {}).get("data") or [{}])[0] or {}).get("price", {}).get("id")
                except Exception:
                    price_id = None
                if price_id:
                    plan_doc_lookup = await db.subscription_plans.find_one(
                        {"stripe_price_id": price_id},
                        {"_id": 0, "id": 1},
                    )
                    if plan_doc_lookup:
                        plan_id = plan_doc_lookup.get("id")

            status_value = determine_subscription_status(plan_id, valid_until_dt, auto_renew)

            updates = {
                "subscription_status": status_value,
            }
            if auto_renew is not None:
                updates["subscription_auto_renew"] = auto_renew
            if valid_until_dt:
                updates["subscription_valid_until"] = valid_until_dt.isoformat()
            if status == "canceled" and not cancel_at_period_end:
                updates["has_full_access"] = False
            if plan_id:
                updates["subscription_plan_id"] = plan_id

            if updates:
                # Prefer updating by internal user id if available, otherwise by email
                update_target = lookup_filter
                await db.users.update_one(
                    update_target,
                    {
                        "$set": updates,
                        "$unset": {
                            "subscription_cancelled": "",
                            "subscription_cancel_at_period_end": "",
                        },
                    },
                )
                logger.info(f"Stripe: updated subscription for {(user_doc.get('email') if user_doc else email)} with {updates}")

                # Send cancellation email when applicable
                try:
                    if status == "canceled" or canceled_at_ts:
                        valid_iso = None
                        try:
                            if current_period_end_ts:
                                valid_iso = datetime.fromtimestamp(int(current_period_end_ts), tz=timezone.utc).isoformat()
                            elif canceled_at_ts:
                                valid_iso = datetime.fromtimestamp(int(canceled_at_ts), tz=timezone.utc).isoformat()
                        except Exception:
                            valid_iso = None
                        loop = asyncio.get_event_loop()
                        loop.run_in_executor(
                            executor,
                            partial(
                                send_subscription_cancellation_email,
                                email,
                                (user_doc.get("name") if user_doc else ""),
                                valid_iso,
                                immediate=not cancel_at_period_end,
                            ),
                        )
                except Exception:
                    pass

            # Reflect cancellation/update in billings using subscription id
            sub_id = data_obj.get("id") or data_obj.get("subscription")
            if sub_id:
                await db.billings.update_one(
                    {"billing_id": sub_id},
                    {"$set": {"status": "canceled" if status == "canceled" else status, "updated_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True,
                )

            # Forward normalized status to external webhook
            try:
                payload = {
                    "source": "stripe",
                    "type": event_type,
                    "status": "canceled" if event_type == "customer.subscription.deleted" or status == "canceled" else "updated",
                    "customer_email": email,
                    "subscription_id": sub_id,
                    "cancel_at_period_end": bool(cancel_at_period_end),
                    "valid_until": (datetime.fromtimestamp(int(current_period_end_ts), tz=timezone.utc).isoformat() if current_period_end_ts else None),
                    "livemode": bool(event.get("livemode", False))
                }
                await _forward_status_to_client(payload)
                _record_stripe_event({
                    "stage": "processed",
                    "type": event_type,
                    "event_id": event.get("id"),
                    "result": "forwarded_status",
                    "payload_json": payload_json,
                    "data_object": data_obj,
                })
            except Exception:
                pass

        elif event_type == "invoice.payment_failed":
            # Forward failed payment status to external webhook and reflect in billing
            sub_id = data_obj.get("subscription")
            customer_id = data_obj.get("customer")
            email = None
            try:
                if customer_id:
                    cust = await stripe_call_with_retry(stripe.Customer.retrieve, customer_id)
                    email = cust.get("email")
            except Exception:
                pass

            if sub_id:
                await db.billings.update_one(
                    {"billing_id": sub_id},
                    {"$set": {"status": "failed", "updated_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True,
                )

        try:
            payload = {
                "source": "stripe",
                "type": event_type,
                "status": "payment_failed",
                "customer_email": email,
                "subscription_id": sub_id,
                "livemode": bool(event.get("livemode", False))
            }
            await _forward_status_to_client(payload)
            _record_stripe_event({
                "stage": "processed",
                "type": event_type,
                "event_id": event.get("id"),
                "result": "forwarded_status",
                "payload_json": payload_json,
                "data_object": data_obj,
            })
        except Exception:
            pass

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error processing Stripe webhook: {e}", exc_info=True)
        try:
            replication_manager.audit.error(f"stripe_webhook_processing_error error={e}")
        except Exception:
            pass
        try:
            _record_stripe_event({
                "stage": "error",
                "type": event_type or "unknown",
                "event_id": (event or {}).get("id") if isinstance(event, dict) else None,
                "error": str(e),
                "payload_json": payload_json,
                "payload_raw": payload_text if payload_json is None else None,
            })
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Webhook processing error")

@api_router.get("/admin/webhooks/stripe/events")
async def list_stripe_webhook_events(current_user: User = Depends(get_current_admin)):
    """Lista os últimos eventos de webhook do Stripe registrados em memória (admin only)"""
    try:
        events = list(reversed(list(STRIPE_WEBHOOK_EVENTS_BUFFER)))
        return {"events": events[:100]}
    except Exception as e:
        logger.error(f"Failed to list Stripe webhook events: {e}")
        raise HTTPException(status_code=500, detail="Failed to list webhook events")

# Hotmart Webhook Endpoint
# Helper function to send password creation email
def send_password_creation_email(email: str, name: str, password_link: str):
    """Send password creation email to new user via SMTP"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        # Get Brevo configuration synchronously
        from pymongo import MongoClient
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        sync_client = MongoClient(mongo_url)
        sync_db = sync_client[os.environ.get('DB_NAME', 'hiperautomacao_db')]
        
        config = sync_db.email_config.find_one({})
        
        if not config:
            logger.warning("No email configuration found, skipping welcome email")
            sync_client.close()
            return
        
        sender_email = config.get('sender_email')
        sender_name = config.get('sender_name', 'Hiperautomação')
        
        # Get SMTP credentials (priority: smtp_username/password, fallback to old method)
        smtp_username = config.get('smtp_username')
        smtp_password = config.get('smtp_password')
        smtp_server = config.get('smtp_server', 'smtp-relay.brevo.com')
        smtp_port = config.get('smtp_port', 587)
        
        # Fallback to old method if new fields not set
        if not smtp_username or not smtp_password:
            smtp_username = config.get('sender_email')
            smtp_password = config.get('brevo_smtp_key') or config.get('brevo_api_key')
        
        if not smtp_username or not smtp_password:
            logger.error("No SMTP credentials found in configuration")
            sync_client.close()
            return
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Bem-vindo! Crie sua senha - Hiperautomação'
        msg['From'] = f"{sender_name} <{sender_email}>"
        msg['To'] = email
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">Bem-vindo à Hiperautomação! 🎉</h2>
            <p>Olá {name},</p>
            <p>Sua compra foi confirmada com sucesso! Agora você precisa criar sua senha para acessar a plataforma.</p>
            <p style="margin: 30px 0;">
                <a href="{password_link}" 
                   style="background-color: #10b981; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                    Criar Minha Senha
                </a>
            </p>
            <p>Este link é válido por 7 dias.</p>
            <p>Após criar sua senha, você terá acesso completo ao conteúdo adquirido.</p>
            <p>Bem-vindo a bordo!</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
                Se você não fez esta compra, ignore este email.
            </p>
        </body>
        </html>
        """
        
        part = MIMEText(html_content, 'html')
        msg.attach(part)
        
        # Send via SMTP
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
        
        logger.info(f"✅ Welcome email sent successfully to {email} via SMTP")
        sync_client.close()
        
    except Exception as e:
        logger.error(f"❌ Failed to send welcome email to {email}: {e}")
        logger.error(f"Exception type: {type(e).__name__}")

# Resend password creation email
@api_router.post("/admin/users/{user_id}/resend-password-email")
async def resend_password_email(user_id: str, current_user: User = Depends(get_current_admin)):
    """Resend password creation email to user"""
    if is_invite_id(user_id):
        invite_doc = await get_invite_doc_by_user_id(user_id)
        if not invite_doc:
            raise HTTPException(status_code=404, detail="Invitation not found")

        new_token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        expires_at = (now + timedelta(days=7)).isoformat()
        combined_history = [new_token] + invite_doc.get("token_history", [])

        await db.password_tokens.update_one(
            {"token": invite_doc["token"]},
            {
                "$set": {
                    "token": new_token,
                    "updated_at": now_iso,
                    "expires_at": expires_at,
                    "token_history": list(dict.fromkeys(combined_history)),
                }
            },
        )

        frontend_url = get_frontend_url()
        password_link = f"{frontend_url}/create-password?token={new_token}"

        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            executor,
            partial(
                send_password_creation_email,
                invite_doc["email"],
                invite_doc.get("name") or invite_doc["email"],
                password_link,
            ),
        )

        logger.info(
            "Reenviado email de convite para %s (token %s) por %s",
            invite_doc.get("email"),
            new_token,
            current_user.email,
        )
        return {"message": "Email enviado com sucesso", "token": new_token}

    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate new token
    password_token = secrets.token_urlsafe(32)
    now_iso = datetime.now(timezone.utc).isoformat()
    previous_token = user.get("password_creation_token")

    # Update user with new token and track history
    update_doc = {
        "$set": {
            "password_creation_token": password_token,
            "password_token_expires": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "updated_at": now_iso,
        },
        "$addToSet": {
            "password_token_history": {"$each": [password_token]},
        },
    }
    if previous_token:
        update_doc["$addToSet"]["password_token_history"]["$each"].append(previous_token)

    await db.users.update_one({"id": user_id}, update_doc)
    
    # Send email
    try:
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        password_link = f"{frontend_url}/create-password?token={password_token}"
        
        # Send email in background
        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            executor,
            send_password_creation_email,
            user["email"],
            user["name"],
            password_link
        )
        
        logger.info(f"📧 Password creation email resent to {user['email']} by admin {current_user.email}")
        
        return {"message": "Email enviado com sucesso"}
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail="Erro ao enviar email")

# Reset user password (admin)
@api_router.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, current_user: User = Depends(get_current_admin)):
    """Reset user password and send password reset email"""
    if is_invite_id(user_id):
        invite_doc = await get_invite_doc_by_user_id(user_id)
        if not invite_doc:
            raise HTTPException(status_code=404, detail="Invitation not found")
        new_token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        expires_at = (now + timedelta(days=7)).isoformat()
        combined_history = [new_token] + invite_doc.get("token_history", [])

        await db.password_tokens.update_one(
            {"token": invite_doc["token"]},
            {
                "$set": {
                    "token": new_token,
                    "expires_at": expires_at,
                    "updated_at": now_iso,
                    "token_history": list(dict.fromkeys(combined_history)),
                }
            },
        )

        frontend_url = get_frontend_url()
        password_link = f"{frontend_url}/create-password?token={new_token}"
        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            executor,
            partial(
                send_password_creation_email,
                invite_doc["email"],
                invite_doc.get("name") or invite_doc["email"],
                password_link,
            ),
        )

        logger.info(
            "Token de convite regenerado para %s via reset admin %s",
            invite_doc.get("email"),
            current_user.email,
        )
        return {"message": "Convite atualizado e email enviado"}

    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate new token
    password_token = secrets.token_urlsafe(32)
    now_iso = datetime.now(timezone.utc).isoformat()
    previous_token = user.get("password_creation_token")
    
    # Clear current password and set token with history tracking
    update_doc = {
        "$set": {
            "password": None,
            "password_creation_token": password_token,
            "password_token_expires": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "updated_at": now_iso,
        },
        "$addToSet": {
            "password_token_history": {"$each": [password_token]},
        },
    }
    if previous_token:
        update_doc["$addToSet"]["password_token_history"]["$each"].append(previous_token)
    
    await db.users.update_one({"id": user_id}, update_doc)
    
    # Send email
    try:
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        password_link = f"{frontend_url}/create-password?token={password_token}"
        
        # Send email in background
        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            executor,
            send_password_reset_email,
            user["email"],
            user["name"],
            password_link
        )
        
        logger.info(f"🔐 Password reset for {user['email']} by admin {current_user.email}")
        
        return {"message": "Senha resetada e email enviado com sucesso"}
    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")
        raise HTTPException(status_code=500, detail="Erro ao enviar email")


@api_router.post("/admin/users/{user_id}/impersonate", response_model=Token)
async def impersonate_user(user_id: str, current_admin: User = Depends(get_current_admin)):
    """Generate an access token so the admin can browse as the selected student."""
    if is_invite_id(user_id):
        raise HTTPException(status_code=400, detail="Não é possível visualizar convites pendentes como aluno.")

    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Você já está autenticado como este usuário.")

    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if user_doc.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Não é possível visualizar outros administradores.")

    impersonated_user = User(**user_doc)
    access_token = create_access_token(data={"sub": impersonated_user.id})

    logger.info(
        "Admin %s (%s) is impersonating user %s (%s)",
        current_admin.email,
        current_admin.id,
        impersonated_user.email,
        impersonated_user.id,
    )

    return Token(access_token=access_token, token_type="bearer", user=impersonated_user)

# Helper function to send password reset email
def send_password_reset_email(email: str, name: str, password_link: str):
    """Send password reset email via SMTP"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        # Get Brevo configuration synchronously
        from pymongo import MongoClient
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        sync_client = MongoClient(mongo_url)
        sync_db = sync_client[os.environ.get('DB_NAME', 'hiperautomacao_db')]
        
        config = sync_db.email_config.find_one({})
        
        if not config:
            logger.warning("No email configuration found, skipping reset email")
            sync_client.close()
            return
        
        sender_email = config.get('sender_email')
        sender_name = config.get('sender_name', 'Hiperautomação')
        
        # Get SMTP credentials (priority: smtp_username/password, fallback to old method)
        smtp_username = config.get('smtp_username')
        smtp_password = config.get('smtp_password')
        smtp_server = config.get('smtp_server', 'smtp-relay.brevo.com')
        smtp_port = config.get('smtp_port', 587)
        
        # Fallback to old method if new fields not set
        if not smtp_username or not smtp_password:
            smtp_username = config.get('sender_email')
            smtp_password = config.get('brevo_smtp_key') or config.get('brevo_api_key')
        
        if not smtp_username or not smtp_password:
            logger.error("No SMTP credentials found in configuration")
            sync_client.close()
            return
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Redefinir Senha - Hiperautomação'
        msg['From'] = f"{sender_name} <{sender_email}>"
        msg['To'] = email
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">Redefinir Senha</h2>
            <p>Olá {name},</p>
            <p>Um administrador solicitou a redefinição da sua senha.</p>
            <p style="margin: 30px 0;">
                <a href="{password_link}" 
                   style="background-color: #10b981; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                    Criar Nova Senha
                </a>
            </p>
            <p>Este link é válido por 7 dias.</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
                Se você não solicitou esta redefinição, ignore este email.
            </p>
        </body>
        </html>
        """
        
        part = MIMEText(html_content, 'html')
        msg.attach(part)
        
        # Send via SMTP
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
        
        logger.info(f"✅ Password reset email sent successfully to {email} via SMTP")
        sync_client.close()
        
    except Exception as e:
        logger.error(f"❌ Failed to send password reset email to {email}: {e}")


# Helper: send subscription activation email
def send_subscription_activation_email(
    email: str,
    name: str,
    login_url: str,
    valid_until_iso: Optional[str] = None,
    auto_renew: Optional[bool] = None,
):
    """Send subscription activation email via SMTP"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        # Get Brevo configuration synchronously
        from pymongo import MongoClient
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        sync_client = MongoClient(mongo_url)
        sync_db = sync_client[os.environ.get('DB_NAME', 'hiperautomacao_db')]

        config = sync_db.email_config.find_one({})
        if not config:
            logger.warning("No email configuration found, skipping activation email")
            sync_client.close()
            return

        sender_email = config.get('sender_email')
        sender_name = config.get('sender_name', 'Hiperautomação')

        smtp_username = config.get('smtp_username')
        smtp_password = config.get('smtp_password')
        smtp_server = config.get('smtp_server', 'smtp-relay.brevo.com')
        smtp_port = config.get('smtp_port', 587)
        if not smtp_username or not smtp_password:
            smtp_username = config.get('sender_email')
            smtp_password = config.get('brevo_smtp_key') or config.get('brevo_api_key')
        if not smtp_username or not smtp_password:
            logger.error("No SMTP credentials found in configuration")
            sync_client.close()
            return

        # Compose message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Assinatura Ativada - Hiperautomação'
        msg['From'] = f"{sender_name} <{sender_email}>"
        msg['To'] = email

        renewal_text = ''
        formatted_date = format_datetime_human(valid_until_iso)
        if formatted_date:
            if auto_renew:
                renewal_text = f"<p>Renovação automática em: <strong>{formatted_date}</strong></p>"
            else:
                renewal_text = f"<p>Seu acesso atual vai até: <strong>{formatted_date}</strong></p>"

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">Assinatura ativa! 🎉</h2>
            <p>Olá {name or ''},</p>
            <p>Sua assinatura foi ativada com sucesso. Agora você já pode acessar a plataforma.</p>
            {renewal_text}
            <p style="margin: 30px 0;">
                <a href="{login_url}" 
                   style="background-color: #10b981; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                    Acessar Plataforma
                </a>
            </p>
            <p>Use seu email para login. Se não tiver senha, crie uma na opção "Esqueci minha senha".</p>
        </body>
        </html>
        """

        part = MIMEText(html_content, 'html')
        msg.attach(part)

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)

        logger.info(f"✅ Subscription activation email sent successfully to {email}")
        sync_client.close()
    except Exception as e:
        logger.error(f"❌ Failed to send activation email to {email}: {e}")


# Helper: send subscription cancellation email
def send_subscription_cancellation_email(
    email: str,
    name: str,
    valid_until_iso: Optional[str] = None,
    immediate: bool = False,
):
    """Send subscription cancellation email via SMTP"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        # Get Brevo configuration synchronously
        from pymongo import MongoClient
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        sync_client = MongoClient(mongo_url)
        sync_db = sync_client[os.environ.get('DB_NAME', 'hiperautomacao_db')]

        config = sync_db.email_config.find_one({})
        if not config:
            logger.warning("No email configuration found, skipping cancellation email")
            sync_client.close()
            return

        sender_email = config.get('sender_email')
        sender_name = config.get('sender_name', 'Hiperautomação')

        smtp_username = config.get('smtp_username')
        smtp_password = config.get('smtp_password')
        smtp_server = config.get('smtp_server', 'smtp-relay.brevo.com')
        smtp_port = config.get('smtp_port', 587)
        if not smtp_username or not smtp_password:
            smtp_username = config.get('sender_email')
            smtp_password = config.get('brevo_smtp_key') or config.get('brevo_api_key')
        if not smtp_username or not smtp_password:
            logger.error("No SMTP credentials found in configuration")
            sync_client.close()
            return

        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Assinatura Cancelada - Hiperautomação'
        msg['From'] = f"{sender_name} <{sender_email}>"
        msg['To'] = email

        formatted_date = format_datetime_human(valid_until_iso)
        subscribe_url = f"{get_frontend_url().rstrip('/')}/subscribe"

        if immediate or not formatted_date:
            status_paragraph = (
                "<p>Sua assinatura foi cancelada e o acesso foi encerrado imediatamente.</p>"
                f"<p>Para voltar a estudar, faça uma nova assinatura em <a href=\"{subscribe_url}\">{subscribe_url}</a>.</p>"
            )
        else:
            status_paragraph = (
                f"<p>Sua assinatura foi cancelada. Você ainda terá acesso até <strong>{formatted_date}</strong>.</p>"
                f"<p>Se desejar continuar após essa data, renove em <a href=\"{subscribe_url}\">{subscribe_url}</a>.</p>"
            )

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #ef4444;">Assinatura cancelada</h2>
            <p>Olá {name or ''},</p>
            {status_paragraph}
        </body>
        </html>
        """

        part = MIMEText(html_content, 'html')
        msg.attach(part)

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)

        logger.info(f"✅ Subscription cancellation email sent successfully to {email}")
        sync_client.close()
    except Exception as e:
        logger.error(f"❌ Failed to send cancellation email to {email}: {e}")


# ==================== GAMIFICATION SYSTEM ====================

# Default gamification rewards
DEFAULT_REWARDS = {
    "create_post": 5,
    "create_comment": 2,
    "receive_like": 1,
    "complete_course": 20
}

# Get gamification settings
@api_router.get("/admin/gamification-settings")
async def get_gamification_settings(current_user: User = Depends(get_current_admin)):
    """Get gamification reward settings (admin only)"""
    settings = await db.gamification_settings.find_one({}, {"_id": 0})
    
    if not settings:
        return DEFAULT_REWARDS
    
    return settings

# Update gamification settings
@api_router.post("/admin/gamification-settings")
async def update_gamification_settings(
    create_post: int,
    create_comment: int,
    receive_like: int,
    complete_course: int,
    current_user: User = Depends(get_current_admin)
):
    """Update gamification reward settings (admin only)"""
    settings = {
        "create_post": create_post,
        "create_comment": create_comment,
        "receive_like": receive_like,
        "complete_course": complete_course,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.email
    }
    
    await db.gamification_settings.update_one(
        {},
        {"$set": settings},
        upsert=True
    )
    
    logger.info(f"Admin {current_user.email} updated gamification settings")
    
    return {"message": "Gamification settings updated successfully"}

# Helper function to get reward amount
async def get_reward_amount(action_type: str) -> int:
    """Get reward amount for a specific action"""
    settings = await db.gamification_settings.find_one({}, {"_id": 0})
    
    if not settings:
        return DEFAULT_REWARDS.get(action_type, 0)
    
    return settings.get(action_type, 0)

# Helper function to give gamification reward
async def give_gamification_reward(user_id: str, action_type: str, description: str):
    """Log gamification action (credits system removed)"""
    logger.info(f"🎮 Gamification action logged for user {user_id}, action: {action_type}")
    
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        logger.warning(f"❌ User {user_id} not found for gamification action")
        return False
    
    # Only log for users who have access to at least one course
    has_access = await user_has_access(user_id)
    if not has_access:
        logger.info(f"❌ User {user.get('email')} has no course access, no gamification action logged for {action_type}")
        return False
    
    logger.info(f"✅ Gamification action {action_type} logged for user {user.get('email')}")
    return True

# Get billing status
@api_router.get("/billing/{billing_id}")
async def get_billing_status(billing_id: str, current_user: User = Depends(get_current_user)):
    """Get billing status"""
    billing = await db.billings.find_one(
        {"billing_id": billing_id, "user_id": current_user.id},
        {"_id": 0}
    )
    
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    
    return billing

# Admin: Update course prices
@api_router.put("/admin/courses/{course_id}/pricing")
async def update_course_pricing(
    course_id: str,
    price_brl: Optional[float] = None,
    current_user: User = Depends(get_current_admin)
):
    """Update course pricing (admin only)"""
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    update_data = {}
    if price_brl is not None:
        update_data["price_brl"] = price_brl
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No pricing data provided")
    
    await db.courses.update_one(
        {"id": course_id},
        {"$set": update_data}
    )
    
    logger.info(f"Admin {current_user.email} updated pricing for course {course_id}")
    
    return {"message": "Course pricing updated successfully", "updates": update_data}

# ==================== LEAD CAPTURE ENDPOINTS ====================

@api_router.post("/leads/capture")
async def capture_lead(lead_data: LeadCaptureRequest):
    """Capture lead and send to Brevo"""
    try:
        # Get Brevo configuration
        brevo_config = await db.brevo_config.find_one({})
        if not brevo_config or not brevo_config.get("api_key"):
            raise HTTPException(status_code=500, detail="Brevo configuration not found")
        
        # Send to Brevo
        import requests
        
        # Normalizar número de WhatsApp para o formato aceito pelo Brevo
        def normalize_whatsapp(whatsapp_number):
            """Normaliza número de WhatsApp para formato internacional"""
            if not whatsapp_number:
                return None
            
            # Remove todos os caracteres não numéricos
            clean_number = ''.join(filter(str.isdigit, whatsapp_number))
            
            # Verificar se o número tem um tamanho válido
            if len(clean_number) < 10 or len(clean_number) > 15:
                logger.warning(f"WhatsApp number invalid length: {whatsapp_number} (cleaned: {clean_number})")
                return None
            
            # Se não começar com código do país, adiciona +55 (Brasil)
            if len(clean_number) == 11 and clean_number.startswith(('11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99')):
                return f"+55{clean_number}"
            elif len(clean_number) == 13 and clean_number.startswith('55'):
                return f"+{clean_number}"
            elif clean_number.startswith('55') and len(clean_number) > 11:
                return f"+{clean_number}"
            
            # Se já tem código do país, mantém
            return f"+{clean_number}" if not whatsapp_number.startswith('+') else whatsapp_number

        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": brevo_config["api_key"]
        }
        
        # Função para tentar enviar para Brevo
        def try_send_to_brevo(contact_data, attempt_description):
            logger.info(f"Sending to Brevo ({attempt_description}): {json.dumps(contact_data, indent=2)}")
            
            response = requests.post(
                "https://api.brevo.com/v3/contacts",
                json=contact_data,
                headers=headers
            )
            
            return response
        
        # Primeira tentativa: com WhatsApp (se válido)
        normalized_whatsapp = normalize_whatsapp(lead_data.whatsapp)
        
        if normalized_whatsapp:
            # Tentar com WhatsApp
            contact_data = {
                "email": lead_data.email,
                "attributes": {
                    "NOME": lead_data.name,
                    "WHATSAPP": normalized_whatsapp
                },
                "listIds": [brevo_config.get("list_id")] if brevo_config.get("list_id") else []
            }
            
            response = try_send_to_brevo(contact_data, "with WhatsApp")
        else:
            # WhatsApp inválido, tentar direto sem WhatsApp
            logger.info("WhatsApp number invalid, sending without WhatsApp field")
            contact_data = {
                "email": lead_data.email,
                "attributes": {
                    "NOME": lead_data.name
                },
                "listIds": [brevo_config.get("list_id")] if brevo_config.get("list_id") else []
            }
            
            response = try_send_to_brevo(contact_data, "without WhatsApp (invalid number)")
        
        brevo_success = False
        brevo_error = None
        
        if response.status_code not in [200, 201, 204]:
            logger.error(f"Brevo API error: {response.status_code} - {response.text}")
            
            # Tratamento específico para erro de IP não autorizado
            if response.status_code == 401:
                try:
                    error_data = response.json()
                    if "unrecognised IP address" in error_data.get("message", ""):
                        raise HTTPException(
                            status_code=400, 
                            detail="IP não autorizado no Brevo. Configure seu IP em: https://app.brevo.com/security/authorised_ips"
                        )
                except:
                    pass
                raise HTTPException(status_code=401, detail="API key do Brevo inválida ou não autorizada")
            
            # Tratamento específico para erro de parâmetro inválido
            if response.status_code == 400:
                try:
                    error_data = response.json()
                    error_message = error_data.get("message", "")
                    error_code = error_data.get("code", "")
                    
                    if "Invalid WhatsApp number" in error_message:
                        # Tentar novamente sem WhatsApp
                        logger.info("WhatsApp number invalid, trying without WhatsApp field")
                        contact_data_no_whatsapp = {
                            "email": lead_data.email,
                            "attributes": {
                                "NOME": lead_data.name
                            },
                            "listIds": [brevo_config.get("list_id")] if brevo_config.get("list_id") else []
                        }
                        
                        response_retry = try_send_to_brevo(contact_data_no_whatsapp, "without WhatsApp")
                        
                        if response_retry.status_code in [200, 201, 204]:
                            brevo_success = True
                            logger.info("Lead successfully sent to Brevo without WhatsApp")
                        else:
                            brevo_error = f"Erro na API do Brevo: {response_retry.status_code}"
                            logger.error(f"Failed to send even without WhatsApp: {response_retry.text}")
                    
                    elif error_code == "duplicate_parameter":
                        duplicate_fields = error_data.get("metadata", {}).get("duplicate_identifiers", [])
                        if "WHATSAPP" in duplicate_fields:
                            raise HTTPException(
                                status_code=409, 
                                detail="Este número de WhatsApp já está cadastrado em nossa base de dados"
                            )
                        elif "email" in duplicate_fields or any("email" in field.lower() for field in duplicate_fields):
                            raise HTTPException(
                                status_code=409, 
                                detail="Este email já está cadastrado em nossa base de dados"
                            )
                        else:
                            raise HTTPException(
                                status_code=409, 
                                detail="Dados duplicados: já existe um contato com essas informações"
                            )
                    elif "invalid_parameter" in error_code:
                        brevo_error = f"Parâmetro inválido: {error_message}"
                        logger.error(f"Invalid parameter error: {error_message}")
                    else:
                        brevo_error = f"Erro na API do Brevo: {response.status_code}"
                        
                except HTTPException:
                    # Re-raise HTTPException to preserve status codes
                    raise
                except Exception as e:
                    logger.error(f"Error parsing Brevo response: {str(e)}")
                    brevo_error = f"Erro na API do Brevo: {response.status_code}"
            else:
                brevo_error = f"Erro na API do Brevo: {response.status_code}"
        else:
            brevo_success = True
        
        # Store lead locally sempre, independente do resultado do Brevo
        lead_doc = {
            "name": lead_data.name,
            "email": lead_data.email,
            "whatsapp": lead_data.whatsapp,
            "created_at": datetime.now(timezone.utc),
            "sent_to_brevo": brevo_success,
            "error": brevo_error if not brevo_success else None
        }
        
        await db.leads.insert_one(lead_doc)
        
        if brevo_success:
            logger.info(f"Lead captured and sent to Brevo: {lead_data.email}")
            return {"message": "Lead captured successfully"}
        else:
            logger.warning(f"Lead captured locally but failed to send to Brevo: {lead_data.email} - Error: {brevo_error}")
            return {"message": "Lead captured successfully (saved locally, Brevo integration had issues)"}
        
    except HTTPException as he:
        # Re-raise HTTPExceptions (like IP authorization errors and duplicates)
        logger.error(f"HTTP Error capturing lead: {he.detail}")
        # Store lead locally even if there's an HTTP error
        lead_doc = {
            "name": lead_data.name,
            "email": lead_data.email,
            "whatsapp": lead_data.whatsapp,
            "created_at": datetime.now(timezone.utc),
            "sent_to_brevo": False,
            "error": he.detail
        }
        
        await db.leads.insert_one(lead_doc)
        raise he
        
    except Exception as e:
        logger.error(f"Error capturing lead: {str(e)}")
        # Store lead locally even if Brevo fails
        lead_doc = {
            "name": lead_data.name,
            "email": lead_data.email,
            "whatsapp": lead_data.whatsapp,
            "created_at": datetime.now(timezone.utc),
            "sent_to_brevo": False,
            "error": str(e)
        }
        
        await db.leads.insert_one(lead_doc)
        raise HTTPException(status_code=500, detail="Error processing lead capture")

@api_router.get("/admin/brevo-config")
async def get_brevo_config(current_user: User = Depends(get_current_admin)):
    """Get Brevo configuration (admin only)"""
    config = await db.brevo_config.find_one({})
    if not config:
        return {"api_key": "", "list_id": None, "sales_page_url": ""}
    
    # Return masked API key for display, but include a flag to indicate if it exists
    return {
        "api_key": config.get("api_key", "")[:10] + "..." if config.get("api_key") else "",
        "api_key_configured": bool(config.get("api_key")),
        "list_id": config.get("list_id"),
        "sales_page_url": config.get("sales_page_url", "")
    }

@api_router.post("/admin/brevo-config")
async def update_brevo_config(
    config: BrevoConfig,
    current_user: User = Depends(get_current_admin)
):
    """Update Brevo configuration (admin only)"""
    config_data = {
        "api_key": config.api_key,
        "list_id": config.list_id,
        "sales_page_url": config.sales_page_url,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.email
    }
    
    await db.brevo_config.replace_one({}, config_data, upsert=True)
    
    logger.info(f"Admin {current_user.email} updated Brevo configuration")
    return {"message": "Brevo configuration updated successfully"}

@api_router.get("/admin/brevo-lists")
async def get_brevo_lists(current_user: User = Depends(get_current_admin)):
    """Get Brevo lists (admin only)"""
    try:
        brevo_config = await db.brevo_config.find_one({})
        if not brevo_config or not brevo_config.get("api_key"):
            raise HTTPException(status_code=400, detail="Brevo API key not configured")
        
        import requests
        
        headers = {
            "accept": "application/json",
            "api-key": brevo_config["api_key"]
        }
        
        response = requests.get(
            "https://api.brevo.com/v3/contacts/lists",
            headers=headers
        )
        
        if response.status_code != 200:
            logger.error(f"Brevo API error: {response.status_code} - {response.text}")
            
            # Tratamento específico para erro de IP não autorizado
            if response.status_code == 401:
                try:
                    error_data = response.json()
                    if "unrecognised IP address" in error_data.get("message", ""):
                        raise HTTPException(
                            status_code=400, 
                            detail="IP não autorizado no Brevo. Adicione seu IP na lista de IPs autorizados em: https://app.brevo.com/security/authorised_ips"
                        )
                except:
                    pass
                raise HTTPException(status_code=401, detail="API key do Brevo inválida ou não autorizada")
            
            raise HTTPException(status_code=500, detail=f"Erro na API do Brevo: {response.status_code}")
        
        data = response.json()
        lists = []
        
        for lst in data.get("lists", []):
            lists.append({
                "id": lst["id"],
                "name": lst["name"],
                "folder_id": lst.get("folderId"),
                "totalSubscribers": lst.get("totalSubscribers", 0)
            })
        
        return {"lists": lists}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Brevo lists: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching Brevo lists: {str(e)}")

@api_router.get("/leads/sales-page-url")
async def get_sales_page_url():
    """Get sales page URL for lead redirection"""
    config = await db.brevo_config.find_one({})
    if not config or not config.get("sales_page_url"):
        return {"url": "https://exemplo.com/vendas"}  # URL padrão
    
    return {"url": config["sales_page_url"]}

# Include the router in the main app



@app.on_event("startup")
async def startup_event():
    """Initialize background services (replication manager) without changing DB schema."""
    try:
        await replication_manager.start()
        logger.info("Replication manager started. Enabled=%s", replication_manager.enabled)
        # Log replication secondary configuration if present
        try:
            cfg = load_config()
            logger.info("[Startup] Replication config loaded: enabled=%s configured=%s mongo_url=%s db_name=%s", 
                        replication_manager.enabled,
                        bool(cfg.get('mongo_url') and cfg.get('db_name')),
                        cfg.get('mongo_url'),
                        cfg.get('db_name'))
        except Exception:
            pass
    except Exception as exc:
        logger.exception("Failed to start replication manager: %s", exc)

    # No migrations here to preserve current DB structure

##############################
# Admin Replication Endpoints
##############################

class ReplicationConfigPayload(BaseModel):
    mongo_url: str
    db_name: str
    username: Optional[str] = None
    password: Optional[str] = None
    replication_enabled: bool = False


@api_router.get("/admin/replication/status")
async def get_replication_status(current_user: User = Depends(get_current_admin)):
    cfg = load_config()
    return {
        "replication_enabled": replication_manager.enabled,
        "configured": bool(cfg.get("mongo_url") and cfg.get("db_name")),
        "queue_size": replication_manager.queue.qsize(),
        "stats": {
            "enqueued": replication_manager.stats.total_enqueued,
            "processed": replication_manager.stats.total_processed,
            "errors": replication_manager.stats.total_errors,
            "last_error": replication_manager.stats.last_error,
        },
    }


@api_router.get("/admin/replication/config")
async def get_replication_config(current_user: User = Depends(get_current_admin)):
    cfg = load_config()
    # Normalize null values so the frontend form can be populated safely
    return {
        "mongo_url": cfg.get("mongo_url") or "",
        "db_name": cfg.get("db_name") or "",
        "username": cfg.get("username") or "",
        "password": cfg.get("password") or "",
        "replication_enabled": bool(cfg.get("replication_enabled", False)),
    }


@api_router.post("/admin/replication/config")
async def set_replication_config(payload: ReplicationConfigPayload, current_user: User = Depends(get_current_admin)):
    config_dict = payload.model_dump()
    # Persist encrypted config
    save_config(config_dict)
    # Apply live configuration (do not fail save on configure errors)
    try:
        await replication_manager.configure(config_dict)
        return {"message": "Configuração de replicação salva", "replication_enabled": replication_manager.enabled}
    except Exception as exc:
        logger.exception("Erro ao aplicar configuração de replicação: %s", exc)
        # Mesmo com erro na aplicação da configuração em tempo real, manter salvamento bem-sucedido
        return {
            "message": f"Configuração salva, mas não foi possível aplicar agora: {exc}",
            "replication_enabled": False
        }


@api_router.post("/admin/replication/test")
async def test_replication_connection(payload: ReplicationConfigPayload, current_user: User = Depends(get_current_admin)):
    # Try connecting using provided config without persisting
    try:
        if not payload.mongo_url or not payload.db_name:
            raise HTTPException(status_code=400, detail="mongo_url e db_name são obrigatórios")
        tmp_client = AsyncIOMotorClient(payload.mongo_url)
        tmp_db = tmp_client[payload.db_name]
        # Simple command to test connectivity
        await tmp_db.command("ping")
        tmp_client.close()
        return {"ok": True, "message": "Conexão bem-sucedida"}
    except Exception as exc:
        return {"ok": False, "message": str(exc)}

# --- Full backup endpoint: copy all collections from primary to configured secondary ---
@api_router.post("/admin/replication/backup")
async def backup_full_database(current_user: User = Depends(get_current_admin)):
    """Copy all documents from the primary database to the configured replication database.
    Drops and recreates collections on the secondary to avoid duplicate _id conflicts.
    """
    try:
        # Ensure replication is enabled and configured
        if not replication_manager.enabled or replication_manager.secondary_db is None:
            raise HTTPException(status_code=400, detail="Replicação desabilitada ou não configurada")

        secondary_db = replication_manager.secondary_db

        # List all collections on primary
        coll_names = await _primary_db.list_collection_names()
        # Exclude system collections
        coll_names = [n for n in coll_names if not n.startswith("system.")]

        replication_manager.audit.info(f"backup_start collections={len(coll_names)}")

        summary = {}
        total_docs = 0

        for name in coll_names:
            copied = 0
            try:
                # Drop target collection to ensure a clean copy
                try:
                    await secondary_db[name].drop()
                except Exception:
                    pass  # ignore if not exists

                # Stream documents in batches to the secondary
                batch = []
                cursor = _primary_db[name].find({}, projection=None)
                async for doc in cursor:
                    batch.append(doc)
                    if len(batch) >= 1000:
                        await secondary_db[name].insert_many(batch, ordered=False)
                        copied += len(batch)
                        batch = []
                if batch:
                    await secondary_db[name].insert_many(batch, ordered=False)
                    copied += len(batch)

                summary[name] = copied
                total_docs += copied
                replication_manager.audit.info(f"backup_collection name={name} copied={copied}")
            except Exception as coll_err:
                # Record per-collection error but continue
                summary[name] = {"error": str(coll_err)}
                replication_manager.audit.error(f"backup_collection_error name={name} error={coll_err}")

        replication_manager.audit.info(f"backup_done collections={len(coll_names)} total_docs={total_docs}")
        return {
            "ok": True,
            "message": f"Backup concluído: {len(coll_names)} coleções, {total_docs} documentos",
            "collections": summary,
            "total_docs": total_docs,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Full backup failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Falha no backup: {str(e)}")


@api_router.post("/admin/replication/toggle")
async def toggle_replication(enable: bool, current_user: User = Depends(get_current_admin)):
    cfg = load_config()
    cfg["replication_enabled"] = bool(enable)
    save_config(cfg)
    await replication_manager.configure(cfg)
    return {"replication_enabled": replication_manager.enabled}


@api_router.get("/admin/replication/logs")
async def get_replication_logs(limit: int = 200, current_user: User = Depends(get_current_admin)):
    # Return last N lines from audit log file
    try:
        if not AUDIT_LOG_FILE.exists():
            return {"logs": []}
        with AUDIT_LOG_FILE.open("r", encoding="utf-8") as f:
            lines = f.readlines()
        tail = lines[-limit:] if limit > 0 else lines
        return {"logs": [line.strip() for line in tail]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao ler logs: {exc}")


app.include_router(api_router)

cors_origin_env = os.environ.get('CORS_ORIGINS')
if cors_origin_env:
    cors_origins = [
        origin.strip()
        for origin in cors_origin_env.split(',')
        if origin.strip()
    ]
else:
    cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

# Remove duplicados preservando a ordem
cors_origins = list(dict.fromkeys(cors_origins))
cors_origin_regex = os.environ.get('CORS_ORIGIN_REGEX') or None

allow_credentials = True
if any(origin == "*" for origin in cors_origins):
    # Starlette não permite '*' com credentials habilitado
    allow_credentials = False
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=allow_credentials,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

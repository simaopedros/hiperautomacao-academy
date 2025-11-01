from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import asyncio
from concurrent.futures import ThreadPoolExecutor
import base64
import io
import csv
import secrets
import httpx
import random
import string
import stripe
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).parent

# Load default env first (backwards compatibility), then env-specific overrides
default_env_file = ROOT_DIR / '.env'
if default_env_file.exists():
    load_dotenv(default_env_file, override=False)

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
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer()

# Abacate Pay Configuration
ABACATEPAY_API_KEY = os.environ.get('ABACATEPAY_API_KEY')
ABACATEPAY_BASE_URL = "https://api.abacatepay.com/v1"

# Stripe Configuration
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Helper to ensure Stripe is configured with the latest available key
# Tries env -> existing api_key -> payment_settings in DB
async def ensure_stripe_config():
    # 1) Try environment variable
    key = os.environ.get('STRIPE_SECRET_KEY')
    if key:
        try:
            stripe.api_key = key
        except Exception:
            pass
        return key

    # 2) Try already configured api_key
    if getattr(stripe, 'api_key', None):
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
            return key
    except Exception:
        # Swallow DB errors here; the caller will handle missing config
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
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "student"  # admin or student
    has_full_access: bool = False  # Access to all courses
    preferred_language: Optional[str] = None  # User's preferred language (pt, en, es, etc.) - None means show all courses

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

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    avatar: Optional[str] = None
    has_purchased: bool = False  # Whether user has made any purchase
    enrolled_courses: list[str] = []  # List of course IDs user is enrolled in
    invited: bool = False  # Whether user was invited
    password_created: bool = False  # Whether user created password from invitation
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    subscription_plan_id: Optional[str] = None
    subscription_valid_until: Optional[datetime] = None

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
    hotmart_product_id: Optional[str] = None  # Hotmart product ID
    hotmart_checkout_url: Optional[str] = None  # Hotmart checkout URL
    language: Optional[str] = None  # Course language (pt, en, es, etc.) - None means available for all languages

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
    hotmart_product_id: Optional[str] = None  # Hotmart product ID
    hotmart_checkout_url: Optional[str] = None  # Hotmart checkout URL
    language: Optional[str] = None  # Course language (pt, en, es, etc.) - None means available for all languages

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

class ModuleCreate(ModuleBase):
    course_id: str

class Module(ModuleBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Link Model for lessons
class LinkItem(BaseModel):
    title: str
    url: str

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

# Lesson Models
class LessonBase(BaseModel):
    title: str
    type: str  # video, text, file
    content: str  # video URL, text content, or file URL
    duration: Optional[int] = 0  # in seconds
    order: int = 0
    links: List[LinkItem] = []  # Additional links for the lesson

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

# Payment Gateway Configuration
class PaymentGatewayConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    active_gateway: str = "abacatepay"  # "abacatepay", "hotmart" ou "stripe"
    hotmart_token: Optional[str] = None  # Hotmart security token (hottok)
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

# Hotmart Webhook Models
class HotmartWebhookData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    callback_type: str
    transaction: str
    prod: str  # Product ID
    prod_name: str
    status: str
    email: str
    name: str
    purchase_date: str
    price: str
    currency: str
    raw_data: dict  # Store full webhook data
    processed: bool = False
    processed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Abacate Pay Models
class AbacatePayBilling(BaseModel):
    billing_id: str
    user_id: str
    amount_brl: float
    course_id: Optional[str] = None  # For direct course purchase
    status: str = "pending"  # pending, paid, failed, cancelled
    payment_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    paid_at: Optional[datetime] = None

# ==================== SUBSCRIPTION MODELS ====================

class SubscriptionPlanBase(BaseModel):
    name: str
    description: Optional[str] = None
    price_brl: float
    duration_days: int # Access duration in days
    is_active: bool = True # To easily enable/disable plans
    hotmart_product_id: Optional[str] = None  # Hotmart product ID for this subscription plan
    hotmart_checkout_url: Optional[str] = None  # Hotmart checkout URL for this plan
    # Stripe
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

# Support Configuration
class SupportConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    support_url: str = "https://wa.me/5511999999999"  # Default WhatsApp
    support_text: str = "Suporte"
    enabled: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

# Feature Flag Configuration
class FeatureFlag(BaseModel):
    model_config = ConfigDict(extra="ignore")
    key: str
    description: Optional[str] = None
    enabled_for_all: bool = False
    enabled_users: List[str] = []  # emails ou IDs de usuários
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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as exc:
        logger.exception("Failed to authenticate token: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid token") from exc

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# (Feature flags removidos)

# Helper function to check if user has access to a course (backward compatible)
async def user_has_course_access(user_id: str, course_id: str, has_full_access: bool = False) -> bool:
    """
    Check if user has access to a course.
    Checks BOTH enrollments collection (new system) and enrolled_courses field (legacy system)
    for backward compatibility with existing production data.
    """
    if has_full_access:
        return True
    
    # Check enrollments collection (new system)
    enrollment = await db.enrollments.find_one({
        "user_id": user_id,
        "course_id": course_id
    })
    if enrollment:
        return True
    
    # Check user's enrolled_courses field (legacy system)
    user_doc = await db.users.find_one({"id": user_id})
    if user_doc and "enrolled_courses" in user_doc:
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

@api_router.put("/auth/language", response_model=User)
async def update_user_language(request: dict, current_user: User = Depends(get_current_user)):
    """Update user's preferred language"""
    language = request.get('language')
    
    # Validate language code if provided
    if language and language not in ['pt', 'en', 'es']:
        raise HTTPException(status_code=400, detail="Invalid language code. Supported: pt, en, es")
    
    # Update user's preferred language
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"preferred_language": language}}
    )
    
    # Return updated user
    updated_user = await db.users.find_one({"id": current_user.id})
    return User(**updated_user)

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
    return lesson

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
    
    # For each user, get their enrolled courses (only valid ones)
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        
        # Get enrolled courses from enrollments collection
        enrollments = await db.enrollments.find({"user_id": user['id']}).to_list(1000)
        # Filter to only include courses that still exist
        user['enrolled_courses'] = [
            enrollment['course_id'] 
            for enrollment in enrollments 
            if enrollment['course_id'] in valid_course_ids
        ]
    
    # Include pending invitations (users who received an invite link but have
    # not created their password / first login yet)
    pending_invites = await db.password_tokens.find({}, {"_id": 0}).to_list(1000)
    for invite in pending_invites:
        created_at_raw = invite.get('created_at')
        created_at = datetime.fromisoformat(created_at_raw) if created_at_raw else datetime.now(timezone.utc)
        
        course_ids = invite.get('course_ids') or []
        if not course_ids and invite.get('course_id'):
            # Backwards compatibility with earlier payloads
            course_ids = [invite['course_id']]
        filtered_courses = [course_id for course_id in course_ids if course_id in valid_course_ids]
        
        pending_user = {
            "id": f"invite-{invite['token']}",
            "email": invite['email'],
            "name": invite.get('name') or invite['email'],
            "role": "student",
            "has_full_access": invite.get('has_full_access', False),
            "avatar": None,
            "has_purchased": False,
            "enrolled_courses": filtered_courses,
            "invited": True,
            "password_created": False,
            "created_at": created_at
        }
        users.append(pending_user)
    
    return users

@api_router.post("/admin/users", response_model=AdminUserCreateResponse)
async def create_user_by_admin(user_data: UserCreate, current_user: User = Depends(get_current_admin)):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Decide whether to create full account or invitation
    is_direct_creation = bool(user_data.password)
    
    if is_direct_creation:
        user_payload = user_data.model_dump(exclude={"password"})
        if user_payload.get("referral_code") is None:
            user_payload.pop("referral_code", None)
        user = User(**user_payload)
        user_dict = user.model_dump()
        user_dict['password_hash'] = get_password_hash(user_data.password)
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        await db.users.insert_one(user_dict)
        return AdminUserCreateResponse(user=user, email_status="not_applicable")
    
    # Invitation flow (no password provided)
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    token_data = {
        "token": token,
        "email": user_data.email,
        "name": user_data.name,
        "has_full_access": user_data.has_full_access,
        "course_ids": [],
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.password_tokens.insert_one(token_data)
    
    # Prepare response-like structure
    invited_user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        has_full_access=user_data.has_full_access,
        invited=True,
        password_created=False
    )
    
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
                    user_data.email,
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
            logger.error(f"Error sending invitation email to {user_data.email}: {email_error}")
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
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_data.model_dump(exclude_unset=True)
    
    # If password is being updated, hash it
    if "password" in update_data and update_data["password"]:
        update_data["password_hash"] = get_password_hash(update_data["password"])
        del update_data["password"]
    
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
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete user's enrollments
    await db.enrollments.delete_many({"user_id": user_id})
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
    # Check if enrollment already exists
    existing = await db.enrollments.find_one({
        "user_id": enrollment.user_id,
        "course_id": enrollment.course_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="User already enrolled in this course")
    
    # Verify user and course exist
    user = await db.users.find_one({"id": enrollment.user_id})
    course = await db.courses.find_one({"id": enrollment.course_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Create enrollment
    enroll_obj = Enrollment(**enrollment.model_dump())
    enroll_dict = enroll_obj.model_dump()
    enroll_dict['enrolled_at'] = enroll_dict['enrolled_at'].isoformat()
    
    await db.enrollments.insert_one(enroll_dict)
    return {"message": "User enrolled successfully"}

@api_router.get("/admin/enrollments/{user_id}")
async def get_user_enrollments(user_id: str, current_user: User = Depends(get_current_admin)):
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
    
    # Also get courses from user's enrolled_courses field (new method - Hotmart)
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
    result = await db.enrollments.delete_one({"user_id": user_id, "course_id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return {"message": "User removed from course successfully"}

# ==================== STUDENT ROUTES ====================

@api_router.get("/student/courses")
async def get_published_courses(current_user: User = Depends(get_current_user)):
    """Get all published courses with enrollment status, filtered by user's preferred language"""
    
    # Build course filter query
    course_filter = {"published": True}
    
    # Apply language filter if user has a preferred language
    if current_user.preferred_language:
        # Show courses that match user's language OR have no language set (backward compatibility)
        course_filter["$or"] = [
            {"language": current_user.preferred_language},
            {"language": {"$exists": False}},  # Courses without language field
            {"language": None}  # Courses with language explicitly set to None
        ]
    
    # Get filtered published courses
    courses = await db.courses.find(course_filter, {"_id": 0}).to_list(1000)
    
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
    
    # Add enrollment status to each course
    result = []
    for course in courses:
        if isinstance(course['created_at'], str):
            course['created_at'] = datetime.fromisoformat(course['created_at'])
        
        # Add enrollment info
        course_data = dict(course)
        course_data['is_enrolled'] = course['id'] in enrolled_course_ids or current_user.has_full_access
        course_data['has_access'] = course['id'] in enrolled_course_ids or current_user.has_full_access
        
        result.append(course_data)
    
    return result

@api_router.get("/student/courses/{course_id}")
async def get_course_detail(course_id: str, current_user: User = Depends(get_current_user)):
    course = await db.courses.find_one({"id": course_id, "published": True}, {"_id": 0})
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
    
    if isinstance(lesson['created_at'], str):
        lesson['created_at'] = datetime.fromisoformat(lesson['created_at'])
    
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
                
                logger.info(f"User {current_user.id} completed course {course_id}: {course_title}")
                
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
    
    # Check if user has full access
    if user.get("has_full_access", False):
        return True

    # Check active subscription
    valid_until = user.get("subscription_valid_until")
    if valid_until:
        # Normalize to datetime if stored as string
        if isinstance(valid_until, str):
            try:
                valid_until = datetime.fromisoformat(valid_until)
            except Exception:
                valid_until = None
        if valid_until and datetime.now(timezone.utc) < valid_until:
            return True
    
    # Check if user is enrolled in at least one course
    enrollment = await db.enrollments.find_one({"user_id": user_id})
    return enrollment is not None

# ==================== COMMENT ROUTES ====================

@api_router.post("/comments", response_model=Comment)
async def create_comment(comment_data: CommentCreate, current_user: User = Depends(get_current_user)):
    # Check if user has access to at least one course
    has_access = await user_has_access(current_user.id)
    if not has_access:
        raise HTTPException(
            status_code=403, 
            detail="Você precisa estar matriculado em pelo menos um curso para participar da comunidade!"
        )
    
    comment = Comment(
        **comment_data.model_dump(),
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
                    # Update access if needed
                    user_id = existing_user['id']
                    
                    # Set full access if requested
                    if request.has_full_access and not existing_user.get('has_full_access'):
                        await db.users.update_one(
                            {"id": user_id},
                            {"$set": {"has_full_access": True}}
                        )
                    
                    # Enroll in courses if specified
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
                else:
                    # Create token for password creation
                    token = secrets.token_urlsafe(32)
                    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
                    
                    token_data = {
                        "token": token,
                        "email": email,
                        "name": name,
                        "has_full_access": request.has_full_access,
                        "course_ids": request.course_ids if not request.has_full_access else [],
                        "expires_at": expires_at.isoformat(),
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.password_tokens.insert_one(token_data)
                    
                    # Send email with password creation link
                    password_link = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/create-password?token={token}"
                    
                    access_description = "acesso completo à plataforma" if request.has_full_access else f"{len(request.course_ids)} curso(s)"
                    
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
                        # Send email in a thread pool to avoid blocking
                        loop = asyncio.get_event_loop()
                        try:
                            # Get SMTP credentials (priority: smtp_username/password, fallback to old method)
                            smtp_username = email_config.get('smtp_username')
                            smtp_password = email_config.get('smtp_password')
                            smtp_server = email_config.get('smtp_server', 'smtp-relay.brevo.com')
                            smtp_port = email_config.get('smtp_port', 587)
                            
                            # Fallback to old method if new fields not set
                            if not smtp_username or not smtp_password:
                                smtp_username = email_config.get('sender_email')
                                smtp_password = email_config.get('brevo_smtp_key') or email_config.get('brevo_api_key')
                            
                            email_sent = await loop.run_in_executor(
                                executor,
                                send_brevo_email,
                                email,
                                name,
                                "Bem-vindo �� Hiperautoma��ǜo - Crie sua senha",
                                html_content,
                                smtp_username,
                                smtp_password,
                                email_config['sender_email'],
                                email_config.get('sender_name'),
                                smtp_server,
                                smtp_port
                            )
                            if email_sent:
                                logger.info(f"Successfully sent invitation email to {email}")
                            else:
                                logger.warning(f"Failed to send email to {email}, but continuing import")
                                errors.append(f"Failed to send email to {email}")
                        except Exception as email_error:
                            logger.error(f"Error sending email to {email}: {email_error}")
                            errors.append(f"Email error for {email}: {str(email_error)}")
                    else:
                        logger.warning(f"Skipping email sending for {email} because email configuration is missing.")
                        errors.append(f"Email not sent to {email}: email configuration not set.")

                    
                    imported_count += 1
                    continue
                
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
    
    if not token_data:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    
    # Check expiration
    expires_at = datetime.fromisoformat(token_data['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Token has expired")
    
    # Create user
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
                "enrolled_at": datetime.now(timezone.utc).isoformat()
            }
            await db.enrollments.insert_one(enrollment)
    
    # Delete used token
    await db.password_tokens.delete_one({"token": token})
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)

# ==================== SOCIAL FEED ====================

@api_router.get("/social/feed", response_model=List[Comment])
async def get_social_feed(current_user: User = Depends(get_current_user), filter: Optional[str] = None):
    # Get all top-level comments/posts (no parent_id) with reply counts
    query = {"parent_id": None}
    if filter == "discussions":
        query["lesson_id"] = None  # Only social posts
    elif filter == "lessons":
        query["lesson_id"] = {"$ne": None}  # Only lesson comments
    
    comments = await db.comments.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    for comment in comments:
        if isinstance(comment['created_at'], str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
        
        # Count replies
        replies_count = await db.comments.count_documents({"parent_id": comment['id']})
        comment['replies_count'] = replies_count
    
    return comments

@api_router.get("/social/post/{post_id}")
async def get_post_detail(post_id: str, current_user: User = Depends(get_current_user)):
    # Get the post
    post = await db.comments.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if isinstance(post['created_at'], str):
        post['created_at'] = datetime.fromisoformat(post['created_at'])
    
    # Get replies
    replies = await db.comments.find({"parent_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    for reply in replies:
        if isinstance(reply['created_at'], str):
            reply['created_at'] = datetime.fromisoformat(reply['created_at'])
    
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


# ==================== ABACATE PAY INTEGRATION ====================

# Create billing for course purchase or subscription
@api_router.post("/billing/create")
async def create_billing(request: CreateBillingRequest, current_user: User = Depends(get_current_user)):
    """Create a billing for course purchase or subscription plan"""
    try:
        # Verificar gateway ativo
        gateway_cfg = await db.gateway_config.find_one({}, {"_id": 0})
        active_gateway = (gateway_cfg or {}).get("active_gateway", "abacatepay")
        # Determine what we're selling
        if request.course_id:
            # Buying course directly
            course = await db.courses.find_one({"id": request.course_id}, {"_id": 0})
            if not course:
                raise HTTPException(status_code=404, detail="Course not found")
            
            amount_brl = course.get("price_brl", 0)
            if amount_brl <= 0:
                raise HTTPException(status_code=400, detail="Course price not set")
            
            product_name = course["title"]
            product_description = f"Acesso ao curso: {course['title']}"
        elif request.subscription_plan_id:
            # Buying subscription plan
            plan = await db.subscription_plans.find_one({"id": request.subscription_plan_id, "is_active": True}, {"_id": 0})
            if not plan:
                raise HTTPException(status_code=404, detail="Subscription plan not found or inactive")

            amount_brl = float(plan.get("price_brl", 0))
            if amount_brl <= 0:
                raise HTTPException(status_code=400, detail="Subscription price not set")

            product_name = f"Assinatura: {plan['name']}"
            product_description = f"Acesso à plataforma por {plan['duration_days']} dias"
        else:
            raise HTTPException(status_code=400, detail="Must specify course_id or subscription_plan_id")

        # Fluxo Stripe para assinaturas
        if request.subscription_plan_id and active_gateway == "stripe":
            stripe_key = await ensure_stripe_config()
            if not stripe_key:
                raise HTTPException(status_code=500, detail="Stripe not configured: missing STRIPE_SECRET_KEY")
            if not plan.get("stripe_price_id"):
                raise HTTPException(status_code=400, detail="Subscription plan missing stripe_price_id")

            try:
                frontend_url = get_frontend_url()
                if not _is_valid_base_url(frontend_url):
                    logger.error(f"Invalid FRONTEND_URL for Stripe: '{frontend_url}'")
                    raise HTTPException(status_code=500, detail="Invalid FRONTEND_URL for Stripe checkout")
                success_url = f"{frontend_url}/subscription-success?session_id={{CHECKOUT_SESSION_ID}}"
                cancel_url = f"{frontend_url}/payment-cancelled"
                logger.info(f"Stripe checkout URLs composed: success={success_url} cancel={cancel_url}")
                session = stripe.checkout.Session.create(
                    mode="subscription",
                    customer_email=request.customer_email,
                    line_items=[{
                        "price": plan["stripe_price_id"],
                        "quantity": 1,
                    }],
                    metadata={
                        "user_id": current_user.id,
                        "subscription_plan_id": request.subscription_plan_id,
                        "access_scope": plan.get("access_scope", "full"),
                        "course_ids": ",".join(plan.get("course_ids", [])),
                        "duration_days": str(plan.get("duration_days", 0)),
                    },
                    client_reference_id=current_user.id,
                    success_url=success_url,
                    cancel_url=cancel_url,
                )
            except Exception as e:
                logger.error(f"Stripe session creation failed: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail="Failed to create Stripe checkout session")

            # Registrar pseudo-billing
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
            await db.billings.insert_one(billing_record)
            return {"payment_url": session.url, "billing_id": session.id}
        
        # Create billing with Abacate Pay
        async with httpx.AsyncClient() as client:
            billing_data = {
                "frequency": "ONE_TIME",
                "methods": ["PIX"],  # Only PIX for sandbox testing
                "products": [{
                    "externalId": request.course_id or request.subscription_plan_id,
                    "name": product_name,
                    "description": product_description,
                    "quantity": 1,
                    "price": int(amount_brl * 100)  # Convert to cents
                }],
                "customer": {
                    "email": request.customer_email,
                    "name": request.customer_name,
                    "cellphone": "+5511999999999",  # Default test cellphone for sandbox
                    "taxId": "11144477735"  # Valid test CPF for sandbox
                },
                "returnUrl": f"{get_frontend_url()}/payment-cancelled",
                "completionUrl": f"{get_frontend_url()}/payment-success"
            }
            
            headers = {
                "Authorization": f"Bearer {ABACATEPAY_API_KEY}",
                "Content-Type": "application/json"
            }
            
            response = await client.post(
                f"{ABACATEPAY_BASE_URL}/billing/create",
                json=billing_data,
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"Abacate Pay API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail=f"Payment gateway error: {response.text}")
            
            billing_response = response.json()
            logger.info(f"Abacate Pay response: {billing_response}")
            
            # Extract data from the response structure
            data = billing_response.get("data", {})
            billing_id = data.get("id")
            payment_url = data.get("url")
            
            # Save billing to database
            billing_record = {
                "billing_id": billing_id,
                "user_id": current_user.id,
                "amount_brl": amount_brl,
                "course_id": request.course_id,
                "subscription_plan_id": request.subscription_plan_id,
                "status": "pending",
                "payment_url": payment_url,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "paid_at": None
            }
            await db.billings.insert_one(billing_record)
            
            logger.info(f"Created billing {billing_id} for user {current_user.email}")
            
            return {
                "billing_id": billing_id,
                "payment_url": payment_url,
                "amount": amount_brl
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating billing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create billing: {str(e)}")

# Webhook endpoint for Abacate Pay payment notifications
@api_router.post("/webhook/abacatepay")
async def abacatepay_webhook(request: dict):
    """Handle payment confirmation webhooks from Abacate Pay"""
    try:
        logger.info(f"Received webhook: {request}")
        
        # Extract event data
        event_type = request.get("type")
        billing_data = request.get("data", {})
        billing_id = billing_data.get("id")
        status = billing_data.get("status")
        
        if not billing_id:
            logger.error("Webhook missing billing_id")
            return {"status": "error", "message": "Missing billing_id"}
        
        # Get billing from database
        billing = await db.billings.find_one({"billing_id": billing_id})
        if not billing:
            logger.error(f"Billing {billing_id} not found in database")
            return {"status": "error", "message": "Billing not found"}
        
        # Process payment confirmation
        if event_type == "billing.paid" or status == "PAID":
            # Check if already processed
            if billing.get("status") == "paid":
                logger.warning(f"Billing {billing_id} already processed")
                return {"status": "ok", "message": "Already processed"}
            
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
            # This is important for referral bonus logic
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
                    logger.info(f"Enrolled user {user_id} in course {course_id} via direct purchase")
            elif billing.get("subscription_plan_id"):
                # Subscription purchase - set subscription validity on user
                plan_id = billing.get("subscription_plan_id")
                plan = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
                if plan:
                    duration_days = int(plan.get("duration_days", 0) or 0)
                    valid_until = datetime.now(timezone.utc) + timedelta(days=duration_days)
                    await db.users.update_one(
                        {"id": user_id},
                        {"$set": {
                            "has_purchased": True,
                            "subscription_plan_id": plan_id,
                            "subscription_valid_until": valid_until.isoformat()
                        }}
                    )
                    logger.info(f"Activated subscription {plan_id} for user {user_id} until {valid_until.isoformat()}")

            logger.info(f"Successfully processed payment for billing {billing_id}")
            return {"status": "ok", "message": "Payment processed"}
        
        else:
            logger.info(f"Webhook event {event_type} - no action needed")
            return {"status": "ok", "message": "Event received"}
            
    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}



# Check payment status from Abacate Pay
@api_router.get("/billing/{billing_id}/check-status")
async def check_billing_status(billing_id: str, current_user: User = Depends(get_current_user)):
    """Check billing status from Abacate Pay and update if paid"""
    try:
        # Get billing from database
        billing = await db.billings.find_one(
            {"billing_id": billing_id, "user_id": current_user.id},
            {"_id": 0}
        )
        
        if not billing:
            raise HTTPException(status_code=404, detail="Billing not found")
        
        # If already paid, return immediately
        if billing.get("status") == "paid":
            return {"status": "paid", "message": "Payment already confirmed"}
        
        # Check status with Abacate Pay
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {ABACATEPAY_API_KEY}",
                "Content-Type": "application/json"
            }
            
            response = await client.get(
                f"{ABACATEPAY_BASE_URL}/billing/{billing_id}",
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"Abacate Pay API error: {response.status_code} - {response.text}")
                return {"status": billing.get("status"), "message": "Could not check status"}
            
            billing_response = response.json()
            data = billing_response.get("data", {})
            status = data.get("status", "PENDING")
            
            logger.info(f"Billing {billing_id} status from API: {status}")
            
            # If paid, process the payment
            if status == "PAID":
                # Update billing status
                await db.billings.update_one(
                    {"billing_id": billing_id},
                    {"$set": {
                        "status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                user_id = billing["user_id"]
                
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
                        logger.info(f"Enrolled user {user_id} in course {course_id} via status check")
                elif billing.get("subscription_plan_id"):
                    # Subscription purchase - set subscription validity on user
                    plan_id = billing.get("subscription_plan_id")
                    plan = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
                    if plan:
                        duration_days = int(plan.get("duration_days", 0) or 0)
                        valid_until = datetime.now(timezone.utc) + timedelta(days=duration_days)
                        await db.users.update_one(
                            {"id": user_id},
                            {"$set": {
                                "has_purchased": True,
                                "subscription_plan_id": plan_id,
                                "subscription_valid_until": valid_until.isoformat()
                            }}
                        )
                        logger.info(f"Activated subscription {plan_id} for user {user_id} until {valid_until.isoformat()} via status check")
                
                return {"status": "paid", "message": "Payment confirmed! Benefits applied."}
            
            return {"status": "pending", "message": "Payment still pending"}
            
    except Exception as e:
        logger.error(f"Error checking billing status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")


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
    """Get payment gateway settings (admin only)"""
    settings = await db.payment_settings.find_one({}, {"_id": 0})
    
    if not settings:
        # Return default settings
        return {
            "abacatepay_api_key": ABACATEPAY_API_KEY or "",
            "environment": os.environ.get('ABACATEPAY_ENVIRONMENT', 'sandbox')
        }
    
    return settings

# Admin: Update payment settings
@api_router.post("/admin/payment-settings")
async def update_payment_settings(
    abacatepay_api_key: str,
    environment: str,
    stripe_secret_key: Optional[str] = None,
    stripe_webhook_secret: Optional[str] = None,
    current_user: User = Depends(get_current_admin)
):
    """Update payment gateway settings (admin only)"""
    if environment not in ["sandbox", "production"]:
        raise HTTPException(status_code=400, detail="Environment must be 'sandbox' or 'production'")
    
    settings = {
        "abacatepay_api_key": abacatepay_api_key,
        "environment": environment,
        "stripe_secret_key": stripe_secret_key,
        "stripe_webhook_secret": stripe_webhook_secret,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.email
    }
    
    await db.payment_settings.update_one(
        {},
        {"$set": settings},
        upsert=True
    )
    
    # Update environment variables (note: requires restart to take full effect)
    os.environ['ABACATEPAY_API_KEY'] = abacatepay_api_key
    os.environ['ABACATEPAY_ENVIRONMENT'] = environment
    if stripe_secret_key:
        os.environ['STRIPE_SECRET_KEY'] = stripe_secret_key
        try:
            stripe.api_key = stripe_secret_key
        except Exception:
            pass
    if stripe_webhook_secret:
        os.environ['STRIPE_WEBHOOK_SECRET'] = stripe_webhook_secret
    
    logger.info(f"Admin {current_user.email} updated payment settings to {environment}")
    
    return {"message": "Payment settings updated successfully. Restart backend to apply changes."}

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
        
        return {
            "message": "Billing marked as paid successfully",
            "course_enrolled": billing.get("course_id")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking billing as paid: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to mark billing as paid: {str(e)}")


# ==================== HOTMART INTEGRATION ====================

# Get payment gateway configuration
@api_router.get("/admin/gateway-config")
async def get_gateway_config(current_user: User = Depends(get_current_admin)):
    """Get payment gateway configuration (admin only)"""
    config = await db.gateway_config.find_one({}, {"_id": 0})
    
    if not config:
        # Return default config
        return {
            "active_gateway": "abacatepay",
            "hotmart_token": None
        }
    
    return config

# Get active gateway (public endpoint for students)
@api_router.get("/gateway/active")
async def get_active_gateway():
    """Get active payment gateway (public endpoint)"""
    config = await db.gateway_config.find_one({}, {"_id": 0})
    
    if not config:
        logger.info("No gateway config found, returning default: abacatepay")
        return {"active_gateway": "abacatepay"}
    
    active = config.get("active_gateway", "abacatepay")
    logger.info(f"Gateway config found, active gateway: {active}")
    
    # Return only the active gateway, not the token
    return {"active_gateway": active}

# Get support configuration (public endpoint)
@api_router.get("/support/config")
async def get_support_config():
    """Get support configuration (public endpoint)"""
    config = await db.support_config.find_one({}, {"_id": 0})
    
    if not config:
        return {
            "support_url": "https://wa.me/5511999999999",
            "support_text": "Suporte",
            "enabled": True
        }
    
    return {
        "support_url": config.get("support_url", "https://wa.me/5511999999999"),
        "support_text": config.get("support_text", "Suporte"),
        "enabled": config.get("enabled", True)
    }

# Update support configuration (admin only)
@api_router.post("/admin/support/config")
async def update_support_config(
    support_url: str,
    support_text: str = "Suporte",
    enabled: bool = True,
    current_user: User = Depends(get_current_admin)
):
    """Update support configuration (admin only)"""
    config = {
        "support_url": support_url,
        "support_text": support_text,
        "enabled": enabled,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.email
    }
    await db.support_config.update_one(
        {},
        {"$set": config},
        upsert=True
    )
    logger.info(f"Admin {current_user.email} updated support config")
    return {"message": "Support configuration updated successfully"}

# (Feature flags removidos)

# Debug endpoint to check user enrollment
@api_router.get("/debug/user/{email}")
async def debug_user(email: str, current_user: User = Depends(get_current_admin)):
    """Debug endpoint to check user data"""
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        return {"error": "User not found"}
    
    # Get course names
    enrolled_course_ids = user.get("enrolled_courses", [])
    courses = []
    for course_id in enrolled_course_ids:
        course = await db.courses.find_one({"id": course_id}, {"_id": 0, "id": 1, "title": 1})
        if course:
            courses.append(course)
    
    return {
        "user": {
            "email": user.get("email"),
            "name": user.get("name"),
            "has_purchased": user.get("has_purchased"),
            "enrolled_courses_count": len(enrolled_course_ids),
            "enrolled_course_ids": enrolled_course_ids
        },
        "courses": courses
    }

# Test email endpoint
@api_router.post("/debug/test-email")
async def test_email(
    recipient_email: str,
    recipient_name: str,
    current_user: User = Depends(get_current_admin)
):
    """Test email sending"""
    try:
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        password_token = secrets.token_urlsafe(32)
        password_link = f"{frontend_url}/create-password?token={password_token}"
        
        # Send in thread pool
        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            executor,
            send_password_creation_email,
            recipient_email,
            recipient_name,
            password_link
        )
        
        return {"message": "Email test started, check logs for results"}
    except Exception as e:
        logger.error(f"Failed to start email test: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Update payment gateway configuration
@api_router.post("/admin/gateway-config")
async def update_gateway_config(
    active_gateway: str,
    hotmart_token: Optional[str] = None,
    current_user: User = Depends(get_current_admin)
):
    """Update payment gateway configuration (admin only)"""
    if active_gateway not in ["abacatepay", "hotmart", "stripe"]:
        raise HTTPException(status_code=400, detail="Invalid gateway. Must be 'abacatepay', 'hotmart' or 'stripe'")
    
    config = {
        "active_gateway": active_gateway,
        "hotmart_token": hotmart_token,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.email
    }
    
    await db.gateway_config.update_one(
        {},
        {"$set": config},
        upsert=True
    )
    
    logger.info(f"Admin {current_user.email} updated gateway config to {active_gateway}")
    
    return {"message": "Gateway configuration updated successfully"}

# ==================== STRIPE WEBHOOK ====================

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
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
    sig_header = request.headers.get("Stripe-Signature")
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=webhook_secret,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event.get("type")
    data_obj = (event.get("data", {}) or {}).get("object", {})

    try:
        if event_type in ("checkout.session.completed", "invoice.payment_succeeded"):
            meta = data_obj.get("metadata", {})
            user_id = meta.get("user_id") or data_obj.get("client_reference_id")
            plan_id = meta.get("subscription_plan_id")
            access_scope = meta.get("access_scope", "full")
            course_ids = [c for c in (meta.get("course_ids") or "").split(",") if c]
            duration_days = int(meta.get("duration_days", "0") or 0)

            if not user_id or not plan_id:
                logger.warning("Missing user_id or plan_id in webhook metadata; skipping")
                return {"status": "ignored"}

            if access_scope == "full":
                valid_until = datetime.now(timezone.utc) + timedelta(days=duration_days)
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {
                        "has_purchased": True,
                        "has_full_access": True,
                        "subscription_plan_id": plan_id,
                        "subscription_valid_until": valid_until.isoformat(),
                    }}
                )
                logger.info(f"Stripe: full access activated for user {user_id} until {valid_until.isoformat()}")
            else:
                if course_ids:
                    await db.users.update_one(
                        {"id": user_id},
                        {"$addToSet": {"enrolled_courses": {"$each": course_ids}}, "$set": {"has_purchased": True}}
                    )
                logger.info(f"Stripe: specific courses granted to user {user_id}: {course_ids}")

            billing_id = data_obj.get("id") or data_obj.get("subscription") or data_obj.get("payment_intent")
            if billing_id:
                await db.billings.update_one(
                    {"billing_id": billing_id},
                    {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True,
                )

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error processing Stripe webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Webhook processing error")

# Hotmart Webhook Endpoint
@api_router.post("/hotmart/webhook")
async def hotmart_webhook(webhook_data: dict):
    """
    Process Hotmart webhook for purchase notifications
    Supports both v1 and v2 webhook formats
    """
    try:
        logger.info(f"🔔 Received Hotmart webhook: {webhook_data}")
        
        # Detect webhook version
        version = webhook_data.get("version", "1.0.0")
        
        if version == "2.0.0":
            # V2 format
            hottok = webhook_data.get("hottok", "")
            event = webhook_data.get("event", "")
            data = webhook_data.get("data", {})
            
            product = data.get("product", {})
            buyer = data.get("buyer", {})
            purchase = data.get("purchase", {})
            
            # Use ucode (unique code) instead of id, as id can be 0 in tests
            prod_id = product.get("ucode", "") or str(product.get("id", ""))
            email = buyer.get("email", "")
            name = buyer.get("name", "")
            status = purchase.get("status", "")
            transaction = purchase.get("transaction", "")
            prod_name = product.get("name", "")
            price = purchase.get("price", {}).get("value", 0)
            currency = purchase.get("price", {}).get("currency_value", "BRL")
            purchase_date = webhook_data.get("creation_date", "")
            
        else:
            # V1 format (legacy)
            hottok = webhook_data.get("hottok", "")
            event = ""  # V1 uses callback_type instead
            callback_type = webhook_data.get("callback_type", "")
            status = webhook_data.get("status", "")
            transaction = webhook_data.get("transaction", "")
            prod_id = webhook_data.get("prod", "")
            email = webhook_data.get("email", "")
            name = webhook_data.get("name", "")
            prod_name = webhook_data.get("prod_name", "")
            price = webhook_data.get("price", "")
            currency = webhook_data.get("currency", "")
            purchase_date = webhook_data.get("purchase_date", "")
        
        # Validate hottok if configured
        gateway_config = await db.gateway_config.find_one({})
        if gateway_config and gateway_config.get("hotmart_token"):
            if hottok != gateway_config.get("hotmart_token"):
                logger.warning(f"❌ Invalid Hotmart token received")
                raise HTTPException(status_code=403, detail="Invalid hotmart token")
        
        # Store webhook data
        webhook_record = {
            "id": str(uuid.uuid4()),
            "version": version,
            "event": event,
            "transaction": transaction,
            "prod": prod_id,
            "prod_name": prod_name,
            "status": status,
            "email": email,
            "name": name,
            "purchase_date": str(purchase_date),
            "price": str(price),
            "currency": currency,
            "raw_data": webhook_data,
            "processed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.hotmart_webhooks.insert_one(webhook_record)
        
        # Determine approval and blocking events
        # Approvals
        # V2: PURCHASE_APPROVED (APPROVED) or RECURRENCE_PAYMENT_CONFIRMED
        # V1: callback_type = "1" (approved purchase)
        is_approved_v2 = (
            version == "2.0.0" and (
                (event == "PURCHASE_APPROVED" and status == "APPROVED") or
                (event == "RECURRENCE_PAYMENT_CONFIRMED")
            )
        )
        is_approved_v1 = (version != "2.0.0" and callback_type == "1" and status == "approved")

        # Blocking events for subscriptions (Hotmart v2 common events)
        is_block_v2 = (
            version == "2.0.0" and event in [
                "PURCHASE_CANCELED",
                "RECURRENCE_OVERDUE",
                "RECURRENCE_CANCELED",
                "PURCHASE_EXPIRED"
            ]
        )
        # Minimal v1 handling: treat callback_type != "1" with status in canceled/expired as block
        is_block_v1 = (
            version != "2.0.0" and status in ["canceled", "expired", "chargeback"]
        )

        # If it's a blocking event, attempt to block subscription access
        if (not is_approved_v2 and not is_approved_v1) and (is_block_v2 or is_block_v1):
            logger.info(f"⛔ Handling blocking event - version: {version}, event: {event}, status: {status}")
            # Try to find a subscription plan associated with this product
            sub_plan = await db.subscription_plans.find_one({"hotmart_product_id": prod_id}, {"_id": 0})
            if not sub_plan:
                logger.info("No subscription plan found for blocking; skipping.")
                return {"message": "Blocking event received but no subscription plan matched"}
            # Find user
            user = await db.users.find_one({"email": email})
            if not user:
                logger.info("Blocking event received but user not found; skipping.")
                return {"message": "Blocking event received but user not found"}
            # Block access by disabling full access and setting subscription validity to now
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {
                    "has_full_access": False,
                    "subscription_plan_id": sub_plan.get("id", user.get("subscription_plan_id")),
                    "subscription_valid_until": datetime.now(timezone.utc).isoformat()
                }}
            )
            await db.hotmart_webhooks.update_one(
                {"transaction": transaction},
                {"$set": {"processed": True, "processed_at": datetime.now(timezone.utc).isoformat()}}
            )
            logger.info(f"🚫 Subscription access blocked for {email} due to event {event}.")
            return {"message": "Subscription access blocked", "event": event, "status": status}

        # For any non-approval/non-blocking, do not process further
        if not (is_approved_v2 or is_approved_v1):
            logger.info(f"⏭️  Skipping webhook - version: {version}, event: {event}, status: {status}")
            return {"message": "Webhook received but not processed (not approved purchase)"}
        
        logger.info(f"✅ Processing approved purchase for {email}")
        logger.info(f"🔍 Looking for product with ID/UCODE: {prod_id}")
        
        # Find subscription plan or course by Hotmart product ID
        sub_plan = await db.subscription_plans.find_one({"hotmart_product_id": prod_id}, {"_id": 0})

        # If a subscription plan is found, prefer it
        # Otherwise fall back to course
        if sub_plan:
            logger.info(f"📅 Found subscription plan: {sub_plan.get('name')}")
        
        # Find course by Hotmart product ID (only if not a subscription plan)
        course = await db.courses.find_one({"hotmart_product_id": prod_id})
        if course:
            logger.info(f"📚 Found course: {course.get('title')}")
        
        if not sub_plan and not course:
            logger.warning(f"⚠️  No subscription plan or course found for Hotmart product ID/UCODE: {prod_id}")
            logger.warning(f"📋 Product name from webhook: {prod_name}")
            return {"message": "Product not found in system", "product_id": prod_id, "product_name": prod_name}
        
        # Get or create user
        user = await db.users.find_one({"email": email})
        
        if not user:
            # Create new user
            logger.info(f"👤 Creating new user from Hotmart purchase: {email}")
            
            # Generate password creation token
            password_token = secrets.token_urlsafe(32)
            
            # Extract first and last name
            name_parts = name.split(" ", 1)
            first_name = name_parts[0] if len(name_parts) > 0 else name
            last_name = name_parts[1] if len(name_parts) > 1 else ""
            
            user_id = str(uuid.uuid4())
            
            # Prepare enrolled courses - add course ID if it's a course purchase
            enrolled_courses = [course["id"]] if course else []
            
            new_user = {
                "id": user_id,
                "email": email,
                "name": name,
                "password": None,  # Will be set when user creates password
                "role": "student",
                "avatar": None,
                "full_access": bool(sub_plan is not None),
                "has_full_access": bool(sub_plan is not None),
                "enrolled_courses": enrolled_courses,
                "has_purchased": True,  # Mark as purchased
                "password_creation_token": password_token,
                "password_token_expires": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_via": "hotmart",
                "hotmart_transaction": transaction
            }
            
            await db.users.insert_one(new_user)
            user = new_user
            
            if course:
                logger.info(f"🎓 Course access granted to NEW user: {course['title']} to {email}")
            if sub_plan:
                # Activate subscription for new user
                duration_days = int(sub_plan.get("duration_days", 0) or 0)
                valid_until = datetime.now(timezone.utc) + timedelta(days=duration_days)
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {
                        "subscription_plan_id": sub_plan["id"],
                        "subscription_valid_until": valid_until.isoformat(),
                        "has_full_access": True
                    }}
                )
                logger.info(f"🟢 Subscription '{sub_plan['name']}' activated for NEW user until {valid_until.isoformat()}.")
            
            # Send welcome email with password creation link
            try:
                frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
                password_link = f"{frontend_url}/create-password?token={password_token}"
                
                # Send email in background
                loop = asyncio.get_event_loop()
                loop.run_in_executor(
                    executor,
                    send_password_creation_email,
                    email,
                    name,
                    password_link
                )
                logger.info(f"📧 Welcome email sent to {email}")
            except Exception as e:
                logger.error(f"❌ Failed to send welcome email: {e}")
        else:
            # Mark existing user as having purchased
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"has_purchased": True}}
            )
            user["has_purchased"] = True
            
            # If it's a course purchase, add course to user's enrolled courses
            if course:
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$addToSet": {"enrolled_courses": course["id"]}}
                )
                logger.info(f"🎓 Course access granted to EXISTING user: {course['title']} to {email}")
            # If it's a subscription plan purchase, grant full access and set validity
            if sub_plan:
                duration_days = int(sub_plan.get("duration_days", 0) or 0)
                valid_until = datetime.now(timezone.utc) + timedelta(days=duration_days)
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {
                        "has_full_access": True,
                        "subscription_plan_id": sub_plan["id"],
                        "subscription_valid_until": valid_until.isoformat()
                    }}
                )
                logger.info(f"🟢 Subscription '{sub_plan['name']}' activated for EXISTING user until {valid_until.isoformat()}.")
        
        user_id = user["id"]
        
        # Add transaction record
        if course:
            # Record course purchase
            transaction_record = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "transaction_type": "course_purchase",
                "description": f"Curso comprado via Hotmart: {course['title']}",
                "reference_id": course["id"],
                "hotmart_transaction": transaction,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.purchase_transactions.insert_one(transaction_record)
            
            logger.info(f"✅ Course purchase recorded for transaction {transaction}")
        elif sub_plan:
            # Record subscription activation
            transaction_record = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "transaction_type": "subscription_purchase",
                "description": f"Assinatura ativada via Hotmart: {sub_plan['name']}",
                "reference_id": sub_plan["id"],
                "hotmart_transaction": transaction,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.purchase_transactions.insert_one(transaction_record)
            logger.info(f"✅ Subscription activation recorded for transaction {transaction}")
        
        # Mark webhook as processed
        await db.hotmart_webhooks.update_one(
            {"transaction": transaction},
            {
                "$set": {
                    "processed": True,
                    "processed_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {"message": "Webhook processed successfully", "user_created": user.get("created_via") == "hotmart"}
        
    except Exception as e:
        logger.error(f"❌ Error processing Hotmart webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing webhook: {str(e)}")

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
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate new token
    password_token = secrets.token_urlsafe(32)
    
    # Update user with new token
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "password_creation_token": password_token,
                "password_token_expires": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            }
        }
    )
    
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
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate new token
    password_token = secrets.token_urlsafe(32)
    
    # Clear current password and set token
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "password": None,
                "password_creation_token": password_token,
                "password_token_expires": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            }
        }
    )
    
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
    """Run migrations on startup"""
    pass


app.include_router(api_router)

cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
cors_origin_regex = os.environ.get('CORS_ORIGIN_REGEX')

# Se allow_credentials=True, não podemos usar '*' como origem.
# Preferimos lista explícita via CORS_ORIGINS ou regex via CORS_ORIGIN_REGEX (ex.: https://.*\.trycloudflare\.com)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

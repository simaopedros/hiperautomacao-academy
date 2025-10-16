from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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

# Referral System Configuration
REFERRAL_SIGNUP_BONUS = 10  # Credits given to referrer when someone signs up
REFERRAL_PURCHASE_PERCENTAGE = 50  # Percentage of credits given to referrer

# Helper function to generate unique referral code
async def generate_referral_code():
    """Generate a unique 8-character referral code"""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        existing = await db.users.find_one({"referral_code": code})
        if not existing:
            return code

# Migration: Add referral codes to existing users
async def migrate_referral_codes():
    """Add referral codes to users that don't have one"""
    users_without_code = await db.users.find({"$or": [{"referral_code": {"$exists": False}}, {"referral_code": ""}]}).to_list(None)
    
    if users_without_code:
        logger.info(f"Migrating {len(users_without_code)} users to have referral codes...")
        for user in users_without_code:
            referral_code = await generate_referral_code()
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"referral_code": referral_code}}
            )
        logger.info("Referral code migration complete")

        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        existing = await db.users.find_one({"referral_code": code})
        if not existing:
            return code

# Abacate Pay Configuration
ABACATEPAY_API_KEY = os.environ.get('ABACATEPAY_API_KEY')
ABACATEPAY_BASE_URL = "https://api.abacatepay.com/v1"

# Credit Packages Configuration
CREDIT_PACKAGES = [
    {"id": "pkg_small", "name": "Pacote Inicial", "price_brl": 10.0, "credits": 50, "bonus_percentage": 0, "hotmart_product_id": None},
    {"id": "pkg_medium", "name": "Pacote Médio", "price_brl": 25.0, "credits": 150, "bonus_percentage": 20, "hotmart_product_id": None},
    {"id": "pkg_large", "name": "Pacote Grande", "price_brl": 50.0, "credits": 350, "bonus_percentage": 40, "hotmart_product_id": None}
]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "student"  # admin or student
    full_access: bool = False  # Access to all courses

class UserCreate(UserBase):
    password: str
    referral_code: Optional[str] = None  # Code of person who referred this user

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    full_access: Optional[bool] = None
    password: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    avatar: Optional[str] = None
    referral_code: str = ""  # This user's unique referral code
    referred_by: Optional[str] = None  # User ID of who referred this user
    has_purchased: bool = False  # Whether user has made any purchase
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

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
    published: bool = False
    price_brl: Optional[float] = 0.0  # Price in BRL (R$)
    price_credits: Optional[int] = 50  # Price in credits (default 50)
    hotmart_product_id: Optional[str] = None  # Hotmart product ID

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    category: Optional[str] = None
    published: Optional[bool] = None
    price_brl: Optional[float] = None
    price_credits: Optional[int] = None
    hotmart_product_id: Optional[str] = None  # Hotmart product ID

class Course(CourseBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    instructor_id: str
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
    brevo_api_key: str
    sender_email: str
    sender_name: str

# Bulk Import Models
class BulkImportRequest(BaseModel):
    course_id: str
    csv_content: str  # Base64 encoded CSV

class PasswordCreationToken(BaseModel):
    token: str
    email: str
    name: str
    course_id: str
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

# ==================== CREDITS MODELS ====================

# User Credits Balance
class UserCredits(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    balance: int = 0
    total_earned: int = 0
    total_spent: int = 0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Credit Transaction
class CreditTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: int  # Positive for earning, negative for spending
    transaction_type: str  # earned, spent, purchased, refund
    description: str
    reference_id: Optional[str] = None  # course_id, billing_id, etc
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Credit Package
class CreditPackage(BaseModel):
    id: str
    name: str
    price_brl: float  # Price in BRL
    credits: int  # Number of credits
    bonus_percentage: int = 0  # Bonus percentage
    hotmart_product_id: Optional[str] = None  # Hotmart product ID

# Payment Gateway Configuration
class PaymentGatewayConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    active_gateway: str = "abacatepay"  # "abacatepay" or "hotmart"
    hotmart_token: Optional[str] = None  # Hotmart security token (hottok)
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
    credits: Optional[int] = None  # For credit packages
    course_id: Optional[str] = None  # For direct course purchase
    package_id: Optional[str] = None  # For credit packages
    status: str = "pending"  # pending, paid, failed, cancelled
    payment_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    paid_at: Optional[datetime] = None

class CreateBillingRequest(BaseModel):
    package_id: Optional[str] = None  # For buying credits
    course_id: Optional[str] = None  # For buying course directly
    customer_name: str
    customer_email: EmailStr

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
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if referral code is valid
    referrer_id = None
    if user_data.referral_code:
        referrer = await db.users.find_one({"referral_code": user_data.referral_code})
        if referrer:
            referrer_id = referrer["id"]
            logger.info(f"New user referred by {referrer['email']} (code: {user_data.referral_code})")
        else:
            logger.warning(f"Invalid referral code: {user_data.referral_code}")
    
    # Create user - default full_access to False for new registrations
    user_data_dict = user_data.model_dump(exclude={"password", "referral_code"})
    if "full_access" not in user_data_dict:
        user_data_dict["full_access"] = False
    
    # Generate unique referral code for this new user
    new_referral_code = await generate_referral_code()
    
    user = User(**user_data_dict, referral_code=new_referral_code, referred_by=referrer_id)
    user_dict = user.model_dump()
    user_dict['password_hash'] = get_password_hash(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Log the referral for tracking (no bonus given at signup)
    if referrer_id:
        logger.info(f"New user {user.email} registered with referral code from {referrer_id}")
    
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

# ==================== ADMIN ROUTES - COURSES ====================

@api_router.post("/admin/courses", response_model=Course)
async def create_course(course_data: CourseCreate, current_user: User = Depends(get_current_admin)):
    course = Course(**course_data.model_dump(), instructor_id=current_user.id)
    course_dict = course.model_dump()
    course_dict['created_at'] = course_dict['created_at'].isoformat()
    
    await db.courses.insert_one(course_dict)
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
    await db.courses.update_one({"id": course_id}, {"$set": update_data})
    
    updated = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
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
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

@api_router.post("/admin/users", response_model=User)
async def create_user_by_admin(user_data: UserCreate, current_user: User = Depends(get_current_admin)):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(**user_data.model_dump(exclude={"password"}))
    user_dict = user.model_dump()
    user_dict['password_hash'] = get_password_hash(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    return user

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
    """Get all published courses with enrollment status"""
    # Get all published courses
    courses = await db.courses.find({"published": True}, {"_id": 0}).to_list(1000)
    
    # Get user's enrollments
    enrollments = await db.enrollments.find({"user_id": current_user.id}).to_list(1000)
    enrolled_course_ids = [e["course_id"] for e in enrollments]
    
    # Add enrollment status to each course
    result = []
    for course in courses:
        if isinstance(course['created_at'], str):
            course['created_at'] = datetime.fromisoformat(course['created_at'])
        
        # Add enrollment info
        course_data = dict(course)
        course_data['is_enrolled'] = course['id'] in enrolled_course_ids or current_user.full_access
        course_data['has_access'] = course['id'] in enrolled_course_ids or current_user.full_access
        
        result.append(course_data)
    
    return result

@api_router.get("/student/courses/{course_id}")
async def get_course_detail(course_id: str, current_user: User = Depends(get_current_user)):
    course = await db.courses.find_one({"id": course_id, "published": True}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if user has access to this course
    if not current_user.full_access:
        enrollment = await db.enrollments.find_one({
            "user_id": current_user.id,
            "course_id": course_id
        })
        if not enrollment:
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

# ==================== COMMENT ROUTES ====================

@api_router.post("/comments", response_model=Comment)
async def create_comment(comment_data: CommentCreate, current_user: User = Depends(get_current_user)):
    # Check if user has at least 1 credit to participate in community
    user_credits = await get_user_credits(current_user.id)
    if user_credits["balance"] < 1:
        raise HTTPException(
            status_code=403, 
            detail="Você precisa ter pelo menos 1 crédito para participar da comunidade. Compre créditos para começar!"
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
    config['brevo_api_key'] = config.get('brevo_api_key', '')[:10] + '...' if config.get('brevo_api_key') else ''
    return config

@api_router.post("/admin/email-config")
async def save_email_config(config: EmailConfig, current_user: User = Depends(get_current_admin)):
    await db.email_config.delete_many({})  # Only one config
    await db.email_config.insert_one(config.model_dump())
    return {"message": "Email configuration saved successfully"}

# ==================== BULK IMPORT ====================

def send_brevo_email(to_email: str, to_name: str, subject: str, html_content: str, api_key: str, sender_email: str, sender_name: str):
    """Send email using Brevo API"""
    try:
        import sib_api_v3_sdk
        from sib_api_v3_sdk.rest import ApiException
        
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = api_key
        
        api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
        
        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": to_email, "name": to_name}],
            sender={"email": sender_email, "name": sender_name},
            subject=subject,
            html_content=html_content
        )
        
        api_response = api_instance.send_transac_email(send_smtp_email)
        logger.info(f"Email sent successfully to {to_email}")
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
        # Get email configuration
        email_config = await db.email_config.find_one({})
        if not email_config:
            logger.error("Email configuration not found")
            raise HTTPException(status_code=400, detail="Email configuration not set. Please configure email settings first.")
        
        logger.info(f"Email config found for: {email_config.get('sender_email')}")
        
        # Decode CSV
        csv_content = base64.b64decode(request.csv_content).decode('utf-8')
        csv_file = io.StringIO(csv_content)
        csv_reader = csv.DictReader(csv_file)
        
        logger.info(f"CSV decoded successfully, course_id: {request.course_id}")
        
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
                    # Just enroll in course
                    user_id = existing_user['id']
                else:
                    # Create token for password creation
                    token = secrets.token_urlsafe(32)
                    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
                    
                    token_data = {
                        "token": token,
                        "email": email,
                        "name": name,
                        "course_id": request.course_id,
                        "expires_at": expires_at.isoformat(),
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.password_tokens.insert_one(token_data)
                    
                    # Send email with password creation link
                    password_link = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/create-password?token={token}"
                    
                    html_content = f"""
                    <html>
                        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                                <h2 style="color: #10b981;">Bem-vindo à Hiperautomação!</h2>
                                <p>Olá <strong>{name}</strong>,</p>
                                <p>Você foi matriculado em um curso na plataforma Hiperautomação.</p>
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
                    
                    # Send email in a thread pool to avoid blocking
                    loop = asyncio.get_event_loop()
                    try:
                        email_sent = await loop.run_in_executor(
                            executor,
                            send_brevo_email,
                            email,
                            name,
                            "Bem-vindo à Hiperautomação - Crie sua senha",
                            html_content,
                            email_config['brevo_api_key'],
                            email_config['sender_email'],
                            email_config['sender_name']
                        )
                        if email_sent:
                            logger.info(f"Successfully sent invitation email to {email}")
                        else:
                            logger.warning(f"Failed to send email to {email}, but continuing import")
                            errors.append(f"Failed to send email to {email}")
                    except Exception as email_error:
                        logger.error(f"Error sending email to {email}: {email_error}")
                        errors.append(f"Email error for {email}: {str(email_error)}")
                    
                    imported_count += 1
                    continue
                
                # Enroll user in course
                existing_enrollment = await db.enrollments.find_one({
                    "user_id": user_id,
                    "course_id": request.course_id
                })
                
                if not existing_enrollment:
                    enrollment = {
                        "id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "course_id": request.course_id,
                        "enrolled_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.enrollments.insert_one(enrollment)
                
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
        role="student"
    )
    
    user_dict = user.model_dump()
    user_dict['password_hash'] = get_password_hash(password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Enroll in course
    enrollment = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "course_id": token_data['course_id'],
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


# ==================== CREDITS SYSTEM ====================

# Helper function to get or create user credits
async def get_user_credits(user_id: str) -> dict:
    """Get user credits balance or create if not exists"""
    credits = await db.user_credits.find_one({"user_id": user_id}, {"_id": 0})
    if not credits:
        credits = {
            "user_id": user_id,
            "balance": 0,
            "total_earned": 0,
            "total_spent": 0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_credits.insert_one(credits.copy())
    return credits

# Helper function to add credits transaction
async def add_credit_transaction(user_id: str, amount: int, transaction_type: str, description: str, reference_id: Optional[str] = None):
    """Add a credit transaction and update user balance"""
    # Get current balance
    credits = await get_user_credits(user_id)
    
    # Create transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "amount": amount,
        "transaction_type": transaction_type,
        "description": description,
        "reference_id": reference_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.credit_transactions.insert_one(transaction.copy())
    
    # Update user balance
    new_balance = credits["balance"] + amount
    update_data = {
        "balance": new_balance,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if amount > 0:
        update_data["total_earned"] = credits.get("total_earned", 0) + amount
    else:
        update_data["total_spent"] = credits.get("total_spent", 0) + abs(amount)
    
    await db.user_credits.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )
    
    return transaction

# Get user credits balance
@api_router.get("/credits/balance")
async def get_credits_balance(current_user: User = Depends(get_current_user)):
    """Get current user's credit balance"""
    credits = await get_user_credits(current_user.id)
    return credits

# Get user credits transaction history
@api_router.get("/credits/transactions")
async def get_credits_transactions(current_user: User = Depends(get_current_user)):
    """Get current user's credit transaction history"""
    transactions = await db.credit_transactions.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    return {"transactions": transactions}

# Get available credit packages
@api_router.get("/credits/packages")
async def get_credit_packages():
    """Get available credit packages for purchase"""
    return {"packages": CREDIT_PACKAGES}

# Enroll in course using credits
@api_router.post("/courses/{course_id}/enroll-with-credits")
async def enroll_with_credits(course_id: str, current_user: User = Depends(get_current_user)):
    """Enroll in a course using credits"""
    # Get course
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if already enrolled
    existing_enrollment = await db.enrollments.find_one({
        "user_id": current_user.id,
        "course_id": course_id
    })
    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")
    
    # Get user credits
    credits = await get_user_credits(current_user.id)
    course_price = course.get("price_credits", 50)
    
    # Check if user has enough credits
    if credits["balance"] < course_price:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient credits. You have {credits['balance']} credits but need {course_price}"
        )
    
    # Deduct credits
    await add_credit_transaction(
        user_id=current_user.id,
        amount=-course_price,
        transaction_type="spent",
        description=f"Matricula no curso: {course['title']}",
        reference_id=course_id
    )
    
    # Create enrollment
    enrollment = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "course_id": course_id,
        "enrolled_at": datetime.now(timezone.utc).isoformat()
    }
    await db.enrollments.insert_one(enrollment)
    
    logger.info(f"User {current_user.email} enrolled in course {course_id} using {course_price} credits")
    
    return {
        "message": "Successfully enrolled in course",
        "credits_spent": course_price,
        "remaining_balance": credits["balance"] - course_price
    }

# ==================== ABACATE PAY INTEGRATION ====================

# Create billing for credit purchase or direct course purchase
@api_router.post("/billing/create")
async def create_billing(request: CreateBillingRequest, current_user: User = Depends(get_current_user)):
    """Create a billing for credit package or direct course purchase"""
    try:
        # Determine what we're selling
        if request.package_id:
            # Buying credits
            package = next((p for p in CREDIT_PACKAGES if p["id"] == request.package_id), None)
            if not package:
                raise HTTPException(status_code=404, detail="Package not found")
            
            amount_brl = package["price_brl"]
            credits = package["credits"]
            product_name = package["name"]
            product_description = f"{package['credits']} créditos"
            
        elif request.course_id:
            # Buying course directly
            course = await db.courses.find_one({"id": request.course_id}, {"_id": 0})
            if not course:
                raise HTTPException(status_code=404, detail="Course not found")
            
            amount_brl = course.get("price_brl", 0)
            if amount_brl <= 0:
                raise HTTPException(status_code=400, detail="Course price not set")
            
            credits = None
            product_name = course["title"]
            product_description = f"Acesso ao curso: {course['title']}"
        else:
            raise HTTPException(status_code=400, detail="Must specify package_id or course_id")
        
        # Create billing with Abacate Pay
        async with httpx.AsyncClient() as client:
            billing_data = {
                "frequency": "ONE_TIME",
                "methods": ["PIX"],  # Only PIX for sandbox testing
                "products": [{
                    "externalId": request.package_id or request.course_id,
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
                "returnUrl": f"{os.environ.get('FRONTEND_URL')}/payment-cancelled",
                "completionUrl": f"{os.environ.get('FRONTEND_URL')}/payment-success"
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
                "credits": credits,
                "course_id": request.course_id,
                "package_id": request.package_id,
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
            
            # Process based on purchase type
            if billing.get("credits"):
                # Credit package purchase - add credits to user
                await add_credit_transaction(
                    user_id=user_id,
                    amount=billing["credits"],
                    transaction_type="purchased",
                    description=f"Compra de {billing['credits']} créditos",
                    reference_id=billing_id
                )
                logger.info(f"Added {billing['credits']} credits to user {user_id}")
                
                # Mark user as having made a purchase
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"has_purchased": True}}
                )
                
                # Give referral bonus to referrer (50% of purchased credits)
                # ONLY if the referrer has also made a purchase
                user = await db.users.find_one({"id": user_id})
                if user and user.get("referred_by"):
                    referrer = await db.users.find_one({"id": user["referred_by"]})
                    if referrer and referrer.get("has_purchased", False):
                        referral_bonus = int(billing["credits"] * (REFERRAL_PURCHASE_PERCENTAGE / 100))
                        await add_credit_transaction(
                            user_id=user["referred_by"],
                            amount=referral_bonus,
                            transaction_type="earned",
                            description=f"Bônus de indicação: {user['name']} comprou {billing['credits']} créditos",
                            reference_id=billing_id
                        )
                        logger.info(f"Awarded {referral_bonus} referral bonus credits to {user['referred_by']}")
                    else:
                        logger.info(f"Referrer {user.get('referred_by')} has not purchased yet, no bonus awarded")
                
            elif billing.get("course_id"):
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
                if billing.get("credits"):
                    # Credit package purchase - add credits to user
                    await add_credit_transaction(
                        user_id=user_id,
                        amount=billing["credits"],
                        transaction_type="purchased",
                        description=f"Compra de {billing['credits']} créditos",
                        reference_id=billing_id
                    )
                    logger.info(f"Added {billing['credits']} credits to user {user_id} via status check")
                    
                    # Mark user as having made a purchase
                    await db.users.update_one(
                        {"id": user_id},
                        {"$set": {"has_purchased": True}}
                    )
                    
                    # Give referral bonus - ONLY if referrer has purchased
                    user = await db.users.find_one({"id": user_id})
                    if user and user.get("referred_by"):
                        referrer = await db.users.find_one({"id": user["referred_by"]})
                        if referrer and referrer.get("has_purchased", False):
                            referral_bonus = int(billing["credits"] * (REFERRAL_PURCHASE_PERCENTAGE / 100))
                            await add_credit_transaction(
                                user_id=user["referred_by"],
                                amount=referral_bonus,
                                transaction_type="earned",
                                description=f"Bônus de indicação: {user['name']} comprou {billing['credits']} créditos",
                                reference_id=billing_id
                            )
                            logger.info(f"Awarded {referral_bonus} referral bonus credits to {user['referred_by']}")
                    
                elif billing.get("course_id"):
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
                
                return {"status": "paid", "message": "Payment confirmed! Credits added."}
            
            return {"status": "pending", "message": "Payment still pending"}
            
    except Exception as e:
        logger.error(f"Error checking billing status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")


# ==================== ADMIN CREDITS & PAYMENTS MANAGEMENT ====================

# Admin: Get all transactions
@api_router.get("/admin/credits/transactions")
async def admin_get_all_transactions(current_user: User = Depends(get_current_admin)):
    """Get all credit transactions (admin only)"""
    transactions = await db.credit_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    
    # Enrich with user info
    for transaction in transactions:
        user = await db.users.find_one({"id": transaction["user_id"]}, {"_id": 0, "name": 1, "email": 1})
        if user:
            transaction["user_name"] = user["name"]
            transaction["user_email"] = user["email"]
    
    return {"transactions": transactions}

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

# Admin: Add credits manually to a user
@api_router.post("/admin/credits/add-manual")
async def admin_add_credits_manually(
    user_id: str,
    amount: int,
    description: str,
    current_user: User = Depends(get_current_admin)
):
    """Manually add credits to a user (admin only)"""
    # Verify user exists
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add credits
    await add_credit_transaction(
        user_id=user_id,
        amount=amount,
        transaction_type="earned",
        description=f"[Admin] {description}",
        reference_id=None
    )
    
    logger.info(f"Admin {current_user.email} added {amount} credits to user {user_id}")
    
    return {"message": f"Successfully added {amount} credits", "user_id": user_id}

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
    current_user: User = Depends(get_current_admin)
):
    """Update payment gateway settings (admin only)"""
    if environment not in ["sandbox", "production"]:
        raise HTTPException(status_code=400, detail="Environment must be 'sandbox' or 'production'")
    
    settings = {
        "abacatepay_api_key": abacatepay_api_key,
        "environment": environment,
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
    
    # Total credits distributed
    all_credits = await db.user_credits.find({}, {"_id": 0}).to_list(length=None)
    total_credits_distributed = sum(c.get("balance", 0) for c in all_credits)
    total_credits_earned = sum(c.get("total_earned", 0) for c in all_credits)
    total_credits_spent = sum(c.get("total_spent", 0) for c in all_credits)
    
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
        "credits": {
            "total_distributed": total_credits_distributed,
            "total_earned": total_credits_earned,
            "total_spent": total_credits_spent
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
    """Manually mark a billing as paid and process credits/enrollment (admin only)"""
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
        
        # Process based on purchase type
        if billing.get("credits"):
            # Credit package purchase - add credits to user
            await add_credit_transaction(
                user_id=user_id,
                amount=billing["credits"],
                transaction_type="purchased",
                description=f"Compra de {billing['credits']} créditos (confirmado manualmente)",
                reference_id=billing_id
            )
            logger.info(f"Admin {current_user.email} manually confirmed billing {billing_id} - added {billing['credits']} credits to user {user_id}")
            
            # Mark user as having made a purchase
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"has_purchased": True}}
            )
            
            # Give referral bonus - ONLY if referrer has purchased
            user = await db.users.find_one({"id": user_id})
            if user and user.get("referred_by"):
                referrer = await db.users.find_one({"id": user["referred_by"]})
                if referrer and referrer.get("has_purchased", False):
                    referral_bonus = int(billing["credits"] * (REFERRAL_PURCHASE_PERCENTAGE / 100))
                    await add_credit_transaction(
                        user_id=user["referred_by"],
                        amount=referral_bonus,
                        transaction_type="earned",
                        description=f"Bônus de indicação: {user['name']} comprou {billing['credits']} créditos",
                        reference_id=billing_id
                    )
                    logger.info(f"Awarded {referral_bonus} referral bonus credits to {user['referred_by']}")
            
        elif billing.get("course_id"):
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
            "credits_added": billing.get("credits"),
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

# Update payment gateway configuration
@api_router.post("/admin/gateway-config")
async def update_gateway_config(
    active_gateway: str,
    hotmart_token: Optional[str] = None,
    current_user: User = Depends(get_current_admin)
):
    """Update payment gateway configuration (admin only)"""
    if active_gateway not in ["abacatepay", "hotmart"]:
        raise HTTPException(status_code=400, detail="Invalid gateway. Must be 'abacatepay' or 'hotmart'")
    
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

# Hotmart Webhook Endpoint
@api_router.post("/hotmart/webhook")
async def hotmart_webhook(webhook_data: dict):
    """
    Process Hotmart webhook for purchase notifications
    Expected webhook format from Hotmart
    """
    try:
        logger.info(f"🔔 Received Hotmart webhook: {webhook_data}")
        
        # Extract data from webhook
        callback_type = webhook_data.get("callback_type", "")
        status = webhook_data.get("status", "")
        transaction = webhook_data.get("transaction", "")
        prod_id = webhook_data.get("prod", "")
        email = webhook_data.get("email", "")
        name = webhook_data.get("name", "")
        
        # Validate hottok if configured
        hottok = webhook_data.get("hottok", "")
        gateway_config = await db.gateway_config.find_one({})
        if gateway_config and gateway_config.get("hotmart_token"):
            if hottok != gateway_config.get("hotmart_token"):
                logger.warning(f"❌ Invalid Hotmart token received")
                raise HTTPException(status_code=403, detail="Invalid hotmart token")
        
        # Store webhook data
        webhook_record = {
            "id": str(uuid.uuid4()),
            "callback_type": callback_type,
            "transaction": transaction,
            "prod": prod_id,
            "prod_name": webhook_data.get("prod_name", ""),
            "status": status,
            "email": email,
            "name": name,
            "purchase_date": webhook_data.get("purchase_date", ""),
            "price": webhook_data.get("price", ""),
            "currency": webhook_data.get("currency", ""),
            "raw_data": webhook_data,
            "processed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.hotmart_webhooks.insert_one(webhook_record)
        
        # Only process approved purchases (status=approved, callback_type=1)
        if status != "approved" or callback_type != "1":
            logger.info(f"⏭️  Skipping webhook - status: {status}, callback_type: {callback_type}")
            return {"message": "Webhook received but not processed (not approved purchase)"}
        
        # Find course or credit package by Hotmart product ID
        course = await db.courses.find_one({"hotmart_product_id": prod_id})
        credit_package = None
        
        # Check if it's a credit package
        if not course:
            for pkg in CREDIT_PACKAGES:
                if pkg.get("hotmart_product_id") == prod_id:
                    credit_package = pkg
                    break
        
        if not course and not credit_package:
            logger.warning(f"⚠️  No course or credit package found for Hotmart product ID: {prod_id}")
            return {"message": "Product not found in system"}
        
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
            referral_code = await generate_referral_code()
            
            new_user = {
                "id": user_id,
                "email": email,
                "name": name,
                "password": None,  # Will be set when user creates password
                "role": "student",
                "avatar": None,
                "full_access": False,
                "enrolled_courses": [],
                "has_purchased": True,  # Mark as purchased
                "referral_code": referral_code,
                "referred_by": None,
                "password_creation_token": password_token,
                "password_token_expires": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.users.insert_one(new_user)
            user = new_user
            
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
        
        user_id = user["id"]
        
        # Process based on type (course or credit package)
        if course:
            # Grant access to course
            logger.info(f"🎓 Granting course access: {course['title']} to {email}")
            
            await db.users.update_one(
                {"id": user_id},
                {"$addToSet": {"enrolled_courses": course["id"]}}
            )
            
            # Add credit transaction record
            transaction_record = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "amount": 0,  # No credits, direct course access
                "transaction_type": "course_purchase",
                "description": f"Curso comprado via Hotmart: {course['title']}",
                "reference_id": course["id"],
                "hotmart_transaction": transaction,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.credit_transactions.insert_one(transaction_record)
            
            logger.info(f"✅ Course access granted for transaction {transaction}")
            
        elif credit_package:
            # Add credits to user
            credits_to_add = credit_package["credits"]
            logger.info(f"💰 Adding {credits_to_add} credits to {email}")
            
            await add_credit_transaction(
                user_id=user_id,
                amount=credits_to_add,
                transaction_type="purchased",
                description=f"Créditos comprados via Hotmart: {credit_package['name']}",
                reference_id=transaction
            )
            
            logger.info(f"✅ Credits added for transaction {transaction}")
        
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
        
        return {"message": "Webhook processed successfully"}
        
    except Exception as e:
        logger.error(f"❌ Error processing Hotmart webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing webhook: {str(e)}")

# Helper function to send password creation email
def send_password_creation_email(email: str, name: str, password_link: str):
    """Send password creation email to new user from Hotmart"""
    try:
        import sib_api_v3_sdk
        from sib_api_v3_sdk.rest import ApiException
        
        # Get Brevo configuration
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        async def get_config():
            return await db.email_config.find_one({})
        
        config = loop.run_until_complete(get_config())
        loop.close()
        
        if not config:
            logger.warning("No email configuration found, skipping welcome email")
            return
        
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = config.get('api_key')
        
        api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
        
        sender = {
            "name": config.get('sender_name', 'Hiperautomação'),
            "email": config.get('sender_email')
        }
        
        to = [{"email": email, "name": name}]
        
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
        
        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=to,
            sender=sender,
            subject="Bem-vindo! Crie sua senha - Hiperautomação",
            html_content=html_content
        )
        
        api_instance.send_transac_email(send_smtp_email)
        logger.info(f"Welcome email sent successfully to {email}")
        
    except Exception as e:
        logger.error(f"Failed to send welcome email to {email}: {e}")

# Get credit packages with Hotmart IDs
@api_router.get("/admin/credit-packages-config")
async def get_credit_packages_config(current_user: User = Depends(get_current_admin)):
    """Get credit packages configuration including Hotmart product IDs"""
    config = await db.credit_packages_config.find_one({}, {"_id": 0})
    
    if not config:
        # Return default packages
        return {"packages": CREDIT_PACKAGES}
    
    return config

# Update credit packages Hotmart IDs
@api_router.post("/admin/credit-packages-config")
async def update_credit_packages_config(
    packages: List[dict],
    current_user: User = Depends(get_current_admin)
):
    """Update credit packages Hotmart product IDs"""
    config = {
        "packages": packages,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.email
    }
    
    await db.credit_packages_config.update_one(
        {},
        {"$set": config},
        upsert=True
    )
    
    # Update global CREDIT_PACKAGES variable
    global CREDIT_PACKAGES
    CREDIT_PACKAGES = packages
    
    logger.info(f"Admin {current_user.email} updated credit packages configuration")
    
    return {"message": "Credit packages configuration updated successfully"}


# ==================== REFERRAL SYSTEM ====================

# Get user's referral info
@api_router.get("/referral/info")
async def get_referral_info(current_user: User = Depends(get_current_user)):
    """Get user's referral code and statistics"""
    # Get referral statistics
    referrals = await db.users.find({"referred_by": current_user.id}, {"_id": 0, "id": 1, "name": 1, "email": 1, "created_at": 1}).to_list(1000)
    
    # Count total credits earned from referrals
    referral_transactions = await db.credit_transactions.find({
        "user_id": current_user.id,
        "transaction_type": "earned",
        "description": {"$regex": "Bônus de indicação"}
    }, {"_id": 0}).to_list(1000)
    
    total_referral_credits = sum(t.get("amount", 0) for t in referral_transactions)
    
    # Get referral link
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    referral_link = f"{frontend_url}/register?ref={current_user.referral_code}"
    
    return {
        "referral_code": current_user.referral_code,
        "referral_link": referral_link,
        "total_referrals": len(referrals),
        "total_credits_earned": total_referral_credits,
        "referrals": referrals,
        "signup_bonus": REFERRAL_SIGNUP_BONUS,
        "purchase_percentage": REFERRAL_PURCHASE_PERCENTAGE
    }

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
    """Give credits reward for gamification action (only if user has purchased)"""
    logger.info(f"🎮 Gamification check for user {user_id}, action: {action_type}")
    
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        logger.warning(f"❌ User {user_id} not found for gamification reward")
        return False
    
    # Only give rewards to users who have made a purchase
    if not user.get("has_purchased", False):
        logger.info(f"❌ User {user.get('email')} has not purchased yet, no gamification reward for {action_type}")
        return False
    
    reward_amount = await get_reward_amount(action_type)
    logger.info(f"💰 Reward amount for {action_type}: {reward_amount} credits")
    
    if reward_amount > 0:
        await add_credit_transaction(
            user_id=user_id,
            amount=reward_amount,
            transaction_type="earned",
            description=description,
            reference_id=None
        )
        logger.info(f"✅ Awarded {reward_amount} credits to user {user.get('email')} for {action_type}")
        return True
    
    logger.info(f"⚠️ No reward given - amount is 0 for {action_type}")
    return False

# Get detailed referral transactions
@api_router.get("/referral/transactions")
async def get_referral_transactions(current_user: User = Depends(get_current_user)):
    """Get all transactions related to referrals"""
    transactions = await db.credit_transactions.find({
        "user_id": current_user.id,
        "transaction_type": "earned",
        "description": {"$regex": "Bônus de indicação"}
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"transactions": transactions}

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
    price_credits: Optional[int] = None,
    current_user: User = Depends(get_current_admin)
):
    """Update course pricing (admin only)"""
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    update_data = {}
    if price_brl is not None:
        update_data["price_brl"] = price_brl
    if price_credits is not None:
        update_data["price_credits"] = price_credits
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No pricing data provided")
    
    await db.courses.update_one(
        {"id": course_id},
        {"$set": update_data}
    )
    
    logger.info(f"Admin {current_user.email} updated pricing for course {course_id}")
    
    return {"message": "Course pricing updated successfully", "updates": update_data}

# Include the router in the main app

@app.on_event("startup")
async def startup_event():
    """Run migrations on startup"""
    await migrate_referral_codes()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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
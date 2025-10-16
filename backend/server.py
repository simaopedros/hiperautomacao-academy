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
    
    # Create user - default full_access to False for new registrations
    user_data_dict = user_data.model_dump(exclude={"password"})
    if "full_access" not in user_data_dict:
        user_data_dict["full_access"] = False
    
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
async def update_course(course_id: str, course_data: CourseCreate, current_user: User = Depends(get_current_admin)):
    existing = await db.courses.find_one({"id": course_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Course not found")
    
    update_data = course_data.model_dump()
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

@api_router.get("/student/courses", response_model=List[Course])
async def get_published_courses(current_user: User = Depends(get_current_user)):
    # If user has full_access, return all published courses
    if current_user.full_access:
        courses = await db.courses.find({"published": True}, {"_id": 0}).to_list(1000)
    else:
        # Get user's enrolled courses
        enrollments = await db.enrollments.find({"user_id": current_user.id}).to_list(1000)
        enrolled_course_ids = [e["course_id"] for e in enrollments]
        
        if not enrolled_course_ids:
            return []
        
        # Return only enrolled courses that are published
        courses = await db.courses.find({
            "published": True,
            "id": {"$in": enrolled_course_ids}
        }, {"_id": 0}).to_list(1000)
    
    for course in courses:
        if isinstance(course['created_at'], str):
            course['created_at'] = datetime.fromisoformat(course['created_at'])
    return courses

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
    
    return comment

@api_router.get("/comments/{lesson_id}", response_model=List[Comment])
async def get_lesson_comments(lesson_id: str, current_user: User = Depends(get_current_user)):
    comments = await db.comments.find({"lesson_id": lesson_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for comment in comments:
        if isinstance(comment['created_at'], str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
    return comments

@api_router.post("/comments/{comment_id}/like")
async def like_comment(comment_id: str, current_user: User = Depends(get_current_user)):
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    await db.comments.update_one({"id": comment_id}, {"$inc": {"likes": 1}})
    return {"message": "Comment liked"}

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

# Include the router in the main app
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
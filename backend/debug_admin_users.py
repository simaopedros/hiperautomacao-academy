import asyncio
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone

# Load environment variables
ROOT_DIR = Path(__file__).parent
default_env_file = ROOT_DIR / '.env'
if default_env_file.exists():
    load_dotenv(default_env_file, override=False)

app_env = os.getenv('APP_ENV', 'development')
env_specific_file = ROOT_DIR / f'.env.{app_env}'
if env_specific_file.exists():
    load_dotenv(env_specific_file, override=True)

async def debug_admin_users():
    """Debug the admin users endpoint by testing database queries directly"""
    
    # Connect to database
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("=== DEBUGGING ADMIN USERS ENDPOINT ===")
    
    try:
        # Test 1: Get users from database
        print("\n1. Testing users query...")
        users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
        print(f"Found {len(users)} users")
        
        if users:
            print("First user sample:")
            first_user = users[0]
            print(f"  ID: {first_user.get('id')}")
            print(f"  Email: {first_user.get('email')}")
            print(f"  Name: {first_user.get('name')}")
            print(f"  Created at: {first_user.get('created_at')} (type: {type(first_user.get('created_at'))})")
        
        # Test 2: Get courses
        print("\n2. Testing courses query...")
        existing_courses = await db.courses.find({}, {"_id": 0, "id": 1}).to_list(1000)
        print(f"Found {len(existing_courses)} courses")
        valid_course_ids = {course['id'] for course in existing_courses}
        print(f"Valid course IDs: {list(valid_course_ids)[:5]}...")  # Show first 5
        
        # Test 3: Process users with date conversion
        print("\n3. Testing date conversion...")
        for i, user in enumerate(users[:3]):  # Test first 3 users
            print(f"User {i+1}:")
            created_at = user.get('created_at')
            print(f"  Original created_at: {created_at} (type: {type(created_at)})")
            
            try:
                if isinstance(created_at, str):
                    converted = datetime.fromisoformat(created_at)
                    print(f"  Converted: {converted}")
                else:
                    print(f"  Already datetime: {created_at}")
            except Exception as e:
                print(f"  ERROR converting date: {e}")
        
        # Test 4: Get enrollments
        print("\n4. Testing enrollments query...")
        enrollments = await db.enrollments.find({}).to_list(100)
        print(f"Found {len(enrollments)} enrollments")
        
        if enrollments:
            print("Sample enrollment:")
            sample = enrollments[0]
            print(f"  User ID: {sample.get('user_id')}")
            print(f"  Course ID: {sample.get('course_id')}")
        
        # Test 5: Get password tokens
        print("\n5. Testing password tokens query...")
        pending_invites = await db.password_tokens.find({}, {"_id": 0}).to_list(1000)
        print(f"Found {len(pending_invites)} pending invites")
        
        if pending_invites:
            print("Sample invite:")
            sample = pending_invites[0]
            print(f"  Email: {sample.get('email')}")
            print(f"  Token: {sample.get('token')}")
            print(f"  Created at: {sample.get('created_at')} (type: {type(sample.get('created_at'))})")
        
        print("\n=== DATABASE QUERIES COMPLETED SUCCESSFULLY ===")
        
    except Exception as e:
        print(f"ERROR in database operations: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()
    
    # Test 6: Try the actual API endpoint
    print("\n6. Testing API endpoint...")
    try:
        # First login to get token
        async with httpx.AsyncClient() as client:
            login_response = await client.post(
                "http://localhost:8000/api/auth/login",
                json={"email": "simao@example.com", "password": "admin123"}
            )
            
            if login_response.status_code == 200:
                token = login_response.json()["access_token"]
                print("Login successful, testing /admin/users endpoint...")
                
                # Test admin/users endpoint
                headers = {"Authorization": f"Bearer {token}"}
                users_response = await client.get(
                    "http://localhost:8000/api/admin/users",
                    headers=headers
                )
                
                print(f"Status: {users_response.status_code}")
                if users_response.status_code != 200:
                    print(f"Error response: {users_response.text}")
                else:
                    users_data = users_response.json()
                    print(f"Success! Got {len(users_data)} users from API")
            else:
                print(f"Login failed: {login_response.status_code} - {login_response.text}")
                
    except Exception as e:
        print(f"ERROR in API test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_admin_users())
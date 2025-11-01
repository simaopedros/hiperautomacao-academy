import asyncio
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from passlib.context import CryptContext

# Load environment variables
ROOT_DIR = Path(__file__).parent
default_env_file = ROOT_DIR / '.env'
if default_env_file.exists():
    load_dotenv(default_env_file, override=False)

app_env = os.getenv('APP_ENV', 'development')
env_specific_file = ROOT_DIR / f'.env.{app_env}'
if env_specific_file.exists():
    load_dotenv(env_specific_file, override=True)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def fix_admin_and_test():
    """Fix admin password and test the endpoint"""
    
    # Connect to database
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("=== FIXING ADMIN PASSWORD AND TESTING ===")
    
    try:
        # Find admin user
        admin_user = await db.users.find_one({"role": "admin"})
        
        if not admin_user:
            print("No admin user found!")
            return
        
        print(f"Found admin user: {admin_user['email']} - {admin_user['name']}")
        
        # Hash new password
        new_password = "admin123"
        hashed_password = pwd_context.hash(new_password)
        
        # Update password in database
        result = await db.users.update_one(
            {"id": admin_user["id"]},
            {"$set": {"password_hash": hashed_password}}
        )
        
        if result.modified_count > 0:
            print(f"✅ Password updated successfully for {admin_user['email']}")
        else:
            print("❌ Failed to update password")
            return
        
        print(f"New password: {new_password}")
        
    except Exception as e:
        print(f"ERROR updating password: {e}")
        import traceback
        traceback.print_exc()
        return
    
    finally:
        client.close()
    
    # Test the API endpoint
    print("\n=== TESTING API ENDPOINT ===")
    try:
        async with httpx.AsyncClient() as client:
            # Login
            login_response = await client.post(
                "http://localhost:8000/api/auth/login",
                json={"email": admin_user["email"], "password": new_password}
            )
            
            print(f"Login status: {login_response.status_code}")
            
            if login_response.status_code == 200:
                token_data = login_response.json()
                token = token_data["access_token"]
                print("✅ Login successful!")
                print(f"User: {token_data['user']['name']} ({token_data['user']['role']})")
                
                # Test /auth/me endpoint
                headers = {"Authorization": f"Bearer {token}"}
                me_response = await client.get(
                    "http://localhost:8000/api/auth/me",
                    headers=headers
                )
                print(f"/auth/me status: {me_response.status_code}")
                
                # Test /admin/users endpoint
                users_response = await client.get(
                    "http://localhost:8000/api/admin/users",
                    headers=headers
                )
                
                print(f"/admin/users status: {users_response.status_code}")
                
                if users_response.status_code == 200:
                    users_data = users_response.json()
                    print(f"✅ SUCCESS! Got {len(users_data)} users from API")
                    
                    # Show sample users
                    for i, user in enumerate(users_data[:3]):
                        print(f"  User {i+1}: {user.get('name')} ({user.get('email')}) - {user.get('role')}")
                        if user.get('invited'):
                            print(f"    -> Pending invitation")
                        else:
                            print(f"    -> Active user, enrolled in {len(user.get('enrolled_courses', []))} courses")
                
                else:
                    print(f"❌ /admin/users failed: {users_response.text}")
                    
            else:
                print(f"❌ Login failed: {login_response.text}")
                
    except Exception as e:
        print(f"ERROR in API test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(fix_admin_and_test())
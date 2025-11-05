import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from jose import jwt
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext

# Load environment variables
load_dotenv()

# Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_password_hash(password):
    return pwd_context.hash(password)

async def create_admin_token_and_reset_password():
    """Create admin token and optionally reset admin password"""
    
    try:
        mongo_url = os.environ.get('MONGO_URL')
        db_name = os.environ.get('DB_NAME')
        
        if not mongo_url or not db_name:
            print("❌ MongoDB connection info not found in environment")
            return
            
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # Get the first admin user
        admin_user = await db.users.find_one({"role": "admin"})
        
        if not admin_user:
            print("❌ No admin user found")
            return
            
        print(f"Found admin user: {admin_user.get('name')} ({admin_user.get('email')})")
        
        # Create a token for this admin
        token_data = {"sub": admin_user["id"]}
        access_token = create_access_token(data=token_data)
        
        print(f"\n✅ Generated admin token:")
        print(f"Token: {access_token}")
        
        # Optionally reset password to a known value
        new_password = "admin123"
        password_hash = get_password_hash(new_password)
        
        await db.users.update_one(
            {"id": admin_user["id"]},
            {"$set": {"password_hash": password_hash}}
        )
        
        print(f"\n✅ Password reset to: {new_password}")
        print(f"You can now login with:")
        print(f"Email: {admin_user.get('email')}")
        print(f"Password: {new_password}")
        
        client.close()
        
        return access_token, admin_user.get('email'), new_password
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None, None, None

async def test_token_with_api(token):
    """Test the generated token with the API"""
    import requests
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get("http://localhost:8000/api/admin/users", headers=headers)
        
        print(f"\n🧪 Testing token with /api/admin/users:")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            users_data = response.json()
            print(f"✅ Success! Fetched {len(users_data)} users")
            if users_data:
                print(f"First user: {users_data[0].get('name')} ({users_data[0].get('email')})")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ API test error: {e}")

if __name__ == "__main__":
    async def main():
        token, email, password = await create_admin_token_and_reset_password()
        if token:
            await test_token_with_api(token)
    
    asyncio.run(main())
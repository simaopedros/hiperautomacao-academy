#!/usr/bin/env python3

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def check_admin_user():
    # Connect to MongoDB
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "hyperlearn")
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("🔍 Checking admin user...")
    
    # Find admin user
    admin_user = await db.users.find_one({"email": "admin@exemplo.com"})
    
    if admin_user:
        print(f"✅ Admin user found:")
        print(f"   Email: {admin_user.get('email')}")
        print(f"   Name: {admin_user.get('name')}")
        print(f"   Role: {admin_user.get('role')}")
        print(f"   Is Admin: {admin_user.get('is_admin')}")
        print(f"   Has Full Access: {admin_user.get('has_full_access')}")
        print(f"   ID: {admin_user.get('id')}")
    else:
        print("❌ Admin user not found")
        
        # Check if there are any admin users
        admin_users = await db.users.find({"is_admin": True}).to_list(10)
        if admin_users:
            print(f"📋 Found {len(admin_users)} admin users:")
            for user in admin_users:
                print(f"   - {user.get('email')} (role: {user.get('role')})")
        else:
            print("📋 No admin users found in database")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_admin_user())
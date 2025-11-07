#!/usr/bin/env python3
"""
Fix admin user by updating role to admin in the database
"""

import pymongo
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv("backend/.env")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "hiperautomacao_db")
ADMIN_EMAIL = "admin@test.com"

def fix_admin_user():
    """Update admin user to have proper admin role and full access"""
    try:
        # Connect to MongoDB
        client = pymongo.MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Find the admin user
        user = db.users.find_one({"email": ADMIN_EMAIL})
        
        if not user:
            print(f"❌ User {ADMIN_EMAIL} not found")
            return
        
        print(f"Found user: {user['email']}")
        print(f"Current role: {user.get('role', 'N/A')}")
        print(f"Current has_full_access: {user.get('has_full_access', False)}")
        
        # Update user to be admin with full access
        update_result = db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {
                "role": "admin",
                "has_full_access": True
            }}
        )
        
        if update_result.modified_count > 0:
            print("✅ Successfully updated admin user:")
            print("  - Role: admin")
            print("  - Has Full Access: true")
        else:
            print("❌ Failed to update admin user")
        
        # Verify the update
        updated_user = db.users.find_one({"email": ADMIN_EMAIL})
        print(f"\nVerification:")
        print(f"- Role: {updated_user.get('role', 'N/A')}")
        print(f"- Has Full Access: {updated_user.get('has_full_access', False)}")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    fix_admin_user()
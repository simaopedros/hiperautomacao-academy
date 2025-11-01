import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
default_env_file = ROOT_DIR / '.env'
if default_env_file.exists():
    load_dotenv(default_env_file, override=False)

app_env = os.getenv('APP_ENV', 'development')
env_specific_file = ROOT_DIR / f'.env.{app_env}'
if env_specific_file.exists():
    load_dotenv(env_specific_file, override=True)

async def check_user_structure():
    """Check user structure in database"""
    
    # Connect to database
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("=== CHECKING USER STRUCTURE ===")
    
    try:
        # Get all users
        users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
        print(f"Found {len(users)} users")
        
        users_without_id = []
        users_with_id = []
        
        for i, user in enumerate(users):
            print(f"\nUser {i+1}: {user.get('name', 'Unknown')} ({user.get('email', 'No email')})")
            
            # Check if user has 'id' field
            if 'id' in user:
                print(f"  ✅ Has 'id': {user['id']}")
                users_with_id.append(user)
            else:
                print(f"  ❌ Missing 'id' field!")
                users_without_id.append(user)
                
                # Show all fields for users without id
                print(f"  Available fields: {list(user.keys())}")
                
                # Check if has _id (MongoDB ObjectId)
                if '_id' in user:
                    print(f"  Has '_id': {user['_id']}")
        
        print(f"\n=== SUMMARY ===")
        print(f"Users with 'id': {len(users_with_id)}")
        print(f"Users without 'id': {len(users_without_id)}")
        
        if users_without_id:
            print(f"\nUsers without 'id' field:")
            for user in users_without_id:
                print(f"  - {user.get('name', 'Unknown')} ({user.get('email', 'No email')})")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check_user_structure())
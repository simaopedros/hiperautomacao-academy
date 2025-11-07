import asyncio
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

async def test_endpoint_parts():
    """Test each part of the get_all_users endpoint separately"""
    
    # Connect to database
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("=== TESTING ENDPOINT PARTS SEPARATELY ===")
    
    try:
        # Part 1: Get users
        print("\n1. Getting users...")
        users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
        print(f"✅ Got {len(users)} users")
        
        # Part 2: Get existing courses
        print("\n2. Getting existing courses...")
        existing_courses = await db.courses.find({}, {"_id": 0, "id": 1}).to_list(1000)
        valid_course_ids = {course['id'] for course in existing_courses}
        print(f"✅ Got {len(existing_courses)} courses")
        
        # Part 3: Process each user
        print("\n3. Processing users...")
        processed_users = []
        
        for i, user in enumerate(users):
            try:
                print(f"  Processing user {i+1}: {user.get('name')}")
                
                # Date conversion
                if isinstance(user['created_at'], str):
                    user['created_at'] = datetime.fromisoformat(user['created_at'])
                    print(f"    ✅ Date converted")
                
                # Get enrollments
                enrollments = await db.enrollments.find({"user_id": user['id']}).to_list(1000)
                user['enrolled_courses'] = [
                    enrollment['course_id'] 
                    for enrollment in enrollments 
                    if enrollment['course_id'] in valid_course_ids
                ]
                print(f"    ✅ Found {len(user['enrolled_courses'])} enrolled courses")
                
                processed_users.append(user)
                
            except Exception as e:
                print(f"    ❌ Error processing user {user.get('name', 'Unknown')}: {e}")
                import traceback
                traceback.print_exc()
                break
        
        print(f"✅ Processed {len(processed_users)} users successfully")
        
        # Part 4: Get pending invitations
        print("\n4. Getting pending invitations...")
        pending_invites = await db.password_tokens.find({}, {"_id": 0}).to_list(1000)
        print(f"✅ Got {len(pending_invites)} pending invites")
        
        # Part 5: Process pending invitations
        print("\n5. Processing pending invitations...")
        processed_invites = []
        
        for i, invite in enumerate(pending_invites):
            try:
                print(f"  Processing invite {i+1}: {invite.get('email')}")
                
                created_at_raw = invite.get('created_at')
                created_at = datetime.fromisoformat(created_at_raw) if created_at_raw else datetime.now(timezone.utc)
                
                course_ids = invite.get('course_ids') or []
                if not course_ids and invite.get('course_id'):
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
                
                processed_invites.append(pending_user)
                print(f"    ✅ Processed invite for {invite['email']}")
                
            except Exception as e:
                print(f"    ❌ Error processing invite {invite.get('email', 'Unknown')}: {e}")
                import traceback
                traceback.print_exc()
                break
        
        print(f"✅ Processed {len(processed_invites)} invites successfully")
        
        # Part 6: Combine results
        print("\n6. Combining results...")
        all_users = processed_users + processed_invites
        print(f"✅ Total users: {len(all_users)}")
        
        # Show sample
        print("\nSample results:")
        for i, user in enumerate(all_users[:5]):
            status = "Invited" if user.get('invited') else "Active"
            courses = len(user.get('enrolled_courses', []))
            print(f"  {i+1}. {user.get('name')} ({user.get('email')}) - {status} - {courses} courses")
        
        print("\n✅ ALL PARTS COMPLETED SUCCESSFULLY!")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_endpoint_parts())
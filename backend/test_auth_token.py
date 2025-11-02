import requests
import json

def test_admin_authentication():
    """Test admin authentication and token generation"""
    
    base_url = "http://localhost:8000/api"
    
    # First, let's try to login with an admin user
    # We know from the database that "Simao Pedros" is an admin
    login_data = {
        "email": "simao@example.com",  # We'll need to find the correct email
        "password": "password123"  # We'll need to find the correct password
    }
    
    print("Testing admin authentication...")
    
    try:
        # Try to login
        login_response = requests.post(f"{base_url}/auth/login", json=login_data)
        print(f"Login Status Code: {login_response.status_code}")
        
        if login_response.status_code == 200:
            login_result = login_response.json()
            token = login_result.get('access_token')
            user = login_result.get('user')
            
            print(f"Login successful!")
            print(f"User: {user.get('name')} ({user.get('email')})")
            print(f"Role: {user.get('role')}")
            print(f"Token: {token[:50]}..." if token else "No token")
            
            # Now test the /admin/users endpoint with the token
            if token:
                headers = {"Authorization": f"Bearer {token}"}
                users_response = requests.get(f"{base_url}/admin/users", headers=headers)
                print(f"\n/admin/users Status Code: {users_response.status_code}")
                
                if users_response.status_code == 200:
                    users_data = users_response.json()
                    print(f"Successfully fetched {len(users_data)} users!")
                    if users_data:
                        print(f"First user: {users_data[0].get('name')} ({users_data[0].get('email')})")
                else:
                    print(f"Error accessing /admin/users: {users_response.text}")
        else:
            print(f"Login failed: {login_response.text}")
            
            # Let's try to find what admin users exist in the database
            print("\nLet's check what users exist in the database...")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - server may not be running")
    except Exception as e:
        print(f"❌ Error: {e}")

def check_database_users():
    """Check what users exist in the database"""
    import os
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio
    from dotenv import load_dotenv
    
    # Load environment variables
    load_dotenv()
    
    async def get_users():
        try:
            mongo_url = os.environ.get('MONGO_URL')
            db_name = os.environ.get('DB_NAME')
            
            if not mongo_url or not db_name:
                print("❌ MongoDB connection info not found in environment")
                return
                
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            
            # Get admin users
            admin_users = await db.users.find({"role": "admin"}, {"_id": 0, "name": 1, "email": 1, "role": 1}).to_list(10)
            
            print(f"\nFound {len(admin_users)} admin users:")
            for user in admin_users:
                print(f"  - {user.get('name')} ({user.get('email')})")
                
            client.close()
            
        except Exception as e:
            print(f"❌ Database error: {e}")
    
    asyncio.run(get_users())

if __name__ == "__main__":
    check_database_users()
    test_admin_authentication()
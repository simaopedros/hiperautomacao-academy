import requests
import json

def test_complete_flow():
    """Test complete authentication flow"""
    
    base_url = "http://localhost:8000/api"
    
    # Login credentials (from previous script)
    login_data = {
        "email": "simaopedros@gmail.com",
        "password": "admin123"
    }
    
    print("🔐 Testing login...")
    
    try:
        # Step 1: Login
        login_response = requests.post(f"{base_url}/auth/login", json=login_data)
        print(f"Login Status Code: {login_response.status_code}")
        
        if login_response.status_code == 200:
            login_result = login_response.json()
            token = login_result.get('access_token')
            user = login_result.get('user')
            
            print(f"✅ Login successful!")
            print(f"User: {user.get('name')} ({user.get('email')})")
            print(f"Role: {user.get('role')}")
            print(f"Has Full Access: {user.get('has_full_access')}")
            
            # Step 2: Test /auth/me endpoint
            print(f"\n🧪 Testing /auth/me...")
            headers = {"Authorization": f"Bearer {token}"}
            me_response = requests.get(f"{base_url}/auth/me", headers=headers)
            print(f"/auth/me Status Code: {me_response.status_code}")
            
            if me_response.status_code == 200:
                me_data = me_response.json()
                print(f"✅ /auth/me successful: {me_data.get('name')} ({me_data.get('role')})")
            else:
                print(f"❌ /auth/me failed: {me_response.text}")
            
            # Step 3: Test /admin/users endpoint
            print(f"\n🧪 Testing /admin/users...")
            users_response = requests.get(f"{base_url}/admin/users", headers=headers)
            print(f"/admin/users Status Code: {users_response.status_code}")
            
            if users_response.status_code == 200:
                users_data = users_response.json()
                print(f"✅ Success! Fetched {len(users_data)} users")
                if users_data:
                    print(f"Sample users:")
                    for i, user in enumerate(users_data[:3]):  # Show first 3 users
                        print(f"  {i+1}. {user.get('name')} ({user.get('email')}) - {user.get('role')}")
            else:
                print(f"❌ /admin/users failed: {users_response.text}")
                
                # Let's also check the response headers for more info
                print(f"Response headers: {dict(users_response.headers)}")
                
        else:
            print(f"❌ Login failed: {login_response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - server may not be running")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_complete_flow()
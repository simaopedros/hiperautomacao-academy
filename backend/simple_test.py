import requests
import json

def test_admin_endpoint():
    """Simple test of admin endpoint"""
    
    print("=== TESTING ADMIN ENDPOINT ===")
    
    # Test 1: Login
    print("1. Testing login...")
    try:
        login_response = requests.post(
            "http://localhost:8000/api/auth/login",
            json={"email": "simaopedros@gmail.com", "password": "admin123"},
            timeout=10
        )
        
        print(f"Login status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            token_data = login_response.json()
            token = token_data["access_token"]
            print("✅ Login successful!")
            
            # Test 2: Admin users endpoint
            print("\n2. Testing /admin/users endpoint...")
            headers = {"Authorization": f"Bearer {token}"}
            
            users_response = requests.get(
                "http://localhost:8000/api/admin/users",
                headers=headers,
                timeout=30
            )
            
            print(f"Status: {users_response.status_code}")
            
            if users_response.status_code == 200:
                users_data = users_response.json()
                print(f"✅ SUCCESS! Got {len(users_data)} users")
                
                # Show first few users
                for i, user in enumerate(users_data[:3]):
                    status = "Invited" if user.get('invited') else "Active"
                    courses = len(user.get('enrolled_courses', []))
                    print(f"  {i+1}. {user.get('name')} ({user.get('email')}) - {status} - {courses} courses")
                    
            else:
                print(f"❌ Failed: {users_response.text}")
                
        else:
            print(f"❌ Login failed: {login_response.text}")
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_admin_endpoint()
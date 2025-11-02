import requests
import json

def test_admin_users_endpoint():
    """Test the /api/admin/users endpoint with correct prefix"""
    
    # Test the endpoint with /api prefix
    url = "http://localhost:8000/api/admin/users"
    
    try:
        print(f"Testing endpoint: {url}")
        
        # Make GET request without authentication first
        response = requests.get(url, headers={"Content-Type": "application/json"})
        
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response type: {type(data)}")
                if isinstance(data, list):
                    print(f"Number of users returned: {len(data)}")
                    if data:
                        print("First user sample:")
                        first_user = data[0]
                        print(f"  Name: {first_user.get('name', 'N/A')}")
                        print(f"  Email: {first_user.get('email', 'N/A')}")
                        print(f"  Role: {first_user.get('role', 'N/A')}")
                        print(f"  Full Access: {first_user.get('has_full_access', 'N/A')}")
                else:
                    print(f"Response data: {data}")
            except json.JSONDecodeError:
                print(f"Response content (not JSON): {response.text}")
        else:
            print(f"Error response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - server may not be running")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_admin_users_endpoint()
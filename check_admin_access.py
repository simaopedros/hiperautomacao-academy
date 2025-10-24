#!/usr/bin/env python3
"""
Check admin user configuration
"""

import requests
import json

BACKEND_URL = "https://hyperlearn.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

def check_admin():
    session = requests.Session()
    
    # Login as admin
    login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    response = session.post(f"{BACKEND_URL}/auth/login", json=login_data)
    
    if response.status_code != 200:
        print(f"❌ Admin login failed: {response.status_code}")
        return
    
    data = response.json()
    admin_token = data['access_token']
    admin_user = data['user']
    
    print("Admin User Info:")
    print(f"- Email: {admin_user['email']}")
    print(f"- Role: {admin_user['role']}")
    print(f"- Has Full Access: {admin_user.get('has_full_access', False)}")
    print(f"- Enrolled Courses: {admin_user.get('enrolled_courses', [])}")
    
    # Check if we need to update admin to have full access
    if not admin_user.get('has_full_access', False):
        print("\n🔧 Admin doesn't have full access. Updating...")
        
        headers = {'Authorization': f'Bearer {admin_token}'}
        update_data = {"has_full_access": True}
        
        update_response = session.put(f"{BACKEND_URL}/admin/users/{admin_user['id']}", 
                                    json=update_data, headers=headers)
        
        if update_response.status_code == 200:
            print("✅ Admin updated to have full access")
        else:
            print(f"❌ Failed to update admin: {update_response.status_code}")
            print(update_response.text)

if __name__ == "__main__":
    check_admin()
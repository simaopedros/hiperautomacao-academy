#!/usr/bin/env python3
"""
Setup test users for backward compatibility testing
"""

import requests
import json

BACKEND_URL = "https://hyperlearn.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

def setup_users():
    session = requests.Session()
    
    # Login as admin
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    response = session.post(f"{BACKEND_URL}/auth/login", json=login_data)
    
    if response.status_code != 200:
        print(f"❌ Admin login failed: {response.status_code}")
        return False
    
    admin_token = response.json()['access_token']
    headers = {'Authorization': f'Bearer {admin_token}'}
    
    # Get existing users
    users_response = session.get(f"{BACKEND_URL}/admin/users", headers=headers)
    if users_response.status_code == 200:
        users = users_response.json()
        print("Existing users:")
        for user in users:
            print(f"- {user['email']} (role: {user['role']}, enrolled_courses: {len(user.get('enrolled_courses', []))})")
    
    # Try to create aluno@test.com if it doesn't exist
    aluno_exists = any(user['email'] == 'aluno@test.com' for user in users)
    
    if not aluno_exists:
        print("\nCreating aluno@test.com...")
        aluno_data = {
            "email": "aluno@test.com",
            "password": "123456",
            "name": "Aluno Test",
            "role": "student"
        }
        
        create_response = session.post(f"{BACKEND_URL}/admin/users", json=aluno_data, headers=headers)
        if create_response.status_code == 200:
            print("✅ aluno@test.com created successfully")
        else:
            print(f"❌ Failed to create aluno@test.com: {create_response.status_code}")
            print(create_response.text)
    else:
        print("✅ aluno@test.com already exists")
    
    return True

if __name__ == "__main__":
    setup_users()
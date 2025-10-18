#!/usr/bin/env python3
"""
Security Test Suite for Registration Endpoint
Tests the security fix that forces role="student" and full_access=False for public registrations
"""

import requests
import json
import time
import sys
import os
from datetime import datetime
import uuid

# Configuration
BACKEND_URL = "https://edupulse-12.preview.emergentagent.com/api"

class RegistrationSecurityTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.admin_token = None
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
    
    def setup_admin_user(self):
        """Setup admin user for admin endpoint testing"""
        try:
            # Try to login first
            login_data = {
                "email": "admin@security.test",
                "password": "admin123"
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                return True
            elif response.status_code == 401:
                # Register admin via public endpoint (will be forced to student, then we'll upgrade via admin panel)
                register_data = {
                    "email": "admin@security.test",
                    "password": "admin123",
                    "name": "Security Test Admin",
                    "role": "admin",  # This should be ignored
                    "full_access": True  # This should be ignored
                }
                
                register_response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
                
                if register_response.status_code == 200:
                    # User was created as student, we need to manually upgrade to admin
                    # For testing purposes, we'll assume there's already an admin in the system
                    # or we'll skip admin-specific tests
                    return False
                else:
                    return False
            else:
                return False
        except Exception as e:
            return False
    
    def test_normal_student_registration(self):
        """Test 1: Normal student registration should work correctly"""
        try:
            timestamp = str(int(time.time()))
            register_data = {
                "email": f"student{timestamp}@example.com",
                "password": "student123",
                "name": "Normal Student",
                "role": "student"
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            
            if response.status_code == 200:
                data = response.json()
                user = data.get('user', {})
                
                # Verify user was created with correct role and access
                if (user.get('role') == 'student' and 
                    user.get('full_access') == False and
                    user.get('email') == register_data['email'] and
                    user.get('name') == register_data['name']):
                    
                    self.log_test("Normal Student Registration", True, 
                                "Student registered correctly with role='student' and full_access=False", 
                                f"Role: {user.get('role')}, Full Access: {user.get('full_access')}")
                    return True
                else:
                    self.log_test("Normal Student Registration", False, 
                                "Student registration returned incorrect user data", user)
                    return False
            else:
                self.log_test("Normal Student Registration", False, 
                            f"Student registration failed: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Normal Student Registration", False, f"Student registration error: {str(e)}")
            return False
    
    def test_attempt_admin_registration_via_payload(self):
        """Test 2: Attempt to register as admin by sending role='admin' in payload (SHOULD BE IGNORED)"""
        try:
            timestamp = str(int(time.time()))
            register_data = {
                "email": f"hacker{timestamp}@example.com",
                "password": "hacker123",
                "name": "Attempted Admin Hacker",
                "role": "admin",  # This should be IGNORED and forced to "student"
                "full_access": True  # This should be IGNORED and forced to False
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            
            if response.status_code == 200:
                data = response.json()
                user = data.get('user', {})
                
                # SECURITY CHECK: User should be created as student, NOT admin
                if (user.get('role') == 'student' and 
                    user.get('full_access') == False):
                    
                    self.log_test("Attempt Admin Registration via Payload", True, 
                                "SECURITY FIX WORKING: Admin role attempt was ignored, user created as student", 
                                f"Attempted role: admin, Actual role: {user.get('role')}, Attempted full_access: True, Actual full_access: {user.get('full_access')}")
                    return True
                else:
                    self.log_test("Attempt Admin Registration via Payload", False, 
                                "SECURITY VULNERABILITY: User was created with admin privileges!", 
                                f"Role: {user.get('role')}, Full Access: {user.get('full_access')}")
                    return False
            else:
                self.log_test("Attempt Admin Registration via Payload", False, 
                            f"Registration failed unexpectedly: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Attempt Admin Registration via Payload", False, f"Admin registration attempt error: {str(e)}")
            return False
    
    def test_attempt_full_access_registration_via_payload(self):
        """Test 3: Attempt to register with full_access=true in payload (SHOULD BE IGNORED)"""
        try:
            timestamp = str(int(time.time()))
            register_data = {
                "email": f"fullaccess{timestamp}@example.com",
                "password": "fullaccess123",
                "name": "Attempted Full Access User",
                "role": "student",  # Even with correct role
                "full_access": True  # This should be IGNORED and forced to False
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            
            if response.status_code == 200:
                data = response.json()
                user = data.get('user', {})
                
                # SECURITY CHECK: full_access should be False regardless of payload
                if user.get('full_access') == False:
                    self.log_test("Attempt Full Access Registration via Payload", True, 
                                "SECURITY FIX WORKING: full_access=true attempt was ignored, user created with full_access=false", 
                                f"Attempted full_access: True, Actual full_access: {user.get('full_access')}")
                    return True
                else:
                    self.log_test("Attempt Full Access Registration via Payload", False, 
                                "SECURITY VULNERABILITY: User was created with full access!", 
                                f"Full Access: {user.get('full_access')}")
                    return False
            else:
                self.log_test("Attempt Full Access Registration via Payload", False, 
                            f"Registration failed unexpectedly: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Attempt Full Access Registration via Payload", False, f"Full access registration attempt error: {str(e)}")
            return False
    
    def test_verify_no_admin_access_after_registration(self):
        """Test 4: Verify that user registered with admin attempt cannot access admin endpoints"""
        try:
            # First register a user attempting to be admin
            timestamp = str(int(time.time()))
            register_data = {
                "email": f"noadmin{timestamp}@example.com",
                "password": "noadmin123",
                "name": "No Admin Access User",
                "role": "admin",  # This should be ignored
                "full_access": True  # This should be ignored
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            
            if response.status_code == 200:
                data = response.json()
                user_token = data.get('access_token')
                
                # Try to access admin endpoint
                headers = {'Authorization': f'Bearer {user_token}'}
                admin_response = self.session.get(f"{BACKEND_URL}/admin/courses", headers=headers)
                
                # Should get 403 Forbidden
                if admin_response.status_code == 403:
                    error_data = admin_response.json()
                    if "Admin access required" in error_data.get('detail', ''):
                        self.log_test("Verify No Admin Access After Registration", True, 
                                    "SECURITY CONFIRMED: User with attempted admin role cannot access admin endpoints", 
                                    f"Admin endpoint returned 403: {error_data.get('detail')}")
                        return True
                    else:
                        self.log_test("Verify No Admin Access After Registration", False, 
                                    "Wrong error message for admin access denial", error_data)
                        return False
                else:
                    self.log_test("Verify No Admin Access After Registration", False, 
                                f"SECURITY ISSUE: User can access admin endpoints! Status: {admin_response.status_code}", 
                                admin_response.text[:200])
                    return False
            else:
                self.log_test("Verify No Admin Access After Registration", False, 
                            "Could not register user for admin access test")
                return False
        except Exception as e:
            self.log_test("Verify No Admin Access After Registration", False, f"Admin access verification error: {str(e)}")
            return False
    
    def test_multiple_privilege_escalation_attempts(self):
        """Test 5: Multiple attempts to escalate privileges in single registration"""
        try:
            timestamp = str(int(time.time()))
            register_data = {
                "email": f"multiattack{timestamp}@example.com",
                "password": "multiattack123",
                "name": "Multi Attack User",
                "role": "admin",  # Should be ignored
                "full_access": True,  # Should be ignored
                # Additional fields that might be attempted
                "is_admin": True,
                "admin": True,
                "superuser": True,
                "permissions": ["admin", "full_access"],
                "access_level": "admin"
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            
            if response.status_code == 200:
                data = response.json()
                user = data.get('user', {})
                
                # SECURITY CHECK: All privilege escalation attempts should be ignored
                if (user.get('role') == 'student' and 
                    user.get('full_access') == False and
                    'is_admin' not in user and
                    'admin' not in user and
                    'superuser' not in user):
                    
                    self.log_test("Multiple Privilege Escalation Attempts", True, 
                                "SECURITY FIX WORKING: All privilege escalation attempts ignored", 
                                f"Final user: role={user.get('role')}, full_access={user.get('full_access')}")
                    return True
                else:
                    self.log_test("Multiple Privilege Escalation Attempts", False, 
                                "SECURITY VULNERABILITY: Some privilege escalation succeeded!", user)
                    return False
            else:
                self.log_test("Multiple Privilege Escalation Attempts", False, 
                            f"Registration failed: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Multiple Privilege Escalation Attempts", False, f"Multi-attack test error: {str(e)}")
            return False
    
    def test_json_injection_attempts(self):
        """Test 6: Attempt JSON injection to bypass security"""
        try:
            timestamp = str(int(time.time()))
            
            # Test various JSON injection attempts
            injection_attempts = [
                {
                    "email": f"inject1{timestamp}@security.test",
                    "password": "inject123",
                    "name": "JSON Inject User 1",
                    "role": {"$ne": "student"},  # MongoDB injection attempt
                },
                {
                    "email": f"inject2{timestamp}@security.test", 
                    "password": "inject123",
                    "name": "JSON Inject User 2",
                    "role": ["admin", "student"],  # Array injection
                },
                {
                    "email": f"inject3{timestamp}@security.test",
                    "password": "inject123", 
                    "name": "JSON Inject User 3",
                    "role": "student\"; UPDATE users SET role='admin' WHERE email='inject3@security.test'; --"  # SQL-style injection
                }
            ]
            
            all_secure = True
            
            for i, attempt in enumerate(injection_attempts):
                response = self.session.post(f"{BACKEND_URL}/auth/register", json=attempt)
                
                if response.status_code == 200:
                    data = response.json()
                    user = data.get('user', {})
                    
                    # Check if security was bypassed
                    if user.get('role') != 'student' or user.get('full_access') != False:
                        all_secure = False
                        self.log_test(f"JSON Injection Attempt {i+1}", False, 
                                    f"SECURITY VULNERABILITY: Injection succeeded!", user)
                    else:
                        self.log_test(f"JSON Injection Attempt {i+1}", True, 
                                    f"Injection attempt blocked, user created as student", 
                                    f"Role: {user.get('role')}")
                else:
                    # Registration failed - could be due to validation, which is also acceptable
                    self.log_test(f"JSON Injection Attempt {i+1}", True, 
                                f"Injection attempt rejected by server: {response.status_code}")
            
            if all_secure:
                self.log_test("JSON Injection Attempts", True, 
                            "All JSON injection attempts were blocked or resulted in secure user creation")
                return True
            else:
                self.log_test("JSON Injection Attempts", False, 
                            "Some JSON injection attempts succeeded")
                return False
                
        except Exception as e:
            self.log_test("JSON Injection Attempts", False, f"JSON injection test error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all security tests"""
        print("=" * 80)
        print("REGISTRATION ENDPOINT SECURITY TESTS")
        print("=" * 80)
        print(f"Backend URL: {BACKEND_URL}")
        print("Testing security fix: role='student' and full_access=False enforcement")
        print()
        
        tests = [
            self.test_normal_student_registration,
            self.test_attempt_admin_registration_via_payload,
            self.test_attempt_full_access_registration_via_payload,
            self.test_verify_no_admin_access_after_registration,
            self.test_multiple_privilege_escalation_attempts,
            self.test_json_injection_attempts
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error - {str(e)}")
                failed += 1
            print()  # Add spacing between tests
        
        print("=" * 80)
        print("SECURITY TEST SUMMARY")
        print("=" * 80)
        total_tests = passed + failed
        
        print(f"TOTAL TESTS: {total_tests}")
        print(f"PASSED: {passed}")
        print(f"FAILED: {failed}")
        print(f"Success Rate: {(passed/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if failed > 0:
            print("\n🚨 SECURITY ISSUES FOUND:")
            for result in self.test_results:
                if not result['success'] and 'VULNERABILITY' in result['message']:
                    print(f"- {result['test']}: {result['message']}")
        else:
            print("\n✅ ALL SECURITY TESTS PASSED - REGISTRATION ENDPOINT IS SECURE")
        
        return failed == 0

if __name__ == "__main__":
    tester = RegistrationSecurityTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
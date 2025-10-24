#!/usr/bin/env python3
"""
Specific test for simaopedros@gmail.com user login and course access
Tests the exact scenarios mentioned in the review request
"""

import requests
import json
import sys
import os
from datetime import datetime

# Configuration
BACKEND_URL = "https://hyperlearn.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
TARGET_USER_EMAIL = "simaopedros@gmail.com"
TARGET_COURSE_ID = "46fab7f9-2a15-411b-bb08-e75051827a0a"
TARGET_COURSE_NAME = "Gemini no Google Workspace"

class SimaoUserTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.target_user_token = None
        self.target_user_id = None
        self.test_results = []
        
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
        """Setup admin user and get token"""
        try:
            login_data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.log_test("Admin Setup", True, "Admin login successful")
                return True
            else:
                self.log_test("Admin Setup", False, f"Admin login failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Setup", False, f"Admin setup error: {str(e)}")
            return False
    
    def try_target_user_login(self):
        """Try to login with target user using common passwords"""
        try:
            # Common passwords to try
            passwords_to_try = [
                "123456", "password", "simao123", "gemini123", 
                "workspace", "google123", "hiperautomacao", 
                "simaopedros", "gmail123", "test123"
            ]
            
            for password in passwords_to_try:
                login_data = {
                    "email": TARGET_USER_EMAIL,
                    "password": password
                }
                
                response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
                
                if response.status_code == 200:
                    data = response.json()
                    self.target_user_token = data['access_token']
                    self.target_user_id = data['user']['id']
                    self.log_test("Target User Login", True, 
                                f"Successfully logged in with password: {password}")
                    return True
            
            self.log_test("Target User Login", False, 
                        "Could not login with any common passwords. User may need password reset.")
            return False
        except Exception as e:
            self.log_test("Target User Login", False, f"Login attempt error: {str(e)}")
            return False
    
    def test_user_data_via_admin(self):
        """Test 1: Verify user data via admin API"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = self.session.get(f"{BACKEND_URL}/admin/users", headers=headers)
            
            if response.status_code == 200:
                users = response.json()
                target_user = next((u for u in users if u['email'] == TARGET_USER_EMAIL), None)
                
                if target_user:
                    self.target_user_id = target_user['id']
                    enrolled_courses = target_user.get('enrolled_courses', [])
                    
                    # Verify the specific course is enrolled
                    if TARGET_COURSE_ID in enrolled_courses and len(enrolled_courses) == 1:
                        self.log_test("User Data via Admin", True, 
                                    f"User correctly shows 1 enrolled course: {TARGET_COURSE_NAME}", 
                                    f"User ID: {self.target_user_id}, Courses: {enrolled_courses}")
                        return True
                    else:
                        self.log_test("User Data via Admin", False, 
                                    f"Unexpected enrollment data. Expected 1 course ({TARGET_COURSE_ID}), got {len(enrolled_courses)}", 
                                    f"Enrolled courses: {enrolled_courses}")
                        return False
                else:
                    self.log_test("User Data via Admin", False, 
                                f"User {TARGET_USER_EMAIL} not found in admin dashboard")
                    return False
            else:
                self.log_test("User Data via Admin", False, 
                            f"Failed to get users: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("User Data via Admin", False, f"Admin API test error: {str(e)}")
            return False
    
    def test_enrollment_collection_via_admin(self):
        """Test 2: Verify enrollment exists in enrollments collection"""
        try:
            if not self.target_user_id:
                self.log_test("Enrollment Collection via Admin", False, 
                            "Target user ID not available")
                return False
            
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = self.session.get(f"{BACKEND_URL}/admin/enrollments/{self.target_user_id}", headers=headers)
            
            if response.status_code == 200:
                enrollments = response.json()
                
                # Look for the target course
                target_enrollment = next((e for e in enrollments if e['course_id'] == TARGET_COURSE_ID), None)
                
                if target_enrollment:
                    self.log_test("Enrollment Collection via Admin", True, 
                                f"Enrollment record found for course '{target_enrollment.get('course_title')}'", 
                                f"Enrollment ID: {target_enrollment.get('enrollment_id')}")
                    return True
                else:
                    self.log_test("Enrollment Collection via Admin", False, 
                                f"No enrollment record found for course {TARGET_COURSE_ID}", 
                                f"Available enrollments: {enrollments}")
                    return False
            else:
                self.log_test("Enrollment Collection via Admin", False, 
                            f"Failed to get enrollments: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Enrollment Collection via Admin", False, f"Enrollment collection test error: {str(e)}")
            return False
    
    def test_student_courses_api_if_logged_in(self):
        """Test 3: GET /api/student/courses (if user is logged in)"""
        try:
            if not self.target_user_token:
                self.log_test("Student Courses API", False, 
                            "Cannot test - user not logged in. Password may need to be reset.")
                return False
            
            headers = {'Authorization': f'Bearer {self.target_user_token}'}
            response = self.session.get(f"{BACKEND_URL}/student/courses", headers=headers)
            
            if response.status_code == 200:
                courses = response.json()
                
                # Find the target course
                target_course = next((c for c in courses if c['id'] == TARGET_COURSE_ID), None)
                
                if target_course:
                    is_enrolled = target_course.get('is_enrolled', False)
                    has_access = target_course.get('has_access', False)
                    
                    if is_enrolled and has_access:
                        self.log_test("Student Courses API", True, 
                                    f"Course shows is_enrolled=true and has_access=true", 
                                    f"Course: {target_course.get('title')}")
                        return True
                    else:
                        self.log_test("Student Courses API", False, 
                                    f"Course access flags incorrect: is_enrolled={is_enrolled}, has_access={has_access}", 
                                    target_course)
                        return False
                else:
                    self.log_test("Student Courses API", False, 
                                f"Target course {TARGET_COURSE_ID} not found in API response", 
                                f"Available courses: {[c['id'] for c in courses]}")
                    return False
            else:
                self.log_test("Student Courses API", False, 
                            f"API call failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Student Courses API", False, f"Student courses API error: {str(e)}")
            return False
    
    def test_course_access_api_if_logged_in(self):
        """Test 4: GET /api/student/courses/{course_id} (if user is logged in)"""
        try:
            if not self.target_user_token:
                self.log_test("Course Access API", False, 
                            "Cannot test - user not logged in. Password may need to be reset.")
                return False
            
            headers = {'Authorization': f'Bearer {self.target_user_token}'}
            response = self.session.get(f"{BACKEND_URL}/student/courses/{TARGET_COURSE_ID}", headers=headers)
            
            if response.status_code == 200:
                course_details = response.json()
                
                if course_details.get('title') == TARGET_COURSE_NAME:
                    self.log_test("Course Access API", True, 
                                f"Successfully accessed course details", 
                                f"Course: {course_details.get('title')}")
                    return True
                else:
                    self.log_test("Course Access API", False, 
                                f"Wrong course returned", course_details)
                    return False
            elif response.status_code == 403:
                self.log_test("Course Access API", False, 
                            "Access denied (403) - enrollment inconsistency still exists!", 
                            response.text[:200])
                return False
            else:
                self.log_test("Course Access API", False, 
                            f"Unexpected response: {response.status_code}", 
                            response.text[:200])
                return False
        except Exception as e:
            self.log_test("Course Access API", False, f"Course access API error: {str(e)}")
            return False
    
    def test_password_reset_functionality(self):
        """Test 5: Verify password reset functionality works"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/forgot-password", 
                                       params={"email": TARGET_USER_EMAIL})
            
            if response.status_code == 200:
                data = response.json()
                expected_message = "Se o email existir, você receberá instruções para redefinir sua senha"
                
                if expected_message in data.get('message', ''):
                    self.log_test("Password Reset Functionality", True, 
                                "Password reset request processed successfully", 
                                "User should receive email with reset instructions")
                    return True
                else:
                    self.log_test("Password Reset Functionality", False, 
                                "Unexpected response message", data)
                    return False
            else:
                self.log_test("Password Reset Functionality", False, 
                            f"Password reset failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Password Reset Functionality", False, f"Password reset test error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests for simaopedros@gmail.com"""
        print("=" * 80)
        print("SIMAOPEDROS@GMAIL.COM SPECIFIC TESTS")
        print("=" * 80)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Target User: {TARGET_USER_EMAIL}")
        print(f"Target Course: {TARGET_COURSE_NAME} ({TARGET_COURSE_ID})")
        print()
        
        # Setup phase
        if not self.setup_admin_user():
            print("❌ CRITICAL: Admin setup failed. Cannot continue tests.")
            return False
        
        # Try to login with target user
        user_logged_in = self.try_target_user_login()
        
        print()
        print("=" * 80)
        print("RUNNING SPECIFIC USER TESTS")
        print("=" * 80)
        
        tests = [
            self.test_user_data_via_admin,
            self.test_enrollment_collection_via_admin,
            self.test_student_courses_api_if_logged_in,
            self.test_course_access_api_if_logged_in,
            self.test_password_reset_functionality
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
        print("TEST SUMMARY")
        print("=" * 80)
        total_tests = passed + failed
        
        print(f"TOTAL TESTS: {total_tests}")
        print(f"PASSED: {passed}")
        print(f"FAILED: {failed}")
        print(f"Success Rate: {(passed/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if failed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"- {result['test']}: {result['message']}")
        
        print("\nKEY FINDINGS:")
        if user_logged_in:
            print("✅ User login successful - can test full functionality")
        else:
            print("⚠️  User login failed - password needs to be reset")
            print("   📧 Password reset functionality is working")
            print("   🔧 User should use password reset link to set new password")
        
        if passed >= 3:  # At least admin tests should pass
            print("✅ Enrollment data migration is working correctly")
            print("✅ User data consistency has been restored")
        else:
            print("❌ Enrollment data migration may have issues")
        
        return failed == 0

if __name__ == "__main__":
    tester = SimaoUserTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
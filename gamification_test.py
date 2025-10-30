#!/usr/bin/env python3
"""
Gamification System Test Suite
Tests all gamification-related endpoints and scenarios
"""

import requests
import json
import time
import sys
import os
from datetime import datetime
import uuid

# Configuration
BACKEND_URL = "http://localhost:8000/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
STUDENT_EMAIL = f"student{int(time.time())}@exemplo.com"
STUDENT_PASSWORD = "student123"

class GamificationTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.student_token = None
        self.student_user_id = None
        self.test_lesson_id = None
        self.test_course_id = None
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
            # Try to login first
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
            elif response.status_code == 401:
                # Register admin
                register_data = {
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD,
                    "name": "Admin User",
                    "role": "admin",
                    "full_access": True
                }
                
                register_response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
                
                if register_response.status_code == 200:
                    data = register_response.json()
                    self.admin_token = data['access_token']
                    self.log_test("Admin Setup", True, "Admin registered and logged in")
                    return True
                else:
                    self.log_test("Admin Setup", False, f"Admin registration failed: {register_response.status_code}")
                    return False
            else:
                self.log_test("Admin Setup", False, f"Admin login failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Setup", False, f"Admin setup error: {str(e)}")
            return False
    
    def setup_student_user(self):
        """Setup student user and get token"""
        try:
            # Try to login first
            login_data = {
                "email": STUDENT_EMAIL,
                "password": STUDENT_PASSWORD
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.student_token = data['access_token']
                self.student_user_id = data['user']['id']
                self.log_test("Student Setup", True, "Student login successful")
                return True
            elif response.status_code == 401:
                # Register student
                register_data = {
                    "email": STUDENT_EMAIL,
                    "password": STUDENT_PASSWORD,
                    "name": "Test Student",
                    "role": "student"
                }
                
                register_response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
                
                if register_response.status_code == 200:
                    data = register_response.json()
                    self.student_token = data['access_token']
                    self.student_user_id = data['user']['id']
                    self.log_test("Student Setup", True, "Student registered and logged in")
                    return True
                else:
                    self.log_test("Student Setup", False, f"Student registration failed: {register_response.status_code}")
                    return False
            else:
                self.log_test("Student Setup", False, f"Student login failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Student Setup", False, f"Student setup error: {str(e)}")
            return False
    
    def create_test_lesson(self):
        """Create a test lesson for gamification testing or use existing course"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # First, try to get existing courses
            print(f"🔍 Fetching existing courses from {BACKEND_URL}/admin/courses")
            courses_response = self.session.get(f"{BACKEND_URL}/admin/courses", headers=headers)
            print(f"📊 Courses response status: {courses_response.status_code}")
            
            if courses_response.status_code == 200:
                courses = courses_response.json()
                print(f"📚 Found {len(courses)} courses")
                if courses:
                    # Use the first existing course
                    course_id = courses[0]['id']
                    print(f"🎯 Using course: {course_id} - {courses[0].get('title', 'Unknown')}")
                    
                    # Get modules for this course
                    print(f"🔍 Fetching modules for course {course_id}")
                    modules_response = self.session.get(f"{BACKEND_URL}/admin/modules/{course_id}", headers=headers)
                    print(f"📊 Modules response status: {modules_response.status_code}")
                    
                    if modules_response.status_code == 200:
                        modules = modules_response.json()
                        print(f"📦 Found {len(modules)} modules")
                        if modules:
                            # Use the first existing module
                            module_id = modules[0]['id']
                            self.test_course_id = course_id
                            print(f"🎯 Using module: {module_id} - {modules[0].get('title', 'Unknown')}")
                            
                            # Get lessons for this module
                            print(f"🔍 Fetching lessons for module {module_id}")
                            lessons_response = self.session.get(f"{BACKEND_URL}/admin/lessons/{module_id}", headers=headers)
                            print(f"📊 Lessons response status: {lessons_response.status_code}")
                            
                            if lessons_response.status_code == 200:
                                lessons = lessons_response.json()
                                print(f"📝 Found {len(lessons)} lessons")
                                if lessons:
                                    # Use the first existing lesson
                                    self.test_lesson_id = lessons[0]['id']
                                    print(f"🎯 Using lesson: {self.test_lesson_id} - {lessons[0].get('title', 'Unknown')}")
                                    self.log_test("Test Lesson Setup", True, "Using existing lesson for testing")
                                    return True
                            else:
                                print(f"❌ Failed to fetch lessons: {lessons_response.text}")
                        else:
                            print("📦 No modules found for this course")
                    else:
                        print(f"❌ Failed to fetch modules: {modules_response.text}")
                else:
                    print("📚 No courses found")
            else:
                print(f"❌ Failed to fetch courses: {courses_response.text}")
            
            print("🔨 Creating new test content...")
            # If no existing content, create new test content
            # First create a course
            course_data = {
                "title": "Test Course for Gamification",
                "description": "Test course for gamification testing",
                "published": True,
                "price_brl": 25.0,
                "price_credits": 50
            }
            
            course_response = self.session.post(f"{BACKEND_URL}/admin/courses", 
                                              json=course_data, headers=headers)
            
            if course_response.status_code != 200:
                print(f"❌ Failed to create course: {course_response.status_code} - {course_response.text}")
                self.log_test("Test Lesson Creation", False, "Failed to create test course")
                return False
            
            course_id = course_response.json()['id']
            self.test_course_id = course_id
            
            # Create a module
            module_data = {
                "title": "Test Module",
                "description": "Test module for gamification",
                "course_id": course_id,
                "order": 1
            }
            
            module_response = self.session.post(f"{BACKEND_URL}/admin/modules", 
                                              json=module_data, headers=headers)
            
            if module_response.status_code != 200:
                self.log_test("Test Lesson Creation", False, "Failed to create test module")
                return False
            
            module_id = module_response.json()['id']
            
            # Create a lesson
            lesson_data = {
                "title": "Test Lesson",
                "type": "text",
                "content": "Test lesson content for gamification testing",
                "module_id": module_id,
                "order": 1
            }
            
            lesson_response = self.session.post(f"{BACKEND_URL}/admin/lessons", 
                                              json=lesson_data, headers=headers)
            
            if lesson_response.status_code == 200:
                self.test_lesson_id = lesson_response.json()['id']
                self.log_test("Test Lesson Creation", True, "Test lesson created successfully")
                return True
            else:
                self.log_test("Test Lesson Creation", False, f"Failed to create lesson: {lesson_response.status_code}")
                return False
        except Exception as e:
            self.log_test("Test Lesson Creation", False, f"Lesson creation error: {str(e)}")
            return False
    
    # ==================== GAMIFICATION TESTS ====================
    
    def test_get_default_gamification_settings(self):
        """Test 1: Admin - Obter configurações padrão"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = self.session.get(f"{BACKEND_URL}/admin/gamification-settings", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has the required fields (may be defaults or previously set values)
                required_fields = ["create_post", "create_comment", "receive_like", "complete_course"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Get Default Gamification Settings", True, 
                                "Gamification settings returned with all required fields", data)
                    return True
                else:
                    self.log_test("Get Default Gamification Settings", False, 
                                "Missing required fields in settings", data)
                    return False
            else:
                self.log_test("Get Default Gamification Settings", False, 
                            f"Failed to get settings: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Get Default Gamification Settings", False, f"Settings check error: {str(e)}")
            return False
    
    def test_update_gamification_settings(self):
        """Test 2: Admin - Atualizar configurações"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Update settings with new values
            params = {
                "create_post": 10,
                "create_comment": 5,
                "receive_like": 2,
                "complete_course": 30
            }
            
            response = self.session.post(f"{BACKEND_URL}/admin/gamification-settings", 
                                       params=params, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "successfully" in data.get("message", "").lower():
                    self.log_test("Update Gamification Settings", True, 
                                "Gamification settings updated successfully", data)
                    return True
                else:
                    self.log_test("Update Gamification Settings", False, 
                                "Unexpected response message", data)
                    return False
            else:
                self.log_test("Update Gamification Settings", False, 
                            f"Failed to update settings: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Update Gamification Settings", False, f"Settings update error: {str(e)}")
            return False
    
    def test_verify_updated_settings(self):
        """Test 3: Admin - Verificar atualização"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = self.session.get(f"{BACKEND_URL}/admin/gamification-settings", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                expected_values = {
                    "create_post": 10,
                    "create_comment": 5,
                    "receive_like": 2,
                    "complete_course": 30
                }
                
                # Check if all values were updated correctly
                all_correct = True
                for key, expected_value in expected_values.items():
                    if data.get(key) != expected_value:
                        all_correct = False
                        break
                
                if all_correct:
                    self.log_test("Verify Updated Settings", True, 
                                "Updated gamification settings verified correctly", data)
                    return True
                else:
                    self.log_test("Verify Updated Settings", False, 
                                "Updated values don't match expected", data)
                    return False
            else:
                self.log_test("Verify Updated Settings", False, 
                            f"Failed to get updated settings: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Verify Updated Settings", False, f"Settings verification error: {str(e)}")
            return False
    
    def enroll_student_in_course(self):
        """Helper: Enroll student in the test course"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            enrollment_data = {
                "user_id": self.student_user_id,
                "course_id": self.test_course_id
            }
            
            response = self.session.post(f"{BACKEND_URL}/admin/enrollments", 
                                       json=enrollment_data, headers=headers)
            
            return response.status_code == 200
        except Exception as e:
            return False

    def test_user_comment_creation(self):
        """Test 4: Usuário pode criar comentários"""
        try:
            # First, enroll the student in the course
            if not self.enroll_student_in_course():
                self.log_test("User Comment Creation", False, 
                            "Failed to enroll student in course")
                return False
            
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            # Create a comment (new post)
            comment_data = {
                "content": "Test post for gamification without credits system",
                "lesson_id": self.test_lesson_id
            }
            
            response = self.session.post(f"{BACKEND_URL}/comments", 
                                       json=comment_data, headers=headers)
            
            if response.status_code == 200:
                comment = response.json()
                self.log_test("User Comment Creation", True, 
                            "Comment created successfully without credits system", 
                            f"Comment ID: {comment.get('id', 'N/A')}")
                return True
            else:
                self.log_test("User Comment Creation", False, 
                            f"Comment creation failed: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("User Comment Creation", False, f"Comment test error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all gamification tests in sequence"""
        print("=" * 80)
        print("STARTING GAMIFICATION SYSTEM TESTS")
        print("=" * 80)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Admin Email: {ADMIN_EMAIL}")
        print(f"Student Email: {STUDENT_EMAIL}")
        print()
        
        # Setup phase
        if not self.setup_admin_user():
            print("❌ CRITICAL: Admin setup failed. Cannot continue tests.")
            return False
        
        if not self.setup_student_user():
            print("❌ CRITICAL: Student setup failed. Cannot continue tests.")
            return False
        
        if not self.create_test_lesson():
            print("❌ CRITICAL: Test lesson creation failed. Cannot continue tests.")
            return False
        
        print()
        print("=" * 80)
        print("RUNNING GAMIFICATION TESTS")
        print("=" * 80)
        
        tests = [
            self.test_get_default_gamification_settings,
            self.test_update_gamification_settings,
            self.test_verify_updated_settings,
            self.test_user_comment_creation
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
        print("GAMIFICATION TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {passed + failed}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/(passed+failed)*100):.1f}%" if (passed+failed) > 0 else "0%")
        
        if failed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"- {result['test']}: {result['message']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = GamificationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
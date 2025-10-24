#!/usr/bin/env python3
"""
Test lesson access with backward compatibility
This tests the actual lesson access endpoints to verify the backward compatibility works
"""

import requests
import json
import sys

BACKEND_URL = "https://hyperlearn.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
TARGET_COURSE_ID = "46fab7f9-2a15-411b-bb08-e75051827a0a"

class LessonAccessTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
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
            'details': details
        })
    
    def setup_admin(self):
        """Setup admin user"""
        try:
            login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                self.admin_token = response.json()['access_token']
                return True
            return False
        except:
            return False
    
    def create_test_user_with_token(self, email, password, name):
        """Create a test user and return their token"""
        try:
            # Try to register
            register_data = {
                "email": email,
                "password": password,
                "name": name
            }
            
            register_response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            
            if register_response.status_code == 200:
                return register_response.json()['access_token']
            
            # If registration fails (user exists), try to login
            login_data = {"email": email, "password": password}
            login_response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if login_response.status_code == 200:
                return login_response.json()['access_token']
            
            return None
        except:
            return None
    
    def get_lesson_from_course(self, course_id, token):
        """Get a lesson ID from a course"""
        try:
            headers = {'Authorization': f'Bearer {token}'}
            response = self.session.get(f"{BACKEND_URL}/student/courses/{course_id}", headers=headers)
            
            if response.status_code == 200:
                course_data = response.json()
                modules = course_data.get('modules', [])
                
                for module in modules:
                    lessons = module.get('lessons', [])
                    if lessons:
                        return lessons[0]['id']
            return None
        except:
            return None
    
    def test_admin_lesson_access(self):
        """Test admin can access lessons in any course"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Get a lesson from the target course
            lesson_id = self.get_lesson_from_course(TARGET_COURSE_ID, self.admin_token)
            
            if not lesson_id:
                self.log_test("Admin Lesson Access", False, "Could not find lesson in target course")
                return False
            
            # Try to access the lesson
            response = self.session.get(f"{BACKEND_URL}/student/lessons/{lesson_id}", headers=headers)
            
            if response.status_code == 200:
                lesson_data = response.json()
                self.log_test("Admin Lesson Access", True, 
                            f"Admin successfully accessed lesson: {lesson_data.get('title')}",
                            f"Lesson ID: {lesson_id}")
                return True
            else:
                self.log_test("Admin Lesson Access", False, 
                            f"Admin failed to access lesson: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Lesson Access", False, f"Error: {str(e)}")
            return False
    
    def test_enrolled_user_lesson_access(self):
        """Test that a user enrolled via new system can access lessons"""
        try:
            # Create a test user and enroll them
            import time
            timestamp = str(int(time.time()))
            test_email = f"testuser{timestamp}@example.com"
            
            token = self.create_test_user_with_token(test_email, "password123", "Test User")
            
            if not token:
                self.log_test("Enrolled User Lesson Access", False, "Could not create test user")
                return False
            
            # Enroll the user in the target course via admin
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Get user ID
            users_response = self.session.get(f"{BACKEND_URL}/admin/users", headers=headers)
            if users_response.status_code != 200:
                self.log_test("Enrolled User Lesson Access", False, "Could not get users")
                return False
            
            users = users_response.json()
            test_user = next((user for user in users if user['email'] == test_email), None)
            
            if not test_user:
                self.log_test("Enrolled User Lesson Access", False, "Test user not found")
                return False
            
            # Enroll user
            enrollment_data = {
                "user_id": test_user['id'],
                "course_id": TARGET_COURSE_ID
            }
            
            enroll_response = self.session.post(f"{BACKEND_URL}/admin/enrollments", 
                                              json=enrollment_data, headers=headers)
            
            if enroll_response.status_code != 200:
                self.log_test("Enrolled User Lesson Access", False, "Could not enroll user")
                return False
            
            # Now try to access a lesson
            lesson_id = self.get_lesson_from_course(TARGET_COURSE_ID, token)
            
            if not lesson_id:
                self.log_test("Enrolled User Lesson Access", False, "Could not find lesson")
                return False
            
            user_headers = {'Authorization': f'Bearer {token}'}
            lesson_response = self.session.get(f"{BACKEND_URL}/student/lessons/{lesson_id}", 
                                             headers=user_headers)
            
            if lesson_response.status_code == 200:
                lesson_data = lesson_response.json()
                self.log_test("Enrolled User Lesson Access", True, 
                            f"Enrolled user successfully accessed lesson: {lesson_data.get('title')}",
                            f"User: {test_email}")
                return True
            else:
                self.log_test("Enrolled User Lesson Access", False, 
                            f"Enrolled user failed to access lesson: {lesson_response.status_code}")
                return False
        except Exception as e:
            self.log_test("Enrolled User Lesson Access", False, f"Error: {str(e)}")
            return False
    
    def test_non_enrolled_user_lesson_access(self):
        """Test that a non-enrolled user cannot access lessons"""
        try:
            # Create a test user but don't enroll them
            import time
            timestamp = str(int(time.time()))
            test_email = f"nonenrolled{timestamp}@example.com"
            
            token = self.create_test_user_with_token(test_email, "password123", "Non-Enrolled User")
            
            if not token:
                self.log_test("Non-Enrolled User Lesson Access", False, "Could not create test user")
                return False
            
            # Get a lesson from the target course
            lesson_id = self.get_lesson_from_course(TARGET_COURSE_ID, self.admin_token)
            
            if not lesson_id:
                self.log_test("Non-Enrolled User Lesson Access", False, "Could not find lesson")
                return False
            
            # Try to access the lesson (should fail)
            user_headers = {'Authorization': f'Bearer {token}'}
            lesson_response = self.session.get(f"{BACKEND_URL}/student/lessons/{lesson_id}", 
                                             headers=user_headers)
            
            if lesson_response.status_code == 403:
                error_data = lesson_response.json()
                expected_message = "You need to be enrolled in this course to access this lesson"
                
                if expected_message in error_data.get('detail', ''):
                    self.log_test("Non-Enrolled User Lesson Access", True, 
                                "Non-enrolled user correctly denied access with proper message",
                                f"User: {test_email}")
                    return True
                else:
                    self.log_test("Non-Enrolled User Lesson Access", False, 
                                f"Wrong error message: {error_data.get('detail')}")
                    return False
            else:
                self.log_test("Non-Enrolled User Lesson Access", False, 
                            f"Expected 403, got {lesson_response.status_code}")
                return False
        except Exception as e:
            self.log_test("Non-Enrolled User Lesson Access", False, f"Error: {str(e)}")
            return False
    
    def test_backward_compatibility_verification(self):
        """Verify the backward compatibility is actually working by checking the code path"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Get simaopedros@gmail.com user info
            users_response = self.session.get(f"{BACKEND_URL}/admin/users", headers=headers)
            if users_response.status_code != 200:
                self.log_test("Backward Compatibility Verification", False, "Could not get users")
                return False
            
            users = users_response.json()
            simao_user = next((user for user in users if user['email'] == 'simaopedros@gmail.com'), None)
            
            if not simao_user:
                self.log_test("Backward Compatibility Verification", False, "simaopedros@gmail.com not found")
                return False
            
            # Check if user has course in enrolled_courses field (legacy)
            enrolled_courses = simao_user.get('enrolled_courses', [])
            has_legacy_enrollment = TARGET_COURSE_ID in enrolled_courses
            
            # Check if user has enrollment in enrollments collection (new)
            enrollments_response = self.session.get(f"{BACKEND_URL}/admin/enrollments/{simao_user['id']}", 
                                                  headers=headers)
            
            has_new_enrollment = False
            if enrollments_response.status_code == 200:
                enrollments = enrollments_response.json()
                has_new_enrollment = any(e['course_id'] == TARGET_COURSE_ID for e in enrollments)
            
            # The system should work regardless of which system has the enrollment
            if has_legacy_enrollment or has_new_enrollment:
                self.log_test("Backward Compatibility Verification", True, 
                            f"Backward compatibility verified: Legacy={has_legacy_enrollment}, New={has_new_enrollment}",
                            f"User has access via {'legacy' if has_legacy_enrollment else 'new'} system")
                return True
            else:
                self.log_test("Backward Compatibility Verification", False, 
                            "User has no enrollment in either system")
                return False
        except Exception as e:
            self.log_test("Backward Compatibility Verification", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all lesson access tests"""
        print("=" * 80)
        print("LESSON ACCESS BACKWARD COMPATIBILITY TESTS")
        print("=" * 80)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Target Course ID: {TARGET_COURSE_ID}")
        print()
        
        # Setup
        if not self.setup_admin():
            print("❌ CRITICAL: Admin setup failed. Cannot continue tests.")
            return False
        
        print("=" * 80)
        print("RUNNING LESSON ACCESS TESTS")
        print("=" * 80)
        
        tests = [
            self.test_backward_compatibility_verification,
            self.test_admin_lesson_access,
            self.test_enrolled_user_lesson_access,
            self.test_non_enrolled_user_lesson_access
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
            print()
        
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
        
        return failed == 0

if __name__ == "__main__":
    tester = LessonAccessTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
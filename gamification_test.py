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
BACKEND_URL = "https://hiperlearn.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@exemplo.com"
ADMIN_PASSWORD = "admin123"
STUDENT_EMAIL = "student@exemplo.com"
STUDENT_PASSWORD = "student123"

class GamificationTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.student_token = None
        self.student_user_id = None
        self.test_lesson_id = None
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
        """Create a test lesson for comment testing"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
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
                self.log_test("Test Lesson Creation", False, "Failed to create test course")
                return False
            
            course_id = course_response.json()['id']
            
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
                expected_defaults = {
                    "create_post": 5,
                    "create_comment": 2,
                    "receive_like": 1,
                    "complete_course": 20
                }
                
                # Check if all expected fields are present with correct default values
                all_correct = True
                for key, expected_value in expected_defaults.items():
                    if data.get(key) != expected_value:
                        all_correct = False
                        break
                
                if all_correct:
                    self.log_test("Get Default Gamification Settings", True, 
                                "Default gamification settings returned correctly", data)
                    return True
                else:
                    self.log_test("Get Default Gamification Settings", False, 
                                "Default values don't match expected", data)
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
    
    def test_user_without_credits_comment_rejection(self):
        """Test 4: Usuário sem créditos tenta comentar"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            # First ensure user has no credits by checking balance
            balance_response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
            if balance_response.status_code == 200:
                balance = balance_response.json().get('balance', 0)
                if balance >= 1:
                    self.log_test("User Without Credits Comment Rejection", False, 
                                f"User has {balance} credits, cannot test rejection scenario")
                    return False
            
            # Try to create a comment
            comment_data = {
                "content": "Test comment without credits",
                "lesson_id": self.test_lesson_id
            }
            
            response = self.session.post(f"{BACKEND_URL}/comments", 
                                       json=comment_data, headers=headers)
            
            if response.status_code == 403:
                data = response.json()
                if "pelo menos 1 crédito" in data.get('detail', ''):
                    self.log_test("User Without Credits Comment Rejection", True, 
                                "Correctly rejected comment due to insufficient credits", data)
                    return True
                else:
                    self.log_test("User Without Credits Comment Rejection", False, 
                                "Wrong error message for insufficient credits", data)
                    return False
            else:
                self.log_test("User Without Credits Comment Rejection", False, 
                            f"Expected 403 status, got {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("User Without Credits Comment Rejection", False, f"Comment rejection test error: {str(e)}")
            return False
    
    def add_credits_to_user(self, amount=10):
        """Helper: Add credits to user via billing simulation"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            # Create billing for small package
            billing_data = {
                "package_id": "pkg_small",
                "customer_name": "Test Student",
                "customer_email": STUDENT_EMAIL
            }
            
            response = self.session.post(f"{BACKEND_URL}/billing/create", 
                                       json=billing_data, headers=headers)
            
            if response.status_code == 200:
                billing_info = response.json()
                billing_id = billing_info['billing_id']
                
                # Simulate webhook payment confirmation
                webhook_data = {
                    "type": "billing.paid",
                    "data": {
                        "id": billing_id,
                        "status": "PAID"
                    }
                }
                
                webhook_response = self.session.post(f"{BACKEND_URL}/webhook/abacatepay", 
                                                   json=webhook_data)
                
                return webhook_response.status_code == 200
            return False
        except Exception as e:
            return False
    
    def test_user_with_credits_no_purchase_comment(self):
        """Test 5: Usuário com créditos mas sem compra"""
        try:
            # Add credits to user
            if not self.add_credits_to_user():
                self.log_test("User With Credits No Purchase Comment", False, 
                            "Failed to add credits to user for testing")
                return False
            
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            # Get initial balance
            balance_response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
            if balance_response.status_code != 200:
                self.log_test("User With Credits No Purchase Comment", False, 
                            "Could not check balance before comment")
                return False
            
            initial_balance = balance_response.json().get('balance', 0)
            
            # Create a comment (new post, no parent_id)
            comment_data = {
                "content": "Test post without purchase but with credits",
                "lesson_id": self.test_lesson_id
            }
            
            response = self.session.post(f"{BACKEND_URL}/comments", 
                                       json=comment_data, headers=headers)
            
            if response.status_code == 200:
                # Comment should be created
                comment = response.json()
                
                # Check balance after comment - should be same (no reward)
                new_balance_response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
                if new_balance_response.status_code == 200:
                    new_balance = new_balance_response.json().get('balance', 0)
                    
                    if new_balance == initial_balance:
                        self.log_test("User With Credits No Purchase Comment", True, 
                                    "Comment created but no reward given (user hasn't purchased)", 
                                    f"Balance unchanged: {initial_balance}")
                        return True
                    else:
                        self.log_test("User With Credits No Purchase Comment", False, 
                                    f"Unexpected balance change: {initial_balance} -> {new_balance}")
                        return False
                else:
                    self.log_test("User With Credits No Purchase Comment", False, 
                                "Could not check balance after comment")
                    return False
            else:
                self.log_test("User With Credits No Purchase Comment", False, 
                            f"Comment creation failed: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("User With Credits No Purchase Comment", False, f"Comment test error: {str(e)}")
            return False
    
    def mark_user_as_purchased(self):
        """Helper: Mark user as having made a purchase"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Update user to mark as purchased
            update_data = {
                "has_purchased": True
            }
            
            response = self.session.put(f"{BACKEND_URL}/admin/users/{self.student_user_id}", 
                                      json=update_data, headers=headers)
            
            return response.status_code == 200
        except Exception as e:
            return False
    
    def test_user_with_credits_and_purchase_comment(self):
        """Test 6: Usuário com créditos E compra"""
        try:
            # Mark user as having purchased
            if not self.mark_user_as_purchased():
                self.log_test("User With Credits And Purchase Comment", False, 
                            "Failed to mark user as purchased")
                return False
            
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            # Get initial balance
            balance_response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
            if balance_response.status_code != 200:
                self.log_test("User With Credits And Purchase Comment", False, 
                            "Could not check balance before comment")
                return False
            
            initial_balance = balance_response.json().get('balance', 0)
            
            # Create a comment (new post)
            comment_data = {
                "content": "Test post with purchase and credits - should get reward",
                "lesson_id": self.test_lesson_id
            }
            
            response = self.session.post(f"{BACKEND_URL}/comments", 
                                       json=comment_data, headers=headers)
            
            if response.status_code == 200:
                comment = response.json()
                
                # Check balance after comment - should increase by reward amount
                new_balance_response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
                if new_balance_response.status_code == 200:
                    new_balance = new_balance_response.json().get('balance', 0)
                    reward_received = new_balance - initial_balance
                    
                    # Should receive 10 credits for create_post (from updated settings)
                    if reward_received == 10:
                        self.log_test("User With Credits And Purchase Comment", True, 
                                    f"Comment created and reward given correctly: +{reward_received} credits", 
                                    f"Balance: {initial_balance} -> {new_balance}")
                        return True
                    else:
                        self.log_test("User With Credits And Purchase Comment", False, 
                                    f"Unexpected reward amount: expected 10, got {reward_received}")
                        return False
                else:
                    self.log_test("User With Credits And Purchase Comment", False, 
                                "Could not check balance after comment")
                    return False
            else:
                self.log_test("User With Credits And Purchase Comment", False, 
                            f"Comment creation failed: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("User With Credits And Purchase Comment", False, f"Comment with reward test error: {str(e)}")
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
            self.test_user_without_credits_comment_rejection,
            self.test_user_with_credits_no_purchase_comment,
            self.test_user_with_credits_and_purchase_comment
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
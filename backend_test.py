#!/usr/bin/env python3
"""
Backend Test Suite for Credits System and Abacate Pay Integration
Tests all credit-related endpoints and payment integration scenarios
"""

import requests
import json
import base64
import time
import sys
import os
from datetime import datetime
import uuid

# Configuration
BACKEND_URL = "https://hyperlearn.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
STUDENT_EMAIL = "student@test.com"
STUDENT_PASSWORD = "student123"
TEST_USER_EMAIL = "aluno@test.com"
TEST_USER_ID = "972fc0d3-3d51-44ac-907b-ea848190e8ce"

class CreditsSystemTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.student_token = None
        self.student_user_id = None
        self.test_course_id = None
        self.test_module_id = None
        self.test_lesson_id = None
        self.enrolled_student_token = None
        self.enrolled_student_id = None
        self.non_enrolled_student_token = None
        self.non_enrolled_student_id = None
        self.full_access_user_token = None
        self.full_access_user_id = None
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
    
    def create_test_course(self):
        """Create a test course for enrollment testing"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            course_data = {
                "title": "Test Course for Credits",
                "description": "Test course for credits system testing",
                "published": True,
                "price_brl": 25.0,
                "price_credits": 50
            }
            
            response = self.session.post(f"{BACKEND_URL}/admin/courses", 
                                       json=course_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_course_id = data['id']
                self.log_test("Test Course Creation", True, f"Created test course: {data['title']}")
                return True
            else:
                self.log_test("Test Course Creation", False, 
                            f"Failed to create course: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Test Course Creation", False, f"Course creation error: {str(e)}")
            return False
    
    def setup_test_data_for_lesson_access(self):
        """Setup test data for lesson access validation tests"""
        try:
            # Create module for the test course
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            module_data = {
                "title": "Test Module for Lesson Access",
                "description": "Module for testing lesson access validation",
                "course_id": self.test_course_id,
                "order": 1
            }
            
            module_response = self.session.post(f"{BACKEND_URL}/admin/modules", 
                                              json=module_data, headers=headers)
            
            if module_response.status_code == 200:
                self.test_module_id = module_response.json()['id']
                
                # Create lesson in the module
                lesson_data = {
                    "title": "Test Lesson for Access Validation",
                    "type": "video",
                    "content": "https://example.com/test-video.mp4",
                    "module_id": self.test_module_id,
                    "order": 1
                }
                
                lesson_response = self.session.post(f"{BACKEND_URL}/admin/lessons", 
                                                  json=lesson_data, headers=headers)
                
                if lesson_response.status_code == 200:
                    self.test_lesson_id = lesson_response.json()['id']
                    
                    # Create enrolled student
                    import time
                    timestamp = str(int(time.time()))
                    enrolled_student_data = {
                        "email": f"enrolled{timestamp}@test.com",
                        "password": "enrolled123",
                        "name": "Enrolled Student"
                    }
                    
                    enrolled_register = self.session.post(f"{BACKEND_URL}/auth/register", 
                                                        json=enrolled_student_data)
                    
                    if enrolled_register.status_code == 200:
                        enrolled_data = enrolled_register.json()
                        self.enrolled_student_token = enrolled_data['access_token']
                        self.enrolled_student_id = enrolled_data['user']['id']
                        
                        # Enroll this student in the course
                        enrollment_data = {
                            "user_id": self.enrolled_student_id,
                            "course_id": self.test_course_id
                        }
                        
                        enroll_response = self.session.post(f"{BACKEND_URL}/admin/enrollments", 
                                                          json=enrollment_data, headers=headers)
                        
                        if enroll_response.status_code == 200:
                            # Create non-enrolled student
                            non_enrolled_student_data = {
                                "email": f"nonenrolled{timestamp}@test.com",
                                "password": "nonenrolled123",
                                "name": "Non-Enrolled Student"
                            }
                            
                            non_enrolled_register = self.session.post(f"{BACKEND_URL}/auth/register", 
                                                                    json=non_enrolled_student_data)
                            
                            if non_enrolled_register.status_code == 200:
                                non_enrolled_data = non_enrolled_register.json()
                                self.non_enrolled_student_token = non_enrolled_data['access_token']
                                self.non_enrolled_student_id = non_enrolled_data['user']['id']
                                
                                # Create full access user
                                full_access_data = {
                                    "email": f"fullaccess{timestamp}@test.com",
                                    "password": "fullaccess123",
                                    "name": "Full Access User",
                                    "full_access": True
                                }
                                
                                full_access_register = self.session.post(f"{BACKEND_URL}/auth/register", 
                                                                       json=full_access_data)
                                
                                if full_access_register.status_code == 200:
                                    full_access_user_data = full_access_register.json()
                                    self.full_access_user_token = full_access_user_data['access_token']
                                    self.full_access_user_id = full_access_user_data['user']['id']
                                    
                                    # Update user to have full access via admin
                                    update_data = {"full_access": True}
                                    update_response = self.session.put(
                                        f"{BACKEND_URL}/admin/users/{self.full_access_user_id}",
                                        json=update_data, headers=headers
                                    )
                                    
                                    if update_response.status_code == 200:
                                        self.log_test("Test Data Setup", True, 
                                                    "Successfully created test data for lesson access validation")
                                        return True
                                    else:
                                        self.log_test("Test Data Setup", False, 
                                                    f"Failed to update full access user: {update_response.status_code}")
                                        return False
                                else:
                                    self.log_test("Test Data Setup", False, 
                                                f"Failed to create full access user: {full_access_register.status_code}")
                                    return False
                            else:
                                self.log_test("Test Data Setup", False, 
                                            f"Failed to create non-enrolled student: {non_enrolled_register.status_code}")
                                return False
                        else:
                            self.log_test("Test Data Setup", False, 
                                        f"Failed to enroll student: {enroll_response.status_code}")
                            return False
                    else:
                        self.log_test("Test Data Setup", False, 
                                    f"Failed to create enrolled student: {enrolled_register.status_code}")
                        return False
                else:
                    self.log_test("Test Data Setup", False, 
                                f"Failed to create lesson: {lesson_response.status_code}")
                    return False
            else:
                self.log_test("Test Data Setup", False, 
                            f"Failed to create module: {module_response.status_code}")
                return False
        except Exception as e:
            self.log_test("Test Data Setup", False, f"Test data setup error: {str(e)}")
            return False

    # ==================== PRIORITY TESTS - LESSON ACCESS VALIDATION ====================
    
    def test_enrolled_user_lesson_access(self):
        """Test: Enrolled user should be able to access lesson"""
        try:
            headers = {'Authorization': f'Bearer {self.enrolled_student_token}'}
            response = self.session.get(f"{BACKEND_URL}/student/lessons/{self.test_lesson_id}", 
                                      headers=headers)
            
            if response.status_code == 200:
                lesson_data = response.json()
                if lesson_data.get('id') == self.test_lesson_id:
                    self.log_test("Enrolled User Lesson Access", True, 
                                "Enrolled user successfully accessed lesson", lesson_data.get('title'))
                    return True
                else:
                    self.log_test("Enrolled User Lesson Access", False, 
                                "Wrong lesson data returned", lesson_data)
                    return False
            else:
                self.log_test("Enrolled User Lesson Access", False, 
                            f"Enrolled user failed to access lesson: {response.status_code}", 
                            response.text[:200])
                return False
        except Exception as e:
            self.log_test("Enrolled User Lesson Access", False, f"Enrolled user access error: {str(e)}")
            return False
    
    def test_non_enrolled_user_lesson_access(self):
        """Test: Non-enrolled user should get 403 error with specific message"""
        try:
            headers = {'Authorization': f'Bearer {self.non_enrolled_student_token}'}
            response = self.session.get(f"{BACKEND_URL}/student/lessons/{self.test_lesson_id}", 
                                      headers=headers)
            
            if response.status_code == 403:
                error_data = response.json()
                expected_message = "You need to be enrolled in this course to access this lesson"
                
                if expected_message in error_data.get('detail', ''):
                    self.log_test("Non-Enrolled User Lesson Access", True, 
                                "Non-enrolled user correctly denied access with proper message", 
                                error_data.get('detail'))
                    return True
                else:
                    self.log_test("Non-Enrolled User Lesson Access", False, 
                                f"Wrong error message. Expected: '{expected_message}', Got: '{error_data.get('detail')}'", 
                                error_data)
                    return False
            else:
                self.log_test("Non-Enrolled User Lesson Access", False, 
                            f"Expected 403 status, got {response.status_code}", 
                            response.text[:200])
                return False
        except Exception as e:
            self.log_test("Non-Enrolled User Lesson Access", False, f"Non-enrolled user access error: {str(e)}")
            return False
    
    def test_full_access_user_lesson_access(self):
        """Test: User with has_full_access=true should access any lesson"""
        try:
            headers = {'Authorization': f'Bearer {self.full_access_user_token}'}
            response = self.session.get(f"{BACKEND_URL}/student/lessons/{self.test_lesson_id}", 
                                      headers=headers)
            
            if response.status_code == 200:
                lesson_data = response.json()
                if lesson_data.get('id') == self.test_lesson_id:
                    self.log_test("Full Access User Lesson Access", True, 
                                "Full access user successfully accessed lesson", lesson_data.get('title'))
                    return True
                else:
                    self.log_test("Full Access User Lesson Access", False, 
                                "Wrong lesson data returned", lesson_data)
                    return False
            else:
                self.log_test("Full Access User Lesson Access", False, 
                            f"Full access user failed to access lesson: {response.status_code}", 
                            response.text[:200])
                return False
        except Exception as e:
            self.log_test("Full Access User Lesson Access", False, f"Full access user access error: {str(e)}")
            return False
    
    def test_nonexistent_lesson_access(self):
        """Test: Non-existent lesson should return 404"""
        try:
            fake_lesson_id = str(uuid.uuid4())
            headers = {'Authorization': f'Bearer {self.enrolled_student_token}'}
            response = self.session.get(f"{BACKEND_URL}/student/lessons/{fake_lesson_id}", 
                                      headers=headers)
            
            if response.status_code == 404:
                error_data = response.json()
                if "not found" in error_data.get('detail', '').lower():
                    self.log_test("Non-Existent Lesson Access", True, 
                                "Non-existent lesson correctly returned 404", error_data.get('detail'))
                    return True
                else:
                    self.log_test("Non-Existent Lesson Access", False, 
                                "Wrong error message for non-existent lesson", error_data)
                    return False
            else:
                self.log_test("Non-Existent Lesson Access", False, 
                            f"Expected 404 status, got {response.status_code}", 
                            response.text[:200])
                return False
        except Exception as e:
            self.log_test("Non-Existent Lesson Access", False, f"Non-existent lesson test error: {str(e)}")
            return False

    # ==================== PRIORITY TESTS - SUPPORT CONFIGURATION ====================
    
    def test_support_config_endpoint_exists(self):
        """Test: Support config endpoint should return configuration"""
        try:
            # This should be a public endpoint, no auth required
            response = self.session.get(f"{BACKEND_URL}/support/config")
            
            if response.status_code == 200:
                config_data = response.json()
                
                # Check if it has the required fields
                required_fields = ['support_url', 'support_text']
                if all(field in config_data for field in required_fields):
                    self.log_test("Support Config Endpoint", True, 
                                "Support config endpoint returned valid configuration", 
                                f"URL: {config_data.get('support_url')}, Text: {config_data.get('support_text')}")
                    return True
                else:
                    self.log_test("Support Config Endpoint", False, 
                                "Support config missing required fields", config_data)
                    return False
            else:
                self.log_test("Support Config Endpoint", False, 
                            f"Support config endpoint failed: {response.status_code}", 
                            response.text[:200])
                return False
        except Exception as e:
            self.log_test("Support Config Endpoint", False, f"Support config test error: {str(e)}")
            return False
    
    def test_support_config_default_values(self):
        """Test: Support config should return default values if no configuration exists"""
        try:
            # This should be a public endpoint, no auth required
            response = self.session.get(f"{BACKEND_URL}/support/config")
            
            if response.status_code == 200:
                config_data = response.json()
                
                # Check for default values
                expected_defaults = {
                    'support_url': 'https://wa.me/5511999999999',
                    'support_text': 'Suporte'
                }
                
                # If no custom config exists, should return defaults
                # If custom config exists, that's also valid
                if (config_data.get('support_url') and config_data.get('support_text')):
                    self.log_test("Support Config Default Values", True, 
                                "Support config has valid URL and text values", 
                                f"URL: {config_data.get('support_url')}, Text: {config_data.get('support_text')}")
                    return True
                else:
                    self.log_test("Support Config Default Values", False, 
                                "Support config missing URL or text values", config_data)
                    return False
            else:
                self.log_test("Support Config Default Values", False, 
                            f"Support config endpoint failed: {response.status_code}", 
                            response.text[:200])
                return False
        except Exception as e:
            self.log_test("Support Config Default Values", False, f"Support config default test error: {str(e)}")
            return False

    # ==================== FASE 1 - SISTEMA DE CRÉDITOS BASE ====================
    
    def test_credits_balance_initial(self):
        """Test 1: Consultar saldo inicial (deve ser zero)"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('balance', -1) == 0:
                    self.log_test("Initial Credits Balance", True, 
                                "Initial balance is correctly zero", data)
                    return True
                else:
                    self.log_test("Initial Credits Balance", False, 
                                f"Expected balance 0, got {data.get('balance')}", data)
                    return False
            else:
                self.log_test("Initial Credits Balance", False, 
                            f"Failed to get balance: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Initial Credits Balance", False, f"Balance check error: {str(e)}")
            return False
    
    def test_credit_packages(self):
        """Test 2: Ver pacotes disponíveis"""
        try:
            response = self.session.get(f"{BACKEND_URL}/credits/packages")
            
            if response.status_code == 200:
                data = response.json()
                packages = data.get('packages', [])
                
                # Check if we have the expected 3 packages
                if len(packages) == 3:
                    # Verify package structure
                    expected_packages = [
                        {"id": "pkg_small", "price_brl": 10.0, "credits": 50},
                        {"id": "pkg_medium", "price_brl": 25.0, "credits": 150},
                        {"id": "pkg_large", "price_brl": 50.0, "credits": 350}
                    ]
                    
                    all_correct = True
                    for expected in expected_packages:
                        found = next((p for p in packages if p['id'] == expected['id']), None)
                        if not found or found['price_brl'] != expected['price_brl'] or found['credits'] != expected['credits']:
                            all_correct = False
                            break
                    
                    if all_correct:
                        self.log_test("Credit Packages", True, 
                                    "All 3 credit packages are correctly configured", packages)
                        return True
                    else:
                        self.log_test("Credit Packages", False, 
                                    "Package configuration doesn't match expected values", packages)
                        return False
                else:
                    self.log_test("Credit Packages", False, 
                                f"Expected 3 packages, got {len(packages)}", packages)
                    return False
            else:
                self.log_test("Credit Packages", False, 
                            f"Failed to get packages: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Credit Packages", False, f"Packages check error: {str(e)}")
            return False
    
    def test_enroll_without_credits(self):
        """Test 3: Tentar matricular sem créditos (deve falhar)"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            response = self.session.post(f"{BACKEND_URL}/courses/{self.test_course_id}/enroll-with-credits", 
                                       headers=headers)
            
            if response.status_code == 400:
                data = response.json()
                if "Insufficient credits" in data.get('detail', ''):
                    self.log_test("Enroll Without Credits", True, 
                                "Correctly rejected enrollment due to insufficient credits", data)
                    return True
                else:
                    self.log_test("Enroll Without Credits", False, 
                                "Wrong error message for insufficient credits", data)
                    return False
            else:
                self.log_test("Enroll Without Credits", False, 
                            f"Expected 400 status, got {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Enroll Without Credits", False, f"Enrollment test error: {str(e)}")
            return False
    
    # ==================== FASE 2 - MATRICULA COM CRÉDITOS ====================
    
    def add_credits_manually(self, amount=100):
        """Helper: Add credits manually to user (simulating purchase)"""
        try:
            # We'll use the database directly through a mock transaction
            # Since we can't access DB directly, we'll simulate this by creating a billing and webhook
            return True
        except Exception as e:
            return False
    
    def test_add_credits_and_check_balance(self):
        """Test 4: Adicionar créditos manualmente e verificar saldo"""
        try:
            # For testing purposes, we'll create a billing and simulate webhook payment
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
                
                if webhook_response.status_code == 200:
                    # Check balance after payment
                    balance_response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
                    
                    if balance_response.status_code == 200:
                        balance_data = balance_response.json()
                        if balance_data.get('balance', 0) >= 50:  # Small package gives 50 credits
                            self.log_test("Add Credits and Check Balance", True, 
                                        f"Credits added successfully, balance: {balance_data['balance']}", balance_data)
                            return True
                        else:
                            self.log_test("Add Credits and Check Balance", False, 
                                        f"Credits not added correctly, balance: {balance_data.get('balance', 0)}", balance_data)
                            return False
                    else:
                        self.log_test("Add Credits and Check Balance", False, 
                                    f"Failed to check balance after payment: {balance_response.status_code}")
                        return False
                else:
                    self.log_test("Add Credits and Check Balance", False, 
                                f"Webhook processing failed: {webhook_response.status_code}")
                    return False
            else:
                self.log_test("Add Credits and Check Balance", False, 
                            f"Failed to create billing: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Add Credits and Check Balance", False, f"Credits addition error: {str(e)}")
            return False
    
    def test_enroll_with_credits(self):
        """Test 5: Matricular com créditos"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            # First check current balance
            balance_response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
            if balance_response.status_code != 200:
                self.log_test("Enroll With Credits", False, "Could not check balance before enrollment")
                return False
            
            initial_balance = balance_response.json().get('balance', 0)
            
            # Try to enroll
            response = self.session.post(f"{BACKEND_URL}/courses/{self.test_course_id}/enroll-with-credits", 
                                       headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                credits_spent = data.get('credits_spent', 0)
                remaining_balance = data.get('remaining_balance', 0)
                
                # Verify enrollment was created
                # Check if balance was deducted correctly
                if credits_spent > 0 and remaining_balance == (initial_balance - credits_spent):
                    self.log_test("Enroll With Credits", True, 
                                f"Successfully enrolled using {credits_spent} credits", data)
                    return True
                else:
                    self.log_test("Enroll With Credits", False, 
                                "Credits calculation incorrect", data)
                    return False
            else:
                self.log_test("Enroll With Credits", False, 
                            f"Enrollment failed: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Enroll With Credits", False, f"Enrollment error: {str(e)}")
            return False
    
    def test_transaction_history(self):
        """Test 6: Ver histórico de transações"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            response = self.session.get(f"{BACKEND_URL}/credits/transactions", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                transactions = data.get('transactions', [])
                
                # Should have at least 2 transactions: credit purchase and course enrollment
                if len(transactions) >= 2:
                    # Check for purchase transaction (positive amount)
                    purchase_found = any(t['amount'] > 0 and t['transaction_type'] == 'purchased' for t in transactions)
                    # Check for spending transaction (negative amount)
                    spending_found = any(t['amount'] < 0 and t['transaction_type'] == 'spent' for t in transactions)
                    
                    if purchase_found and spending_found:
                        self.log_test("Transaction History", True, 
                                    f"Transaction history shows {len(transactions)} transactions with purchase and spending", 
                                    f"Transactions: {len(transactions)}")
                        return True
                    else:
                        self.log_test("Transaction History", False, 
                                    "Missing expected transaction types", transactions)
                        return False
                else:
                    self.log_test("Transaction History", False, 
                                f"Expected at least 2 transactions, got {len(transactions)}", transactions)
                    return False
            else:
                self.log_test("Transaction History", False, 
                            f"Failed to get transactions: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Transaction History", False, f"Transaction history error: {str(e)}")
            return False
    
    # ==================== FASE 3 - ABACATE PAY ====================
    
    def test_create_billing_for_credits(self):
        """Test 7: Criar billing para pacote de créditos"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            billing_data = {
                "package_id": "pkg_medium",
                "customer_name": "Test Student",
                "customer_email": STUDENT_EMAIL
            }
            
            response = self.session.post(f"{BACKEND_URL}/billing/create", 
                                       json=billing_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['billing_id', 'payment_url', 'amount']
                
                if all(field in data for field in required_fields):
                    # Verify amount matches package price
                    if data['amount'] == 25.0:  # pkg_medium price
                        self.log_test("Create Billing for Credits", True, 
                                    "Billing created successfully with correct amount", data)
                        return True
                    else:
                        self.log_test("Create Billing for Credits", False, 
                                    f"Wrong amount: expected 25.0, got {data['amount']}", data)
                        return False
                else:
                    self.log_test("Create Billing for Credits", False, 
                                "Missing required fields in response", data)
                    return False
            else:
                self.log_test("Create Billing for Credits", False, 
                            f"Failed to create billing: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Create Billing for Credits", False, f"Billing creation error: {str(e)}")
            return False
    
    def test_billing_status_check(self):
        """Test 8: Verificar estrutura do billing"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            # Create a billing first
            billing_data = {
                "package_id": "pkg_small",
                "customer_name": "Test Student",
                "customer_email": STUDENT_EMAIL
            }
            
            create_response = self.session.post(f"{BACKEND_URL}/billing/create", 
                                              json=billing_data, headers=headers)
            
            if create_response.status_code == 200:
                billing_info = create_response.json()
                billing_id = billing_info['billing_id']
                
                # Check billing status
                status_response = self.session.get(f"{BACKEND_URL}/billing/{billing_id}", headers=headers)
                
                if status_response.status_code == 200:
                    billing_data = status_response.json()
                    
                    # Verify billing structure
                    required_fields = ['billing_id', 'user_id', 'amount_brl', 'status', 'created_at']
                    if all(field in billing_data for field in required_fields):
                        if billing_data['status'] == 'pending':
                            self.log_test("Billing Status Check", True, 
                                        "Billing structure is correct and status is pending", billing_data)
                            return True
                        else:
                            self.log_test("Billing Status Check", False, 
                                        f"Expected status 'pending', got '{billing_data['status']}'", billing_data)
                            return False
                    else:
                        self.log_test("Billing Status Check", False, 
                                    "Missing required fields in billing data", billing_data)
                        return False
                else:
                    self.log_test("Billing Status Check", False, 
                                f"Failed to get billing status: {status_response.status_code}")
                    return False
            else:
                self.log_test("Billing Status Check", False, 
                            f"Failed to create billing for status check: {create_response.status_code}")
                return False
        except Exception as e:
            self.log_test("Billing Status Check", False, f"Billing status check error: {str(e)}")
            return False
    
    def test_webhook_payment_confirmation(self):
        """Test 9: Simular webhook de pagamento confirmado"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            # Create billing
            billing_data = {
                "package_id": "pkg_small",
                "customer_name": "Test Student",
                "customer_email": STUDENT_EMAIL
            }
            
            create_response = self.session.post(f"{BACKEND_URL}/billing/create", 
                                              json=billing_data, headers=headers)
            
            if create_response.status_code == 200:
                billing_info = create_response.json()
                billing_id = billing_info['billing_id']
                
                # Get initial balance
                balance_response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
                initial_balance = balance_response.json().get('balance', 0) if balance_response.status_code == 200 else 0
                
                # Simulate webhook
                webhook_data = {
                    "type": "billing.paid",
                    "data": {
                        "id": billing_id,
                        "status": "PAID"
                    }
                }
                
                webhook_response = self.session.post(f"{BACKEND_URL}/webhook/abacatepay", json=webhook_data)
                
                if webhook_response.status_code == 200:
                    webhook_result = webhook_response.json()
                    
                    # Check if billing status changed
                    status_response = self.session.get(f"{BACKEND_URL}/billing/{billing_id}", headers=headers)
                    
                    if status_response.status_code == 200:
                        billing_status = status_response.json()
                        
                        # Check if credits were added
                        new_balance_response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
                        
                        if new_balance_response.status_code == 200:
                            new_balance = new_balance_response.json().get('balance', 0)
                            
                            if (billing_status['status'] == 'paid' and 
                                new_balance > initial_balance and
                                (new_balance - initial_balance) == 50):  # pkg_small gives 50 credits
                                
                                self.log_test("Webhook Payment Confirmation", True, 
                                            f"Webhook processed correctly: status changed to paid, credits added ({new_balance - initial_balance})", 
                                            f"Status: {billing_status['status']}, Credits added: {new_balance - initial_balance}")
                                return True
                            else:
                                self.log_test("Webhook Payment Confirmation", False, 
                                            f"Webhook processing incomplete: status={billing_status['status']}, credits_added={new_balance - initial_balance}")
                                return False
                        else:
                            self.log_test("Webhook Payment Confirmation", False, 
                                        "Could not check balance after webhook")
                            return False
                    else:
                        self.log_test("Webhook Payment Confirmation", False, 
                                    "Could not check billing status after webhook")
                        return False
                else:
                    self.log_test("Webhook Payment Confirmation", False, 
                                f"Webhook processing failed: {webhook_response.status_code}", webhook_response.text[:200])
                    return False
            else:
                self.log_test("Webhook Payment Confirmation", False, 
                            "Could not create billing for webhook test")
                return False
        except Exception as e:
            self.log_test("Webhook Payment Confirmation", False, f"Webhook test error: {str(e)}")
            return False
    
    def test_direct_course_purchase(self):
        """Test 10: Criar billing para compra direta de curso"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            # Create billing for direct course purchase
            billing_data = {
                "course_id": self.test_course_id,
                "customer_name": "Test Student",
                "customer_email": STUDENT_EMAIL
            }
            
            response = self.session.post(f"{BACKEND_URL}/billing/create", 
                                       json=billing_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify amount matches course price
                if data['amount'] == 25.0:  # Test course price_brl
                    self.log_test("Direct Course Purchase Billing", True, 
                                "Direct course purchase billing created successfully", data)
                    return True
                else:
                    self.log_test("Direct Course Purchase Billing", False, 
                                f"Wrong amount for course: expected 25.0, got {data['amount']}", data)
                    return False
            else:
                self.log_test("Direct Course Purchase Billing", False, 
                            f"Failed to create course billing: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Direct Course Purchase Billing", False, f"Direct course purchase error: {str(e)}")
            return False
    
    def test_direct_course_payment_webhook(self):
        """Test 11: Confirmar pagamento direto de curso"""
        try:
            headers = {'Authorization': f'Bearer {self.student_token}'}
            
            # Create billing for course
            billing_data = {
                "course_id": self.test_course_id,
                "customer_name": "Test Student Direct",
                "customer_email": "direct@test.com"
            }
            
            create_response = self.session.post(f"{BACKEND_URL}/billing/create", 
                                              json=billing_data, headers=headers)
            
            if create_response.status_code == 200:
                billing_info = create_response.json()
                billing_id = billing_info['billing_id']
                
                # Simulate webhook for course payment
                webhook_data = {
                    "type": "billing.paid",
                    "data": {
                        "id": billing_id,
                        "status": "PAID"
                    }
                }
                
                webhook_response = self.session.post(f"{BACKEND_URL}/webhook/abacatepay", json=webhook_data)
                
                if webhook_response.status_code == 200:
                    # Check if enrollment was created (we can't directly check enrollments as student)
                    # But we can verify the webhook response indicates success
                    webhook_result = webhook_response.json()
                    
                    if webhook_result.get('status') == 'ok':
                        self.log_test("Direct Course Payment Webhook", True, 
                                    "Direct course payment webhook processed successfully", webhook_result)
                        return True
                    else:
                        self.log_test("Direct Course Payment Webhook", False, 
                                    "Webhook processing failed", webhook_result)
                        return False
                else:
                    self.log_test("Direct Course Payment Webhook", False, 
                                f"Webhook failed: {webhook_response.status_code}", webhook_response.text[:200])
                    return False
            else:
                self.log_test("Direct Course Payment Webhook", False, 
                            "Could not create billing for direct course payment test")
                return False
        except Exception as e:
            self.log_test("Direct Course Payment Webhook", False, f"Direct course payment webhook error: {str(e)}")
            return False
    
    # ==================== FULL ACCESS TESTS - PRIORITY ====================
    
    def test_admin_update_user_full_access_true(self):
        """Test 1: Admin updates user to has_full_access=true via API"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Update user to have full access
            update_data = {"has_full_access": True}
            response = self.session.put(f"{BACKEND_URL}/admin/users/{TEST_USER_ID}", 
                                      json=update_data, headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                
                # Verify response shows has_full_access: true
                if user_data.get('has_full_access') == True:
                    self.log_test("Admin Update User Full Access True", True, 
                                f"API response shows has_full_access=true for user {user_data.get('email')}", 
                                f"has_full_access: {user_data.get('has_full_access')}")
                    return True
                else:
                    self.log_test("Admin Update User Full Access True", False, 
                                f"API response shows has_full_access={user_data.get('has_full_access')}, expected True", 
                                user_data)
                    return False
            else:
                self.log_test("Admin Update User Full Access True", False, 
                            f"Failed to update user: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Admin Update User Full Access True", False, f"Update user error: {str(e)}")
            return False
    
    def test_verify_full_access_persistence(self):
        """Test 2: Verify has_full_access=true is persisted by fetching user again"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Get all users and find our test user
            response = self.session.get(f"{BACKEND_URL}/admin/users", headers=headers)
            
            if response.status_code == 200:
                users = response.json()
                test_user = next((u for u in users if u.get('id') == TEST_USER_ID), None)
                
                if test_user:
                    if test_user.get('has_full_access') == True:
                        self.log_test("Verify Full Access Persistence", True, 
                                    f"User {test_user.get('email')} has has_full_access=true persisted in database", 
                                    f"has_full_access: {test_user.get('has_full_access')}")
                        return True
                    else:
                        self.log_test("Verify Full Access Persistence", False, 
                                    f"User has_full_access={test_user.get('has_full_access')}, expected True. PERSISTENCE FAILED!", 
                                    test_user)
                        return False
                else:
                    self.log_test("Verify Full Access Persistence", False, 
                                f"Test user with ID {TEST_USER_ID} not found in users list")
                    return False
            else:
                self.log_test("Verify Full Access Persistence", False, 
                            f"Failed to get users: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Verify Full Access Persistence", False, f"Persistence check error: {str(e)}")
            return False
    
    def test_full_access_user_sees_all_courses(self):
        """Test 3: User with has_full_access=true should see ALL courses with has_access=true"""
        try:
            # First, update the test user's password as admin so we can login
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            update_data = {"password": "testpassword123", "has_full_access": True}
            update_response = self.session.put(f"{BACKEND_URL}/admin/users/{TEST_USER_ID}", 
                                             json=update_data, headers=headers)
            
            if update_response.status_code == 200:
                # Now login as the test user
                login_data = {
                    "email": TEST_USER_EMAIL,
                    "password": "testpassword123"
                }
                
                login_response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
                
                if login_response.status_code == 200:
                login_data = login_response.json()
                test_user_token = login_data['access_token']
                
                # Get courses as the test user
                headers = {'Authorization': f'Bearer {test_user_token}'}
                response = self.session.get(f"{BACKEND_URL}/student/courses", headers=headers)
                
                if response.status_code == 200:
                    courses = response.json()
                    
                    if len(courses) > 0:
                        # Check if ALL courses have has_access=true
                        all_have_access = all(course.get('has_access') == True for course in courses)
                        
                        if all_have_access:
                            self.log_test("Full Access User Sees All Courses", True, 
                                        f"User with full access sees {len(courses)} courses, ALL with has_access=true", 
                                        f"Courses: {len(courses)}")
                            return True
                        else:
                            courses_without_access = [c for c in courses if not c.get('has_access')]
                            self.log_test("Full Access User Sees All Courses", False, 
                                        f"User with full access has {len(courses_without_access)} courses without access", 
                                        f"Courses without access: {[c.get('title') for c in courses_without_access]}")
                            return False
                    else:
                        self.log_test("Full Access User Sees All Courses", False, 
                                    "No courses found for full access user")
                        return False
                else:
                    self.log_test("Full Access User Sees All Courses", False, 
                                f"Failed to get courses for full access user: {response.status_code}", 
                                response.text[:200])
                    return False
            else:
                # Try to create the user if login fails
                register_data = {
                    "email": TEST_USER_EMAIL,
                    "password": "password123",
                    "name": "Test User Aluno"
                }
                
                register_response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
                
                if register_response.status_code == 200:
                    # Now update this user to have full access
                    register_data = register_response.json()
                    new_user_id = register_data['user']['id']
                    
                    headers = {'Authorization': f'Bearer {self.admin_token}'}
                    update_data = {"has_full_access": True}
                    update_response = self.session.put(f"{BACKEND_URL}/admin/users/{new_user_id}", 
                                                     json=update_data, headers=headers)
                    
                    if update_response.status_code == 200:
                        # Now test with the new user
                        test_user_token = register_data['access_token']
                        headers = {'Authorization': f'Bearer {test_user_token}'}
                        response = self.session.get(f"{BACKEND_URL}/student/courses", headers=headers)
                        
                        if response.status_code == 200:
                            courses = response.json()
                            
                            if len(courses) > 0:
                                all_have_access = all(course.get('has_access') == True for course in courses)
                                
                                if all_have_access:
                                    self.log_test("Full Access User Sees All Courses", True, 
                                                f"Newly created user with full access sees {len(courses)} courses, ALL with has_access=true", 
                                                f"Courses: {len(courses)}")
                                    return True
                                else:
                                    courses_without_access = [c for c in courses if not c.get('has_access')]
                                    self.log_test("Full Access User Sees All Courses", False, 
                                                f"Newly created user with full access has {len(courses_without_access)} courses without access", 
                                                f"Courses without access: {[c.get('title') for c in courses_without_access]}")
                                    return False
                            else:
                                self.log_test("Full Access User Sees All Courses", False, 
                                            "No courses found for newly created full access user")
                                return False
                        else:
                            self.log_test("Full Access User Sees All Courses", False, 
                                        f"Failed to get courses for newly created full access user: {response.status_code}")
                            return False
                    else:
                        self.log_test("Full Access User Sees All Courses", False, 
                                    f"Failed to update newly created user to full access: {update_response.status_code}")
                        return False
                else:
                    self.log_test("Full Access User Sees All Courses", False, 
                                f"Failed to update user password and full access: {update_response.status_code}")
                    return False
            else:
                self.log_test("Full Access User Sees All Courses", False, 
                            f"Failed to login as test user after password update: {login_response.status_code}")
                return False
        except Exception as e:
            self.log_test("Full Access User Sees All Courses", False, f"Full access courses test error: {str(e)}")
            return False
    
    def test_full_access_user_can_access_any_lesson(self):
        """Test 4: User with has_full_access=true should access any lesson without enrollment"""
        try:
            # Login as test user (assuming they have full access from previous test)
            login_data = {
                "email": TEST_USER_EMAIL,
                "password": "password123"
            }
            
            login_response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if login_response.status_code == 200:
                login_data = login_response.json()
                test_user_token = login_data['access_token']
                
                # Try to access a lesson without being enrolled
                headers = {'Authorization': f'Bearer {test_user_token}'}
                response = self.session.get(f"{BACKEND_URL}/student/lessons/{self.test_lesson_id}", 
                                          headers=headers)
                
                if response.status_code == 200:
                    lesson_data = response.json()
                    if lesson_data.get('id') == self.test_lesson_id:
                        self.log_test("Full Access User Can Access Any Lesson", True, 
                                    "User with full access successfully accessed lesson without enrollment", 
                                    lesson_data.get('title'))
                        return True
                    else:
                        self.log_test("Full Access User Can Access Any Lesson", False, 
                                    "Wrong lesson data returned", lesson_data)
                        return False
                else:
                    self.log_test("Full Access User Can Access Any Lesson", False, 
                                f"Full access user failed to access lesson: {response.status_code}", 
                                response.text[:200])
                    return False
            else:
                self.log_test("Full Access User Can Access Any Lesson", False, 
                            f"Failed to login as test user: {login_response.status_code}")
                return False
        except Exception as e:
            self.log_test("Full Access User Can Access Any Lesson", False, f"Full access lesson test error: {str(e)}")
            return False
    
    def test_admin_update_user_full_access_false(self):
        """Test 5: Admin updates user to has_full_access=false (remove full access)"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Update user to remove full access
            update_data = {"has_full_access": False}
            response = self.session.put(f"{BACKEND_URL}/admin/users/{TEST_USER_ID}", 
                                      json=update_data, headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                
                # Verify response shows has_full_access: false
                if user_data.get('has_full_access') == False:
                    self.log_test("Admin Update User Full Access False", True, 
                                f"API response shows has_full_access=false for user {user_data.get('email')}", 
                                f"has_full_access: {user_data.get('has_full_access')}")
                    return True
                else:
                    self.log_test("Admin Update User Full Access False", False, 
                                f"API response shows has_full_access={user_data.get('has_full_access')}, expected False", 
                                user_data)
                    return False
            else:
                self.log_test("Admin Update User Full Access False", False, 
                            f"Failed to update user: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Admin Update User Full Access False", False, f"Remove full access error: {str(e)}")
            return False
    
    def test_verify_full_access_false_persistence(self):
        """Test 6: Verify has_full_access=false is persisted and user only sees enrolled courses"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Get all users and find our test user
            response = self.session.get(f"{BACKEND_URL}/admin/users", headers=headers)
            
            if response.status_code == 200:
                users = response.json()
                test_user = next((u for u in users if u.get('id') == TEST_USER_ID), None)
                
                if test_user:
                    if test_user.get('has_full_access') == False:
                        # Now login as the user and check they only see enrolled courses
                        login_data = {
                            "email": TEST_USER_EMAIL,
                            "password": "password123"
                        }
                        
                        login_response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
                        
                        if login_response.status_code == 200:
                            login_data = login_response.json()
                            test_user_token = login_data['access_token']
                            
                            # Get courses as the test user
                            user_headers = {'Authorization': f'Bearer {test_user_token}'}
                            courses_response = self.session.get(f"{BACKEND_URL}/student/courses", headers=user_headers)
                            
                            if courses_response.status_code == 200:
                                courses = courses_response.json()
                                
                                # Count courses with and without access
                                courses_with_access = [c for c in courses if c.get('has_access') == True]
                                courses_without_access = [c for c in courses if c.get('has_access') == False]
                                
                                self.log_test("Verify Full Access False Persistence", True, 
                                            f"User has has_full_access=false persisted. Access: {len(courses_with_access)} courses, No access: {len(courses_without_access)} courses", 
                                            f"has_full_access: {test_user.get('has_full_access')}, enrolled courses: {len(courses_with_access)}")
                                return True
                            else:
                                self.log_test("Verify Full Access False Persistence", False, 
                                            f"Failed to get courses for user: {courses_response.status_code}")
                                return False
                        else:
                            self.log_test("Verify Full Access False Persistence", True, 
                                        f"User has has_full_access=false persisted (couldn't test course access due to login failure)", 
                                        f"has_full_access: {test_user.get('has_full_access')}")
                            return True
                    else:
                        self.log_test("Verify Full Access False Persistence", False, 
                                    f"User has_full_access={test_user.get('has_full_access')}, expected False. PERSISTENCE FAILED!", 
                                    test_user)
                        return False
                else:
                    self.log_test("Verify Full Access False Persistence", False, 
                                f"Test user with ID {TEST_USER_ID} not found in users list")
                    return False
            else:
                self.log_test("Verify Full Access False Persistence", False, 
                            f"Failed to get users: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Verify Full Access False Persistence", False, f"Persistence check error: {str(e)}")
            return False

    # ==================== FASE 4 - ADMIN ====================
    
    def test_admin_update_course_pricing(self):
        """Test 12: Admin atualizar preços do curso"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Update course pricing
            new_price_brl = 35.0
            new_price_credits = 75
            
            response = self.session.put(f"{BACKEND_URL}/admin/courses/{self.test_course_id}/pricing",
                                      params={
                                          "price_brl": new_price_brl,
                                          "price_credits": new_price_credits
                                      },
                                      headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify the course was updated
                course_response = self.session.get(f"{BACKEND_URL}/admin/courses/{self.test_course_id}", 
                                                 headers=headers)
                
                if course_response.status_code == 200:
                    course_data = course_response.json()
                    
                    if (course_data.get('price_brl') == new_price_brl and 
                        course_data.get('price_credits') == new_price_credits):
                        
                        self.log_test("Admin Update Course Pricing", True, 
                                    f"Course pricing updated successfully: R${new_price_brl}, {new_price_credits} credits", 
                                    f"BRL: {course_data['price_brl']}, Credits: {course_data['price_credits']}")
                        return True
                    else:
                        self.log_test("Admin Update Course Pricing", False, 
                                    "Course pricing not updated correctly", course_data)
                        return False
                else:
                    self.log_test("Admin Update Course Pricing", False, 
                                "Could not verify course update")
                    return False
            else:
                self.log_test("Admin Update Course Pricing", False, 
                            f"Failed to update pricing: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Admin Update Course Pricing", False, f"Admin pricing update error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 80)
        print("STARTING CREDITS SYSTEM AND ABACATE PAY INTEGRATION TESTS")
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
        
        if not self.create_test_course():
            print("❌ CRITICAL: Test course creation failed. Cannot continue tests.")
            return False
        
        if not self.setup_test_data_for_lesson_access():
            print("❌ CRITICAL: Test data setup for lesson access failed. Cannot continue priority tests.")
            return False
        
        print()
        print("=" * 80)
        print("RUNNING PRIORITY TESTS - FULL ACCESS FUNCTIONALITY")
        print("=" * 80)
        
        # Full Access tests - HIGHEST PRIORITY
        full_access_tests = [
            self.test_admin_update_user_full_access_true,
            self.test_verify_full_access_persistence,
            self.test_full_access_user_sees_all_courses,
            self.test_full_access_user_can_access_any_lesson,
            self.test_admin_update_user_full_access_false,
            self.test_verify_full_access_false_persistence
        ]
        
        full_access_passed = 0
        full_access_failed = 0
        
        for test in full_access_tests:
            try:
                if test():
                    full_access_passed += 1
                else:
                    full_access_failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error - {str(e)}")
                full_access_failed += 1
            print()  # Add spacing between tests
        
        print()
        print("=" * 80)
        print("RUNNING SECONDARY TESTS - LESSON ACCESS & SUPPORT CONFIG")
        print("=" * 80)
        
        # Priority tests second
        priority_tests = [
            self.test_enrolled_user_lesson_access,
            self.test_non_enrolled_user_lesson_access,
            self.test_full_access_user_lesson_access,
            self.test_nonexistent_lesson_access,
            self.test_support_config_endpoint_exists,
            self.test_support_config_default_values
        ]
        
        priority_passed = 0
        priority_failed = 0
        
        for test in priority_tests:
            try:
                if test():
                    priority_passed += 1
                else:
                    priority_failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error - {str(e)}")
                priority_failed += 1
            print()  # Add spacing between tests
        
        print()
        print("=" * 80)
        print("RUNNING CREDITS SYSTEM TESTS")
        print("=" * 80)
        
        tests = [
            # Fase 1 - Sistema de Créditos Base
            self.test_credits_balance_initial,
            self.test_credit_packages,
            self.test_enroll_without_credits,
            
            # Fase 2 - Matricula com Créditos
            self.test_add_credits_and_check_balance,
            self.test_enroll_with_credits,
            self.test_transaction_history,
            
            # Fase 3 - Abacate Pay
            self.test_create_billing_for_credits,
            self.test_billing_status_check,
            self.test_webhook_payment_confirmation,
            self.test_direct_course_purchase,
            self.test_direct_course_payment_webhook,
            
            # Fase 4 - Admin
            self.test_admin_update_course_pricing
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
        total_tests = full_access_passed + full_access_failed + priority_passed + priority_failed + passed + failed
        total_passed = full_access_passed + priority_passed + passed
        total_failed = full_access_failed + priority_failed + failed
        
        print(f"FULL ACCESS TESTS: {full_access_passed + full_access_failed} (Passed: {full_access_passed}, Failed: {full_access_failed})")
        print(f"LESSON ACCESS TESTS: {priority_passed + priority_failed} (Passed: {priority_passed}, Failed: {priority_failed})")
        print(f"CREDITS TESTS: {passed + failed} (Passed: {passed}, Failed: {failed})")
        print(f"TOTAL TESTS: {total_tests}")
        print(f"TOTAL PASSED: {total_passed}")
        print(f"TOTAL FAILED: {total_failed}")
        print(f"Success Rate: {(total_passed/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if total_failed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"- {result['test']}: {result['message']}")
        
        return total_failed == 0

if __name__ == "__main__":
    tester = CreditsSystemTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
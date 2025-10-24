#!/usr/bin/env python3
"""
Referral System Test Suite
Tests the corrected referral system as specified in test_result.md

New Logic:
1. Referrer gets 10 fixed credits when referred user makes first purchase
2. Referrer gets 50% of ALL credits that referred user earns (purchases, gamification, course completion, etc)
"""

import requests
import json
import time
import sys
import os
from datetime import datetime
import uuid

# Configuration
BACKEND_URL = "https://hyperlearn.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

class ReferralSystemTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        self.test_course_id = None
        self.test_module_id = None
        self.test_lesson_id = None
        
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
    
    def create_test_course(self):
        """Create a test course for referral testing"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            course_data = {
                "title": "Test Course for Referrals",
                "description": "Test course for referral system testing",
                "published": True,
                "price_brl": 25.0,
                "price_credits": 50
            }
            
            response = self.session.post(f"{BACKEND_URL}/admin/courses", 
                                       json=course_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_course_id = data['id']
                
                # Create module and lesson for course completion testing
                module_data = {
                    "title": "Test Module",
                    "description": "Module for testing",
                    "course_id": self.test_course_id,
                    "order": 1
                }
                
                module_response = self.session.post(f"{BACKEND_URL}/admin/modules", 
                                                  json=module_data, headers=headers)
                
                if module_response.status_code == 200:
                    self.test_module_id = module_response.json()['id']
                    
                    lesson_data = {
                        "title": "Test Lesson",
                        "type": "video",
                        "content": "https://example.com/test-video.mp4",
                        "module_id": self.test_module_id,
                        "order": 1
                    }
                    
                    lesson_response = self.session.post(f"{BACKEND_URL}/admin/lessons", 
                                                      json=lesson_data, headers=headers)
                    
                    if lesson_response.status_code == 200:
                        self.test_lesson_id = lesson_response.json()['id']
                        self.log_test("Test Course Creation", True, f"Created test course with module and lesson")
                        return True
                    else:
                        self.log_test("Test Course Creation", False, f"Failed to create lesson: {lesson_response.status_code}")
                        return False
                else:
                    self.log_test("Test Course Creation", False, f"Failed to create module: {module_response.status_code}")
                    return False
            else:
                self.log_test("Test Course Creation", False, 
                            f"Failed to create course: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Test Course Creation", False, f"Course creation error: {str(e)}")
            return False
    
    def create_user_with_referral(self, email, password, name, referral_code=None):
        """Create a user with optional referral code"""
        try:
            register_data = {
                "email": email,
                "password": password,
                "name": name,
                "role": "student"
            }
            
            if referral_code:
                register_data["referral_code"] = referral_code
            
            response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "user_id": data['user']['id'],
                    "token": data['access_token'],
                    "referral_code": data['user']['referral_code']
                }
            else:
                return {
                    "success": False,
                    "error": f"Registration failed: {response.status_code}",
                    "details": response.text[:200]
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Registration error: {str(e)}"
            }
    
    def make_purchase(self, user_token, package_id="pkg_small"):
        """Make a purchase for a user (simulate billing + webhook)"""
        try:
            headers = {'Authorization': f'Bearer {user_token}'}
            
            # Create billing
            billing_data = {
                "package_id": package_id,
                "customer_name": "Test User",
                "customer_email": "test@example.com"
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
                    return {"success": True, "billing_id": billing_id}
                else:
                    return {"success": False, "error": f"Webhook failed: {webhook_response.status_code}"}
            else:
                return {"success": False, "error": f"Billing creation failed: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": f"Purchase error: {str(e)}"}
    
    def get_user_balance(self, user_token):
        """Get user's credit balance"""
        try:
            headers = {'Authorization': f'Bearer {user_token}'}
            response = self.session.get(f"{BACKEND_URL}/credits/balance", headers=headers)
            
            if response.status_code == 200:
                return response.json()
            else:
                return None
        except Exception as e:
            return None
    
    def get_user_transactions(self, user_token):
        """Get user's transaction history"""
        try:
            headers = {'Authorization': f'Bearer {user_token}'}
            response = self.session.get(f"{BACKEND_URL}/credits/transactions", headers=headers)
            
            if response.status_code == 200:
                return response.json().get('transactions', [])
            else:
                return []
        except Exception as e:
            return []
    
    def create_social_post(self, user_token, content="Test post for gamification"):
        """Create a social post to earn gamification credits"""
        try:
            headers = {'Authorization': f'Bearer {user_token}'}
            comment_data = {
                "content": content,
                "parent_id": None,  # Top-level post
                "lesson_id": None   # Social post, not lesson comment
            }
            
            response = self.session.post(f"{BACKEND_URL}/comments", 
                                       json=comment_data, headers=headers)
            
            if response.status_code == 200:
                return {"success": True, "comment_id": response.json()['id']}
            else:
                return {"success": False, "error": f"Post creation failed: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": f"Post creation error: {str(e)}"}
    
    def complete_course(self, user_token, course_id):
        """Simulate course completion by marking progress"""
        try:
            headers = {'Authorization': f'Bearer {user_token}'}
            
            # First enroll in course with credits
            enroll_response = self.session.post(f"{BACKEND_URL}/courses/{course_id}/enroll-with-credits", 
                                              headers=headers)
            
            if enroll_response.status_code == 200:
                # Mark lesson as completed
                progress_data = {
                    "lesson_id": self.test_lesson_id,
                    "completed": True,
                    "last_position": 100
                }
                
                progress_response = self.session.post(f"{BACKEND_URL}/progress", 
                                                    json=progress_data, headers=headers)
                
                if progress_response.status_code == 200:
                    return {"success": True}
                else:
                    return {"success": False, "error": f"Progress update failed: {progress_response.status_code}"}
            else:
                return {"success": False, "error": f"Enrollment failed: {enroll_response.status_code}"}
        except Exception as e:
            return {"success": False, "error": f"Course completion error: {str(e)}"}
    
    # ==================== TEST SCENARIOS ====================
    
    def test_scenario_1_signup_and_first_purchase(self):
        """
        Cenário 1: Cadastro e Primeira Compra
        1. Criar usuário A (referrer) e fazer uma compra para ele
        2. Criar usuário B com código de indicação de A
        3. Usuário B faz primeira compra de créditos
        4. Verificar: Usuário A deve ganhar 10 créditos fixos + 50% dos créditos comprados por B
        """
        try:
            timestamp = str(int(time.time()))
            
            # 1. Create user A (referrer) and make a purchase
            user_a = self.create_user_with_referral(
                f"referrer{timestamp}@test.com", 
                "referrer123", 
                "Referrer User A"
            )
            
            if not user_a["success"]:
                self.log_test("Scenario 1", False, f"Failed to create referrer: {user_a['error']}")
                return False
            
            # Make purchase for user A to set has_purchased=True
            purchase_a = self.make_purchase(user_a["token"])
            if not purchase_a["success"]:
                self.log_test("Scenario 1", False, f"Failed to make purchase for referrer: {purchase_a['error']}")
                return False
            
            # Get initial balance of user A
            initial_balance_a = self.get_user_balance(user_a["token"])
            if not initial_balance_a:
                self.log_test("Scenario 1", False, "Could not get initial balance for referrer")
                return False
            
            # 2. Create user B with referral code from A
            user_b = self.create_user_with_referral(
                f"referred{timestamp}@test.com", 
                "referred123", 
                "Referred User B",
                user_a["referral_code"]
            )
            
            if not user_b["success"]:
                self.log_test("Scenario 1", False, f"Failed to create referred user: {user_b['error']}")
                return False
            
            # 3. User B makes first purchase (pkg_small = 50 credits)
            purchase_b = self.make_purchase(user_b["token"], "pkg_small")
            if not purchase_b["success"]:
                self.log_test("Scenario 1", False, f"Failed to make purchase for referred user: {purchase_b['error']}")
                return False
            
            # Wait a moment for processing
            time.sleep(2)
            
            # 4. Check user A's balance - should have gained 10 + 25 (50% of 50) = 35 credits
            final_balance_a = self.get_user_balance(user_a["token"])
            if not final_balance_a:
                self.log_test("Scenario 1", False, "Could not get final balance for referrer")
                return False
            
            # Calculate expected bonus: 10 (signup) + 25 (50% of 50 credits)
            expected_bonus = 10 + (50 * 50 // 100)  # 10 + 25 = 35
            actual_bonus = final_balance_a["balance"] - initial_balance_a["balance"]
            
            # Check transactions for referrer
            transactions_a = self.get_user_transactions(user_a["token"])
            signup_bonus_found = any("Bônus de cadastro" in t.get("description", "") for t in transactions_a)
            referral_bonus_found = any("Bônus de indicação" in t.get("description", "") for t in transactions_a)
            
            if actual_bonus == expected_bonus and signup_bonus_found and referral_bonus_found:
                self.log_test("Scenario 1", True, 
                            f"✅ Referrer gained correct bonus: {actual_bonus} credits (10 signup + 25 referral)", 
                            f"Expected: {expected_bonus}, Actual: {actual_bonus}")
                return True
            else:
                self.log_test("Scenario 1", False, 
                            f"❌ Incorrect bonus. Expected: {expected_bonus}, Actual: {actual_bonus}. Signup bonus: {signup_bonus_found}, Referral bonus: {referral_bonus_found}")
                return False
                
        except Exception as e:
            self.log_test("Scenario 1", False, f"Scenario 1 error: {str(e)}")
            return False
    
    def test_scenario_2_subsequent_purchases(self):
        """
        Cenário 2: Compras Subsequentes
        1. Usuário B (já fez primeira compra) compra mais créditos
        2. Verificar: Usuário A deve ganhar 50% dos créditos (sem os 10 créditos fixos novamente)
        """
        try:
            timestamp = str(int(time.time()))
            
            # Create and setup users (similar to scenario 1)
            user_a = self.create_user_with_referral(
                f"referrer2_{timestamp}@test.com", 
                "referrer123", 
                "Referrer User A2"
            )
            
            if not user_a["success"]:
                self.log_test("Scenario 2", False, f"Failed to create referrer: {user_a['error']}")
                return False
            
            # Make purchase for user A
            purchase_a = self.make_purchase(user_a["token"])
            if not purchase_a["success"]:
                self.log_test("Scenario 2", False, f"Failed to make purchase for referrer: {purchase_a['error']}")
                return False
            
            # Create user B with referral
            user_b = self.create_user_with_referral(
                f"referred2_{timestamp}@test.com", 
                "referred123", 
                "Referred User B2",
                user_a["referral_code"]
            )
            
            if not user_b["success"]:
                self.log_test("Scenario 2", False, f"Failed to create referred user: {user_b['error']}")
                return False
            
            # User B makes first purchase
            purchase_b1 = self.make_purchase(user_b["token"], "pkg_small")
            if not purchase_b1["success"]:
                self.log_test("Scenario 2", False, f"Failed to make first purchase for referred user: {purchase_b1['error']}")
                return False
            
            time.sleep(2)
            
            # Get balance after first purchase
            balance_after_first = self.get_user_balance(user_a["token"])
            if not balance_after_first:
                self.log_test("Scenario 2", False, "Could not get balance after first purchase")
                return False
            
            # User B makes second purchase (pkg_medium = 150 credits)
            purchase_b2 = self.make_purchase(user_b["token"], "pkg_medium")
            if not purchase_b2["success"]:
                self.log_test("Scenario 2", False, f"Failed to make second purchase for referred user: {purchase_b2['error']}")
                return False
            
            time.sleep(2)
            
            # Check final balance - should only gain 50% of 150 = 75 credits (no signup bonus)
            final_balance = self.get_user_balance(user_a["token"])
            if not final_balance:
                self.log_test("Scenario 2", False, "Could not get final balance")
                return False
            
            bonus_from_second_purchase = final_balance["balance"] - balance_after_first["balance"]
            expected_bonus = 150 * 50 // 100  # 75 credits
            
            # Check that no additional signup bonus was given
            transactions_a = self.get_user_transactions(user_a["token"])
            signup_bonus_count = sum(1 for t in transactions_a if "Bônus de cadastro" in t.get("description", ""))
            
            if bonus_from_second_purchase == expected_bonus and signup_bonus_count == 1:
                self.log_test("Scenario 2", True, 
                            f"✅ Subsequent purchase bonus correct: {bonus_from_second_purchase} credits (50% of 150), no duplicate signup bonus", 
                            f"Expected: {expected_bonus}, Actual: {bonus_from_second_purchase}, Signup bonuses: {signup_bonus_count}")
                return True
            else:
                self.log_test("Scenario 2", False, 
                            f"❌ Incorrect subsequent purchase bonus. Expected: {expected_bonus}, Actual: {bonus_from_second_purchase}, Signup bonuses: {signup_bonus_count}")
                return False
                
        except Exception as e:
            self.log_test("Scenario 2", False, f"Scenario 2 error: {str(e)}")
            return False
    
    def test_scenario_3_gamification_credits(self):
        """
        Cenário 3: Créditos de Gamificação
        1. Usuário B cria um post na comunidade (ganha créditos por gamificação)
        2. Verificar: Usuário A deve ganhar 50% dos créditos ganhos por B
        """
        try:
            timestamp = str(int(time.time()))
            
            # Setup users
            user_a = self.create_user_with_referral(
                f"referrer3_{timestamp}@test.com", 
                "referrer123", 
                "Referrer User A3"
            )
            
            if not user_a["success"]:
                self.log_test("Scenario 3", False, f"Failed to create referrer: {user_a['error']}")
                return False
            
            # Make purchase for user A
            purchase_a = self.make_purchase(user_a["token"])
            if not purchase_a["success"]:
                self.log_test("Scenario 3", False, f"Failed to make purchase for referrer: {purchase_a['error']}")
                return False
            
            # Create user B with referral
            user_b = self.create_user_with_referral(
                f"referred3_{timestamp}@test.com", 
                "referred123", 
                "Referred User B3",
                user_a["referral_code"]
            )
            
            if not user_b["success"]:
                self.log_test("Scenario 3", False, f"Failed to create referred user: {user_b['error']}")
                return False
            
            # User B makes purchase to enable gamification
            purchase_b = self.make_purchase(user_b["token"], "pkg_small")
            if not purchase_b["success"]:
                self.log_test("Scenario 3", False, f"Failed to make purchase for referred user: {purchase_b['error']}")
                return False
            
            time.sleep(2)
            
            # Get balance before gamification
            balance_before_gamification = self.get_user_balance(user_a["token"])
            if not balance_before_gamification:
                self.log_test("Scenario 3", False, "Could not get balance before gamification")
                return False
            
            # User B creates a social post (should earn gamification credits)
            post_result = self.create_social_post(user_b["token"], "Test post for gamification rewards")
            if not post_result["success"]:
                self.log_test("Scenario 3", False, f"Failed to create social post: {post_result['error']}")
                return False
            
            time.sleep(2)
            
            # Check if user A gained referral bonus from B's gamification
            final_balance = self.get_user_balance(user_a["token"])
            if not final_balance:
                self.log_test("Scenario 3", False, "Could not get final balance")
                return False
            
            gamification_bonus = final_balance["balance"] - balance_before_gamification["balance"]
            
            # Check transactions for gamification-related referral bonus
            transactions_a = self.get_user_transactions(user_a["token"])
            gamification_referral_found = any(
                "Bônus de indicação" in t.get("description", "") and 
                "ganhou" in t.get("description", "") and
                t.get("amount", 0) > 0
                for t in transactions_a
            )
            
            # Expected: 50% of gamification reward (default is 10 credits for create_post)
            expected_gamification_bonus = 10 * 50 // 100  # 5 credits
            
            if gamification_bonus >= expected_gamification_bonus and gamification_referral_found:
                self.log_test("Scenario 3", True, 
                            f"✅ Gamification referral bonus working: {gamification_bonus} credits gained", 
                            f"Expected at least: {expected_gamification_bonus}, Actual: {gamification_bonus}")
                return True
            else:
                self.log_test("Scenario 3", False, 
                            f"❌ Gamification referral bonus not working. Bonus: {gamification_bonus}, Referral found: {gamification_referral_found}")
                return False
                
        except Exception as e:
            self.log_test("Scenario 3", False, f"Scenario 3 error: {str(e)}")
            return False
    
    def test_scenario_4_course_completion_credits(self):
        """
        Cenário 4: Créditos de Conclusão de Curso
        1. Usuário B completa um curso (ganha créditos por conclusão)
        2. Verificar: Usuário A deve ganhar 50% dos créditos ganhos por B
        """
        try:
            timestamp = str(int(time.time()))
            
            # Setup users
            user_a = self.create_user_with_referral(
                f"referrer4_{timestamp}@test.com", 
                "referrer123", 
                "Referrer User A4"
            )
            
            if not user_a["success"]:
                self.log_test("Scenario 4", False, f"Failed to create referrer: {user_a['error']}")
                return False
            
            # Make purchase for user A
            purchase_a = self.make_purchase(user_a["token"])
            if not purchase_a["success"]:
                self.log_test("Scenario 4", False, f"Failed to make purchase for referrer: {purchase_a['error']}")
                return False
            
            # Create user B with referral
            user_b = self.create_user_with_referral(
                f"referred4_{timestamp}@test.com", 
                "referred123", 
                "Referred User B4",
                user_a["referral_code"]
            )
            
            if not user_b["success"]:
                self.log_test("Scenario 4", False, f"Failed to create referred user: {user_b['error']}")
                return False
            
            # User B makes purchase to enable gamification and get credits for course enrollment
            purchase_b = self.make_purchase(user_b["token"], "pkg_medium")  # 150 credits
            if not purchase_b["success"]:
                self.log_test("Scenario 4", False, f"Failed to make purchase for referred user: {purchase_b['error']}")
                return False
            
            time.sleep(2)
            
            # Get balance before course completion
            balance_before_completion = self.get_user_balance(user_a["token"])
            if not balance_before_completion:
                self.log_test("Scenario 4", False, "Could not get balance before course completion")
                return False
            
            # User B completes course (should earn completion credits)
            completion_result = self.complete_course(user_b["token"], self.test_course_id)
            if not completion_result["success"]:
                self.log_test("Scenario 4", False, f"Failed to complete course: {completion_result['error']}")
                return False
            
            time.sleep(2)
            
            # Check if user A gained referral bonus from B's course completion
            final_balance = self.get_user_balance(user_a["token"])
            if not final_balance:
                self.log_test("Scenario 4", False, "Could not get final balance")
                return False
            
            completion_bonus = final_balance["balance"] - balance_before_completion["balance"]
            
            # Check transactions for course completion referral bonus
            transactions_a = self.get_user_transactions(user_a["token"])
            completion_referral_found = any(
                "Bônus de indicação" in t.get("description", "") and 
                t.get("amount", 0) > 0
                for t in transactions_a
            )
            
            # Expected: 50% of course completion reward (default is 30 credits)
            expected_completion_bonus = 30 * 50 // 100  # 15 credits
            
            if completion_bonus >= expected_completion_bonus and completion_referral_found:
                self.log_test("Scenario 4", True, 
                            f"✅ Course completion referral bonus working: {completion_bonus} credits gained", 
                            f"Expected at least: {expected_completion_bonus}, Actual: {completion_bonus}")
                return True
            else:
                self.log_test("Scenario 4", False, 
                            f"❌ Course completion referral bonus not working. Bonus: {completion_bonus}, Referral found: {completion_referral_found}")
                return False
                
        except Exception as e:
            self.log_test("Scenario 4", False, f"Scenario 4 error: {str(e)}")
            return False
    
    def test_scenario_5_referrer_without_purchase(self):
        """
        Cenário 5: Referrer Sem Compra
        1. Criar usuário C (referrer sem compra)
        2. Criar usuário D com código de indicação de C
        3. Usuário D faz compra
        4. Verificar: Usuário C NÃO deve ganhar bônus (precisa ter feito compra primeiro)
        """
        try:
            timestamp = str(int(time.time()))
            
            # 1. Create user C (referrer WITHOUT purchase)
            user_c = self.create_user_with_referral(
                f"referrer_no_purchase_{timestamp}@test.com", 
                "referrer123", 
                "Referrer User C (No Purchase)"
            )
            
            if not user_c["success"]:
                self.log_test("Scenario 5", False, f"Failed to create referrer: {user_c['error']}")
                return False
            
            # Get initial balance of user C (should be 0)
            initial_balance_c = self.get_user_balance(user_c["token"])
            if not initial_balance_c:
                self.log_test("Scenario 5", False, "Could not get initial balance for referrer")
                return False
            
            # 2. Create user D with referral code from C
            user_d = self.create_user_with_referral(
                f"referred_to_no_purchase_{timestamp}@test.com", 
                "referred123", 
                "Referred User D",
                user_c["referral_code"]
            )
            
            if not user_d["success"]:
                self.log_test("Scenario 5", False, f"Failed to create referred user: {user_d['error']}")
                return False
            
            # 3. User D makes purchase
            purchase_d = self.make_purchase(user_d["token"], "pkg_small")
            if not purchase_d["success"]:
                self.log_test("Scenario 5", False, f"Failed to make purchase for referred user: {purchase_d['error']}")
                return False
            
            time.sleep(2)
            
            # 4. Check user C's balance - should NOT have gained any bonus
            final_balance_c = self.get_user_balance(user_c["token"])
            if not final_balance_c:
                self.log_test("Scenario 5", False, "Could not get final balance for referrer")
                return False
            
            bonus_gained = final_balance_c["balance"] - initial_balance_c["balance"]
            
            # Check transactions - should have NO referral bonuses
            transactions_c = self.get_user_transactions(user_c["token"])
            referral_bonuses = [t for t in transactions_c if "Bônus" in t.get("description", "")]
            
            if bonus_gained == 0 and len(referral_bonuses) == 0:
                self.log_test("Scenario 5", True, 
                            f"✅ Referrer without purchase correctly received no bonus: {bonus_gained} credits", 
                            f"Referral bonuses found: {len(referral_bonuses)}")
                return True
            else:
                self.log_test("Scenario 5", False, 
                            f"❌ Referrer without purchase incorrectly received bonus: {bonus_gained} credits, bonuses: {len(referral_bonuses)}")
                return False
                
        except Exception as e:
            self.log_test("Scenario 5", False, f"Scenario 5 error: {str(e)}")
            return False
    
    def test_scenario_6_credit_spending(self):
        """
        Cenário 6: Gastos de Créditos
        1. Usuário B gasta créditos para matricular em curso
        2. Verificar: Usuário A NÃO deve receber bônus negativo (apenas ganhos contam)
        """
        try:
            timestamp = str(int(time.time()))
            
            # Setup users
            user_a = self.create_user_with_referral(
                f"referrer6_{timestamp}@test.com", 
                "referrer123", 
                "Referrer User A6"
            )
            
            if not user_a["success"]:
                self.log_test("Scenario 6", False, f"Failed to create referrer: {user_a['error']}")
                return False
            
            # Make purchase for user A
            purchase_a = self.make_purchase(user_a["token"])
            if not purchase_a["success"]:
                self.log_test("Scenario 6", False, f"Failed to make purchase for referrer: {purchase_a['error']}")
                return False
            
            # Create user B with referral
            user_b = self.create_user_with_referral(
                f"referred6_{timestamp}@test.com", 
                "referred123", 
                "Referred User B6",
                user_a["referral_code"]
            )
            
            if not user_b["success"]:
                self.log_test("Scenario 6", False, f"Failed to create referred user: {user_b['error']}")
                return False
            
            # User B makes purchase to get credits
            purchase_b = self.make_purchase(user_b["token"], "pkg_medium")  # 150 credits
            if not purchase_b["success"]:
                self.log_test("Scenario 6", False, f"Failed to make purchase for referred user: {purchase_b['error']}")
                return False
            
            time.sleep(2)
            
            # Get balance after purchase (should include referral bonuses)
            balance_after_purchase = self.get_user_balance(user_a["token"])
            if not balance_after_purchase:
                self.log_test("Scenario 6", False, "Could not get balance after purchase")
                return False
            
            # User B spends credits on course enrollment
            headers_b = {'Authorization': f'Bearer {user_b["token"]}'}
            enroll_response = self.session.post(f"{BACKEND_URL}/courses/{self.test_course_id}/enroll-with-credits", 
                                              headers=headers_b)
            
            if enroll_response.status_code != 200:
                self.log_test("Scenario 6", False, f"Failed to enroll user B in course: {enroll_response.status_code}")
                return False
            
            time.sleep(2)
            
            # Check user A's balance - should NOT have decreased due to B's spending
            final_balance = self.get_user_balance(user_a["token"])
            if not final_balance:
                self.log_test("Scenario 6", False, "Could not get final balance")
                return False
            
            balance_change = final_balance["balance"] - balance_after_purchase["balance"]
            
            # Check transactions - should have NO negative referral bonuses
            transactions_a = self.get_user_transactions(user_a["token"])
            negative_referral_bonuses = [
                t for t in transactions_a 
                if "Bônus de indicação" in t.get("description", "") and t.get("amount", 0) < 0
            ]
            
            if balance_change >= 0 and len(negative_referral_bonuses) == 0:
                self.log_test("Scenario 6", True, 
                            f"✅ No negative referral bonus for spending: balance change {balance_change}", 
                            f"Negative referral bonuses: {len(negative_referral_bonuses)}")
                return True
            else:
                self.log_test("Scenario 6", False, 
                            f"❌ Incorrect handling of spending. Balance change: {balance_change}, Negative bonuses: {len(negative_referral_bonuses)}")
                return False
                
        except Exception as e:
            self.log_test("Scenario 6", False, f"Scenario 6 error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all referral system tests"""
        print("=" * 80)
        print("STARTING REFERRAL SYSTEM TESTS")
        print("=" * 80)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Admin Email: {ADMIN_EMAIL}")
        print()
        
        # Setup phase
        if not self.setup_admin_user():
            print("❌ CRITICAL: Admin setup failed. Cannot continue tests.")
            return False
        
        if not self.create_test_course():
            print("❌ CRITICAL: Test course creation failed. Cannot continue tests.")
            return False
        
        print()
        print("=" * 80)
        print("RUNNING REFERRAL SYSTEM TEST SCENARIOS")
        print("=" * 80)
        
        tests = [
            ("Cenário 1: Cadastro e Primeira Compra", self.test_scenario_1_signup_and_first_purchase),
            ("Cenário 2: Compras Subsequentes", self.test_scenario_2_subsequent_purchases),
            ("Cenário 3: Créditos de Gamificação", self.test_scenario_3_gamification_credits),
            ("Cenário 4: Créditos de Conclusão de Curso", self.test_scenario_4_course_completion_credits),
            ("Cenário 5: Referrer Sem Compra", self.test_scenario_5_referrer_without_purchase),
            ("Cenário 6: Gastos de Créditos", self.test_scenario_6_credit_spending)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            print(f"\n--- {test_name} ---")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test_name}: Unexpected error - {str(e)}")
                failed += 1
            print()
        
        print("=" * 80)
        print("REFERRAL SYSTEM TEST SUMMARY")
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
    tester = ReferralSystemTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
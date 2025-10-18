#!/usr/bin/env python3
"""
Focused Referral System Test - Testing the specific scenarios mentioned by the user
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
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

class FocusedReferralTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_course_id = None
        self.test_module_id = None
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
    
    def create_test_course(self):
        """Create a test course for completion testing"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            course_data = {
                "title": "Test Course for Referral Completion",
                "description": "Test course for referral completion testing",
                "published": True,
                "price_brl": 30.0,
                "price_credits": 60
            }
            
            response = self.session.post(f"{BACKEND_URL}/admin/courses", 
                                       json=course_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_course_id = data['id']
                
                # Create module
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
                    
                    # Create lesson
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
                        self.log_test("Test Course Creation", True, f"Created test course: {data['title']}")
                        return True
                    else:
                        self.log_test("Test Course Creation", False, 
                                    f"Failed to create lesson: {lesson_response.status_code}")
                        return False
                else:
                    self.log_test("Test Course Creation", False, 
                                f"Failed to create module: {module_response.status_code}")
                    return False
            else:
                self.log_test("Test Course Creation", False, 
                            f"Failed to create course: {response.status_code}")
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
    
    def complete_course(self, user_token):
        """Complete the test course"""
        try:
            headers = {'Authorization': f'Bearer {user_token}'}
            
            # First enroll in course using admin
            headers_admin = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Get user info to get user_id
            user_response = self.session.get(f"{BACKEND_URL}/auth/me", headers=headers)
            if user_response.status_code != 200:
                return {"success": False, "error": "Could not get user info"}
            
            user_id = user_response.json()['id']
            
            enrollment_data = {
                "user_id": user_id,
                "course_id": self.test_course_id
            }
            
            enroll_response = self.session.post(f"{BACKEND_URL}/admin/enrollments", 
                                              json=enrollment_data, headers=headers_admin)
            
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
    
    def test_scenario_1_bonus_cadastro(self):
        """
        Cenário 1: Bônus de Cadastro (10 créditos fixos)
        - Criar referrer A com compra
        - Criar indicado B com código de A
        - B faz primeira compra
        - Verificar: A deve ganhar 10 créditos fixos + 50% dos créditos comprados
        """
        try:
            timestamp = str(int(time.time()))
            
            # Create referrer A and make purchase
            user_a = self.create_user_with_referral(
                f"referrer_a_{timestamp}@test.com", 
                "password123", 
                "Referrer A"
            )
            
            if not user_a["success"]:
                self.log_test("Cenário 1", False, f"Failed to create referrer A: {user_a['error']}")
                return False
            
            # Make purchase for A to set has_purchased=True
            purchase_a = self.make_purchase(user_a["token"])
            if not purchase_a["success"]:
                self.log_test("Cenário 1", False, f"Failed to make purchase for referrer A: {purchase_a['error']}")
                return False
            
            # Get initial balance of A
            initial_balance_a = self.get_user_balance(user_a["token"])
            if not initial_balance_a:
                self.log_test("Cenário 1", False, "Could not get initial balance for referrer A")
                return False
            
            # Create referred user B with A's referral code
            user_b = self.create_user_with_referral(
                f"referred_b_{timestamp}@test.com", 
                "password123", 
                "Referred B",
                user_a["referral_code"]
            )
            
            if not user_b["success"]:
                self.log_test("Cenário 1", False, f"Failed to create referred user B: {user_b['error']}")
                return False
            
            # B makes first purchase (pkg_small = 50 credits)
            purchase_b = self.make_purchase(user_b["token"], "pkg_small")
            if not purchase_b["success"]:
                self.log_test("Cenário 1", False, f"Failed to make purchase for referred user B: {purchase_b['error']}")
                return False
            
            # Wait for processing
            time.sleep(3)
            
            # Check A's balance - should have gained 10 + 25 (50% of 50) = 35 credits
            final_balance_a = self.get_user_balance(user_a["token"])
            if not final_balance_a:
                self.log_test("Cenário 1", False, "Could not get final balance for referrer A")
                return False
            
            credits_gained = final_balance_a["balance"] - initial_balance_a["balance"]
            expected_credits = 10 + (50 * 50 // 100)  # 10 signup + 25 referral = 35
            
            # Check transactions
            transactions_a = self.get_user_transactions(user_a["token"])
            signup_bonus_found = any("Bônus de cadastro" in t.get("description", "") for t in transactions_a)
            referral_bonus_found = any("Bônus de indicação" in t.get("description", "") for t in transactions_a)
            
            if credits_gained == expected_credits and signup_bonus_found and referral_bonus_found:
                self.log_test("Cenário 1", True, 
                            f"A ganhou {credits_gained} créditos (10 cadastro + 25 indicação)", 
                            f"Esperado: {expected_credits}, Atual: {credits_gained}")
                return True
            else:
                self.log_test("Cenário 1", False, 
                            f"Créditos incorretos. Esperado: {expected_credits}, Atual: {credits_gained}. Cadastro: {signup_bonus_found}, Indicação: {referral_bonus_found}")
                return False
                
        except Exception as e:
            self.log_test("Cenário 1", False, f"Erro: {str(e)}")
            return False
    
    def test_scenario_2_compras_subsequentes(self):
        """
        Cenário 2: Compras Subsequentes
        - B faz segunda compra
        - Verificar: A deve ganhar 50% (sem os 10 créditos novamente)
        """
        try:
            timestamp = str(int(time.time()))
            
            # Setup users (similar to scenario 1)
            user_a = self.create_user_with_referral(
                f"referrer_a2_{timestamp}@test.com", 
                "password123", 
                "Referrer A2"
            )
            
            if not user_a["success"]:
                self.log_test("Cenário 2", False, f"Failed to create referrer A: {user_a['error']}")
                return False
            
            # Make purchase for A
            purchase_a = self.make_purchase(user_a["token"])
            if not purchase_a["success"]:
                self.log_test("Cenário 2", False, f"Failed to make purchase for referrer A: {purchase_a['error']}")
                return False
            
            # Create user B
            user_b = self.create_user_with_referral(
                f"referred_b2_{timestamp}@test.com", 
                "password123", 
                "Referred B2",
                user_a["referral_code"]
            )
            
            if not user_b["success"]:
                self.log_test("Cenário 2", False, f"Failed to create referred user B: {user_b['error']}")
                return False
            
            # B makes first purchase
            purchase_b1 = self.make_purchase(user_b["token"], "pkg_small")
            if not purchase_b1["success"]:
                self.log_test("Cenário 2", False, f"Failed to make first purchase for B: {purchase_b1['error']}")
                return False
            
            time.sleep(3)
            
            # Get balance after first purchase
            balance_after_first = self.get_user_balance(user_a["token"])
            if not balance_after_first:
                self.log_test("Cenário 2", False, "Could not get balance after first purchase")
                return False
            
            # B makes second purchase (pkg_medium = 150 credits)
            purchase_b2 = self.make_purchase(user_b["token"], "pkg_medium")
            if not purchase_b2["success"]:
                self.log_test("Cenário 2", False, f"Failed to make second purchase for B: {purchase_b2['error']}")
                return False
            
            time.sleep(3)
            
            # Check final balance - should only gain 50% of 150 = 75 credits (no signup bonus)
            final_balance = self.get_user_balance(user_a["token"])
            if not final_balance:
                self.log_test("Cenário 2", False, "Could not get final balance")
                return False
            
            bonus_from_second_purchase = final_balance["balance"] - balance_after_first["balance"]
            expected_bonus = 150 * 50 // 100  # 75 credits
            
            # Check that no additional signup bonus was given
            transactions_a = self.get_user_transactions(user_a["token"])
            signup_bonus_count = sum(1 for t in transactions_a if "Bônus de cadastro" in t.get("description", ""))
            
            if bonus_from_second_purchase == expected_bonus and signup_bonus_count == 1:
                self.log_test("Cenário 2", True, 
                            f"A ganhou {bonus_from_second_purchase} créditos da segunda compra (50% de 150), sem bônus duplicado", 
                            f"Esperado: {expected_bonus}, Atual: {bonus_from_second_purchase}, Bônus cadastro: {signup_bonus_count}")
                return True
            else:
                self.log_test("Cenário 2", False, 
                            f"Bônus incorreto. Esperado: {expected_bonus}, Atual: {bonus_from_second_purchase}, Bônus cadastro: {signup_bonus_count}")
                return False
                
        except Exception as e:
            self.log_test("Cenário 2", False, f"Erro: {str(e)}")
            return False
    
    def test_scenario_4_conclusao_curso(self):
        """
        Cenário 4: Conclusão de Curso
        - B completa um curso (marca todas as aulas como completed)
        - Verificar: A deve ganhar 50% dos créditos de conclusão que B ganhou
        """
        try:
            timestamp = str(int(time.time()))
            
            # Setup users
            user_a = self.create_user_with_referral(
                f"referrer_a4_{timestamp}@test.com", 
                "password123", 
                "Referrer A4"
            )
            
            if not user_a["success"]:
                self.log_test("Cenário 4", False, f"Failed to create referrer A: {user_a['error']}")
                return False
            
            # Make purchase for A
            purchase_a = self.make_purchase(user_a["token"])
            if not purchase_a["success"]:
                self.log_test("Cenário 4", False, f"Failed to make purchase for referrer A: {purchase_a['error']}")
                return False
            
            # Create user B
            user_b = self.create_user_with_referral(
                f"referred_b4_{timestamp}@test.com", 
                "password123", 
                "Referred B4",
                user_a["referral_code"]
            )
            
            if not user_b["success"]:
                self.log_test("Cenário 4", False, f"Failed to create referred user B: {user_b['error']}")
                return False
            
            # B makes purchase to enable gamification
            purchase_b = self.make_purchase(user_b["token"], "pkg_small")
            if not purchase_b["success"]:
                self.log_test("Cenário 4", False, f"Failed to make purchase for B: {purchase_b['error']}")
                return False
            
            time.sleep(3)
            
            # Get balance before course completion
            balance_before_completion = self.get_user_balance(user_a["token"])
            if not balance_before_completion:
                self.log_test("Cenário 4", False, "Could not get balance before course completion")
                return False
            
            # B completes course
            completion_result = self.complete_course(user_b["token"])
            if not completion_result["success"]:
                self.log_test("Cenário 4", False, f"Failed to complete course: {completion_result['error']}")
                return False
            
            time.sleep(3)
            
            # Check if A gained referral bonus from B's course completion
            final_balance = self.get_user_balance(user_a["token"])
            if not final_balance:
                self.log_test("Cenário 4", False, "Could not get final balance")
                return False
            
            completion_bonus = final_balance["balance"] - balance_before_completion["balance"]
            
            # Check transactions for course completion referral bonus
            transactions_a = self.get_user_transactions(user_a["token"])
            completion_referral_found = any(
                "Bônus de indicação" in t.get("description", "") and 
                t.get("amount", 0) > 0
                for t in transactions_a
            )
            
            # Expected: 50% of course completion reward (current setting is 5 credits)
            expected_completion_bonus = 5 * 50 // 100  # 2.5 -> 2 credits (rounded down)
            
            if completion_bonus >= expected_completion_bonus and completion_referral_found:
                self.log_test("Cenário 4", True, 
                            f"A ganhou {completion_bonus} créditos da conclusão do curso por B", 
                            f"Esperado pelo menos: {expected_completion_bonus}, Atual: {completion_bonus}")
                return True
            else:
                self.log_test("Cenário 4", False, 
                            f"Bônus de conclusão não funcionando. Bônus: {completion_bonus}, Referral encontrado: {completion_referral_found}")
                return False
                
        except Exception as e:
            self.log_test("Cenário 4", False, f"Erro: {str(e)}")
            return False
    
    def run_focused_tests(self):
        """Run the focused referral system tests"""
        print("=" * 80)
        print("TESTE FOCADO DO SISTEMA DE INDICAÇÕES - CORREÇÕES")
        print("=" * 80)
        print(f"Backend URL: {BACKEND_URL}")
        print("Testando correções específicas mencionadas pelo usuário")
        print()
        
        # Setup phase
        if not self.setup_admin_user():
            print("❌ CRÍTICO: Setup do admin falhou. Não é possível continuar.")
            return False
        
        if not self.create_test_course():
            print("❌ CRÍTICO: Criação do curso de teste falhou. Não é possível continuar.")
            return False
        
        print()
        print("=" * 80)
        print("EXECUTANDO CENÁRIOS PRIORITÁRIOS")
        print("=" * 80)
        
        tests = [
            ("Cenário 1: Bônus de Cadastro", self.test_scenario_1_bonus_cadastro),
            ("Cenário 2: Compras Subsequentes", self.test_scenario_2_compras_subsequentes),
            ("Cenário 4: Conclusão de Curso", self.test_scenario_4_conclusao_curso)
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
                print(f"❌ FALHA {test_name}: Erro inesperado - {str(e)}")
                failed += 1
            print()
        
        print("=" * 80)
        print("RESUMO DOS TESTES FOCADOS")
        print("=" * 80)
        total_tests = passed + failed
        
        print(f"TOTAL DE TESTES: {total_tests}")
        print(f"APROVADOS: {passed}")
        print(f"FALHARAM: {failed}")
        print(f"Taxa de Sucesso: {(passed/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if failed > 0:
            print("\nTESTES QUE FALHARAM:")
            for result in self.test_results:
                if not result['success']:
                    print(f"- {result['test']}: {result['message']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = FocusedReferralTester()
    success = tester.run_focused_tests()
    sys.exit(0 if success else 1)
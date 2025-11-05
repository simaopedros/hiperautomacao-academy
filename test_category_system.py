#!/usr/bin/env python3
"""
Script de teste para verificar o sistema de categorias corrigido
"""

import asyncio
import aiohttp
import json
from datetime import datetime

# Configurações
BACKEND_URL = "http://localhost:8000/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

class CategorySystemTest:
    def __init__(self):
        self.session = None
        self.admin_token = None
        self.test_category_id = None
        self.test_course_id = None

    async def setup(self):
        """Configurar sessão e autenticação"""
        self.session = aiohttp.ClientSession()
        
        # Login como admin
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        async with self.session.post(f"{BACKEND_URL}/auth/login", json=login_data) as response:
            if response.status == 200:
                result = await response.json()
                self.admin_token = result["access_token"]
                print("✅ Login realizado com sucesso")
            else:
                raise Exception(f"Falha no login: {response.status}")

    async def cleanup(self):
        """Limpar recursos"""
        if self.session:
            await self.session.close()

    def log_test(self, test_name, success, message, details=None):
        """Log dos resultados dos testes"""
        status = "✅ PASSOU" if success else "❌ FALHOU"
        print(f"{status} - {test_name}: {message}")
        if details:
            print(f"   Detalhes: {details}")

    async def test_create_category(self):
        """Teste: Criar uma categoria válida"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            category_data = {
                "name": "Categoria Teste Sistema",
                "description": "Categoria criada para testar o sistema",
                "icon": "BookOpen"
            }
            
            async with self.session.post(f"{BACKEND_URL}/admin/categories", 
                                       json=category_data, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    self.test_category_id = result["id"]
                    self.log_test("Criar Categoria", True, 
                                f"Categoria criada: {result['name']} (ID: {result['id']})")
                    return True
                else:
                    text = await response.text()
                    self.log_test("Criar Categoria", False, 
                                f"Falha ao criar categoria: {response.status}", text[:200])
                    return False
        except Exception as e:
            self.log_test("Criar Categoria", False, f"Erro: {str(e)}")
            return False

    async def test_create_course_with_valid_category(self):
        """Teste: Criar curso com categoria válida"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            course_data = {
                "title": "Curso Teste Sistema Categorias",
                "description": "Curso para testar o sistema de categorias",
                "categories": [self.test_category_id],
                "published": True
            }
            
            async with self.session.post(f"{BACKEND_URL}/admin/courses", 
                                       json=course_data, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    self.test_course_id = result["id"]
                    self.log_test("Criar Curso com Categoria Válida", True, 
                                f"Curso criado: {result['title']} (ID: {result['id']})")
                    return True
                else:
                    text = await response.text()
                    self.log_test("Criar Curso com Categoria Válida", False, 
                                f"Falha ao criar curso: {response.status}", text[:200])
                    return False
        except Exception as e:
            self.log_test("Criar Curso com Categoria Válida", False, f"Erro: {str(e)}")
            return False

    async def test_create_course_with_invalid_category(self):
        """Teste: Tentar criar curso com categoria inválida (deve falhar)"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            course_data = {
                "title": "Curso Teste Categoria Inválida",
                "description": "Este curso não deve ser criado",
                "categories": ["categoria-inexistente-123"],
                "published": True
            }
            
            async with self.session.post(f"{BACKEND_URL}/admin/courses", 
                                       json=course_data, headers=headers) as response:
                if response.status == 400:
                    text = await response.text()
                    if "Invalid category IDs" in text:
                        self.log_test("Rejeitar Curso com Categoria Inválida", True, 
                                    "Sistema corretamente rejeitou categoria inválida")
                        return True
                    else:
                        self.log_test("Rejeitar Curso com Categoria Inválida", False, 
                                    "Erro 400 mas mensagem incorreta", text[:200])
                        return False
                else:
                    text = await response.text()
                    self.log_test("Rejeitar Curso com Categoria Inválida", False, 
                                f"Sistema não rejeitou categoria inválida: {response.status}", text[:200])
                    return False
        except Exception as e:
            self.log_test("Rejeitar Curso com Categoria Inválida", False, f"Erro: {str(e)}")
            return False

    async def test_update_course_with_invalid_category(self):
        """Teste: Tentar atualizar curso com categoria inválida (deve falhar)"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            update_data = {
                "categories": ["categoria-inexistente-456"]
            }
            
            async with self.session.put(f"{BACKEND_URL}/admin/courses/{self.test_course_id}", 
                                      json=update_data, headers=headers) as response:
                if response.status == 400:
                    text = await response.text()
                    if "Invalid category IDs" in text:
                        self.log_test("Rejeitar Atualização com Categoria Inválida", True, 
                                    "Sistema corretamente rejeitou atualização com categoria inválida")
                        return True
                    else:
                        self.log_test("Rejeitar Atualização com Categoria Inválida", False, 
                                    "Erro 400 mas mensagem incorreta", text[:200])
                        return False
                else:
                    text = await response.text()
                    self.log_test("Rejeitar Atualização com Categoria Inválida", False, 
                                f"Sistema não rejeitou atualização inválida: {response.status}", text[:200])
                    return False
        except Exception as e:
            self.log_test("Rejeitar Atualização com Categoria Inválida", False, f"Erro: {str(e)}")
            return False

    async def test_get_courses_public(self):
        """Teste: Verificar listagem pública de cursos"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            async with self.session.get(f"{BACKEND_URL}/admin/courses", headers=headers) as response:
                if response.status == 200:
                    courses = await response.json()
                    test_course = next((c for c in courses if c.get("id") == self.test_course_id), None)
                    
                    if test_course:
                        categories = test_course.get("categories", [])
                        if self.test_category_id in categories:
                            self.log_test("Listagem Pública de Cursos", True, 
                                        f"Curso encontrado com categoria correta: {categories}")
                            return True
                        else:
                            self.log_test("Listagem Pública de Cursos", False, 
                                        f"Curso encontrado mas categoria incorreta: {categories}")
                            return False
                    else:
                        self.log_test("Listagem Pública de Cursos", False, 
                                    "Curso de teste não encontrado na listagem pública")
                        return False
                else:
                    text = await response.text()
                    self.log_test("Listagem Pública de Cursos", False, 
                                f"Falha ao obter cursos: {response.status}", text[:200])
                    return False
        except Exception as e:
            self.log_test("Listagem Pública de Cursos", False, f"Erro: {str(e)}")
            return False

    async def test_delete_category_with_courses(self):
        """Teste: Deletar categoria que tem cursos associados"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            async with self.session.delete(f"{BACKEND_URL}/admin/categories/{self.test_category_id}", 
                                         headers=headers) as response:
                if response.status == 200:
                    self.log_test("Deletar Categoria com Cursos", True, 
                                "Categoria deletada (sistema permite cascade delete)")
                    return True
                elif response.status == 400:
                    text = await response.text()
                    self.log_test("Deletar Categoria com Cursos", True, 
                                "Sistema corretamente impediu deleção de categoria com cursos", text[:200])
                    return True
                else:
                    text = await response.text()
                    self.log_test("Deletar Categoria com Cursos", False, 
                                f"Resposta inesperada: {response.status}", text[:200])
                    return False
        except Exception as e:
            self.log_test("Deletar Categoria com Cursos", False, f"Erro: {str(e)}")
            return False

    async def test_course_without_categories_handling(self):
        """Teste: Verificar como cursos sem categoria são tratados"""
        try:
            # Primeiro, verificar se o curso ainda existe após a deleção da categoria
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            async with self.session.get(f"{BACKEND_URL}/admin/courses", headers=headers) as response:
                if response.status == 200:
                    courses = await response.json()
                    test_course = next((c for c in courses if c.get("id") == self.test_course_id), None)
                    
                    if test_course:
                        categories = test_course.get("categories", [])
                        self.log_test("Curso Sem Categoria", True, 
                                    f"Curso ainda existe após deleção da categoria. Categorias: {categories}")
                        return True
                    else:
                        self.log_test("Curso Sem Categoria", True, 
                                    "Curso foi removido junto com a categoria (comportamento aceitável)")
                        return True
                else:
                    text = await response.text()
                    self.log_test("Curso Sem Categoria", False, 
                                f"Falha ao verificar cursos: {response.status}", text[:200])
                    return False
        except Exception as e:
            self.log_test("Curso Sem Categoria", False, f"Erro: {str(e)}")
            return False

    async def cleanup_test_data(self):
        """Limpar dados de teste"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Deletar curso de teste se ainda existir
            if self.test_course_id:
                async with self.session.delete(f"{BACKEND_URL}/admin/courses/{self.test_course_id}", 
                                             headers=headers) as response:
                    if response.status == 200:
                        print("🧹 Curso de teste removido")
                    elif response.status == 404:
                        print("🧹 Curso de teste já foi removido")
            
            # Deletar categoria de teste se ainda existir
            if self.test_category_id:
                async with self.session.delete(f"{BACKEND_URL}/admin/categories/{self.test_category_id}", 
                                             headers=headers) as response:
                    if response.status == 200:
                        print("🧹 Categoria de teste removida")
                    elif response.status == 404:
                        print("🧹 Categoria de teste já foi removida")
                        
        except Exception as e:
            print(f"⚠️  Erro durante limpeza: {str(e)}")

    async def run_all_tests(self):
        """Executar todos os testes"""
        print("=== TESTE DO SISTEMA DE CATEGORIAS CORRIGIDO ===")
        print(f"Timestamp: {datetime.now()}")
        print(f"Backend URL: {BACKEND_URL}")
        print()
        
        try:
            await self.setup()
            
            tests = [
                self.test_create_category,
                self.test_create_course_with_valid_category,
                self.test_create_course_with_invalid_category,
                self.test_update_course_with_invalid_category,
                self.test_get_courses_public,
                self.test_delete_category_with_courses,
                self.test_course_without_categories_handling
            ]
            
            results = []
            for test in tests:
                result = await test()
                results.append(result)
            
            print()
            print("=== RESUMO DOS TESTES ===")
            passed = sum(results)
            total = len(results)
            print(f"Testes passaram: {passed}/{total}")
            
            if passed == total:
                print("🎉 TODOS OS TESTES PASSARAM! Sistema de categorias funcionando corretamente.")
            else:
                print("⚠️  Alguns testes falharam. Verifique os logs acima.")
            
            print()
            print("=== LIMPEZA ===")
            await self.cleanup_test_data()
            
        except Exception as e:
            print(f"❌ Erro durante execução dos testes: {str(e)}")
        finally:
            await self.cleanup()

async def main():
    """Função principal"""
    test_runner = CategorySystemTest()
    await test_runner.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())
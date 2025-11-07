#!/usr/bin/env python3
"""
Script para verificar e limpar categorias não autorizadas no banco de dados
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime

# Configuração do MongoDB
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = "hiperautomacao_academy"

async def check_and_clean_categories():
    """Verifica e limpa categorias não autorizadas do banco de dados"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    try:
        print("=== VERIFICAÇÃO DE CATEGORIAS ===")
        print(f"Conectado ao MongoDB: {MONGO_URL}")
        print(f"Database: {DATABASE_NAME}")
        print(f"Timestamp: {datetime.now()}")
        print()
        
        # 1. Listar todas as categorias existentes
        print("1. CATEGORIAS EXISTENTES:")
        categories = await db.categories.find({}).to_list(None)
        
        if not categories:
            print("   ❌ Nenhuma categoria encontrada no banco de dados")
        else:
            print(f"   📊 Total de categorias: {len(categories)}")
            for i, cat in enumerate(categories, 1):
                print(f"   {i}. ID: {cat.get('id', 'N/A')} | Nome: {cat.get('name', 'N/A')} | Ícone: {cat.get('icon', 'N/A')}")
        
        print()
        
        # 2. Verificar cursos e suas categorias
        print("2. ANÁLISE DE CURSOS E CATEGORIAS:")
        courses = await db.courses.find({}).to_list(None)
        
        if not courses:
            print("   ❌ Nenhum curso encontrado no banco de dados")
        else:
            print(f"   📚 Total de cursos: {len(courses)}")
            
            # Coletar todas as categorias referenciadas pelos cursos
            referenced_categories = set()
            courses_without_categories = []
            courses_with_invalid_categories = []
            
            valid_category_ids = {cat.get('id') for cat in categories if cat.get('id')}
            
            for course in courses:
                course_id = course.get('id', 'N/A')
                course_title = course.get('title', 'N/A')
                course_categories = course.get('categories', [])
                
                if not course_categories:
                    courses_without_categories.append({
                        'id': course_id,
                        'title': course_title
                    })
                else:
                    # Verificar se as categorias do curso existem
                    invalid_cats = []
                    for cat_id in course_categories:
                        referenced_categories.add(cat_id)
                        if cat_id not in valid_category_ids:
                            invalid_cats.append(cat_id)
                    
                    if invalid_cats:
                        courses_with_invalid_categories.append({
                            'id': course_id,
                            'title': course_title,
                            'invalid_categories': invalid_cats,
                            'all_categories': course_categories
                        })
            
            print(f"   📋 Cursos sem categorias: {len(courses_without_categories)}")
            for course in courses_without_categories:
                print(f"      - {course['title']} (ID: {course['id']})")
            
            print(f"   ⚠️  Cursos com categorias inválidas: {len(courses_with_invalid_categories)}")
            for course in courses_with_invalid_categories:
                print(f"      - {course['title']} (ID: {course['id']})")
                print(f"        Categorias inválidas: {course['invalid_categories']}")
                print(f"        Todas as categorias: {course['all_categories']}")
            
            print(f"   🔗 Total de categorias referenciadas: {len(referenced_categories)}")
            print(f"      Categorias referenciadas: {list(referenced_categories)}")
        
        print()
        
        # 3. Identificar categorias órfãs (não referenciadas por nenhum curso)
        print("3. CATEGORIAS ÓRFÃS (não referenciadas por cursos):")
        valid_category_ids = {cat.get('id') for cat in categories if cat.get('id')}
        orphan_categories = valid_category_ids - referenced_categories
        
        if orphan_categories:
            print(f"   🗑️  Categorias órfãs encontradas: {len(orphan_categories)}")
            for cat_id in orphan_categories:
                cat_data = next((cat for cat in categories if cat.get('id') == cat_id), None)
                if cat_data:
                    print(f"      - {cat_data.get('name', 'N/A')} (ID: {cat_id})")
        else:
            print("   ✅ Nenhuma categoria órfã encontrada")
        
        print()
        
        # 4. Propor limpeza
        print("4. AÇÕES DE LIMPEZA PROPOSTAS:")
        
        actions_needed = False
        
        # Limpar categorias inválidas dos cursos
        if courses_with_invalid_categories:
            print(f"   🧹 Remover categorias inválidas de {len(courses_with_invalid_categories)} cursos")
            actions_needed = True
            
            # Executar limpeza
            for course in courses_with_invalid_categories:
                valid_cats = [cat for cat in course['all_categories'] if cat in valid_category_ids]
                
                print(f"      - Curso: {course['title']}")
                print(f"        Antes: {course['all_categories']}")
                print(f"        Depois: {valid_cats}")
                
                # Atualizar o curso no banco
                await db.courses.update_one(
                    {"id": course['id']},
                    {"$set": {"categories": valid_cats}}
                )
        
        # Definir cursos sem categoria como "Sem Categoria"
        if courses_without_categories:
            print(f"   📝 Cursos sem categoria serão tratados como 'Sem Categoria' no frontend")
            print(f"      (Não é necessário alterar o banco - tratamento no frontend)")
        
        # Remover categorias órfãs (opcional)
        if orphan_categories:
            print(f"   🗑️  Categorias órfãs podem ser removidas (opcional)")
            print(f"      Use o parâmetro --remove-orphans para executar")
        
        if not actions_needed:
            print("   ✅ Nenhuma ação de limpeza necessária")
        
        print()
        print("=== VERIFICAÇÃO CONCLUÍDA ===")
        
    except Exception as e:
        print(f"❌ Erro durante a verificação: {str(e)}")
        raise
    finally:
        client.close()

async def remove_orphan_categories():
    """Remove categorias órfãs do banco de dados"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Obter categorias e cursos
        categories = await db.categories.find({}).to_list(None)
        courses = await db.courses.find({}).to_list(None)
        
        # Identificar categorias referenciadas
        referenced_categories = set()
        for course in courses:
            course_categories = course.get('categories', [])
            referenced_categories.update(course_categories)
        
        # Identificar categorias órfãs
        valid_category_ids = {cat.get('id') for cat in categories if cat.get('id')}
        orphan_categories = valid_category_ids - referenced_categories
        
        if orphan_categories:
            print(f"Removendo {len(orphan_categories)} categorias órfãs...")
            for cat_id in orphan_categories:
                result = await db.categories.delete_one({"id": cat_id})
                if result.deleted_count > 0:
                    print(f"  ✅ Categoria {cat_id} removida")
                else:
                    print(f"  ❌ Falha ao remover categoria {cat_id}")
        else:
            print("Nenhuma categoria órfã encontrada para remoção")
            
    except Exception as e:
        print(f"❌ Erro ao remover categorias órfãs: {str(e)}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    import sys
    
    if "--remove-orphans" in sys.argv:
        asyncio.run(remove_orphan_categories())
    else:
        asyncio.run(check_and_clean_categories())
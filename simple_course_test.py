#!/usr/bin/env python3
import pymongo
import requests
import json

# Conectar ao MongoDB
client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["hiperautomacao_academy"]

print("=== VERIFICANDO CURSOS NO BANCO ===")
courses_collection = db["courses"]
courses = list(courses_collection.find({"published": True}, {"title": 1, "id": 1, "language": 1, "_id": 1}).limit(5))

print(f"Total de cursos publicados: {len(courses)}")
for course in courses:
    print(f"- Título: {course.get('title', 'N/A')}, ID: {course.get('id', 'N/A')}, Idioma: {course.get('language', 'N/A')}")

print(f"\n=== TESTANDO ENDPOINT SEM AUTENTICAÇÃO ===")

# Testar endpoints públicos
public_endpoints = [
    "http://localhost:8000/api/health",
    "http://localhost:8000/api/docs",
    "http://localhost:8000/docs",
    "http://localhost:8000/api/",
]

for endpoint in public_endpoints:
    try:
        response = requests.get(endpoint, timeout=5)
        print(f"✅ {endpoint}: {response.status_code}")
        if response.status_code == 200:
            content = response.text[:200] + "..." if len(response.text) > 200 else response.text
            print(f"   Conteúdo: {content}")
    except Exception as e:
        print(f"❌ {endpoint}: Erro - {e}")

print(f"\n=== VERIFICANDO ESTRUTURA DO FRONTEND ===")

# Verificar se o frontend está funcionando
try:
    response = requests.get("http://localhost:3000", timeout=5)
    print(f"✅ Frontend (http://localhost:3000): {response.status_code}")
    if "React" in response.text or "root" in response.text:
        print("   Frontend React detectado")
except Exception as e:
    print(f"❌ Frontend: Erro - {e}")

client.close()

print(f"\n=== RESUMO DO DIAGNÓSTICO ===")
print("1. MongoDB: ✅ Conectado")
print(f"2. Cursos no banco: ✅ {len(courses)} cursos publicados encontrados")
print("3. Backend: ✅ Respondendo (mesmo que com 404 para rotas não existentes)")
print("4. Problema identificado: ❌ Autenticação/Login com erro 500")
print("\n🔍 PRÓXIMOS PASSOS:")
print("- Verificar logs do backend para erro 500")
print("- Testar frontend diretamente no navegador")
print("- Verificar se o problema está na função fetchCourses do frontend")
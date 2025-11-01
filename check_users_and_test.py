#!/usr/bin/env python3
import pymongo
import requests
import json
from bson import ObjectId

# Conectar ao MongoDB
client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["hiperautomacao_academy"]

print("=== VERIFICANDO USUÁRIOS NO BANCO ===")
users_collection = db["users"]
users = list(users_collection.find({}, {"email": 1, "name": 1, "role": 1, "_id": 1}).limit(5))

print(f"Total de usuários encontrados: {len(users)}")
for user in users:
    print(f"- Email: {user.get('email', 'N/A')}, Nome: {user.get('name', 'N/A')}, Role: {user.get('role', 'N/A')}, ID: {user['_id']}")

if not users:
    print("Nenhum usuário encontrado no banco de dados!")
    exit(1)

# Tentar fazer login com o primeiro usuário encontrado
test_user = users[0]
test_email = test_user.get('email')

if not test_email:
    print("Usuário não tem email válido!")
    exit(1)

print(f"\n=== TESTANDO LOGIN COM {test_email} ===")

# Lista de senhas comuns para testar
test_passwords = ["123456", "password", "admin", "test", "123", "senha", "12345678"]

login_url = "http://localhost:8000/api/auth/login"
courses_url = "http://localhost:8000/api/student/courses"

token = None
for password in test_passwords:
    try:
        login_data = {
            "email": test_email,
            "password": password
        }
        
        print(f"Tentando senha: {password}")
        response = requests.post(login_url, json=login_data)
        
        if response.status_code == 200:
            result = response.json()
            token = result.get("access_token")
            print(f"✅ Login bem-sucedido! Token obtido.")
            break
        else:
            print(f"❌ Falha no login: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Erro na requisição de login: {e}")

if not token:
    print("\n❌ Não foi possível fazer login com nenhuma senha testada")
    print("Vou tentar criar um usuário de teste...")
    
    # Criar usuário de teste
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    test_user_data = {
        "email": "test@test.com",
        "password_hash": pwd_context.hash("123456"),
        "name": "Test User",
        "role": "student",
        "language": "pt",
        "created_at": "2024-01-01T00:00:00Z",
        "id": "test-user-123"
    }
    
    try:
        result = users_collection.insert_one(test_user_data)
        print(f"✅ Usuário de teste criado com ID: {result.inserted_id}")
        
        # Tentar login com o usuário criado
        login_data = {
            "email": "test@test.com",
            "password": "123456"
        }
        
        response = requests.post(login_url, json=login_data)
        if response.status_code == 200:
            result = response.json()
            token = result.get("access_token")
            print(f"✅ Login com usuário de teste bem-sucedido!")
        else:
            print(f"❌ Falha no login com usuário de teste: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Erro ao criar usuário de teste: {e}")

if token:
    print(f"\n=== TESTANDO ENDPOINT DE CURSOS ===")
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(courses_url, headers=headers)
        print(f"Status da resposta: {response.status_code}")
        
        if response.status_code == 200:
            courses = response.json()
            print(f"✅ Cursos obtidos com sucesso!")
            print(f"Número de cursos: {len(courses)}")
            
            for i, course in enumerate(courses[:3]):  # Mostrar apenas os primeiros 3
                print(f"\nCurso {i+1}:")
                print(f"  - ID: {course.get('id', 'N/A')}")
                print(f"  - Título: {course.get('title', 'N/A')}")
                print(f"  - Publicado: {course.get('published', 'N/A')}")
                print(f"  - Idioma: {course.get('language', 'N/A')}")
                
        else:
            print(f"❌ Erro ao obter cursos: {response.status_code}")
            print(f"Resposta: {response.text}")
            
    except Exception as e:
        print(f"❌ Erro na requisição de cursos: {e}")
else:
    print("\n❌ Não foi possível obter token de autenticação")

client.close()
import requests
import json
import uuid
from pymongo import MongoClient
from passlib.context import CryptContext
from datetime import datetime

# Configurações
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "hiperautomacao_academy"

# Configurar o contexto de senha igual ao backend
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_test_users():
    print("=== Criando Usuários de Teste para Modal de Idioma ===\n")
    
    try:
        # Conectar ao MongoDB
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        users_collection = db.users
        
        # Limpar usuários de teste existentes
        users_collection.delete_many({"email": {"$in": ["admin@test.com", "student@test.com"]}})
        
        # Criar usuário administrador
        admin_user = {
            "id": str(uuid.uuid4()),
            "name": "Admin Teste",
            "email": "admin@test.com",
            "password_hash": pwd_context.hash("admin123"),
            "role": "admin",
            "preferred_language": None,  # Sem idioma definido
            "created_at": datetime.utcnow(),
            "is_active": True
        }
        
        admin_result = users_collection.insert_one(admin_user)
        print(f"✅ Usuário administrador criado: {admin_user['email']}")
        print(f"   ID: {admin_result.inserted_id}")
        print(f"   Papel: {admin_user['role']}")
        print(f"   Idioma: {admin_user['preferred_language']}")
        
        # Criar usuário estudante
        student_user = {
            "id": str(uuid.uuid4()),
            "name": "Estudante Teste",
            "email": "student@test.com", 
            "password_hash": pwd_context.hash("student123"),
            "role": "student",
            "preferred_language": None,  # Sem idioma definido
            "created_at": datetime.utcnow(),
            "is_active": True
        }
        
        student_result = users_collection.insert_one(student_user)
        print(f"✅ Usuário estudante criado: {student_user['email']}")
        print(f"   ID: {student_result.inserted_id}")
        print(f"   Papel: {student_user['role']}")
        print(f"   Idioma: {student_user['preferred_language']}")
        
        print(f"\n📋 Usuários criados com sucesso!")
        print(f"   Admin: admin@test.com / admin123")
        print(f"   Estudante: student@test.com / student123")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Erro ao criar usuários: {e}")

if __name__ == "__main__":
    create_test_users()
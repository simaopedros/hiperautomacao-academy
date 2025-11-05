import requests
import pymongo
import jwt
from datetime import datetime, timedelta

# Conectar ao MongoDB para pegar um usuário
client = pymongo.MongoClient('mongodb://localhost:27017/')
db = client.hiperautomacao_academy

# Buscar um usuário de teste
user = db.users.find_one({"email": {"$exists": True}})
if not user:
    print("Nenhum usuário encontrado no banco!")
    exit(1)

print(f"Usuário encontrado: {user.get('name', 'N/A')} ({user.get('email', 'N/A')})")
print(f"Idioma preferido: {user.get('preferred_language', 'N/A')}")

# Criar um token JWT válido (simulando o processo de login)
SECRET_KEY = "your-secret-key-change-in-production"  # Chave padrão do backend
payload = {
    "user_id": str(user["_id"]),
    "exp": datetime.utcnow() + timedelta(hours=1)
}

try:
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    
    # Testar o endpoint
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get("http://localhost:8000/api/student/courses", headers=headers)
    
    print(f"\nStatus da resposta: {response.status_code}")
    if response.status_code == 200:
        courses = response.json()
        print(f"Cursos retornados: {len(courses)}")
        for course in courses:
            print(f"- {course.get('title', 'N/A')} (Language: {course.get('language', 'N/A')}, Access: {course.get('has_access', False)})")
    else:
        print(f"Erro: {response.text}")
        
except Exception as e:
    print(f"Erro ao testar endpoint: {e}")
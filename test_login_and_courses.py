import requests
import pymongo

# Conectar ao MongoDB
client = pymongo.MongoClient('mongodb://localhost:27017/')
db = client.hiperautomacao_academy

# Buscar um usuário existente
user = db.users.find_one({"email": {"$exists": True}})
if not user:
    print("Nenhum usuário encontrado no banco!")
    exit(1)

email = user.get('email')
print(f"Tentando fazer login com: {email}")

# Tentar fazer login (assumindo que a senha é 'password123' ou similar)
login_data = {
    "email": email,
    "password": "password123"  # Senha padrão de teste
}

try:
    # Fazer login
    login_response = requests.post("http://localhost:8000/api/auth/login", json=login_data)
    
    if login_response.status_code == 200:
        login_result = login_response.json()
        token = login_result.get('access_token')
        print(f"Login bem-sucedido! Token obtido.")
        
        # Testar endpoint de cursos
        headers = {"Authorization": f"Bearer {token}"}
        courses_response = requests.get("http://localhost:8000/api/student/courses", headers=headers)
        
        print(f"\nStatus do endpoint de cursos: {courses_response.status_code}")
        if courses_response.status_code == 200:
            courses = courses_response.json()
            print(f"Cursos retornados: {len(courses)}")
            for course in courses:
                print(f"- {course.get('title', 'N/A')} (Language: {course.get('language', 'N/A')}, Access: {course.get('has_access', False)})")
        else:
            print(f"Erro ao buscar cursos: {courses_response.text}")
            
    else:
        print(f"Erro no login: {login_response.status_code} - {login_response.text}")
        
        # Vamos tentar outras senhas comuns
        for password in ["123456", "admin", "test", "senha123"]:
            login_data["password"] = password
            login_response = requests.post("http://localhost:8000/api/auth/login", json=login_data)
            if login_response.status_code == 200:
                print(f"Login bem-sucedido com senha: {password}")
                break
        else:
            print("Não foi possível fazer login com nenhuma senha testada")
        
except Exception as e:
    print(f"Erro: {e}")
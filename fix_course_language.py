import requests
import json

# Configurações
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

def login_admin():
    """Faz login como administrador"""
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    if response.status_code == 200:
        token = response.json().get("access_token")
        print(f"✅ Login admin realizado com sucesso")
        return token
    else:
        print(f"❌ Erro no login admin: {response.status_code} - {response.text}")
        return None

def get_courses(token):
    """Busca todos os cursos"""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/api/admin/courses", headers=headers)
    if response.status_code == 200:
        courses = response.json()
        print(f"✅ Encontrados {len(courses)} cursos")
        return courses
    else:
        print(f"❌ Erro ao buscar cursos: {response.status_code} - {response.text}")
        return []

def update_course_language(token, course_id, language):
    """Atualiza o idioma de um curso"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Primeiro, busca os dados completos do curso
    response = requests.get(f"{BASE_URL}/api/admin/courses/{course_id}", headers=headers)
    if response.status_code != 200:
        print(f"❌ Erro ao buscar curso {course_id}: {response.status_code}")
        return False
    
    course_data = response.json()
    course_data["language"] = language
    
    # Atualiza o curso
    response = requests.put(f"{BASE_URL}/api/admin/courses/{course_id}", 
                          headers=headers, json=course_data)
    
    if response.status_code == 200:
        print(f"✅ Idioma do curso '{course_data['title']}' atualizado para '{language}'")
        return True
    else:
        print(f"❌ Erro ao atualizar curso: {response.status_code} - {response.text}")
        return False

def main():
    print("🔧 Definindo idioma para cursos sem idioma definido...")
    
    # Login
    token = login_admin()
    if not token:
        return
    
    # Buscar cursos
    courses = get_courses(token)
    if not courses:
        return
    
    # Encontrar cursos sem idioma
    courses_without_language = []
    for course in courses:
        print(f"\n📚 Curso: {course['title']}")
        print(f"   ID: {course['id']}")
        print(f"   Idioma: {course.get('language', 'Não definido')}")
        
        if not course.get('language'):
            courses_without_language.append(course)
    
    if not courses_without_language:
        print("\n✅ Todos os cursos já têm idioma definido!")
        return
    
    print(f"\n🎯 Encontrados {len(courses_without_language)} cursos sem idioma definido:")
    
    for course in courses_without_language:
        print(f"\n🔄 Definindo idioma 'pt' para: {course['title']}")
        success = update_course_language(token, course['id'], 'pt')
        
        if success:
            print(f"✅ Sucesso!")
        else:
            print(f"❌ Falha!")
    
    print("\n🎉 Processo concluído!")

if __name__ == "__main__":
    main()
import requests
import json

def check_course_structure():
    try:
        # Login como admin
        login_response = requests.post('http://localhost:8000/api/auth/login', json={
            'email': 'admin@test.com',
            'password': 'admin123'
        })
        
        if login_response.status_code != 200:
            print(f"Erro no login: {login_response.status_code}")
            print(login_response.text)
            return
            
        login_data = login_response.json()
        token = login_data.get('access_token')
        
        if not token:
            print("Token não encontrado na resposta do login")
            print(login_data)
            return

        # Buscar todos os cursos
        courses_response = requests.get('http://localhost:8000/api/admin/courses', headers={
            'Authorization': f'Bearer {token}'
        })
        
        if courses_response.status_code != 200:
            print(f"Erro ao buscar cursos: {courses_response.status_code}")
            print(courses_response.text)
            return

        courses = courses_response.json()
        print('=== ESTRUTURA DOS CURSOS ===')
        
        for course in courses:
            title = course.get('title', 'N/A')
            course_id = course.get('id', 'N/A')
            print(f'Curso: {title}')
            print(f'  - ID: {course_id}')
            
            if 'category' in course:
                category = course.get('category')
                print(f'  - Campo legado category: {category}')
            
            if 'categories' in course:
                categories = course.get('categories')
                print(f'  - Campo novo categories: {categories}')
            
            print('---')
            
        # Buscar categorias disponíveis
        categories_response = requests.get('http://localhost:8000/api/categories')
        if categories_response.status_code == 200:
            categories = categories_response.json()
            print('\n=== CATEGORIAS DISPONÍVEIS ===')
            for cat in categories:
                print(f'ID: {cat.get("id")} - Nome: {cat.get("name")}')
        
    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    check_course_structure()
import requests

def create_test_categories():
    try:
        # Login como admin
        login_response = requests.post('http://localhost:8000/api/auth/login', json={
            'email': 'admin@test.com',
            'password': 'admin123'
        })
        
        if login_response.status_code != 200:
            print(f"Erro no login: {login_response.status_code}")
            return
            
        token = login_response.json()['access_token']

        # Criar categorias que correspondem aos nomes dos cursos antigos
        categories_to_create = [
            {'name': 'Programação', 'description': 'Cursos de programação e desenvolvimento'},
            {'name': 'Teste', 'description': 'Categoria de teste'}
        ]

        for category_data in categories_to_create:
            try:
                response = requests.post('http://localhost:8000/api/admin/categories', 
                    json=category_data,
                    headers={'Authorization': f'Bearer {token}'}
                )
                if response.status_code == 201:
                    print(f'✅ Categoria criada: {category_data["name"]}')
                else:
                    print(f'❌ Erro ao criar {category_data["name"]}: {response.status_code} - {response.text}')
            except Exception as e:
                print(f'❌ Erro ao criar {category_data["name"]}: {e}')
                
    except Exception as e:
        print(f"Erro geral: {e}")

if __name__ == "__main__":
    create_test_categories()
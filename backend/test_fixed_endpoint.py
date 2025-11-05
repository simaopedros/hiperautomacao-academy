import httpx
import asyncio

async def test_fixed_endpoint():
    base_url = "http://localhost:8000"
    
    # Login first
    login_data = {
        "email": "simaopedros@gmail.com",
        "password": "admin123"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Login
        print("Fazendo login...")
        login_response = await client.post(f"{base_url}/api/auth/login", json=login_data)
        print(f"Status do login: {login_response.status_code}")
        
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Test /admin/users endpoint
            print("\nTestando endpoint /api/admin/users...")
            users_response = await client.get(f"{base_url}/api/admin/users", headers=headers)
            print(f"Status: {users_response.status_code}")
            
            if users_response.status_code == 200:
                users_data = users_response.json()
                print(f"Sucesso! Encontrados {len(users_data)} usuários")
                
                # Check if legacy user is handled correctly
                for user in users_data:
                    if user.get('email') == 'test@test.com':
                        print(f"Usuário legacy encontrado: {user.get('name', 'N/A')} - ID: {user.get('id', 'N/A')}")
                        break
                
                return True
            else:
                print(f"Erro: {users_response.text}")
                return False
        else:
            print(f"Erro no login: {login_response.text}")
            return False

if __name__ == "__main__":
    success = asyncio.run(test_fixed_endpoint())
    if success:
        print("\n✅ Endpoint /admin/users está funcionando corretamente!")
    else:
        print("\n❌ Ainda há problemas com o endpoint.")
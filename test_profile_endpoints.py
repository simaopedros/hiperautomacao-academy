#!/usr/bin/env python3
"""
Teste dos endpoints de perfil do usuário
"""

import requests
import json

BACKEND_URL = "http://localhost:8000"

def test_profile_endpoints():
    """Testa os endpoints de perfil do usuário"""
    
    print("🧪 Testando endpoints de perfil do usuário...")
    
    # 1. Login para obter token
    print("\n1. Fazendo login...")
    login_data = {
        "email": "admin@test.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            token = response.json()["access_token"]
            user = response.json()["user"]
            print(f"✅ Login realizado com sucesso! Usuário: {user['name']}")
        else:
            print(f"❌ Erro no login: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Erro na conexão: {e}")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Testar GET /user/preferences
    print("\n2. Testando GET /api/user/preferences...")
    try:
        response = requests.get(f"{BACKEND_URL}/api/user/preferences", headers=headers)
        if response.status_code == 200:
            preferences = response.json()
            print(f"✅ Preferências obtidas: {preferences}")
        else:
            print(f"❌ Erro ao obter preferências: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Erro na requisição: {e}")
    
    # 3. Testar PUT /user/profile
    print("\n3. Testando PUT /api/user/profile...")
    profile_data = {
        "name": "Admin Teste Atualizado",
        "preferred_language": "pt-BR"
    }
    
    try:
        response = requests.put(f"{BACKEND_URL}/api/user/profile", json=profile_data, headers=headers)
        if response.status_code == 200:
            updated_user = response.json()
            print(f"✅ Perfil atualizado: {updated_user['name']} - Idioma: {updated_user.get('preferred_language', 'N/A')}")
        else:
            print(f"❌ Erro ao atualizar perfil: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Erro na requisição: {e}")
    
    # 4. Testar PUT /user/preferences
    print("\n4. Testando PUT /api/user/preferences...")
    preferences_data = {
        "email_notifications": True,
        "course_reminders": False,
        "social_notifications": True,
        "marketing_emails": False
    }
    
    try:
        response = requests.put(f"{BACKEND_URL}/api/user/preferences", json=preferences_data, headers=headers)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Preferências atualizadas: {result}")
        else:
            print(f"❌ Erro ao atualizar preferências: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Erro na requisição: {e}")
    
    # 5. Testar PUT /user/password
    print("\n5. Testando PUT /api/user/password...")
    password_data = {
        "current_password": "admin123",
        "new_password": "admin123"  # Mantendo a mesma senha para não quebrar outros testes
    }
    
    try:
        response = requests.put(f"{BACKEND_URL}/api/user/password", json=password_data, headers=headers)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Senha atualizada: {result}")
        else:
            print(f"❌ Erro ao atualizar senha: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Erro na requisição: {e}")
    
    print("\n🎉 Teste dos endpoints de perfil concluído!")
    return True

if __name__ == "__main__":
    test_profile_endpoints()
#!/usr/bin/env python3
import requests
import json

def test_admin_users_endpoint():
    try:
        # Testar o endpoint sem autenticação primeiro
        url = "http://localhost:8000/admin/users"
        
        print(f"🔍 Testando endpoint: {url}")
        
        response = requests.get(url)
        
        print(f"📊 Status Code: {response.status_code}")
        print(f"📋 Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"✅ Resposta JSON recebida com sucesso!")
                print(f"📊 Número de usuários retornados: {len(data) if isinstance(data, list) else 'N/A'}")
                
                if isinstance(data, list) and len(data) > 0:
                    print("👥 Primeiros usuários da API:")
                    for i, user in enumerate(data[:3], 1):
                        name = user.get('name', 'N/A')
                        email = user.get('email', 'N/A')
                        role = user.get('role', 'N/A')
                        print(f"  {i}. {name} - {email} - Role: {role}")
                else:
                    print("⚠️  Lista de usuários vazia na resposta da API!")
                    
            except json.JSONDecodeError:
                print("❌ Erro ao decodificar JSON da resposta")
                print(f"📄 Conteúdo da resposta: {response.text[:500]}")
                
        elif response.status_code == 401:
            print("🔒 Endpoint requer autenticação (401 Unauthorized)")
            
        elif response.status_code == 403:
            print("🚫 Acesso negado (403 Forbidden)")
            
        else:
            print(f"❌ Erro na requisição: {response.status_code}")
            print(f"📄 Conteúdo da resposta: {response.text[:500]}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Erro de conexão - Servidor não está rodando ou não está acessível")
        
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")

if __name__ == '__main__':
    test_admin_users_endpoint()
#!/usr/bin/env python3
"""
Script para testar as configurações de idioma do sistema
"""

import requests
import json
import sys
from datetime import datetime

# Configurações
BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3000"

def test_backend_language_endpoint():
    """Testa o endpoint de idioma no backend"""
    print("🔍 Testando endpoint de idioma no backend...")
    
    # Primeiro, vamos tentar fazer login para obter um token
    login_data = {
        "username": "admin@admin.com",
        "password": "admin123"
    }
    
    try:
        # Login
        login_response = requests.post(f"{BACKEND_URL}/api/auth/login", json=login_data)
        if login_response.status_code != 200:
            print(f"❌ Erro no login: {login_response.status_code}")
            return False
            
        token = login_response.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Testar idiomas suportados
        languages_to_test = ["pt", "en", "es"]
        
        for lang in languages_to_test:
            print(f"  📝 Testando idioma: {lang}")
            
            # Atualizar idioma
            update_response = requests.put(
                f"{BACKEND_URL}/api/auth/language",
                json={"preferred_language": lang},
                headers=headers
            )
            
            if update_response.status_code == 200:
                user_data = update_response.json()
                current_lang = user_data.get("preferred_language")
                print(f"  ✅ Idioma {lang} atualizado com sucesso. Atual: {current_lang}")
            else:
                print(f"  ❌ Erro ao atualizar idioma {lang}: {update_response.status_code}")
                print(f"     Resposta: {update_response.text}")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Não foi possível conectar ao backend. Verifique se está rodando.")
        return False
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")
        return False

def check_frontend_files():
    """Verifica se os arquivos de tradução existem"""
    print("🔍 Verificando arquivos de tradução...")
    
    import os
    
    base_path = "frontend/src/i18n/locales"
    required_files = ["pt-BR.json", "en-US.json", "es-ES.json"]
    
    all_exist = True
    for file in required_files:
        file_path = os.path.join(base_path, file)
        if os.path.exists(file_path):
            print(f"  ✅ {file} existe")
            
            # Verificar se contém as traduções de profile
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                    if 'profile' in content:
                        print(f"    ✅ Contém traduções de profile")
                    else:
                        print(f"    ⚠️  Não contém traduções de profile")
            except Exception as e:
                print(f"    ❌ Erro ao ler arquivo: {e}")
        else:
            print(f"  ❌ {file} não encontrado")
            all_exist = False
    
    return all_exist

def check_frontend_config():
    """Verifica a configuração do i18n"""
    print("🔍 Verificando configuração do i18n...")
    
    try:
        with open("frontend/src/i18n/index.js", 'r', encoding='utf-8') as f:
            content = f.read()
            
        if "es-ES" in content:
            print("  ✅ Espanhol configurado no i18n")
        else:
            print("  ❌ Espanhol não encontrado na configuração")
            
        if "supportedLngs: ['pt-BR', 'en-US', 'es-ES']" in content:
            print("  ✅ Idiomas suportados incluem espanhol")
        else:
            print("  ⚠️  Configuração de idiomas suportados pode estar incorreta")
            
        return True
        
    except FileNotFoundError:
        print("  ❌ Arquivo de configuração i18n não encontrado")
        return False
    except Exception as e:
        print(f"  ❌ Erro ao verificar configuração: {e}")
        return False

def main():
    """Função principal"""
    print("🚀 Iniciando testes das configurações de idioma")
    print("=" * 50)
    
    # Verificar arquivos
    files_ok = check_frontend_files()
    config_ok = check_frontend_config()
    
    # Testar backend
    backend_ok = test_backend_language_endpoint()
    
    print("\n" + "=" * 50)
    print("📊 RESUMO DOS TESTES:")
    print(f"  Arquivos de tradução: {'✅' if files_ok else '❌'}")
    print(f"  Configuração i18n: {'✅' if config_ok else '❌'}")
    print(f"  Backend endpoint: {'✅' if backend_ok else '❌'}")
    
    if files_ok and config_ok and backend_ok:
        print("\n🎉 Todos os testes passaram! O sistema de idiomas está funcionando.")
        return 0
    else:
        print("\n⚠️  Alguns testes falharam. Verifique os detalhes acima.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
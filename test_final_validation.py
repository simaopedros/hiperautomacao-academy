import requests
import json
import random
from pymongo import MongoClient

def test_final_validation():
    """Teste final para validar todas as funcionalidades de captura de leads"""
    
    # Conectar ao MongoDB
    client = MongoClient("mongodb://localhost:27017/")
    db = client.hiperautomacao_academy
    
    print("🎯 TESTE FINAL - Validação Completa do Sistema de Captura de Leads\n")
    
    test_cases = [
        {
            "description": "✅ Lead com WhatsApp válido",
            "data": {
                "name": "João Silva",
                "email": f"joao_valido_{random.randint(10000, 99999)}@exemplo.com",
                "whatsapp": "(11) 98765-4321"
            },
            "expected_status": 200,
            "expected_brevo": True
        },
        {
            "description": "✅ Lead com WhatsApp inválido (muito curto)",
            "data": {
                "name": "Maria Santos",
                "email": f"maria_curto_{random.randint(10000, 99999)}@exemplo.com", 
                "whatsapp": "123"
            },
            "expected_status": 200,
            "expected_brevo": True  # Deve ser enviado sem WhatsApp
        },
        {
            "description": "✅ Lead com WhatsApp vazio",
            "data": {
                "name": "Pedro Costa",
                "email": f"pedro_vazio_{random.randint(10000, 99999)}@exemplo.com",
                "whatsapp": ""
            },
            "expected_status": 200,
            "expected_brevo": True  # Deve ser enviado sem WhatsApp
        },
        {
            "description": "✅ Lead com WhatsApp com caracteres especiais",
            "data": {
                "name": "Ana Oliveira",
                "email": f"ana_especiais_{random.randint(10000, 99999)}@exemplo.com",
                "whatsapp": "11@#$%^&*()98765-4321"
            },
            "expected_status": 200,
            "expected_brevo": True  # Deve normalizar e enviar
        }
    ]
    
    success_count = 0
    total_tests = len(test_cases)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"📋 Teste {i}: {test_case['description']}")
        print(f"👤 Nome: {test_case['data']['name']}")
        print(f"📧 Email: {test_case['data']['email']}")
        print(f"📱 WhatsApp: '{test_case['data']['whatsapp']}'")
        
        try:
            response = requests.post(
                "http://localhost:8000/api/leads/capture",
                json=test_case['data'],
                timeout=15
            )
            
            print(f"📊 Status Code: {response.status_code}")
            print(f"📋 Response: {response.text}")
            
            # Verificar se o lead foi salvo no banco
            lead_in_db = db.leads.find_one({"email": test_case['data']['email']})
            
            if lead_in_db:
                print(f"💾 Lead no banco:")
                print(f"   - sent_to_brevo: {lead_in_db.get('sent_to_brevo', 'N/A')}")
                print(f"   - error: {lead_in_db.get('error', 'None')}")
                
                # Validar resultado
                status_ok = response.status_code == test_case['expected_status']
                brevo_ok = lead_in_db.get('sent_to_brevo') == test_case['expected_brevo']
                
                if status_ok and brevo_ok:
                    print("✅ TESTE PASSOU!")
                    success_count += 1
                else:
                    print("❌ TESTE FALHOU!")
                    if not status_ok:
                        print(f"   - Status esperado: {test_case['expected_status']}, recebido: {response.status_code}")
                    if not brevo_ok:
                        print(f"   - Brevo esperado: {test_case['expected_brevo']}, recebido: {lead_in_db.get('sent_to_brevo')}")
            else:
                print("❌ Lead NÃO encontrado no banco - TESTE FALHOU!")
                
        except Exception as e:
            print(f"❌ Erro na requisição: {str(e)} - TESTE FALHOU!")
        
        print("-" * 70)
    
    # Resultado final
    print(f"\n🎯 RESULTADO FINAL:")
    print(f"✅ Testes que passaram: {success_count}/{total_tests}")
    print(f"📊 Taxa de sucesso: {(success_count/total_tests)*100:.1f}%")
    
    if success_count == total_tests:
        print("🎉 TODOS OS TESTES PASSARAM! Sistema funcionando perfeitamente!")
    else:
        print("⚠️  Alguns testes falharam. Verifique os logs acima.")
    
    client.close()

if __name__ == "__main__":
    test_final_validation()
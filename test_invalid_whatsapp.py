import requests
import json
import random
from pymongo import MongoClient

def test_invalid_whatsapp():
    """Testa o comportamento com números de WhatsApp inválidos"""
    
    # Conectar ao MongoDB para verificar os leads salvos
    client = MongoClient("mongodb://localhost:27017/")
    db = client.hiperautomacao_academy
    
    print("🧪 Testando captura de leads com números de WhatsApp inválidos\n")
    
    # Casos de teste com números inválidos
    test_cases = [
        {
            "name": "Teste WhatsApp Muito Curto",
            "email": f"whatsapp_curto_{random.randint(1000, 9999)}@exemplo.com",
            "whatsapp": "123"  # Muito curto
        },
        {
            "name": "Teste WhatsApp Muito Longo", 
            "email": f"whatsapp_longo_{random.randint(1000, 9999)}@exemplo.com",
            "whatsapp": "11999999999999999999"  # Muito longo
        },
        {
            "name": "Teste WhatsApp com Letras",
            "email": f"whatsapp_letras_{random.randint(1000, 9999)}@exemplo.com", 
            "whatsapp": "11abcd-efgh"  # Com letras
        },
        {
            "name": "Teste WhatsApp Vazio",
            "email": f"whatsapp_vazio_{random.randint(1000, 9999)}@exemplo.com",
            "whatsapp": ""  # Vazio
        },
        {
            "name": "Teste WhatsApp Válido (controle)",
            "email": f"whatsapp_valido_{random.randint(1000, 9999)}@exemplo.com",
            "whatsapp": "(11) 99999-9999"  # Válido
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"📋 Teste {i}: {test_case['name']}")
        print(f"📧 Email: {test_case['email']}")
        print(f"📱 WhatsApp: '{test_case['whatsapp']}'")
        
        try:
            response = requests.post(
                "http://localhost:8000/api/leads/capture",
                json=test_case,
                timeout=10
            )
            
            print(f"📊 Status Code: {response.status_code}")
            print(f"📋 Response: {response.text}")
            
            # Verificar se o lead foi salvo no banco
            lead_in_db = db.leads.find_one({"email": test_case["email"]})
            if lead_in_db:
                print(f"✅ Lead salvo no banco:")
                print(f"   - sent_to_brevo: {lead_in_db.get('sent_to_brevo', 'N/A')}")
                print(f"   - error: {lead_in_db.get('error', 'None')}")
            else:
                print(f"❌ Lead NÃO encontrado no banco")
                
        except Exception as e:
            print(f"❌ Erro na requisição: {str(e)}")
        
        print("-" * 60)
    
    client.close()

if __name__ == "__main__":
    test_invalid_whatsapp()
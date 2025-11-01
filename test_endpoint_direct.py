import requests
import json
import random

# Testar endpoint de captura de leads com dados únicos
test_lead = {
    "name": "Teste Endpoint",
    "email": f"endpoint{random.randint(10000, 99999)}@exemplo.com",
    "whatsapp": f"(11) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
}

print(f"🧪 Testando endpoint com dados únicos:")
print(f"📧 Email: {test_lead['email']}")
print(f"📱 WhatsApp: {test_lead['whatsapp']}")

try:
    response = requests.post(
        "http://localhost:8000/api/leads/capture",
        json=test_lead,
        timeout=10
    )
    
    print(f"\n📊 Status Code: {response.status_code}")
    print(f"📋 Response: {response.text}")
    
    if response.status_code == 200:
        print("✅ Captura de lead funcionando!")
    else:
        print(f"❌ Erro na captura: {response.status_code}")
        
except Exception as e:
    print(f"❌ Erro na requisição: {str(e)}")
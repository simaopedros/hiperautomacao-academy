import requests
import json

# Testar com dados fixos para forçar duplicata
test_lead = {
    "name": "Teste Duplicata",
    "email": "duplicata@exemplo.com",
    "whatsapp": "(11) 98888-8888"
}

print(f"🧪 Testando tratamento de duplicatas:")
print(f"📧 Email: {test_lead['email']}")
print(f"📱 WhatsApp: {test_lead['whatsapp']}")

# Primeira tentativa
print(f"\n🔄 Primeira tentativa:")
try:
    response = requests.post(
        "http://localhost:8000/api/leads/capture",
        json=test_lead,
        timeout=10
    )
    
    print(f"📊 Status Code: {response.status_code}")
    print(f"📋 Response: {response.text}")
        
except Exception as e:
    print(f"❌ Erro na requisição: {str(e)}")

# Segunda tentativa (deve dar duplicata)
print(f"\n🔄 Segunda tentativa (deve detectar duplicata):")
try:
    response = requests.post(
        "http://localhost:8000/api/leads/capture",
        json=test_lead,
        timeout=10
    )
    
    print(f"📊 Status Code: {response.status_code}")
    print(f"📋 Response: {response.text}")
        
except Exception as e:
    print(f"❌ Erro na requisição: {str(e)}")
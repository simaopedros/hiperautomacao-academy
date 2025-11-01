import requests
import random

# Teste com número único
unique_number = f"11{random.randint(90000, 99999)}{random.randint(1000, 9999)}"

test_data = {
    "name": "Ana Oliveira",
    "email": f"ana_especiais_{random.randint(10000, 99999)}@exemplo.com",
    "whatsapp": f"({unique_number[:2]}) {unique_number[2:7]}-{unique_number[7:]}"
}

print(f"🧪 Testando com WhatsApp único:")
print(f"📧 Email: {test_data['email']}")
print(f"📱 WhatsApp: {test_data['whatsapp']}")

try:
    response = requests.post(
        "http://localhost:8000/api/leads/capture",
        json=test_data,
        timeout=10
    )
    
    print(f"📊 Status Code: {response.status_code}")
    print(f"📋 Response: {response.text}")
    
    if response.status_code == 200:
        print("✅ SUCESSO! Lead capturado com WhatsApp normalizado!")
    else:
        print("❌ Falha inesperada")
        
except Exception as e:
    print(f"❌ Erro: {str(e)}")
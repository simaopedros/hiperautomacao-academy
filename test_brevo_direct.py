import requests
import json
from pymongo import MongoClient

# Conectar ao MongoDB para pegar a configuração
client = MongoClient('mongodb://localhost:27017/')
db = client['hiperautomacao_academy']

brevo_config = db.brevo_config.find_one({})

if not brevo_config or not brevo_config.get('api_key'):
    print("❌ Configuração do Brevo não encontrada")
    exit(1)

api_key = brevo_config['api_key']
list_id = brevo_config.get('list_id')

print(f"🔑 API Key: {api_key[:10]}...")
print(f"📋 List ID: {list_id}")

# Testar diretamente a API do Brevo
headers = {
    "api-key": api_key,
    "Content-Type": "application/json"
}

contact_data = {
    "email": "teste@exemplo.com",
    "attributes": {
        "NOME": "Teste Usuario",
        "WHATSAPP": "+5511999999999"  # Formato internacional
    }
}

if list_id:
    contact_data["listIds"] = [list_id]

print(f"\n📤 Enviando dados para Brevo:")
print(json.dumps(contact_data, indent=2))

try:
    response = requests.post(
        "https://api.brevo.com/v3/contacts",
        json=contact_data,
        headers=headers,
        timeout=10
    )
    
    print(f"\n📊 Status Code: {response.status_code}")
    print(f"📋 Response Headers: {dict(response.headers)}")
    print(f"📄 Response Body: {response.text}")
    
    if response.status_code in [200, 201, 204]:
        print("✅ Sucesso!")
    else:
        print("❌ Erro na API do Brevo")
        
        # Tentar parsear o erro
        try:
            error_data = response.json()
            print(f"🔍 Detalhes do erro: {json.dumps(error_data, indent=2)}")
        except:
            print("Não foi possível parsear o erro como JSON")
            
except Exception as e:
    print(f"❌ Erro na requisição: {str(e)}")

client.close()
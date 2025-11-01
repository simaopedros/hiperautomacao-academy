import requests
import json
from pymongo import MongoClient

def normalize_whatsapp(whatsapp_number):
    """Normaliza número de WhatsApp para formato internacional"""
    if not whatsapp_number:
        return whatsapp_number
    
    # Remove todos os caracteres não numéricos
    clean_number = ''.join(filter(str.isdigit, whatsapp_number))
    
    # Se não começar com código do país, adiciona +55 (Brasil)
    if len(clean_number) == 11 and clean_number.startswith(('11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99')):
        return f"+55{clean_number}"
    elif len(clean_number) == 13 and clean_number.startswith('55'):
        return f"+{clean_number}"
    elif clean_number.startswith('55') and len(clean_number) > 11:
        return f"+{clean_number}"
    
    # Se já tem código do país, mantém
    return f"+{clean_number}" if not whatsapp_number.startswith('+') else whatsapp_number

# Conectar ao MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['hiperautomacao_academy']

print("🔍 Debug da captura de leads...")

# 1. Pegar configuração do Brevo
brevo_config = db.brevo_config.find_one({})
print(f"📋 Configuração Brevo: {brevo_config}")

# 2. Simular dados do lead
import random
lead_data = {
    "name": "Debug Usuario",
    "email": f"debug{random.randint(1000, 9999)}@exemplo.com",
    "whatsapp": f"(11) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
}

print(f"📤 Dados originais do lead: {lead_data}")

# 3. Normalizar WhatsApp
normalized_whatsapp = normalize_whatsapp(lead_data["whatsapp"])
print(f"📱 WhatsApp normalizado: {normalized_whatsapp}")

# 4. Preparar dados para Brevo (exatamente como no código)
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    "api-key": brevo_config["api_key"]
}

contact_data = {
    "email": lead_data["email"],
    "attributes": {
        "NOME": lead_data["name"],
        "WHATSAPP": normalized_whatsapp
    },
    "listIds": [brevo_config.get("list_id")] if brevo_config.get("list_id") else []
}

print(f"📦 Dados preparados para Brevo:")
print(json.dumps(contact_data, indent=2))

# 5. Enviar para Brevo
print(f"\n🚀 Enviando para Brevo...")
try:
    response = requests.post(
        "https://api.brevo.com/v3/contacts",
        json=contact_data,
        headers=headers,
        timeout=10
    )
    
    print(f"📊 Status: {response.status_code}")
    print(f"📄 Response: {response.text}")
    
    if response.status_code not in [200, 201, 204]:
        print("❌ Erro detectado!")
        try:
            error_data = response.json()
            print(f"🔍 Detalhes do erro: {json.dumps(error_data, indent=2)}")
        except:
            print("Não foi possível parsear o erro")
    else:
        print("✅ Sucesso!")
        
except Exception as e:
    print(f"❌ Exceção: {str(e)}")

client.close()
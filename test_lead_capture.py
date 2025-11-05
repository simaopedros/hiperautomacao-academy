import requests
import json
import random
from pymongo import MongoClient

# Conectar ao MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['hiperautomacao_academy']

print("🔍 Testando captura de leads...")

# 1. Verificar configuração do Brevo
print("\n1. Verificando configuração do Brevo...")
brevo_config = db.brevo_config.find_one({})

if not brevo_config:
    print("❌ Nenhuma configuração do Brevo encontrada")
else:
    print(f"✅ Configuração encontrada:")
    print(f"   - API Key: {'Configurada' if brevo_config.get('api_key') else 'Não configurada'}")
    print(f"   - List ID: {brevo_config.get('list_id', 'Não configurado')}")
    print(f"   - Sales Page URL: {brevo_config.get('sales_page_url', 'Não configurado')}")

# 2. Testar endpoint de captura de leads
print("\n2. Testando endpoint de captura de leads...")

test_lead = {
    "name": "Teste Usuario Novo",
    "email": f"teste{random.randint(1000, 9999)}@exemplo.com",
    "whatsapp": "(11) 99999-9999"
}

try:
    response = requests.post(
        "http://localhost:8000/api/leads/capture",
        json=test_lead,
        timeout=10
    )
    
    print(f"📊 Status Code: {response.status_code}")
    print(f"📋 Response: {response.text}")
    
    if response.status_code == 200:
        print("✅ Captura de lead funcionando!")
    else:
        print(f"❌ Erro na captura: {response.status_code}")
        
except Exception as e:
    print(f"❌ Erro na requisição: {str(e)}")

# 3. Verificar leads salvos no banco
print("\n3. Verificando leads salvos no banco...")
leads_count = db.leads.count_documents({})
print(f"📈 Total de leads no banco: {leads_count}")

if leads_count > 0:
    latest_lead = db.leads.find_one({}, sort=[("created_at", -1)])
    print(f"🔄 Último lead:")
    print(f"   - Email: {latest_lead.get('email')}")
    print(f"   - Enviado para Brevo: {latest_lead.get('sent_to_brevo', False)}")
    if latest_lead.get('error'):
        print(f"   - Erro: {latest_lead.get('error')}")

client.close()
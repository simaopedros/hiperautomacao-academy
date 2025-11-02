#!/usr/bin/env python3
"""
Script para enviar webhook correto para atualizar o usuário student1761846292@exemplo.com
"""

import requests
import json
import time
import hmac
import hashlib
import os

def send_correct_webhook():
    """Envia webhook correto para atualizar o usuário"""
    
    # ID real do usuário (obtido do banco)
    real_user_id = "555aa7ed-21d7-4679-bb1a-c6cc6b1b021b"
    user_email = "student1761846292@exemplo.com"
    
    print(f"🎯 Enviando webhook para atualizar usuário: {user_email}")
    print(f"🆔 User ID: {real_user_id}")
    
    # Payload correto do Stripe
    stripe_payload = {
        "id": f"evt_correct_{int(time.time())}",
        "object": "event",
        "api_version": "2020-08-27",
        "created": int(time.time()),
        "data": {
            "object": {
                "id": f"cs_correct_{int(time.time())}",
                "object": "checkout.session",
                "client_reference_id": user_email,
                "metadata": {
                    "user_id": real_user_id,
                    "subscription_plan_id": "plan_premium_full_access",
                    "access_scope": "full",
                    "duration_days": "365"
                },
                "payment_status": "paid",
                "status": "complete"
            }
        },
        "livemode": False,
        "pending_webhooks": 1,
        "request": {
            "id": f"req_correct_{int(time.time())}",
            "idempotency_key": None
        },
        "type": "checkout.session.completed"
    }
    
    # Converter para JSON
    payload_json = json.dumps(stripe_payload, separators=(',', ':'))
    
    # Gerar assinatura HMAC (usando a mesma chave do test_real_webhook.py)
    webhook_secret = "whsec_b19287079bc825dc9b05265a95795e915cabbf272abb29975acb49939413b29f"
    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.{payload_json}"
    
    signature = hmac.new(
        webhook_secret.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    stripe_signature = f"t={timestamp},v1={signature}"
    
    # Headers do Stripe
    headers = {
        'Content-Type': 'application/json',
        'Stripe-Signature': stripe_signature,
        'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
    }
    
    print(f"📤 Enviando webhook para http://localhost:8000/api/webhook/stripe")
    print(f"🔐 Signature: {stripe_signature[:50]}...")
    
    try:
        # Enviar webhook para o servidor real
        response = requests.post(
            "http://localhost:8000/api/webhook/stripe",
            data=payload_json,
            headers=headers,
            timeout=30
        )
        
        print(f"📨 Status: {response.status_code}")
        print(f"📄 Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Webhook enviado com sucesso!")
            
            # Aguardar um pouco para o processamento
            print("⏳ Aguardando processamento...")
            time.sleep(2)
            
            # Verificar se o usuário foi atualizado
            print("🔍 Verificando se o usuário foi atualizado...")
            
        else:
            print(f"❌ Erro no webhook: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Erro ao enviar webhook: {e}")

if __name__ == "__main__":
    send_correct_webhook()
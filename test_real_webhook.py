#!/usr/bin/env python3
"""
Script para testar webhook REAL no servidor principal
Envia para porta 8000 (servidor real) com usuário real
"""

import requests
import json
import time
import hmac
import hashlib
import os

def create_real_webhook():
    """Cria webhook real para o servidor principal"""
    
    # Buscar user_id real do usuário student1761846292@exemplo.com
    print("🔍 Buscando dados do usuário real...")
    
    try:
        # Primeiro, vamos buscar o user_id real
        user_response = requests.get(
            "http://localhost:8000/api/debug/user/student1761846292@exemplo.com",
            headers={"Authorization": "Bearer admin_token_2023"},
            timeout=10
        )
        
        if user_response.status_code == 200:
            user_data = user_response.json()
            real_user_id = user_data.get('_id', 'unknown')
            print(f"✅ User ID encontrado: {real_user_id}")
        else:
            print(f"⚠️ Não foi possível buscar user_id, usando ID genérico")
            real_user_id = "student1761846292_id"
            
    except Exception as e:
        print(f"⚠️ Erro ao buscar usuário: {e}")
        real_user_id = "student1761846292_id"
    
    # Payload real para o usuário real
    real_payload = {
        "id": f"evt_real_{int(time.time())}",
        "object": "event",
        "api_version": "2020-08-27",
        "created": int(time.time()),
        "data": {
            "object": {
                "id": f"cs_real_{int(time.time())}",
                "object": "checkout.session",
                "client_reference_id": "student1761846292@exemplo.com",
                "metadata": {
                    "user_id": real_user_id,
                    "subscription_plan_id": "plan_premium_full_access",
                    "access_scope": "full",
                    "duration_days": "365"
                },
                "payment_status": "paid",
                "status": "complete",
                "customer_email": "student1761846292@exemplo.com"
            }
        },
        "livemode": False,
        "pending_webhooks": 1,
        "request": {
            "id": f"req_real_{int(time.time())}",
            "idempotency_key": None
        },
        "type": "checkout.session.completed"
    }
    
    # Converter para string JSON
    payload_str = json.dumps(real_payload, separators=(',', ':'))
    
    # Criar assinatura HMAC real
    webhook_secret = "whsec_b19287079bc825dc9b05265a95795e915cabbf272abb29975acb49939413b29f"
    timestamp = str(int(time.time()))
    
    # Criar payload para assinatura
    signed_payload = f"{timestamp}.{payload_str}"
    
    # Gerar assinatura
    signature = hmac.new(
        webhook_secret.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Headers reais do Stripe
    headers = {
        "Content-Type": "application/json",
        "Stripe-Signature": f"t={timestamp},v1={signature}",
        "User-Agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)"
    }
    
    print("🚀 Enviando webhook REAL para o servidor principal...")
    print(f"📡 URL: http://localhost:8000/api/webhook/stripe")
    print(f"👤 Usuário: student1761846292@exemplo.com")
    print(f"🆔 User ID: {real_user_id}")
    print(f"📦 Payload: {json.dumps(real_payload, indent=2)}")
    print()
    
    try:
        # Enviar para o servidor REAL (porta 8000)
        response = requests.post(
            "http://localhost:8000/api/webhook/stripe",
            data=payload_str,
            headers=headers,
            timeout=10
        )
        
        print(f"✅ Status: {response.status_code}")
        print(f"📄 Resposta: {response.text}")
        
        if response.status_code == 200:
            print("🎉 Webhook real enviado com sucesso!")
            print("🔍 Agora vamos verificar se o usuário foi atualizado...")
            
            # Verificar se o usuário foi atualizado
            time.sleep(1)
            check_user_response = requests.get(
                "http://localhost:8000/api/debug/user/student1761846292@exemplo.com",
                headers={"Authorization": "Bearer admin_token_2023"},
                timeout=10
            )
            
            if check_user_response.status_code == 200:
                updated_user = check_user_response.json()
                print("📊 Status do usuário após webhook:")
                print(f"   has_full_access: {updated_user.get('has_full_access')}")
                print(f"   has_purchased: {updated_user.get('has_purchased')}")
                print(f"   subscription_plan_id: {updated_user.get('subscription_plan_id')}")
                print(f"   subscription_valid_until: {updated_user.get('subscription_valid_until')}")
            else:
                print("❌ Não foi possível verificar o status do usuário")
                
        else:
            print("❌ Erro no webhook real")
            
    except requests.exceptions.ConnectionError:
        print("❌ Não foi possível conectar ao servidor real na porta 8000")
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    create_real_webhook()
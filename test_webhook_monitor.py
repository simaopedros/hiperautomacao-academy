#!/usr/bin/env python3
"""
Script para testar o monitor de webhooks
Envia um webhook simulado para verificar se está funcionando
"""

import requests
import json
import time

def test_monitor():
    """Testa o monitor enviando um webhook simulado"""
    
    # Payload de teste simulando um checkout.session.completed
    test_payload = {
        "id": "evt_test_webhook_monitor",
        "object": "event",
        "api_version": "2020-08-27",
        "created": int(time.time()),
        "data": {
            "object": {
                "id": "cs_test_monitor_123",
                "object": "checkout.session",
                "client_reference_id": "user_test_monitor",
                "metadata": {
                    "user_id": "test-user-123",
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
            "id": "req_test_monitor",
            "idempotency_key": None
        },
        "type": "checkout.session.completed"
    }
    
    headers = {
        "Content-Type": "application/json",
        "Stripe-Signature": "t=1234567890,v1=test_signature_for_monitor",
        "User-Agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)"
    }
    
    print("🧪 Testando o monitor de webhooks...")
    print(f"📡 Enviando para: http://localhost:8001/api/webhook/stripe")
    print(f"📦 Payload: {json.dumps(test_payload, indent=2)}")
    print()
    
    try:
        response = requests.post(
            "http://localhost:8001/api/webhook/stripe",
            json=test_payload,
            headers=headers,
            timeout=10
        )
        
        print(f"✅ Status: {response.status_code}")
        print(f"📄 Resposta: {response.text}")
        
        if response.status_code == 200:
            print("🎉 Monitor está funcionando! Verifique o terminal do monitor.")
        else:
            print("❌ Algo deu errado com o monitor.")
            
    except requests.exceptions.ConnectionError:
        print("❌ Não foi possível conectar ao monitor. Verifique se está rodando na porta 8001.")
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    test_monitor()
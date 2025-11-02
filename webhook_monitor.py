#!/usr/bin/env python3
"""
Script de Monitoramento de Webhooks Stripe
Captura e exibe todos os webhooks recebidos em tempo real
"""

import json
import time
from datetime import datetime
from flask import Flask, request, jsonify
import threading
import os

app = Flask(__name__)

# Cores para terminal
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_separator():
    print(f"{Colors.OKCYAN}{'='*80}{Colors.ENDC}")

def print_timestamp():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{Colors.HEADER}[{now}]{Colors.ENDC}")

@app.route('/api/webhook/stripe', methods=['POST'])
def stripe_webhook_monitor():
    """Endpoint que monitora webhooks do Stripe"""
    
    print_separator()
    print_timestamp()
    print(f"{Colors.BOLD}{Colors.OKGREEN}🔔 WEBHOOK RECEBIDO DO STRIPE{Colors.ENDC}")
    print_separator()
    
    # Headers
    print(f"{Colors.OKBLUE}📋 HEADERS:{Colors.ENDC}")
    for header, value in request.headers.items():
        if 'stripe' in header.lower():
            print(f"  {Colors.WARNING}{header}:{Colors.ENDC} {value}")
        else:
            print(f"  {header}: {value}")
    
    print()
    
    # Payload
    try:
        payload = request.get_data(as_text=True)
        print(f"{Colors.OKBLUE}📦 PAYLOAD RAW ({len(payload)} bytes):{Colors.ENDC}")
        print(f"{Colors.OKCYAN}{payload[:500]}{'...' if len(payload) > 500 else ''}{Colors.ENDC}")
        print()
        
        # Tentar parsear como JSON
        try:
            json_data = json.loads(payload)
            print(f"{Colors.OKBLUE}📄 PAYLOAD JSON FORMATADO:{Colors.ENDC}")
            print(f"{Colors.OKCYAN}{json.dumps(json_data, indent=2, ensure_ascii=False)}{Colors.ENDC}")
            
            # Extrair informações importantes
            event_type = json_data.get('type', 'N/A')
            event_id = json_data.get('id', 'N/A')
            
            print()
            print(f"{Colors.BOLD}🎯 INFORMAÇÕES PRINCIPAIS:{Colors.ENDC}")
            print(f"  Event Type: {Colors.WARNING}{event_type}{Colors.ENDC}")
            print(f"  Event ID: {Colors.WARNING}{event_id}{Colors.ENDC}")
            
            # Se for checkout.session.completed, mostrar metadata
            if event_type == 'checkout.session.completed':
                data_obj = json_data.get('data', {}).get('object', {})
                metadata = data_obj.get('metadata', {})
                client_ref = data_obj.get('client_reference_id')
                
                print(f"  Client Reference ID: {Colors.WARNING}{client_ref}{Colors.ENDC}")
                print(f"  Metadata: {Colors.WARNING}{json.dumps(metadata, indent=4)}{Colors.ENDC}")
                
        except json.JSONDecodeError:
            print(f"{Colors.FAIL}❌ Payload não é JSON válido{Colors.ENDC}")
            
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao processar payload: {e}{Colors.ENDC}")
    
    print_separator()
    print(f"{Colors.OKGREEN}✅ Webhook capturado e exibido com sucesso{Colors.ENDC}")
    print_separator()
    print()
    
    # Retornar resposta de sucesso
    return jsonify({"status": "ok", "message": "Webhook monitorado com sucesso"}), 200

@app.route('/api/webhook/stripe-test', methods=['POST'])
def stripe_webhook_test_monitor():
    """Endpoint de teste que também monitora"""
    
    print_separator()
    print_timestamp()
    print(f"{Colors.BOLD}{Colors.WARNING}🧪 WEBHOOK DE TESTE RECEBIDO{Colors.ENDC}")
    print_separator()
    
    try:
        json_data = request.get_json()
        print(f"{Colors.OKBLUE}📄 PAYLOAD DE TESTE:{Colors.ENDC}")
        print(f"{Colors.OKCYAN}{json.dumps(json_data, indent=2, ensure_ascii=False)}{Colors.ENDC}")
        
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao processar payload de teste: {e}{Colors.ENDC}")
    
    print_separator()
    print()
    
    return jsonify({"status": "ok", "message": "Webhook de teste monitorado"}), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "message": "Monitor ativo"}), 200

def print_startup_info():
    """Exibe informações de inicialização"""
    print(f"{Colors.BOLD}{Colors.HEADER}")
    print("🔍 MONITOR DE WEBHOOKS STRIPE")
    print("=" * 50)
    print(f"{Colors.ENDC}")
    print(f"{Colors.OKGREEN}✅ Servidor iniciado em: http://localhost:8001{Colors.ENDC}")
    print(f"{Colors.OKBLUE}📡 Monitorando endpoint: /api/webhook/stripe{Colors.ENDC}")
    print(f"{Colors.WARNING}🧪 Endpoint de teste: /api/webhook/stripe-test{Colors.ENDC}")
    print(f"{Colors.OKCYAN}💡 Health check: /health{Colors.ENDC}")
    print()
    print(f"{Colors.BOLD}📋 INSTRUÇÕES:{Colors.ENDC}")
    print("1. Configure o Stripe CLI para enviar para: http://localhost:8001/api/webhook/stripe")
    print("2. Ou use: stripe listen --forward-to localhost:8001/api/webhook/stripe")
    print("3. Todos os webhooks serão exibidos aqui em tempo real")
    print()
    print(f"{Colors.WARNING}⏳ Aguardando webhooks...{Colors.ENDC}")
    print_separator()
    print()

if __name__ == '__main__':
    print_startup_info()
    
    # Executar o servidor Flask
    app.run(
        host='0.0.0.0',
        port=8001,
        debug=False,
        use_reloader=False
    )
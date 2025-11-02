#!/usr/bin/env python3
"""
Monitor de Webhooks Stripe em Tempo Real
Exibe continuamente todos os webhooks recebidos sem fechar a conexão
"""

import json
import time
import threading
from datetime import datetime
from flask import Flask, request, jsonify
import os
import sys

app = Flask(__name__)

# Lista para armazenar webhooks recebidos
webhooks_received = []
webhook_count = 0

# Lock para thread safety
webhook_lock = threading.Lock()

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

def clear_screen():
    """Limpa a tela"""
    os.system('cls' if os.name == 'nt' else 'clear')

def print_header():
    """Imprime o cabeçalho do monitor"""
    print(f"{Colors.BOLD}{Colors.HEADER}")
    print("🔍 MONITOR DE WEBHOOKS STRIPE - TEMPO REAL")
    print("=" * 60)
    print(f"{Colors.ENDC}")
    print(f"{Colors.OKGREEN}✅ Servidor ativo: http://localhost:8001{Colors.ENDC}")
    print(f"{Colors.OKBLUE}📡 Endpoint: /api/webhook/stripe{Colors.ENDC}")
    print(f"{Colors.WARNING}📊 Total de webhooks recebidos: {webhook_count}{Colors.ENDC}")
    print(f"{Colors.OKCYAN}🕐 Última atualização: {datetime.now().strftime('%H:%M:%S')}{Colors.ENDC}")
    print("=" * 60)
    print()

def print_webhook_summary(webhook_data):
    """Imprime resumo do webhook"""
    timestamp = webhook_data.get('timestamp', 'N/A')
    event_type = webhook_data.get('event_type', 'N/A')
    event_id = webhook_data.get('event_id', 'N/A')
    
    print(f"{Colors.OKGREEN}🔔 [{timestamp}] {event_type}{Colors.ENDC}")
    print(f"   ID: {event_id}")
    
    if 'metadata' in webhook_data and webhook_data['metadata']:
        print(f"   Metadata: {Colors.WARNING}{json.dumps(webhook_data['metadata'], ensure_ascii=False)}{Colors.ENDC}")
    
    print()

def update_display():
    """Atualiza a exibição em tempo real"""
    while True:
        try:
            clear_screen()
            print_header()
            
            with webhook_lock:
                if webhooks_received:
                    print(f"{Colors.BOLD}📋 ÚLTIMOS WEBHOOKS RECEBIDOS:{Colors.ENDC}")
                    print("-" * 60)
                    
                    # Mostra os últimos 10 webhooks
                    recent_webhooks = webhooks_received[-10:]
                    for webhook in recent_webhooks:
                        print_webhook_summary(webhook)
                        
                    if len(webhooks_received) > 10:
                        print(f"{Colors.OKCYAN}... e mais {len(webhooks_received) - 10} webhooks anteriores{Colors.ENDC}")
                        print()
                else:
                    print(f"{Colors.WARNING}⏳ Aguardando webhooks...{Colors.ENDC}")
                    print()
                    print("💡 Configure o Stripe CLI:")
                    print("   stripe listen --forward-to localhost:8001/api/webhook/stripe")
                    print()
            
            print(f"{Colors.OKCYAN}🔄 Atualizando a cada 2 segundos... (Ctrl+C para sair){Colors.ENDC}")
            
        except Exception as e:
            print(f"{Colors.FAIL}❌ Erro na exibição: {e}{Colors.ENDC}")
        
        time.sleep(2)

@app.route('/api/webhook/stripe', methods=['POST'])
def stripe_webhook_monitor():
    """Endpoint que monitora webhooks do Stripe"""
    global webhook_count
    
    try:
        # Captura dados do webhook
        payload = request.get_data(as_text=True)
        headers = dict(request.headers)
        
        # Parse JSON
        json_data = json.loads(payload)
        event_type = json_data.get('type', 'unknown')
        event_id = json_data.get('id', 'unknown')
        
        # Extrai metadata se disponível
        metadata = {}
        if event_type == 'checkout.session.completed':
            data_obj = json_data.get('data', {}).get('object', {})
            metadata = data_obj.get('metadata', {})
        
        # Cria registro do webhook
        webhook_data = {
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'event_type': event_type,
            'event_id': event_id,
            'metadata': metadata,
            'payload_size': len(payload),
            'headers': headers
        }
        
        # Adiciona à lista (thread safe)
        with webhook_lock:
            webhooks_received.append(webhook_data)
            webhook_count += 1
            
            # Mantém apenas os últimos 50 webhooks na memória
            if len(webhooks_received) > 50:
                webhooks_received.pop(0)
        
        return jsonify({"status": "ok", "message": "Webhook recebido"}), 200
        
    except Exception as e:
        error_data = {
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'event_type': 'ERROR',
            'event_id': 'error',
            'metadata': {'error': str(e)},
            'payload_size': 0,
            'headers': {}
        }
        
        with webhook_lock:
            webhooks_received.append(error_data)
            webhook_count += 1
        
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok", 
        "webhooks_received": webhook_count,
        "uptime": datetime.now().isoformat()
    }), 200

def run_flask_server():
    """Executa o servidor Flask em thread separada"""
    app.run(
        host='0.0.0.0',
        port=8001,
        debug=False,
        use_reloader=False,
        threaded=True
    )

if __name__ == '__main__':
    print(f"{Colors.BOLD}{Colors.OKGREEN}🚀 Iniciando Monitor de Webhooks em Tempo Real...{Colors.ENDC}")
    print()
    
    # Inicia servidor Flask em thread separada
    flask_thread = threading.Thread(target=run_flask_server, daemon=True)
    flask_thread.start()
    
    # Aguarda um pouco para o servidor iniciar
    time.sleep(2)
    
    try:
        # Inicia a exibição em tempo real
        update_display()
    except KeyboardInterrupt:
        print(f"\n{Colors.OKGREEN}✅ Monitor finalizado pelo usuário{Colors.ENDC}")
        sys.exit(0)
    except Exception as e:
        print(f"\n{Colors.FAIL}❌ Erro: {e}{Colors.ENDC}")
        sys.exit(1)
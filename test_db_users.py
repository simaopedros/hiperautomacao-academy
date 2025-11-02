#!/usr/bin/env python3
import pymongo
import os
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv('.env.development.sample')

def test_mongodb_connection():
    try:
        # Conectar ao MongoDB
        mongo_url = 'mongodb://127.0.0.1:27017'
        client = pymongo.MongoClient(mongo_url)
        db = client['hiperautomacao_academy']
        
        # Testar conexão
        client.admin.command('ping')
        print('✅ Conexão com MongoDB estabelecida com sucesso!')
        
        # Verificar usuários
        users_count = db.users.count_documents({})
        print(f'📊 Total de usuários no banco: {users_count}')
        
        if users_count > 0:
            # Mostrar alguns usuários (sem senhas)
            users = list(db.users.find({}, {'_id': 0, 'password_hash': 0}).limit(5))
            print('👥 Primeiros usuários encontrados:')
            for i, user in enumerate(users, 1):
                name = user.get('name', 'N/A')
                email = user.get('email', 'N/A')
                role = user.get('role', 'N/A')
                has_full_access = user.get('has_full_access', False)
                print(f'  {i}. {name} - {email} - Role: {role} - Full Access: {has_full_access}')
        else:
            print('⚠️  Nenhum usuário encontrado no banco de dados!')
            
        # Verificar coleções disponíveis
        collections = db.list_collection_names()
        print(f'📁 Coleções disponíveis: {collections}')
        
        # Verificar se há tokens de convite pendentes
        if 'password_tokens' in collections:
            tokens_count = db.password_tokens.count_documents({})
            print(f'🎫 Tokens de convite pendentes: {tokens_count}')
            
        client.close()
        
    except Exception as e:
        print(f'❌ Erro ao conectar com MongoDB: {e}')

if __name__ == '__main__':
    test_mongodb_connection()
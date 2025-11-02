#!/usr/bin/env python3
"""
Script para verificar o status específico do usuário student1761846292@exemplo.com
"""

import pymongo
import json
from datetime import datetime

def check_user_status():
    """Verifica o status do usuário específico"""
    
    try:
        # Conectar ao MongoDB
        client = pymongo.MongoClient("mongodb://localhost:27017/")
        db = client["hiperautomacao_academy"]
        
        email = "student1761846292@exemplo.com"
        print(f"🔍 Buscando usuário: {email}")
        print("=" * 60)
        
        # Buscar usuário
        user = db.users.find_one({"email": email})
        
        if not user:
            print("❌ Usuário não encontrado!")
            return
        
        print("✅ Usuário encontrado!")
        print(f"📧 Email: {user.get('email', 'N/A')}")
        print(f"👤 Nome: {user.get('name', 'N/A')}")
        print(f"🆔 ID: {user.get('id', user.get('_id', 'N/A'))}")
        print(f"🎭 Role: {user.get('role', 'N/A')}")
        print(f"🔓 Has Full Access: {user.get('has_full_access', False)}")
        print(f"💳 Has Purchased: {user.get('has_purchased', False)}")
        print(f"📅 Subscription Plan ID: {user.get('subscription_plan_id', 'N/A')}")
        print(f"⏰ Subscription Valid Until: {user.get('subscription_valid_until', 'N/A')}")
        print(f"📚 Enrolled Courses: {len(user.get('enrolled_courses', []))}")
        
        # Mostrar cursos matriculados
        enrolled_courses = user.get('enrolled_courses', [])
        if enrolled_courses:
            print("\n📚 Cursos matriculados:")
            for course_id in enrolled_courses:
                course = db.courses.find_one({"id": course_id}, {"title": 1, "language": 1})
                if course:
                    print(f"  - {course.get('title', 'N/A')} ({course.get('language', 'N/A')})")
                else:
                    print(f"  - Curso ID: {course_id} (não encontrado)")
        
        # Verificar plano de assinatura
        subscription_plan_id = user.get('subscription_plan_id')
        if subscription_plan_id:
            plan = db.subscription_plans.find_one({"id": subscription_plan_id})
            if plan:
                print(f"\n💎 Plano de Assinatura:")
                print(f"  - Nome: {plan.get('name', 'N/A')}")
                print(f"  - Preço: {plan.get('price', 'N/A')}")
                print(f"  - Duração: {plan.get('duration_days', 'N/A')} dias")
                print(f"  - Acesso: {plan.get('access_scope', 'N/A')}")
        
        print("\n" + "=" * 60)
        print("🎯 RESUMO DO STATUS:")
        
        if user.get('has_full_access'):
            print("✅ Usuário TEM acesso completo")
        else:
            print("❌ Usuário NÃO tem acesso completo")
            
        if user.get('has_purchased'):
            print("✅ Usuário fez compra")
        else:
            print("❌ Usuário não fez compra")
            
        # Verificar se a assinatura está válida
        subscription_valid_until = user.get('subscription_valid_until')
        if subscription_valid_until:
            if isinstance(subscription_valid_until, str):
                try:
                    valid_until = datetime.fromisoformat(subscription_valid_until.replace('Z', '+00:00'))
                    if valid_until > datetime.now():
                        print("✅ Assinatura está válida")
                    else:
                        print("❌ Assinatura expirou")
                except:
                    print("⚠️ Data de validade inválida")
            else:
                print("⚠️ Data de validade em formato desconhecido")
        else:
            print("❌ Sem data de validade da assinatura")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    check_user_status()
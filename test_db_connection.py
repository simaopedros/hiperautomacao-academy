import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_database_connection():
    """Test MongoDB connection and basic operations"""
    try:
        # Get MongoDB URI from environment
        mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
        database_name = os.getenv('DATABASE_NAME', 'hiperautomacao_academy')
        
        print(f"Tentando conectar ao MongoDB: {mongodb_uri}")
        print(f"Database: {database_name}")
        
        # Create client
        client = AsyncIOMotorClient(mongodb_uri)
        db = client[database_name]
        
        # Test connection
        await client.admin.command('ping')
        print("✅ Conexão com MongoDB estabelecida com sucesso!")
        
        # List collections
        collections = await db.list_collection_names()
        print(f"📋 Collections encontradas: {collections}")
        
        # Test basic queries on main collections
        if 'users' in collections:
            user_count = await db.users.count_documents({})
            print(f"👥 Total de usuários: {user_count}")
            
            # Get sample user (without sensitive data)
            sample_user = await db.users.find_one({}, {"password": 0, "hashed_password": 0})
            if sample_user:
                print(f"📄 Exemplo de usuário: {sample_user.get('name', 'N/A')} - {sample_user.get('email', 'N/A')}")
        
        if 'courses' in collections:
            course_count = await db.courses.count_documents({})
            print(f"📚 Total de cursos: {course_count}")
            
            # Get sample course
            sample_course = await db.courses.find_one({})
            if sample_course:
                print(f"📖 Exemplo de curso: {sample_course.get('title', 'N/A')}")
        
        if 'enrollments' in collections:
            enrollment_count = await db.enrollments.count_documents({})
            print(f"🎓 Total de matrículas: {enrollment_count}")
        
        if 'credit_transactions' in collections:
            transaction_count = await db.credit_transactions.count_documents({})
            print(f"💰 Total de transações de crédito: {transaction_count}")
        
        # Close connection
        client.close()
        print("✅ Teste de conexão concluído com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro na conexão com o banco de dados: {str(e)}")
        print(f"Tipo do erro: {type(e).__name__}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(test_database_connection())
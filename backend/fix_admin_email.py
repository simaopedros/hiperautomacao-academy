import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
default_env_file = ROOT_DIR / '.env'
if default_env_file.exists():
    load_dotenv(default_env_file, override=False)

app_env = os.getenv('APP_ENV', 'development')
env_specific_file = ROOT_DIR / f'.env.{app_env}'
if env_specific_file.exists():
    load_dotenv(env_specific_file, override=True)

async def run():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    try:
        print("=== FIX ADMIN EMAIL ===")
        admin = await db.users.find_one({"role": "admin"})
        if not admin:
            print("Nenhum admin encontrado.")
            return
        new_email = os.environ.get('DEFAULT_ADMIN_EMAIL', 'admin@example.com')
        result = await db.users.update_one({"id": admin["id"]}, {"$set": {"email": new_email}})
        if result.modified_count:
            print(f"✅ Email do admin atualizado para: {new_email}")
        else:
            print("Nada atualizado (email pode já estar igual).")
    finally:
        client.close()

if __name__ == '__main__':
    import asyncio
    asyncio.run(run())
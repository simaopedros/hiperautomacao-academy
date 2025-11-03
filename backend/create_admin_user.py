import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# Load environment variables (default .env then env-specific)
ROOT_DIR = Path(__file__).parent
default_env_file = ROOT_DIR / '.env'
if default_env_file.exists():
    load_dotenv(default_env_file, override=False)

app_env = os.getenv('APP_ENV', 'development')
env_specific_file = ROOT_DIR / f'.env.{app_env}'
if env_specific_file.exists():
    load_dotenv(env_specific_file, override=True)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def main():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Admin credentials (change if needed)
    admin_email = os.environ.get('DEFAULT_ADMIN_EMAIL', 'admin@hiperautomacao.local')
    admin_name = os.environ.get('DEFAULT_ADMIN_NAME', 'Administrador')
    admin_password = os.environ.get('DEFAULT_ADMIN_PASSWORD', 'admin123')

    async def run():
        print("=== CREATE ADMIN USER ===")
        existing_admin = await db.users.find_one({"role": "admin"})
        if existing_admin:
            print(f"Admin já existe: {existing_admin.get('email')} - nada a fazer.")
            return

        user_id = str(uuid.uuid4())
        password_hash = pwd_context.hash(admin_password)
        now_iso = datetime.now(timezone.utc).isoformat()

        user_doc = {
            "id": user_id,
            "email": admin_email,
            "name": admin_name,
            "role": "admin",
            "avatar": None,
            "has_full_access": True,
            "full_access": True,
            "has_purchased": False,
            "enrolled_courses": [],
            "invited": False,
            "password_created": True,
            "created_at": now_iso,
            "password_hash": password_hash,
        }

        await db.users.insert_one(user_doc)
        print("✅ Admin criado com sucesso!")
        print(f"Email: {admin_email}")
        print(f"Senha: {admin_password}")

    import asyncio
    try:
        asyncio.run(run())
    finally:
        client.close()

if __name__ == '__main__':
    main()
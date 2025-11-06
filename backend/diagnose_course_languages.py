import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables similar to server.py
ROOT_DIR = Path(__file__).parent
default_env_file = ROOT_DIR / '.env'
if default_env_file.exists():
    load_dotenv(default_env_file, override=False)

app_env = os.getenv('APP_ENV', 'development')
env_specific_file = ROOT_DIR / f'.env.{app_env}'
if env_specific_file.exists():
    load_dotenv(env_specific_file, override=True)


def _sanitize_language_token(code: str | None) -> str:
    if code is None:
        return ""
    if not isinstance(code, str):
        return ""
    code = code.strip().lower()
    # normalize separator and trim
    code = code.replace('_', '-')
    return code


SUPPORTED_LANGUAGES = {
    "pt": {"aliases": {"pt-br"}, "prefixes": {"pt"}},
    "en": {"aliases": set(), "prefixes": {"en"}},
    "es": {"aliases": set(), "prefixes": {"es"}},
}


def _normalize_language(code: str | None) -> str | None:
    if code is None:
        return None
    token = _sanitize_language_token(code)
    if token in {"", "all", "any", "todos", "todas", "todo"}:
        return None
    # exact base
    if token in SUPPORTED_LANGUAGES:
        return token
    # alias match
    for base, meta in SUPPORTED_LANGUAGES.items():
        if token in meta["aliases"]:
            return base
        for prefix in meta["prefixes"]:
            if token.startswith(prefix):
                return base
    return None


async def diagnose_course_languages():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]

    try:
        print("=== DIAGNOSE COURSE LANGUAGES ===")
        courses = await db.courses.find({}, {"_id": 0, "id": 1, "title": 1, "language": 1}).to_list(2000)
        print(f"Found {len(courses)} courses")

        counts: dict[str, int] = {}
        invalid: list[dict] = []
        none_count = 0

        for c in courses:
            lang = c.get("language")
            norm = _normalize_language(lang) if isinstance(lang, str) else None if lang is None else _normalize_language(str(lang))
            if lang is None or (isinstance(lang, str) and _sanitize_language_token(lang) in {"", "all", "any", "todos", "todas", "todo"}):
                none_count += 1
                status = "ALL"
            elif norm is None:
                invalid.append(c)
                status = "INVALID"
            else:
                counts[norm] = counts.get(norm, 0) + 1
                status = norm
            print(f"- {c.get('title','<no title>')} [{c.get('id','no-id')}] -> language={lang} status={status}")

        print("\n=== SUMMARY ===")
        print(f"All-languages (None/any): {none_count}")
        for base, total in sorted(counts.items()):
            print(f"{base}: {total}")
        print(f"Invalid entries: {len(invalid)}")
        if invalid:
            print("\nInvalid course languages:")
            for c in invalid:
                print(f"  - {c.get('title','<no title>')} [{c.get('id','no-id')}] language={c.get('language')}")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(diagnose_course_languages())
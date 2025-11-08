import json
import time
from pathlib import Path
import re
from copy import deepcopy

from googletrans import Translator

BASE_LOCALE_PATH = Path("frontend/src/i18n/locales")
SOURCE_FILE = BASE_LOCALE_PATH / "en-US.json"

TARGET_LOCALES = {
    "fr-FR": "fr",
}

PLACEHOLDER_PATTERN = re.compile(r"\{\{.*?\}\}")


def protect_placeholders(text: str):
    replacements = {}
    protected = text

    def _replacement(match):
        token = f"__PH_{len(replacements)}__"
        replacements[token] = match.group(0)
        return token

    protected = PLACEHOLDER_PATTERN.sub(_replacement, protected)
    return protected, replacements


def restore_placeholders(text: str, replacements: dict[str, str]):
    restored = text
    for token, original in replacements.items():
        restored = restored.replace(token, original)
    return restored


def translate_text(translator: Translator, text: str, dest: str, cache: dict):
    cache_key = (text, dest)
    if cache_key in cache:
        return cache[cache_key]

    if not text.strip():
        cache[cache_key] = text
        return text

    protected, replacements = protect_placeholders(text)

    attempt = 0
    while True:
        attempt += 1
        try:
            translated = translator.translate(protected, src="en", dest=dest).text
            restored = restore_placeholders(translated, replacements)
            cache[cache_key] = restored
            return restored
        except Exception as exc:  # noqa: BLE001
            if attempt >= 5:
                print(f"[WARN] Failed to translate '{text}' to {dest}: {exc}")
                cache[cache_key] = text
                return text
            time.sleep(min(5, attempt))


def translate_value(translator: Translator, value, dest: str, cache: dict):
    if isinstance(value, dict):
        return {
            key: translate_value(translator, nested, dest, cache)
            for key, nested in value.items()
        }
    if isinstance(value, list):
        return [translate_value(translator, item, dest, cache) for item in value]
    if isinstance(value, str):
        return translate_text(translator, value, dest, cache)
    return value


def main():
    with SOURCE_FILE.open("r", encoding="utf-8") as f:
        source = json.load(f)

    translator = Translator()
    cache: dict[tuple[str, str], str] = {}

    for locale, dest_code in TARGET_LOCALES.items():
        print(f"[INFO] Translating locale {locale}...")
        translated = translate_value(translator, deepcopy(source), dest_code, cache)
        target_file = BASE_LOCALE_PATH / f"{locale}.json"
        with target_file.open("w", encoding="utf-8") as f:
            json.dump(translated, f, ensure_ascii=False, indent=2)
        print(f"[INFO] Wrote {target_file}")


if __name__ == "__main__":
    main()

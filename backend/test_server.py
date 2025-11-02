#!/usr/bin/env python3
import sys
import traceback

try:
    print("Importing server...")
    with open('server.py', 'r', encoding='utf-8') as f:
        exec(f.read())
    print("Server imported successfully!")
except Exception as e:
    print(f"Error importing server: {e}")
    traceback.print_exc()
    sys.exit(1)
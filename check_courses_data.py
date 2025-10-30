#!/usr/bin/env python3
from pymongo import MongoClient

def check_courses():
    client = MongoClient('mongodb://localhost:27017')
    db = client.hiperautomacao_academy
    
    print("=== COURSES IN DATABASE ===")
    courses = list(db.courses.find({}, {'_id': 0, 'title': 1, 'categories': 1, 'category': 1}).limit(5))
    
    for course in courses:
        print(f'Title: {course.get("title", "N/A")}')
        print(f'Categories: {course.get("categories", [])}')
        print(f'Category (legacy): {course.get("category", "N/A")}')
        print('---')
    
    print("\n=== CATEGORIES IN DATABASE ===")
    categories = list(db.categories.find({}, {'_id': 0, 'id': 1, 'name': 1}))
    
    for cat in categories:
        print(f'ID: {cat.get("id", "N/A")}')
        print(f'Name: {cat.get("name", "N/A")}')
        print('---')
    
    client.close()

if __name__ == "__main__":
    check_courses()
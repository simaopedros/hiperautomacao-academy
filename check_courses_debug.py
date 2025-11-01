import pymongo

try:
    # Conectar ao MongoDB
    client = pymongo.MongoClient('mongodb://localhost:27017/')
    db = client.hiperautomacao_academy
    
    # Verificar cursos
    total_courses = db.courses.count_documents({})
    published_courses = db.courses.count_documents({"published": True})
    
    print(f"Total de cursos no banco: {total_courses}")
    print(f"Cursos publicados: {published_courses}")
    
    if total_courses > 0:
        print("\nPrimeiros 3 cursos:")
        for course in db.courses.find().limit(3):
            title = course.get("title", "Sem título")
            course_id = course.get("id", "N/A")
            published = course.get("published", False)
            language = course.get("language", "N/A")
            print(f"- {title} (ID: {course_id}, Published: {published}, Language: {language})")
    else:
        print("Nenhum curso encontrado no banco de dados!")
        
except Exception as e:
    print(f"Erro ao conectar ao banco: {e}")
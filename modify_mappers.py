import re
with open('app/mappers.py', 'r', encoding='utf-8') as f:
    t = f.read()

target = '''    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],'''

rep = '''    try:
        project_id = row["project_id"]
    except (IndexError, KeyError):
        project_id = None

    try:
        focus_time = dict(row).get("focus_time_spent", 0)
    except (IndexError, KeyError, TypeError):
        focus_time = 0

    return {
        "id": row["id"],
        "project_id": project_id,
        "focus_time_spent": focus_time,
        "title": row["title"],
        "description": row["description"],'''

t = t.replace(target, rep)
with open('app/mappers.py', 'w', encoding='utf-8') as f:
    f.write(t)

import sqlite3
import os

db_path = 'data/database.sqlite' # guessing path, maybe data is there? let's check
if not os.path.exists(db_path):
    db_path = 'app.db' # let's search for the db file

print('DB found at:', db_path)

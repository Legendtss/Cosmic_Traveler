#!/usr/bin/env python3
"""Create a test account for Goals testing"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.auth import hash_password
from app.utils import now_iso

DB_PATH = 'data/fitness.sqlite'

def create_test_account():
    """Create a single test account"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    test_email = 'test@example.com'
    test_password = 'password123'
    
    # Check if already exists
    c.execute("SELECT id FROM users WHERE email = ?", (test_email,))
    if c.fetchone():
        print(f"Account {test_email} already exists!")
        conn.close()
        return
    
    # Insert new user
    hashed_pwd = hash_password(test_password)
    c.execute("""
        INSERT INTO users 
        (email, password_hash, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
    """, (test_email, hashed_pwd, "Test User", now_iso(), now_iso()))
    
    user_id = c.lastrowid
    
    conn.commit()
    conn.close()
    
    print(f"✓ Created test account:")
    print(f"  Email: {test_email}")
    print(f"  Password: {test_password}")

if __name__ == '__main__':
    create_test_account()

#!/usr/bin/env python3
"""Create a test account for Goals testing."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app import app as flask_app
from app.auth import hash_password
from app.db import get_db
from app.utils import now_iso


def create_test_account():
    """Create a single test account."""
    test_email = "testgoals@test.com"
    test_password = "password123"

    with flask_app.app_context():
        db = get_db()
        existing = db.execute("SELECT id FROM users WHERE email = ?", (test_email,)).fetchone()
        if existing:
            print(f"Account {test_email} already exists!")
            return

        db.execute(
            """
            INSERT INTO users
            (email, password_hash, display_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (test_email, hash_password(test_password), "Goals Test", now_iso(), now_iso()),
        )
        db.commit()

    print("Created test account:")
    print(f"  Email: {test_email}")
    print(f"  Password: {test_password}")


if __name__ == "__main__":
    create_test_account()

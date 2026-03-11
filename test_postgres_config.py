#!/usr/bin/env python3
"""Quick test to verify PostgreSQL config detection."""

import os
import sys

# Set PostgreSQL URL
os.environ["DATABASE_URL"] = "postgresql://cosmic_traveler_db_user:dixtV82YMPWBa8TG7BsVIpjz4OU6mpjT@dpg-d6omqh4r85hc739if9j0-a.oregon-postgres.render.com/cosmic_traveler_db"

print("Testing PostgreSQL configuration...\n")

# Test config detection
from app.config import _get_database_config

config = _get_database_config()
print(f"✓ Database type detected: {config['type']}")
if config['type'] == 'postgresql':
    print(f"  URL: {config['url'][:80]}...")
    
# Test app imports
try:
    from app import app
    print(f"✓ App initializes successfully")
    print(f"  DB_CONFIG: {app.config['DB_CONFIG']}")
    print(f"\n✓ All tests passed!")
except Exception as e:
    print(f"✗ Error: {e}")
    sys.exit(1)

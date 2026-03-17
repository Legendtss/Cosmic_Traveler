#!/usr/bin/env python3
"""Direct route test"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app import create_app

app = create_app()

# Create test client
client = app.test_client()

# Login
print("1. LOGIN...")
resp = client.post('/api/auth/login',
    json={'email': 'testgoals@test.com', 'password': 'password123'},
    headers={'Content-Type': 'application/json'}
)
print(f"   Status: {resp.status_code}")
print(f"   Response: {resp.get_json()}")
print()

# Get Goals
print("2. GET GOALS...")
resp = client.get('/api/goals')
print(f"   Status: {resp.status_code}")
data = resp.get_json()
print(f"   Response: {data}")
if resp.status_code == 200:
    print(f"   ✓ Success! Found {len(data.get('goals', []))} goals")
else:
    print(f"   ✗ Error: {data}")

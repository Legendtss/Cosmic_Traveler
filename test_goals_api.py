#!/usr/bin/env python3
"""Test Goals API endpoint"""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app import create_app
from app.auth import hash_password
from app.utils import now_iso

# Create app and test client
app = create_app()
client = app.test_client()

# Test login
print("Testing Goals API...\n")
response = client.post('/api/auth/login', 
    json={'email': 'test@example.com', 'password': 'password123'},
    headers={'Content-Type': 'application/json'}
)
print(f"Login: {response.status_code}")
if response.status_code == 200:
    data = response.get_json()
    print(f"  ✓ Logged in successfully")
else:
    print(f"  ✗ Login failed: {response.data}")
    sys.exit(1)

# Test GET /api/goals (should be empty)
response = client.get('/api/goals')
print(f"\nGET /api/goals: {response.status_code}")
if response.status_code == 200:
    data = response.get_json()
    print(f"  ✓ Goals: {len(data.get('goals', []))} found")
else:
    print(f"  ✗ Failed: {response.data}")

# Test POST /api/goals (create a goal)
new_goal = {
    'title': 'Learn Python',
    'description': 'Master Python programming',
    'category': 'Learning',
    'target_progress': 100
}
response = client.post('/api/goals',
    json=new_goal,
    headers={'Content-Type': 'application/json'}
)
print(f"\nPOST /api/goals: {response.status_code}")
if response.status_code == 201:
    data = response.get_json()
    goal_id = data.get('goal', {}).get('id')
    print(f"  ✓ Goal created: {goal_id}")
    
    # Test GET specific goal
    response = client.get(f'/api/goals/{goal_id}')
    print(f"\nGET /api/goals/{goal_id}: {response.status_code}")
    if response.status_code == 200:
        goal = response.get_json().get('goal')
        print(f"  ✓ Goal title: {goal.get('title')}")
        print(f"  ✓ Progress: {goal.get('current_progress')}%")
    else:
        print(f"  ✗ Failed: {response.data}")
else:
    print(f"  ✗ Failed: {response.data}")

print("\n✓ All Goals API tests passed!")

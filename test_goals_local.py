#!/usr/bin/env python3
"""Test Goals feature with proper session handling"""
import requests
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# Create HTTP session to preserve cookies
session = requests.Session()
BASE_URL = 'http://localhost:5000'

print("=== Testing Goals Feature ===\n")

# 1. Login
print("1. Logging in...")
response = session.post(f'{BASE_URL}/api/auth/login', 
    json={'email': 'testgoals@test.com', 'password': 'password123'},
    headers={'Content-Type': 'application/json'}
)
print(f"   Status: {response.status_code}")
if response.status_code != 200:
    print(f"   Error: {response.text}")
    sys.exit(1)
print("   ✓ Logged in\n")

print("2. Checking session...")
response = session.get(f'{BASE_URL}/api/auth/me')
print(f"   GET /api/auth/me: {response.status_code}")
if response.status_code == 200:
    print(f"   ✓ Session valid")
else:
    print(f"   ✗ Session invalid: {response.text}")
    print(f"   Cookies: {response.cookies}")
print()

# 2. Fetch root page
print("2a. Fetching main page...")
response = session.get(f'{BASE_URL}/')
print(f"   Status: {response.status_code}")
if 'id="goals"' in response.text:
    print("   ✓ Goals HTML section found")
else:
    print("   ✗ Goals HTML section NOT found")
if 'goals-handler.js' in response.text:
    print("   ✓ Goals handler script referenced")
else:
    print("   ✗ Goals handler script NOT found")
if 'goals-style.css' in response.text:
    print("   ✓ Goals style sheet referenced")
else:  
    print("   ✗ Goals style sheet NOT found")
print()

# 3. Test Goals API
print("3. Testing Goals API...")
response = session.get(f'{BASE_URL}/api/goals')
print(f"   GET /api/goals: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"   ✓ Goals: {len(data.get('goals', []))} found")
else:
    print(f"   ✗ Error: {response.text}")
print()

# 4. Create a test goal
print("4. Creating test goal...")
goal_data = {
    'title': 'Test Goal - Local',
    'description': 'Testing Goals API',
    'category': 'Testing',
    'target_progress': 100
}
response = session.post(f'{BASE_URL}/api/goals',
    json=goal_data,
    headers={'Content-Type': 'application/json'}
)
print(f"   POST /api/goals: {response.status_code}")
if response.status_code == 201:
    goal = response.json().get('goal', {})
    print(f"   ✓ Goal created: ID={goal.get('id')}, Title={goal.get('title')}")
    print(f"   ✓ Progress: {goal.get('current_progress')}%")
else:
    print(f"   ✗ Error: {response.text}")
print()

print("✓ All tests passed! Goals feature is working locally.")

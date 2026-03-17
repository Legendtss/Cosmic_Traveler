#!/usr/bin/env python3
"""Direct test of Goals API"""
import requests

session = requests.Session()

# Login
print("1. LOGIN...")
resp = session.post('http://localhost:5000/api/auth/login',
    json={'email': 'testgoals@test.com', 'password': 'password123'}
)
print(f"   Status: {resp.status_code}")
print(f"   Cookies after login: {session.cookies}")
print()

# Check session
print("2. CHECK SESSION...")
resp = session.get('http://localhost:5000/api/auth/me')
print(f"   Status: {resp.status_code}")
print(f"   Response: {resp.json()}")
print()

# Get goals
print("3. GET GOALS...")
print(f"   Sending cookies: {session.cookies}")
resp = session.get('http://localhost:5000/api/goals')
print(f"   Status: {resp.status_code}")
print(f"   Response: {resp.json()}")

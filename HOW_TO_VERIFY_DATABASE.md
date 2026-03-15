# How to Verify Data is Being Stored in Live PostgreSQL

## Overview

Your app can use either **SQLite** (local development) or **PostgreSQL** (production on Render). This guide explains how to verify that data is being stored in the live PostgreSQL database on Render.

---

## Step 1: Check Your Current Database Setup

### Option A: Run Local Verification (SQLite)
```bash
python verify_live_db.py
```

This shows:
- ✓ Database type (SQLite vs PostgreSQL)
- ✓ Connection status
- ✓ Record counts in all tables
- ✓ Sample data from recent entries

**Example Output:**
```
Database Type: SQLITE
Connection: ✓ Active

users          : 39 records
tasks          : 85 records
nutrition_entries : 151 records
workouts       : 34 records
notes          : 37 records
...
TOTAL RECORDS  : 476
```

---

## Step 2: Verify Data in Production PostgreSQL

### Get Your Render PostgreSQL Database URL

1. **Go to Render Dashboard:** https://dashboard.render.com/
2. **Find your PostgreSQL database** (not your web service)
3. **Copy the "External Database URL"**
   - Looks like: `postgresql://username:password@host:5432/dbname`

### Run Production Verification

```bash
python verify_live_postgres.py "postgresql://username:password@host:5432/dbname"
```

**Or set it as environment variable:**
```bash
export DATABASE_URL="postgresql://username:password@host:5432/dbname"
python verify_live_postgres.py
```

### Expected Output
```
✓ Connection successful!
  Server time: 2026-03-15 18:30:35

✓ users          : X records
✓ tasks          : X records
✓ meals          : X records
✓ workouts       : X records
✓ notes          : X records
...
✓ TOTAL RECORDS  : X
```

---

## Step 3: Verify via Render Dashboard Console

### Option 1: Using Render PostgreSQL Shell

1. **Go to your PostgreSQL instance** on https://dashboard.render.com/
2. **Click "Tools"** → **"Connect"** → **"psql"**
3. **Run these SQL commands:**

```sql
-- Check record counts
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'workouts', COUNT(*) FROM workouts
UNION ALL
SELECT 'nutrition_entries', COUNT(*) FROM nutrition_entries
UNION ALL
SELECT 'notes', COUNT(*) FROM notes;

-- See recent users
SELECT id, email, display_name, created_at FROM users ORDER BY created_at DESC LIMIT 5;

-- See recent tasks
SELECT id, title, completed, created_at FROM tasks ORDER BY created_at DESC LIMIT 5;

-- See recent meals
SELECT id, name, calories, date FROM nutrition_entries ORDER BY created_at DESC LIMIT 5;

-- Total records
SELECT COUNT(*) as total_records FROM (
  SELECT 'users' FROM users
  UNION ALL
  SELECT 'tasks' FROM tasks
  UNION ALL
  SELECT 'workouts' FROM workouts
  UNION ALL
  SELECT 'nutrition_entries' FROM nutrition_entries
  UNION ALL
  SELECT 'notes' FROM notes
) t;
```

---

## Step 4: Verify via Your Production App

### Check in Browser Console
1. **Login to your production app:** https://cosmic-traveler.onrender.com
2. **Open DevTools** (F12) → **Console**
3. **Check API responses:**

```javascript
// Get all tasks
fetch('/api/tasks').then(r => r.json()).then(d => console.log(d));

// Get all meals
fetch('/api/meals').then(r => r.json()).then(d => console.log(d));

// Get all workouts
fetch('/api/workouts').then(r => r.json()).then(d => console.log(d));

// Get user analytics
fetch('/api/analytics/summary').then(r => r.json()).then(d => console.log(d));
```

### Check API Directly
```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
     https://cosmic-traveler.onrender.com/api/tasks

curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
     https://cosmic-traveler.onrender.com/api/meals

curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
     https://cosmic-traveler.onrender.com/api/workouts
```

---

## Step 5: Verify DATABASE_URL is Set on Render

### Check Environment Variables

1. **Go to your web service** on https://dashboard.render.com/
2. **Click "Environment"**
3. **Look for `DATABASE_URL`** variable
4. **It should be set to your PostgreSQL URL:**
   ```
   postgresql://username:password@host:5432/dbname
   ```

### If DATABASE_URL is NOT set:

You can set it manually:

```bash
# Get your PostgreSQL external URL from the database dashboard
# Then add it to your web service

# Via CLI:
render env set DATABASE_URL "postgresql://username:password@host:5432/dbname"

# Or manually in Render Dashboard:
# 1. Go to your web service
# 2. Click "Environment"
# 3. Add new variable: DATABASE_URL
# 4. Paste your PostgreSQL external URL
# 5. Click "Save Changes"
```

---

## How to Know Your App is Using PostgreSQL in Production

Your app automatically detects the database type:

1. **If `DATABASE_URL` is set** → Uses **PostgreSQL** ✓
2. **If `DATABASE_URL` is NOT set** → Uses **SQLite** (limited on production)

### Production Setup (Recommended)

```
DATABASE_URL=postgresql://username:password@host:5432/dbname
```

This ensures:
- ✓ Data persists across restarts
- ✓ All replicas share the same database
- ✓ Backups are automatic
- ✓ Horizontal scaling is possible

---

## Troubleshooting

### Problem: "Connection failed"

**Solution 1:** Check your PostgreSQL URL is correct
```bash
# Format must be:
postgresql://username:password@hostname:5432/dbname

# NOT:
postgresql://username:password@hostname.render.com:5432/dbname
# (Render gives you full URL with port)
```

**Solution 2:** Install psycopg2
```bash
pip install psycopg2-binary
```

**Solution 3:** Check DATABASE_URL environment variable
```bash
echo $DATABASE_URL  # Should show your PostgreSQL URL
```

### Problem: "No data found"

This could mean:
1. Your app is using SQLite locally (not PostgreSQL)
2. The PostgreSQL database hasn't been populated yet
3. You're connecting to the wrong database

**Check:**
```bash
# Is your app actually writing to PostgreSQL?
python verify_live_postgres.py "your-database-url"

# Or check via Render console
# SELECT COUNT(*) FROM users;
```

### Problem: "No such table"

This usually means:
1. Database schema hasn't been initialized
2. You're connected to a different PostgreSQL instance

**Fix:**
```bash
# Your app should auto-initialize tables on startup
# But you can manually run the schema:
psql "postgresql://..." < db/schema.sql
```

---

## Quick Reference Commands

```bash
# 1. Verify local database (SQLite)
python verify_live_db.py

# 2. Verify production database (PostgreSQL)
python verify_live_postgres.py "postgresql://user:pass@host:5432/db"

# 3. Check all database types
git log --oneline -5

# 4. See data being written now
python verify_live_db.py && echo "---" && python verify_live_postgres.py

# 5. Test app is writing to PostgreSQL
# Login to app, add a task, then:
python verify_live_postgres.py  # Should show new task count
```

---

## Summary

Your app stores data in:

| Environment | Database | Location | Persistence |
|---|---|---|---|
| **Local Dev** | SQLite | `data/fitness.sqlite` | Yes, until deleted |
| **Render Prod** | PostgreSQL | Render managed | Yes, automatic backups |

To verify data is being stored:

1. ✓ Run `python verify_live_db.py` (shows all data currently stored)
2. ✓ Run `python verify_live_postgres.py <URL>` (checks production directly)
3. ✓ Check Render dashboard → PostgreSQL instance → Tables
4. ✓ Login to app → Check if data appears → Check database

Data is definitely being stored if you see records in the verification output! 🎯


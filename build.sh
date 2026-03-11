#!/bin/bash

set -e

echo "==> Upgrading build tools..."
pip install --upgrade pip setuptools wheel

echo "==> Installing Python dependencies..."
# psycopg2 compiles from source, which is more compatible than psycopg2-binary
pip install -r requirements.txt

echo "==> Verifying psycopg2 installation..."
if python -c "import psycopg2; print(f'✓ psycopg2 version: {psycopg2.__version__}')" 2>/dev/null; then
  echo "PostgreSQL support enabled"
else
  echo "⚠ psycopg2 not available - app will use SQLite fallback"
fi

echo "==> Build complete!"

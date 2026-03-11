#!/bin/bash

set -e

echo "==> Installing Python dependencies..."
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

echo "==> Verifying psycopg2 installation..."
python -c "import psycopg2; print(f'psycopg2 version: {psycopg2.__version__}')" || echo "WARNING: psycopg2 not available - will use SQLite"

echo "==> Build complete!"

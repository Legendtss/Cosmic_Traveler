#!/bin/bash
set -e

echo "==> Installing system dependencies for psycopg2 compilation..."
apk add --no-cache gcc musl-dev postgresql-dev python3-dev libpq

echo "==> Upgrading pip, setuptools, wheel..."
pip install --upgrade pip setuptools wheel

echo "==> Installing Python requirements..."
pip install -r requirements.txt

echo "==> Verifying psycopg2 installation..."
python -c "import psycopg2; print(f'✓ psycopg2 {psycopg2.__version__} installed successfully')" || (echo "⚠ WARNING: psycopg2 installation failed" && false)

echo "==> Build complete!"

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies: build tools AND runtime libraries
# gcc, make, libpq-dev needed for psycopg2 compilation
# libpq5 needed for psycopg2 runtime
RUN apt-get update && apt-get install -y \
    gcc \
    make \
    libpq-dev \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install build tools
RUN pip install --upgrade pip setuptools wheel

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application code
COPY . .

# Verify psycopg2 is available
RUN python -c "import psycopg2; print(f'✓ psycopg2 {psycopg2.__version__} loaded successfully')" || (echo "ERROR: psycopg2 failed to import" && false)

# Run the app
CMD ["gunicorn", "run:app", "--bind", "0.0.0.0:$PORT"]

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies needed for psycopg2 compilation
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Copy application code
COPY . .

# Run the app
CMD ["gunicorn", "run:app", "--bind", "0.0.0.0:$PORT"]

FROM python:3.12-slim

WORKDIR /app

# Install shared library first
COPY shared /app/shared
RUN pip install --no-cache-dir -e /app/shared

# Install service dependencies
COPY services/ingestion-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy service source
COPY services/ingestion-service/src /app/src

ENV PYTHONPATH=/app
EXPOSE 8001

CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]

FROM python:3.12-slim

WORKDIR /app

COPY shared /app/shared
COPY services/ingestion-service /app/services/ingestion-service

RUN pip install --no-cache-dir -e /app/shared
RUN pip install --no-cache-dir -r /app/services/ingestion-service/requirements.txt

ENV PYTHONPATH=/app
EXPOSE 8001

CMD ["python", "services/ingestion-service/src/main.py"]

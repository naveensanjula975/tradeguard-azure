FROM python:3.12-slim

WORKDIR /app

COPY shared /app/shared
COPY services/anomaly-service /app/services/anomaly-service

RUN pip install --no-cache-dir -e /app/shared
RUN pip install --no-cache-dir -r /app/services/anomaly-service/requirements.txt

ENV PYTHONPATH=/app
EXPOSE 8002

CMD ["python", "services/anomaly-service/src/main.py"]

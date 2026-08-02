FROM python:3.12-slim

WORKDIR /app

COPY shared /app/shared
COPY services/alert-case-service /app/services/alert-case-service

RUN pip install --no-cache-dir -e /app/shared
RUN pip install --no-cache-dir -r /app/services/alert-case-service/requirements.txt

ENV PYTHONPATH=/app
EXPOSE 8003

CMD ["python", "services/alert-case-service/src/main.py"]

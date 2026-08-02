FROM python:3.12-slim

WORKDIR /app

COPY shared /app/shared
COPY services/risk-engine /app/services/risk-engine

RUN pip install --no-cache-dir -e /app/shared
RUN pip install --no-cache-dir -r /app/services/risk-engine/requirements.txt

ENV PYTHONPATH=/app
EXPOSE 8005

CMD ["python", "services/risk-engine/src/main.py"]

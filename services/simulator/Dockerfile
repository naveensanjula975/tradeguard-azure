FROM python:3.12-slim

WORKDIR /app

COPY shared /app/shared
COPY services/simulator /app/services/simulator

RUN pip install --no-cache-dir -e /app/shared
RUN pip install --no-cache-dir -r /app/services/simulator/requirements.txt

ENV PYTHONPATH=/app
EXPOSE 8004

CMD ["python", "services/simulator/src/main.py"]

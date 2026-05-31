FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY sensor_simulator.py .

ENV BACKEND_URL=http://backend:8080
ENV SIMULATOR_INTERVAL=1.0

ENTRYPOINT ["python", "sensor_simulator.py"]
CMD ["--batch"]

FROM envoyproxy/envoy:v1.28.0

RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/envoy /models /config

COPY ../envoy/envoy.yaml /etc/envoy/envoy.yaml
COPY ../config/routes.json /config/routes.json
COPY ../models/models.json /models/models.json

EXPOSE 8080 9901

CMD ["envoy", "-c", "/etc/envoy/envoy.yaml", "--service-cluster", "ai-gateway", "--service-node", "gateway-node"]

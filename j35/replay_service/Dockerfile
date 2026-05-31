FROM golang:1.21-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /replay_service .

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /replay_service .

EXPOSE 50052

ENV KAFKA_BROKERS=localhost:9092
ENV GRPC_ADDR=:50052
ENV REDIS_ADDR=localhost:6379
ENV CHEAT_BATCH_INTERVAL_MIN=30

ENTRYPOINT ["/app/replay_service"]

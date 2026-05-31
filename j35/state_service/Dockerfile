FROM golang:1.21-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /state_service .

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /state_service .

EXPOSE 50051

ENV REDIS_ADDR=localhost:6379
ENV CASSANDRA_HOSTS=localhost
ENV GRPC_ADDR=:50051

ENTRYPOINT ["/app/state_service"]

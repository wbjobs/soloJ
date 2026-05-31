FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libboost-system-dev \
    libprotobuf-dev \
    protobuf-compiler \
    libgrpc++-dev \
    grpc-proto \
    libgrpc-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY proto/ /build/proto/
COPY src/ /build/src/
COPY CMakeLists.txt /build/

RUN mkdir -p build && cd build \
    && cmake -DCMAKE_BUILD_TYPE=Release .. \
    && make -j$(nproc)

FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libprotobuf23 \
    libgrpc++1 \
    libboost-system1.74.0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/build/collision_service /app/collision_service

EXPOSE 50051 8080

ENV GRPC_PORT=50051
ENV TCP_PORT=8080
ENV WORLD_SIZE=1000
ENV FRAME_RATE=60
ENV MAX_UNITS=2000

ENTRYPOINT ["/app/collision_service"]

FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libboost-all-dev \
    liblua5.4-dev \
    lua5.4 \
    libgrpc-dev \
    libgrpc++-dev \
    libprotobuf-dev \
    protobuf-compiler \
    grpc-src \
    libgflags-dev \
    libgoogle-glog-dev \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /tmp/grpc-build && \
    cd /tmp/grpc-build && \
    find /usr -name "grpc_cpp_plugin" -exec ln -sf {} /usr/local/bin/grpc_cpp_plugin \; || true && \
    if [ ! -f /usr/local/bin/grpc_cpp_plugin ]; then \
        if [ -d /usr/share/grpc ]; then \
            cd /usr/share/grpc && mkdir -p cmake_build && cd cmake_build && \
            cmake .. -DCMAKE_BUILD_TYPE=Release -DgRPC_INSTALL=ON && \
            make -j$(nproc) grpc_cpp_plugin && \
            cp grpc_cpp_plugin /usr/local/bin/; \
        fi; \
    fi

WORKDIR /build

COPY proto/ /build/proto/
COPY src/ /build/src/
COPY CMakeLists.txt /build/
COPY scripts/ /build/scripts/

RUN mkdir -p build && cd build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release && \
    make -j$(nproc)

FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libboost-system1.74.0 \
    libboost-thread1.74.0 \
    liblua5.4-0 \
    libgrpc10 \
    libprotobuf23 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/build/bin/damage_arbiter /app/damage_arbiter
COPY --from=builder /build/scripts/ /app/scripts/

EXPOSE 50051

ENTRYPOINT ["/app/damage_arbiter"]
CMD ["--scripts", "/app/scripts", "--address", "0.0.0.0:50051"]

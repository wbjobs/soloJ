FROM emscripten/emsdk:3.1.45

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    unzip \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir cmake ninja

WORKDIR /src

RUN git clone --depth 1 --branch v2.13.0 https://github.com/tensorflow/tensorflow.git /tensorflow

RUN cd /tensorflow && \
    ./tensorflow/lite/tools/make/download_dependencies.sh && \
    ./tensorflow/lite/tools/make/build_generic_aarch64_lib.sh || true

RUN git clone --depth 1 --branch v0.2.1 https://github.com/proxy-wasm/proxy-wasm-cpp-sdk.git /proxy-wasm-cpp-sdk

ENV TENSORFLOW_DIR=/tensorflow
ENV PROXY_WASM_SDK_DIR=/proxy-wasm-cpp-sdk

COPY ../wasm/ /src/wasm/

WORKDIR /src/wasm

CMD ["bash", "./scripts/build_wasm.sh"]

cmake_minimum_required(VERSION 3.15)
project(smart_gateway_wasm CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

option(ENABLE_GPU "Enable GPU acceleration" OFF)

if(ENABLE_GPU)
    add_definitions(-DENABLE_GPU)
endif()

include_directories(
    ${CMAKE_SOURCE_DIR}/include
    ${CMAKE_SOURCE_DIR}/third_party
    ${CMAKE_SOURCE_DIR}/third_party/nlohmann/include
    ${CMAKE_SOURCE_DIR}/../tensorflow
    ${CMAKE_SOURCE_DIR}/../tensorflow/tensorflow/lite/tools/make/downloads/flatbuffers/include
    ${CMAKE_SOURCE_DIR}/../proxy-wasm-cpp-sdk
)

set(PROXY_WASM_CPP_SDK_DIR "${CMAKE_SOURCE_DIR}/../proxy-wasm-cpp-sdk")

add_library(proxy_wasm_intrinsics STATIC
    ${PROXY_WASM_CPP_SDK_DIR}/src/wasm.cc
    ${PROXY_WASM_CPP_SDK_DIR}/src/exports.cc
    ${PROXY_WASM_CPP_SDK_DIR}/src/context.cc
    ${PROXY_WASM_CPP_SDK_DIR}/src/wasmtime.cc
)

set_target_properties(proxy_wasm_intrinsics PROPERTIES
    CXX_STANDARD 17
    POSITION_INDEPENDENT_CODE ON
)

add_library(inference_engine STATIC
    src/inference_engine.cc
)

target_link_libraries(inference_engine
    tensorflow-lite
)

if(ENABLE_GPU)
    target_link_libraries(inference_engine
        tensorflowlite_gpu_delegate
    )
endif()

add_library(route_config STATIC
    src/route_config.cc
)

add_executable(ai_gateway_filter
    src/ai_gateway_filter.cc
)

target_link_libraries(ai_gateway_filter
    inference_engine
    route_config
    proxy_wasm_intrinsics
)

set_target_properties(ai_gateway_filter PROPERTIES
    SUFFIX ".wasm"
    LINK_FLAGS "\
        -Wl,--no-entry \
        -Wl,--export-all \
        -Wl,--allow-undefined \
        -Wl,--import-memory \
        -Wl,-z,stack-size=8388608 \
        -nostartfiles \
        -Wl,--whole-archive \
        -lproxy_wasm_intrinsics \
        -Wl,--no-whole-archive \
    "
)

enable_testing()
add_subdirectory(tests)

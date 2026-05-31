cmake_minimum_required(VERSION 3.16)
project(audio_fingerprint_wasm CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(SOURCES
    src/fft.cpp
    src/fingerprint.cpp
    src/main.cpp
)

set(EM_FLAGS
    "-O3"
    "-s WASM=1"
    "-s ALLOW_MEMORY_GROWTH=1"
    "-s EXPORT_ES6=0"
    "-s ENVIRONMENT=web"
    "-s SINGLE_FILE=0"
    "-s MODULARIZE=1"
    "-s EXPORT_NAME=createFingerprintModule"
    "-lembind"
    "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']"
    "-s ASSERTIONS=0"
    "-s DISABLE_EXCEPTION_CATCHING=0"
    "-mnontrapping-fptoint"
)

string(REPLACE ";" " " EM_FLAGS_STR "${EM_FLAGS}")

add_executable(audio_fingerprint ${SOURCES})

set_target_properties(audio_fingerprint PROPERTIES
    SUFFIX ".js"
    LINK_FLAGS "${EM_FLAGS_STR}"
    PREFIX ""
)

target_include_directories(audio_fingerprint PRIVATE ${CMAKE_SOURCE_DIR}/src)

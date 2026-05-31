cmake_minimum_required(VERSION 3.20)
project(damage_arbiter VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(Boost REQUIRED COMPONENTS asio system)
find_package(Lua 5.4 REQUIRED)
find_package(Threads REQUIRED)
find_package(Protobuf REQUIRED)
find_package(gRPC REQUIRED)

find_program(_GRPC_CPP_PLUGIN grpc_cpp_plugin)
find_program(_GRPC_CSHARP_PLUGIN grpc_csharp_plugin)

set(PROTO_SRC_DIR ${CMAKE_CURRENT_SOURCE_DIR}/proto)
set(PROTO_GEN_DIR ${CMAKE_CURRENT_BINARY_DIR}/generated)

file(MAKE_DIRECTORY ${PROTO_GEN_DIR})

set(PROTO_FILES
    ${PROTO_SRC_DIR}/damage_arbiter.proto
)

foreach(PROTO_FILE ${PROTO_FILES})
    get_filename_component(PROTO_NAME ${PROTO_FILE} NAME_WE)
    list(APPEND PROTO_SRCS ${PROTO_GEN_DIR}/${PROTO_NAME}.pb.cc)
    list(APPEND PROTO_HDRS ${PROTO_GEN_DIR}/${PROTO_NAME}.pb.h)
    list(APPEND GRPC_SRCS ${PROTO_GEN_DIR}/${PROTO_NAME}.grpc.pb.cc)
    list(APPEND GRPC_HDRS ${PROTO_GEN_DIR}/${PROTO_NAME}.grpc.pb.h)
endforeach()

add_custom_command(
    OUTPUT ${PROTO_SRCS} ${PROTO_HDRS} ${GRPC_SRCS} ${GRPC_HDRS}
    COMMAND ${Protobuf_PROTOC_EXECUTABLE}
    ARGS
        --proto_path=${PROTO_SRC_DIR}
        --cpp_out=${PROTO_GEN_DIR}
        --grpc_out=${PROTO_GEN_DIR}
        --plugin=protoc-gen-grpc=${_GRPC_CPP_PLUGIN}
        ${PROTO_FILES}
    DEPENDS ${PROTO_FILES}
    COMMENT "Generating protobuf/gRPC sources"
)

add_executable(damage_arbiter
    src/main.cpp
    src/arbiter.cpp
    src/lua_engine.cpp
    src/lua_bindings.cpp
    src/arbiter_server.cpp
    ${PROTO_SRCS}
    ${GRPC_SRCS}
)

target_include_directories(damage_arbiter PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${PROTO_GEN_DIR}
    ${LUA_INCLUDE_DIR}
)

target_link_libraries(damage_arbiter PRIVATE
    ${LUA_LIBRARIES}
    Boost::asio
    Boost::system
    gRPC::grpc++
    gRPC::grpc++_reflection
    protobuf::libprotobuf
    Threads::Threads
)

target_compile_options(damage_arbiter PRIVATE
    -Wall -Wextra -Wno-unused-parameter
)

set_target_properties(damage_arbiter PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/scripts DESTINATION ${CMAKE_BINARY_DIR}/bin)

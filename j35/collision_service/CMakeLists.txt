cmake_minimum_required(VERSION 3.16)
project(collision_service LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(Protobuf REQUIRED)
find_package(gRPC REQUIRED)
find_package(Boost REQUIRED COMPONENTS system)

find_program(PROTOC_EXECUTABLE protoc REQUIRED)
find_program(GRPC_CPP_PLUGIN grpc_cpp_plugin REQUIRED)

set(PROTO_DIR "${CMAKE_CURRENT_SOURCE_DIR}/proto")
set(PROTO_SRC_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated")

file(MAKE_DIRECTORY ${PROTO_SRC_DIR})

set(PROTO_FILES
    "${PROTO_DIR}/collision.proto"
)

foreach(PROTO_FILE ${PROTO_FILES})
    get_filename_component(PROTO_NAME ${PROTO_FILE} NAME_WE)
    list(APPEND PROTO_SRCS "${PROTO_SRC_DIR}/${PROTO_NAME}.pb.cc")
    list(APPEND PROTO_HDRS "${PROTO_SRC_DIR}/${PROTO_NAME}.pb.h")
    list(APPEND GRPC_SRCS "${PROTO_SRC_DIR}/${PROTO_NAME}.grpc.pb.cc")
    list(APPEND GRPC_HDRS "${PROTO_SRC_DIR}/${PROTO_NAME}.grpc.pb.h")
endforeach()

add_custom_command(
    OUTPUT ${PROTO_SRCS} ${PROTO_HDRS} ${GRPC_SRCS} ${GRPC_HDRS}
    COMMAND ${PROTOC_EXECUTABLE}
        --proto_path=${PROTO_DIR}
        --cpp_out=${PROTO_SRC_DIR}
        --grpc_out=${PROTO_SRC_DIR}
        --plugin=protoc-gen-grpc=${GRPC_CPP_PLUGIN}
        ${PROTO_FILES}
    DEPENDS ${PROTO_FILES}
    COMMENT "Generating protobuf/gRPC sources"
)

add_library(collision_proto
    ${PROTO_SRCS}
    ${GRPC_SRCS}
)
target_include_directories(collision_proto PUBLIC ${PROTO_SRC_DIR})
target_link_libraries(collision_proto PUBLIC
    protobuf::libprotobuf
    gRPC::grpc++
    gRPC::grpc++_reflection
)

add_executable(collision_service
    src/main.cpp
    src/quadtree.cpp
    src/aoe_checker.cpp
    src/frame_sync.cpp
    src/collision_server.cpp
)

target_include_directories(collision_service PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${PROTO_SRC_DIR}
)

target_link_libraries(collision_service PRIVATE
    collision_proto
    Boost::system
    protobuf::libprotobuf
    gRPC::grpc++
    gRPC::grpc++_reflection
)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
    target_compile_options(collision_service PRIVATE -O2 -flto)
endif()

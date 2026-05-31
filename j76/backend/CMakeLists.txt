cmake_minimum_required(VERSION 3.15)
project(FluidBackend CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(WIN32)
    add_definitions(-DWIN32_LEAN_AND_MEAN -D_CRT_SECURE_NO_WARNINGS)
    if(MSVC)
        add_compile_options(/W4)
    else()
        add_compile_options(-Wall -Wextra)
    endif()
else()
    add_compile_options(-Wall -Wextra -pthread)
endif()

set(SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/src)

add_executable(fluid_server
    ${SOURCE_DIR}/main.cpp
)

target_include_directories(fluid_server PRIVATE
    ${SOURCE_DIR}
    ${SOURCE_DIR}/third_party
)

if(WIN32)
    target_link_libraries(fluid_server PRIVATE ws2_32)
else()
    target_link_libraries(fluid_server PRIVATE pthread)
endif()

set_target_properties(fluid_server PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/bin
)

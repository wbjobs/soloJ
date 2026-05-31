#include <iostream>
#include <string>
#include <csignal>
#include <boost/asio.hpp>
#include "collision_server.h"

static boost::asio::io_context* g_ioc = nullptr;

void signal_handler(int) {
    if (g_ioc) {
        g_ioc->stop();
    }
}

int main(int argc, char* argv[]) {
    uint16_t grpc_port = 50051;
    uint16_t tcp_port = 8080;
    float world_size = 1000.0f;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--grpc-port" && i + 1 < argc) {
            grpc_port = static_cast<uint16_t>(std::stoi(argv[++i]));
        } else if (arg == "--tcp-port" && i + 1 < argc) {
            tcp_port = static_cast<uint16_t>(std::stoi(argv[++i]));
        } else if (arg == "--world-size" && i + 1 < argc) {
            world_size = std::stof(argv[++i]);
        }
    }

    const char* env_grpc = std::getenv("GRPC_PORT");
    const char* env_tcp = std::getenv("TCP_PORT");
    const char* env_world = std::getenv("WORLD_SIZE");
    if (env_grpc) grpc_port = static_cast<uint16_t>(std::stoi(env_grpc));
    if (env_tcp) tcp_port = static_cast<uint16_t>(std::stoi(env_tcp));
    if (env_world) world_size = std::stof(env_world);

    std::cout << "Collision Service starting..." << std::endl;
    std::cout << "gRPC port: " << grpc_port << std::endl;
    std::cout << "TCP port: " << tcp_port << std::endl;
    std::cout << "World size: " << world_size << std::endl;

    boost::asio::io_context ioc;
    g_ioc = &ioc;

    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    CollisionServer server(ioc, grpc_port, tcp_port, world_size);
    server.start();

    std::cout << "Collision Service running." << std::endl;

    ioc.run();

    server.stop();
    g_ioc = nullptr;

    std::cout << "Collision Service stopped." << std::endl;
    return 0;
}

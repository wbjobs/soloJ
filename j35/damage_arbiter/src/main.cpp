#include "arbiter.h"
#include "arbiter_server.h"
#include <iostream>
#include <string>
#include <csignal>
#include <atomic>

static std::atomic<bool> g_running{true};

static void signal_handler(int) {
    g_running = false;
}

int main(int argc, char* argv[]) {
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    std::string scripts_dir = "./scripts";
    std::string server_address = "0.0.0.0:50051";

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--scripts" && i + 1 < argc) {
            scripts_dir = argv[++i];
        } else if (arg == "--address" && i + 1 < argc) {
            server_address = argv[++i];
        } else if (arg == "--help") {
            std::cout << "Usage: damage_arbiter [options]" << std::endl;
            std::cout << "  --scripts <dir>     Lua scripts directory (default: ./scripts)" << std::endl;
            std::cout << "  --address <addr>    gRPC server address (default: 0.0.0.0:50051)" << std::endl;
            return 0;
        }
    }

    auto arbiter = std::make_shared<Arbiter>();
    if (!arbiter->initialize(scripts_dir)) {
        std::cerr << "Failed to initialize arbiter" << std::endl;
        return 1;
    }

    ArbiterServer server(arbiter);
    server.start(server_address);

    while (g_running) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    std::cout << "Shutting down..." << std::endl;
    server.stop();

    return 0;
}

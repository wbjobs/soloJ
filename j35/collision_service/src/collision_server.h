#pragma once

#include <cstdint>
#include <memory>
#include <vector>
#include <array>
#include <boost/asio.hpp>
#include <grpcpp/grpcpp.h>
#include "collision.pb.h"
#include "collision.grpc.pb.h"
#include "frame_sync.h"

class CollisionServer {
public:
    CollisionServer(boost::asio::io_context& ioc, uint16_t grpc_port, uint16_t tcp_port, float world_size);
    ~CollisionServer();

    void start();
    void stop();
    void wait();

    void handle_frame_result(const FrameResult& result);

private:
    class GRPCServiceImpl : public collision::CollisionService::Service {
    public:
        explicit GRPCServiceImpl(CollisionServer& server);

        grpc::Status CheckCollision(grpc::ServerContext* context,
                                     const collision::CollisionRequest* request,
                                     collision::CollisionResponse* response) override;

        grpc::Status StreamFrames(grpc::ServerContext* context,
                                   grpc::ServerReaderWriter<collision::FrameResult, collision::FrameUpdate>* stream) override;

    private:
        CollisionServer& server_;
    };

    class TCPSession : public std::enable_shared_from_this<TCPSession> {
    public:
        TCPSession(boost::asio::ip::tcp::socket socket, CollisionServer& server);
        void start();

    private:
        void do_read_header();
        void do_read_body(uint32_t body_size);
        void do_write(const std::vector<uint8_t>& data);

        boost::asio::ip::tcp::socket socket_;
        CollisionServer& server_;
        std::array<uint8_t, 4> header_buf_;
        std::vector<uint8_t> body_buf_;
    };

    void do_accept();

    boost::asio::io_context& ioc_;
    uint16_t grpc_port_;
    uint16_t tcp_port_;
    float world_size_;

    std::unique_ptr<GRPCServiceImpl> grpc_service_;
    std::unique_ptr<grpc::Server> grpc_server_;

    boost::asio::ip::tcp::acceptor acceptor_;
    FrameSync frame_sync_;
};

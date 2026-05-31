#include "collision_server.h"
#include <chrono>

CollisionServer::CollisionServer(boost::asio::io_context& ioc, uint16_t grpc_port, uint16_t tcp_port, float world_size)
    : ioc_(ioc)
    , grpc_port_(grpc_port)
    , tcp_port_(tcp_port)
    , world_size_(world_size)
    , acceptor_(ioc, boost::asio::ip::tcp::endpoint(boost::asio::ip::tcp::v4(), tcp_port))
    , frame_sync_(world_size, 2000)
{
    frame_sync_.set_result_callback([this](const FrameResult& r) { handle_frame_result(r); });
}

CollisionServer::~CollisionServer() {
    stop();
}

void CollisionServer::start() {
    grpc_service_ = std::make_unique<GRPCServiceImpl>(*this);

    grpc::ServerBuilder builder;
    std::string server_address = "0.0.0.0:" + std::to_string(grpc_port_);
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(grpc_service_.get());
    grpc_server_ = builder.BuildAndStart();

    frame_sync_.start(ioc_);
    do_accept();
}

void CollisionServer::stop() {
    frame_sync_.stop();
    if (grpc_server_) {
        grpc_server_->Shutdown();
    }
    boost::system::error_code ec;
    acceptor_.close(ec);
}

void CollisionServer::wait() {
    if (grpc_server_) {
        grpc_server_->Wait();
    }
}

void CollisionServer::handle_frame_result(const FrameResult& result) {
}

CollisionServer::GRPCServiceImpl::GRPCServiceImpl(CollisionServer& server) : server_(server) {}

grpc::Status CollisionServer::GRPCServiceImpl::CheckCollision(
    grpc::ServerContext* context,
    const collision::CollisionRequest* request,
    collision::CollisionResponse* response) {

    auto start = std::chrono::steady_clock::now();

    response->set_frame_number(request->frame_number());

    Quadtree qt(server_.world_size_);
    std::vector<Unit> units(request->units_size());
    std::vector<Unit*> unit_ptrs(request->units_size());
    for (int i = 0; i < request->units_size(); ++i) {
        const auto& u = request->units(i);
        units[i].id = u.unit_id();
        units[i].position = {u.position().x(), u.position().y()};
        units[i].heading = u.heading();
        units[i].radius = u.radius();
        units[i].faction = u.faction();
        unit_ptrs[i] = &units[i];
        qt.insert(&units[i]);
    }

    AOEChecker checker;
    for (int i = 0; i < request->casts_size(); ++i) {
        const auto& c = request->casts(i);
        SkillCastInfo cast;
        cast.caster_id = c.caster_id();
        cast.skill_id = c.skill_id();
        cast.shape = static_cast<SkillShape>(c.skill_type());
        cast.origin = {c.origin().x(), c.origin().y()};
        cast.direction = {c.direction().x(), c.direction().y()};
        cast.range = c.range();
        cast.radius = c.radius();
        cast.width = c.width();
        cast.height = c.height();
        cast.angle = c.angle();
        cast.speed = c.speed();
        cast.base_damage = c.base_damage();

        auto hits = checker.check(cast, qt);
        for (const auto& h : hits) {
            auto* hr = response->add_results();
            hr->set_target_id(h.target_id);
            hr->set_skill_id(h.skill_id);
            hr->set_hit(h.hit);
            hr->set_distance(h.distance);
        }
    }

    auto end = std::chrono::steady_clock::now();
    auto us = std::chrono::duration_cast<std::chrono::microseconds>(end - start).count();
    response->set_processing_time_us(us);

    return grpc::Status::OK;
}

grpc::Status CollisionServer::GRPCServiceImpl::StreamFrames(
    grpc::ServerContext* context,
    grpc::ServerReaderWriter<collision::FrameResult, collision::FrameUpdate>* stream) {

    collision::FrameUpdate update;
    while (stream->Read(&update)) {
        for (const auto& mov : update.movements()) {
            server_.frame_sync_.move_unit(mov.unit_id(), {mov.position().x(), mov.position().y()}, mov.heading());
        }
        for (const auto& c : update.casts()) {
            SkillCastInfo cast;
            cast.caster_id = c.caster_id();
            cast.skill_id = c.skill_id();
            cast.shape = static_cast<SkillShape>(c.skill_type());
            cast.origin = {c.origin().x(), c.origin().y()};
            cast.direction = {c.direction().x(), c.direction().y()};
            cast.range = c.range();
            cast.radius = c.radius();
            cast.width = c.width();
            cast.height = c.height();
            cast.angle = c.angle();
            cast.speed = c.speed();
            cast.base_damage = c.base_damage();
            cast.frame_number = c.frame_number();
            server_.frame_sync_.submit_cast(cast);
        }
    }

    return grpc::Status::OK;
}

CollisionServer::TCPSession::TCPSession(boost::asio::ip::tcp::socket socket, CollisionServer& server)
    : socket_(std::move(socket)), server_(server) {}

void CollisionServer::TCPSession::start() {
    do_read_header();
}

void CollisionServer::TCPSession::do_read_header() {
    auto self = shared_from_this();
    boost::asio::async_read(socket_, boost::asio::buffer(header_buf_),
        [this, self](boost::system::error_code ec, size_t) {
            if (ec) return;
            uint32_t body_size = (static_cast<uint32_t>(header_buf_[0]) << 24) |
                                 (static_cast<uint32_t>(header_buf_[1]) << 16) |
                                 (static_cast<uint32_t>(header_buf_[2]) << 8) |
                                  static_cast<uint32_t>(header_buf_[3]);
            do_read_body(body_size);
        });
}

void CollisionServer::TCPSession::do_read_body(uint32_t body_size) {
    body_buf_.resize(body_size);
    auto self = shared_from_this();
    boost::asio::async_read(socket_, boost::asio::buffer(body_buf_),
        [this, self](boost::system::error_code ec, size_t) {
            if (ec) return;
            collision::CollisionRequest request;
            if (request.ParseFromArray(body_buf_.data(), static_cast<int>(body_buf_.size()))) {
                for (const auto& u : request.units()) {
                    Unit unit;
                    unit.id = u.unit_id();
                    unit.position = {u.position().x(), u.position().y()};
                    unit.heading = u.heading();
                    unit.radius = u.radius();
                    unit.faction = u.faction();
                    server_.frame_sync_.add_unit(unit);
                }
                for (const auto& c : request.casts()) {
                    SkillCastInfo cast;
                    cast.caster_id = c.caster_id();
                    cast.skill_id = c.skill_id();
                    cast.shape = static_cast<SkillShape>(c.skill_type());
                    cast.origin = {c.origin().x(), c.origin().y()};
                    cast.direction = {c.direction().x(), c.direction().y()};
                    cast.range = c.range();
                    cast.radius = c.radius();
                    cast.width = c.width();
                    cast.height = c.height();
                    cast.angle = c.angle();
                    cast.speed = c.speed();
                    cast.base_damage = c.base_damage();
                    cast.frame_number = c.frame_number();
                    server_.frame_sync_.submit_cast(cast);
                }
            }
            do_read_header();
        });
}

void CollisionServer::TCPSession::do_write(const std::vector<uint8_t>& data) {
    auto self = shared_from_this();
    boost::asio::async_write(socket_, boost::asio::buffer(data),
        [this, self](boost::system::error_code ec, size_t) {
            if (ec) return;
        });
}

void CollisionServer::do_accept() {
    acceptor_.async_accept(
        [this](boost::system::error_code ec, boost::asio::ip::tcp::socket socket) {
            if (ec) return;
            std::make_shared<TCPSession>(std::move(socket), *this)->start();
            do_accept();
        });
}

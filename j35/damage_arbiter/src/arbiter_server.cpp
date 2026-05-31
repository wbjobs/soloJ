#include "arbiter_server.h"
#include <grpcpp/grpc_server.h>
#include <grpcpp/server_builder.h>
#include <iostream>
#include <thread>

ArbiterServer::ArbiterServer(std::shared_ptr<Arbiter> arbiter)
    : arbiter_(std::move(arbiter)) {}

ArbiterServer::~ArbiterServer() {
    stop();
}

grpc::Status ArbiterServer::ArbitrateDamage(
    grpc::ServerContext*,
    const damage_arbiter::ArbitrateRequest* request,
    damage_arbiter::ArbitrateResponse* response) {

    std::lock_guard<std::mutex> lock(mutex_);
    *response = arbiter_->arbitrate(*request);
    return grpc::Status::OK;
}

grpc::Status ArbiterServer::GetUnitState(
    grpc::ServerContext*,
    const damage_arbiter::UnitStateRequest* request,
    damage_arbiter::UnitStateResponse* response) {

    response->set_found(false);
    return grpc::Status::OK;
}

void ArbiterServer::start(const std::string& address) {
    grpc::ServerBuilder builder;
    builder.AddListeningPort(address, grpc::InsecureServerCredentials());
    builder.RegisterService(this);

    server_ = builder.BuildAndStart();
    std::cout << "ArbiterServer listening on " << address << std::endl;
}

void ArbiterServer::stop() {
    if (server_) {
        server_->Shutdown();
        server_.reset();
    }
}

void ArbiterServer::wait() {
    if (server_) {
        server_->Wait();
    }
}

AsyncArbiterServer::AsyncArbiterServer(std::shared_ptr<Arbiter> arbiter)
    : arbiter_(std::move(arbiter)) {}

AsyncArbiterServer::~AsyncArbiterServer() {
    stop();
}

void AsyncArbiterServer::start(const std::string& address) {
    grpc::ServerBuilder builder;
    builder.AddListeningPort(address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service_);

    cq_ = builder.AddCompletionQueue();
    server_ = builder.BuildAndStart();

    new CallData(&service_, cq_.get(), arbiter_);

    std::thread(&AsyncArbiterServer::handle_rpcs, this).detach();
    std::cout << "AsyncArbiterServer listening on " << address << std::endl;
}

void AsyncArbiterServer::stop() {
    if (server_) {
        server_->Shutdown();
    }
    if (cq_) {
        cq_->Shutdown();
    }
    server_.reset();
}

void AsyncArbiterServer::wait() {
    if (server_) {
        server_->Wait();
    }
}

void AsyncArbiterServer::handle_rpcs() {
    void* tag;
    bool ok = false;
    while (cq_->Next(&tag, &ok)) {
        if (ok) {
            auto* call = static_cast<CallData*>(tag);
            call->proceed();
        }
    }
}

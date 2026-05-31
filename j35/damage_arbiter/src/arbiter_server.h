#pragma once

#include "arbiter.h"
#include "damage_arbiter.grpc.pb.h"
#include <grpcpp/grpc_server.h>
#include <memory>
#include <string>
#include <unordered_map>
#include <mutex>

class ArbiterServer final : public damage_arbiter::DamageArbiterService::Service {
public:
    explicit ArbiterServer(std::shared_ptr<Arbiter> arbiter);
    ~ArbiterServer() override;

    grpc::Status ArbitrateDamage(
        grpc::ServerContext* context,
        const damage_arbiter::ArbitrateRequest* request,
        damage_arbiter::ArbitrateResponse* response) override;

    grpc::Status GetUnitState(
        grpc::ServerContext* context,
        const damage_arbiter::UnitStateRequest* request,
        damage_arbiter::UnitStateResponse* response) override;

    void start(const std::string& address);
    void stop();
    void wait();

private:
    std::shared_ptr<Arbiter> arbiter_;
    std::unique_ptr<grpc::Server> server_;
    std::mutex mutex_;
};

class AsyncArbiterServer {
public:
    explicit AsyncArbiterServer(std::shared_ptr<Arbiter> arbiter);
    ~AsyncArbiterServer();

    void start(const std::string& address);
    void stop();
    void wait();

private:
    void handle_rpcs();

    struct CallData {
        enum class CallStatus { CREATE, PROCESS, FINISH };
        CallStatus status;

        damage_arbiter::DamageArbiterService::AsyncService service;
        grpc::ServerCompletionQueue* cq;
        grpc::ServerContext context;

        damage_arbiter::ArbitrateRequest request;
        damage_arbiter::ArbitrateResponse response;
        grpc::ServerAsyncResponseWriter<damage_arbiter::ArbitrateResponse> responder;

        std::shared_ptr<Arbiter> arbiter;

        CallData(damage_arbiter::DamageArbiterService::AsyncService* svc,
                 grpc::ServerCompletionQueue* cq,
                 std::shared_ptr<Arbiter> arb)
            : status(CallStatus::CREATE), cq(cq), responder(&context), arbiter(arb) {
            service = *svc;
            proceed();
        }

        void proceed() {
            if (status == CallStatus::CREATE) {
                status = CallStatus::PROCESS;
                service.RequestArbitrateDamage(&context, &request, &responder, cq, cq, this);
            } else if (status == CallStatus::PROCESS) {
                new CallData(&service, cq, arbiter);

                auto resp = arbiter->arbitrate(request);
                response = resp;

                status = CallStatus::FINISH;
                responder.Finish(response, grpc::Status::OK, this);
            } else {
                delete this;
            }
        }
    };

    std::shared_ptr<Arbiter> arbiter_;
    std::unique_ptr<grpc::ServerCompletionQueue> cq_;
    damage_arbiter::DamageArbiterService::AsyncService service_;
    std::unique_ptr<grpc::Server> server_;
    std::mutex mutex_;
};

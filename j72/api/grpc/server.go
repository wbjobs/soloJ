package grpcapi

import (
	"context"
	"log"
	"net"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"
	"modbus-fuzzer/api/proto"
	"modbus-fuzzer/core/coverage"
)

type FuzzingServer struct {
	proto.UnimplementedFuzzingServiceServer
	registry       *coverage.CoverageRegistry
	grpcServer     *grpc.Server
	listener       net.Listener
	ctx            context.Context
	cancel         context.CancelFunc
	mu             sync.Mutex
	streamClients  map[string]chan struct{}
}

func NewFuzzingServer() *FuzzingServer {
	ctx, cancel := context.WithCancel(context.Background())

	return &FuzzingServer{
		registry:      coverage.GetRegistry(),
		ctx:           ctx,
		cancel:        cancel,
		streamClients: make(map[string]chan struct{}),
	}
}

func (s *FuzzingServer) Start(addr string) error {
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	s.listener = listener

	opts := []grpc.ServerOption{
		grpc.MaxRecvMsgSize(1024 * 1024 * 10),
		grpc.MaxSendMsgSize(1024 * 1024 * 10),
	}

	s.grpcServer = grpc.NewServer(opts...)
	proto.RegisterFuzzingServiceServer(s.grpcServer, s)
	reflection.Register(s.grpcServer)

	log.Printf("[gRPC] Starting server on %s", addr)
	go func() {
		if err := s.grpcServer.Serve(listener); err != nil {
			select {
			case <-s.ctx.Done():
				log.Println("[gRPC] Server stopped")
			default:
				log.Printf("[gRPC] Server error: %v", err)
			}
		}
	}()

	return nil
}

func (s *FuzzingServer) Stop() {
	log.Println("[gRPC] Stopping server...")
	s.cancel()

	s.mu.Lock()
	for _, ch := range s.streamClients {
		close(ch)
	}
	s.streamClients = make(map[string]chan struct{})
	s.mu.Unlock()

	if s.grpcServer != nil {
		s.grpcServer.GracefulStop()
	}
	if s.listener != nil {
		s.listener.Close()
	}
	log.Println("[gRPC] Server stopped")
}

func (s *FuzzingServer) GetCoverage(ctx context.Context, req *proto.GetCoverageRequest) (*proto.GetCoverageResponse, error) {
	trackers := s.registry.GetAllTrackers()
	coverageData := make([]*proto.CoverageData, 0, len(trackers))

	for _, tracker := range trackers {
		if req.WorkerId != "" && tracker.WorkerID() != req.WorkerId {
			continue
		}

		snap := tracker.GetSnapshot(req.TargetIp)
		coverageData = append(coverageData, convertSnapshot(snap))
	}

	return &proto.GetCoverageResponse{
		Coverage:  coverageData,
		Timestamp: time.Now().Unix(),
	}, nil
}

func (s *FuzzingServer) StreamCoverage(req *proto.StreamCoverageRequest, stream proto.FuzzingService_StreamCoverageServer) error {
	interval := time.Duration(req.IntervalSeconds) * time.Second
	if interval < 1*time.Second {
		interval = 1 * time.Second
	}
	if interval > 60*time.Second {
		interval = 60 * time.Second
	}

	clientID := time.Now().String()
	stopChan := make(chan struct{})

	s.mu.Lock()
	s.streamClients[clientID] = stopChan
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.streamClients, clientID)
		close(stopChan)
		s.mu.Unlock()
	}()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			trackers := s.registry.GetAllTrackers()
			for _, tracker := range trackers {
				if req.WorkerId != "" && tracker.WorkerID() != req.WorkerId {
					continue
				}

				snap := tracker.GetSnapshot("")
				data := convertSnapshot(snap)

				if err := stream.Send(data); err != nil {
					return status.Errorf(codes.Internal, "failed to send coverage: %v", err)
				}
			}

		case <-stopChan:
			return nil

		case <-s.ctx.Done():
			return nil

		case <-stream.Context().Done():
			return stream.Context().Err()
		}
	}
}

func convertSnapshot(snap *coverage.CoverageSnapshot) *proto.CoverageData {
	return &proto.CoverageData{
		WorkerId:             snap.WorkerID,
		TargetIp:             snap.TargetIP,
		TotalPacketsSent:     snap.TotalPacketsSent,
		NormalPackets:        snap.NormalPackets,
		MalformedPackets:     snap.MalformedPackets,
		SuccessfulResponses:  snap.SuccessfulResponses,
		CrashesDetected:      snap.CrashesDetected,
		Timeouts:             snap.Timeouts,
		Errors:               snap.Errors,
		FunctionCodeCoverage: snap.FunctionCodeCoverage,
		MutationRuleCoverage: snap.RuleCoverage,
		AvgResponseTimeMs:    snap.AvgResponseTimeMs,
		StartedAt:            snap.StartedAt,
		LastUpdated:          snap.LastUpdated,
	}
}

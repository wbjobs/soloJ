package proto

import (
	context "context"
	fmt "fmt"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
	proto "google.golang.org/protobuf/proto"
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
)

type MutationType int32

const (
	MutationType_UNKNOWN                MutationType = 0
	MutationType_INVALID_FUNCTION_CODE  MutationType = 1
	MutationType_INVALID_DATA_LENGTH    MutationType = 2
	MutationType_OVERFLOW_DATA          MutationType = 3
	MutationType_INVALID_PROTOCOL_ID    MutationType = 4
	MutationType_INVALID_UNIT_ID        MutationType = 5
	MutationType_BOUNDARY_VALUE         MutationType = 6
	MutationType_MALFORMED_PACKET       MutationType = 7
	MutationType_FUZZY_BYTES            MutationType = 8
	MutationType_REVERSED_BYTES         MutationType = 9
	MutationType_CUSTOM                 MutationType = 10
)

type MutationRule struct {
	Id          string            `protobuf:"bytes,1,opt,name=id,proto3" json:"id,omitempty"`
	Name        string            `protobuf:"bytes,2,opt,name=name,proto3" json:"name,omitempty"`
	Description string            `protobuf:"bytes,3,opt,name=description,proto3" json:"description,omitempty"`
	Type        MutationType      `protobuf:"varint,4,opt,name=type,proto3,enum=fuzzapi.MutationType" json:"type,omitempty"`
	Weight      int32             `protobuf:"varint,5,opt,name=weight,proto3" json:"weight,omitempty"`
	Enabled     bool              `protobuf:"varint,6,opt,name=enabled,proto3" json:"enabled,omitempty"`
	Parameters  map[string]string `protobuf:"bytes,7,rep,name=parameters,proto3" json:"parameters,omitempty"`
	CreatedAt   int64             `protobuf:"varint,8,opt,name=created_at,json=createdAt,proto3" json:"created_at,omitempty"`
	UpdatedAt   int64             `protobuf:"varint,9,opt,name=updated_at,json=updatedAt,proto3" json:"updated_at,omitempty"`
}

func (x *MutationRule) Reset()         { *x = MutationRule{} }
func (x *MutationRule) String() string { return fmt.Sprintf("%+v", *x) }
func (*MutationRule) ProtoMessage()    {}

type CoverageData struct {
	WorkerId              string            `protobuf:"bytes,1,opt,name=worker_id,json=workerId,proto3" json:"worker_id,omitempty"`
	TargetIp              string            `protobuf:"bytes,2,opt,name=target_ip,json=targetIp,proto3" json:"target_ip,omitempty"`
	TotalPacketsSent      int64             `protobuf:"varint,3,opt,name=total_packets_sent,json=totalPacketsSent,proto3" json:"total_packets_sent,omitempty"`
	NormalPackets         int64             `protobuf:"varint,4,opt,name=normal_packets,json=normalPackets,proto3" json:"normal_packets,omitempty"`
	MalformedPackets      int64             `protobuf:"varint,5,opt,name=malformed_packets,json=malformedPackets,proto3" json:"malformed_packets,omitempty"`
	SuccessfulResponses   int64             `protobuf:"varint,6,opt,name=successful_responses,json=successfulResponses,proto3" json:"successful_responses,omitempty"`
	CrashesDetected       int64             `protobuf:"varint,7,opt,name=crashes_detected,json=crashesDetected,proto3" json:"crashes_detected,omitempty"`
	Timeouts              int64             `protobuf:"varint,8,opt,name=timeouts,proto3" json:"timeouts,omitempty"`
	Errors                int64             `protobuf:"varint,9,opt,name=errors,proto3" json:"errors,omitempty"`
	FunctionCodeCoverage  map[string]int64  `protobuf:"bytes,10,rep,name=function_code_coverage,json=functionCodeCoverage,proto3" json:"function_code_coverage,omitempty"`
	MutationRuleCoverage  map[string]int64  `protobuf:"bytes,11,rep,name=mutation_rule_coverage,json=mutationRuleCoverage,proto3" json:"mutation_rule_coverage,omitempty"`
	AvgResponseTimeMs     float64           `protobuf:"fixed64,12,opt,name=avg_response_time_ms,json=avgResponseTimeMs,proto3" json:"avg_response_time_ms,omitempty"`
	StartedAt             int64             `protobuf:"varint,13,opt,name=started_at,json=startedAt,proto3" json:"started_at,omitempty"`
	LastUpdated           int64             `protobuf:"varint,14,opt,name=last_updated,json=lastUpdated,proto3" json:"last_updated,omitempty"`
}

func (x *CoverageData) Reset()         { *x = CoverageData{} }
func (x *CoverageData) String() string { return fmt.Sprintf("%+v", *x) }
func (*CoverageData) ProtoMessage()    {}

type GetCoverageRequest struct {
	WorkerId string `protobuf:"bytes,1,opt,name=worker_id,json=workerId,proto3" json:"worker_id,omitempty"`
	TargetIp string `protobuf:"bytes,2,opt,name=target_ip,json=targetIp,proto3" json:"target_ip,omitempty"`
}

func (x *GetCoverageRequest) Reset()         { *x = GetCoverageRequest{} }
func (x *GetCoverageRequest) String() string { return fmt.Sprintf("%+v", *x) }
func (*GetCoverageRequest) ProtoMessage()    {}

type GetCoverageResponse struct {
	Coverage  []*CoverageData `protobuf:"bytes,1,rep,name=coverage,proto3" json:"coverage,omitempty"`
	Timestamp int64           `protobuf:"varint,2,opt,name=timestamp,proto3" json:"timestamp,omitempty"`
}

func (x *GetCoverageResponse) Reset()         { *x = GetCoverageResponse{} }
func (x *GetCoverageResponse) String() string { return fmt.Sprintf("%+v", *x) }
func (*GetCoverageResponse) ProtoMessage()    {}

type StreamCoverageRequest struct {
	WorkerId        string `protobuf:"bytes,1,opt,name=worker_id,json=workerId,proto3" json:"worker_id,omitempty"`
	IntervalSeconds int32  `protobuf:"varint,2,opt,name=interval_seconds,json=intervalSeconds,proto3" json:"interval_seconds,omitempty"`
}

func (x *StreamCoverageRequest) Reset()         { *x = StreamCoverageRequest{} }
func (x *StreamCoverageRequest) String() string { return fmt.Sprintf("%+v", *x) }
func (*StreamCoverageRequest) ProtoMessage()    {}

type FuzzingServiceServer interface {
	GetCoverage(context.Context, *GetCoverageRequest) (*GetCoverageResponse, error)
	StreamCoverage(*StreamCoverageRequest, FuzzingService_StreamCoverageServer) error
	mustEmbedUnimplementedFuzzingServiceServer()
}

type UnimplementedFuzzingServiceServer struct{}

func (UnimplementedFuzzingServiceServer) GetCoverage(context.Context, *GetCoverageRequest) (*GetCoverageResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetCoverage not implemented")
}
func (UnimplementedFuzzingServiceServer) StreamCoverage(*StreamCoverageRequest, FuzzingService_StreamCoverageServer) error {
	return status.Errorf(codes.Unimplemented, "method StreamCoverage not implemented")
}
func (UnimplementedFuzzingServiceServer) mustEmbedUnimplementedFuzzingServiceServer() {}

type FuzzingService_StreamCoverageServer interface {
	Send(*CoverageData) error
	grpc.ServerStream
}

func RegisterFuzzingServiceServer(s grpc.ServiceRegistrar, srv FuzzingServiceServer) {
	s.RegisterService(&FuzzingService_ServiceDesc, srv)
}

var FuzzingService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "fuzzapi.FuzzingService",
	HandlerType: (*FuzzingServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "GetCoverage",
			Handler:    _FuzzingService_GetCoverage_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "StreamCoverage",
			Handler:       _FuzzingService_StreamCoverage_Handler,
			ServerStreams: true,
		},
	},
	Metadata: "api/proto/fuzzapi.proto",
}

func _FuzzingService_GetCoverage_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetCoverageRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(FuzzingServiceServer).GetCoverage(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/fuzzapi.FuzzingService/GetCoverage",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(FuzzingServiceServer).GetCoverage(ctx, req.(*GetCoverageRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _FuzzingService_StreamCoverage_Handler(srv interface{}, stream grpc.ServerStream) error {
	m := new(StreamCoverageRequest)
	if err := stream.RecvMsg(m); err != nil {
		return err
	}
	return srv.(FuzzingServiceServer).StreamCoverage(m, &fuzzingServiceStreamCoverageServer{stream})
}

type fuzzingServiceStreamCoverageServer struct {
	grpc.ServerStream
}

func (x *fuzzingServiceStreamCoverageServer) Send(m *CoverageData) error {
	return x.ServerStream.SendMsg(m)
}

var File_fuzzapi_proto protoreflect.FileDescriptor

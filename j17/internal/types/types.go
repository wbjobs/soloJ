package types

import "time"

type EventType uint32

const (
	EventSend EventType = iota
	EventRecv
	EventTLSWrite
	EventTLSRead
	EventTLSHandshake
)

const (
	MaxPayloadSize = 4096
	TaskCommLen    = 16
)

type HTTPEvent struct {
	PID          uint32
	TID          uint32
	Timestamp    uint64
	Type         EventType
	Comm         [TaskCommLen]byte
	PayloadLen   uint32
	TotalLen     uint32
	SegmentCount uint32
	IsSegmented  uint32
	Payload      [MaxPayloadSize]byte
	SAddr        uint32
	DAddr        uint32
	SPort        uint16
	DPort        uint16
	Seq          uint32
	IsTLS        uint32
	TLSVersion   uint16
	TLSContentType uint8
	SSLCtxPtr    uint64
}

type HTTPRequest struct {
	ID           string
	PID          uint32
	Comm         string
	Method       string
	Path         string
	StatusCode   int
	ResponseTime time.Duration
	RequestSize  int
	ResponseSize int
	SrcIP        string
	DstIP        string
	SrcPort      uint16
	DstPort      uint16
	Timestamp    time.Time
	IsSegmented  bool
	SegmentCount int
	IsHTTPS      bool
	TLSVersion   uint16
}

type Config struct {
	PIDFilter      uint32
	AlertThreshold time.Duration
	OutputJSON     string
	Verbose        bool
}

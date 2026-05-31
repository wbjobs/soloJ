package parser

import (
	"bytes"
	"net"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/ebpf-http-tracer/internal/tls"
	"github.com/ebpf-http-tracer/internal/types"
)

var (
	httpRequestRegex  = regexp.MustCompile(`^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+(\S+)\s+HTTP/\d\.\d`)
	httpResponseRegex = regexp.MustCompile(`^HTTP/\d\.\d\s+(\d{3})\s+`)
)

type PendingRequest struct {
	Method       string
	Path         string
	Timestamp    uint64
	Size         int
	TotalSize    int
	SrcIP        string
	DstIP        string
	SrcPort      uint16
	DstPort      uint16
	IsSegmented  bool
	SegmentCount int
	IsHTTPS      bool
	TLSVersion   uint16
}

type HTTPParser struct {
	pendingRequests map[string]*PendingRequest
	tlsManager      *tls.TLSManager
}

func NewHTTPParser() *HTTPParser {
	return &HTTPParser{
		pendingRequests: make(map[string]*PendingRequest),
	}
}

func NewHTTPParserWithTLS(tlsManager *tls.TLSManager) *HTTPParser {
	return &HTTPParser{
		pendingRequests: make(map[string]*PendingRequest),
		tlsManager:      tlsManager,
	}
}

func (p *HTTPParser) ParseEvent(event *types.HTTPEvent) (*types.HTTPRequest, bool) {
	payloadLen := int(event.PayloadLen)
	if payloadLen > types.MaxPayloadSize {
		payloadLen = types.MaxPayloadSize
	}
	
	var payload []byte
	var err error
	
	if p.tlsManager != nil && event.IsTLS > 0 {
		payload, err = p.tlsManager.DecryptEvent(event)
		if err != nil {
			return nil, false
		}
		if payload == nil {
			return nil, false
		}
	} else {
		payload = event.Payload[:payloadLen]
	}
	
	isHTTP := IsHTTP(payload)
	if !isHTTP {
		return nil, false
	}
	
	payloadStr := string(payload[:min(len(payload), 4096)])
	
	eventType := event.Type
	if eventType == types.EventSend || eventType == 2 {
		return p.parseRequest(event, payloadStr)
	}
	return p.parseResponse(event, payloadStr)
}

func (p *HTTPParser) parseRequest(event *types.HTTPEvent, payload string) (*types.HTTPRequest, bool) {
	match := httpRequestRegex.FindStringSubmatch(payload)
	if len(match) < 3 {
		return nil, false
	}

	method := match[1]
	path := match[2]

	key := p.makeKey(event)
	
	totalSize := int(event.TotalLen)
	if totalSize == 0 {
		totalSize = int(event.PayloadLen)
	}
	
	isSegmented := event.IsSegmented > 0
	segmentCount := int(event.SegmentCount)
	if isSegmented && segmentCount == 0 {
		segmentCount = 1
	}

	p.pendingRequests[key] = &PendingRequest{
		Method:       method,
		Path:         path,
		Timestamp:    event.Timestamp,
		Size:         int(event.PayloadLen),
		TotalSize:    totalSize,
		SrcIP:        intToIP(event.SAddr),
		DstIP:        intToIP(event.DAddr),
		SrcPort:      event.SPort,
		DstPort:      event.DPort,
		IsSegmented:  isSegmented,
		SegmentCount: segmentCount,
		IsHTTPS:      event.IsTLS > 0,
		TLSVersion:   event.TLSVersion,
	}

	return nil, false
}

func (p *HTTPParser) parseResponse(event *types.HTTPEvent, payload string) (*types.HTTPRequest, bool) {
	match := httpResponseRegex.FindStringSubmatch(payload)
	if len(match) < 2 {
		return nil, false
	}

	statusCode, _ := strconv.Atoi(match[1])

	key := p.makeResponseKey(event)
	if req, ok := p.pendingRequests[key]; ok {
		responseTime := time.Duration(event.Timestamp-req.Timestamp) * time.Nanosecond
		
		totalRespSize := int(event.TotalLen)
		if totalRespSize == 0 {
			totalRespSize = int(event.PayloadLen)
		}
		
		isSegmented := req.IsSegmented || event.IsSegmented > 0
		segmentCount := req.SegmentCount
		if event.IsSegmented > 0 && int(event.SegmentCount) > segmentCount {
			segmentCount = int(event.SegmentCount)
		}

		httpReq := &types.HTTPRequest{
			PID:          event.PID,
			Comm:         bytesToString(event.Comm[:]),
			Method:       req.Method,
			Path:         req.Path,
			StatusCode:   statusCode,
			ResponseTime: responseTime,
			RequestSize:  req.TotalSize,
			ResponseSize: totalRespSize,
			SrcIP:        req.SrcIP,
			DstIP:        req.DstIP,
			SrcPort:      req.SrcPort,
			DstPort:      req.DstPort,
			Timestamp:    time.Now(),
			IsSegmented:  isSegmented,
			SegmentCount: segmentCount,
			IsHTTPS:      req.IsHTTPS,
			TLSVersion:   req.TLSVersion,
		}

		delete(p.pendingRequests, key)
		return httpReq, true
	}

	return nil, false
}

func (p *HTTPParser) makeKey(event *types.HTTPEvent) string {
	return net.JoinHostPort(intToIP(event.SAddr), strconv.Itoa(int(event.SPort))) + "-" +
		net.JoinHostPort(intToIP(event.DAddr), strconv.Itoa(int(event.DPort)))
}

func (p *HTTPParser) makeResponseKey(event *types.HTTPEvent) string {
	return net.JoinHostPort(intToIP(event.DAddr), strconv.Itoa(int(event.DPort))) + "-" +
		net.JoinHostPort(intToIP(event.SAddr), strconv.Itoa(int(event.SPort)))
}

func intToIP(ip uint32) string {
	return net.IPv4(byte(ip), byte(ip>>8), byte(ip>>16), byte(ip>>24)).String()
}

func bytesToString(b []byte) string {
	if idx := bytes.IndexByte(b, 0); idx >= 0 {
		return string(b[:idx])
	}
	return string(b)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func IsHTTP(payload []byte) bool {
	if len(payload) < 4 {
		return false
	}
	
	checkLen := min(len(payload), 20)
	head := strings.ToUpper(string(payload[:checkLen]))
	
	methods := []string{"GET ", "POST", "PUT ", "DELE", "PATC", "HEAD", "OPTI", "CONN", "TRAC", "HTTP"}
	for _, m := range methods {
		if strings.HasPrefix(head, m) {
			return true
		}
	}
	return false
}

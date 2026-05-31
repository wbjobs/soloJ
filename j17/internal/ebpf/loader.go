package ebpf

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"unsafe"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/perf"
	"github.com/ebpf-http-tracer/internal/types"
)

//go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc clang -cflags "-O2 -g -Wall -Werror -Wno-address-of-packed-member" bpf ../bpf/http_trace.bpf.c -- -I../bpf

type Tracer struct {
	objs          bpfObjects
	sendLink      link.Link
	recvEntryLink link.Link
	recvExitLink  link.Link
	perfReader    *perf.Reader
}

func NewTracer() (*Tracer, error) {
	var objs bpfObjects
	if err := loadBpfObjects(&objs, nil); err != nil {
		return nil, fmt.Errorf("loading bpf objects: %w", err)
	}

	sendLink, err := link.Kprobe("tcp_sendmsg", objs.TcpSendmsgEntry, nil)
	if err != nil {
		objs.Close()
		return nil, fmt.Errorf("attaching tcp_sendmsg kprobe: %w", err)
	}

	recvEntryLink, err := link.Kprobe("tcp_recvmsg", objs.TcpRecvmsgEntry, nil)
	if err != nil {
		sendLink.Close()
		objs.Close()
		return nil, fmt.Errorf("attaching tcp_recvmsg kprobe: %w", err)
	}

	recvExitLink, err := link.Kretprobe("tcp_recvmsg", objs.TcpRecvmsgExit, nil)
	if err != nil {
		recvEntryLink.Close()
		sendLink.Close()
		objs.Close()
		return nil, fmt.Errorf("attaching tcp_recvmsg kretprobe: %w", err)
	}

	perfReader, err := perf.NewReader(objs.Events, os.Getpagesize()*64)
	if err != nil {
		recvExitLink.Close()
		recvEntryLink.Close()
		sendLink.Close()
		objs.Close()
		return nil, fmt.Errorf("creating perf reader: %w", err)
	}

	return &Tracer{
		objs:          objs,
		sendLink:      sendLink,
		recvEntryLink: recvEntryLink,
		recvExitLink:  recvExitLink,
		perfReader:    perfReader,
	}, nil
}

func (t *Tracer) ReadEvent() (*types.HTTPEvent, error) {
	record, err := t.perfReader.Read()
	if err != nil {
		return nil, fmt.Errorf("reading perf record: %w", err)
	}

	if record.LostSamples != 0 {
		return nil, fmt.Errorf("lost %d samples", record.LostSamples)
	}

	event, err := parseEvent(record.RawSample)
	if err != nil {
		return nil, fmt.Errorf("parsing event: %w", err)
	}

	return event, nil
}

func parseEvent(data []byte) (*types.HTTPEvent, error) {
	if len(data) < int(unsafe.Sizeof(bpfHttpEvent{})) {
		return nil, fmt.Errorf("data too short: %d bytes, expected at least %d bytes",
			len(data), unsafe.Sizeof(bpfHttpEvent{}))
	}

	var bpfEvent bpfHttpEvent
	if err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &bpfEvent); err != nil {
		return nil, fmt.Errorf("reading binary event: %w", err)
	}

	event := &types.HTTPEvent{
		PID:          bpfEvent.Pid,
		TID:          bpfEvent.Tid,
		Timestamp:    bpfEvent.Timestamp,
		Type:         types.EventType(bpfEvent.Type),
		PayloadLen:   bpfEvent.PayloadLen,
		TotalLen:     bpfEvent.TotalLen,
		SegmentCount: bpfEvent.SegmentCount,
		IsSegmented:  bpfEvent.IsSegmented,
		SAddr:        bpfEvent.Saddr,
		DAddr:        bpfEvent.Daddr,
		SPort:        bpfEvent.Sport,
		DPort:        bpfEvent.Dport,
		Seq:          bpfEvent.Seq,
	}

	copy(event.Comm[:], bpfEvent.Comm[:])

	payloadLen := bpfEvent.PayloadLen
	if payloadLen > types.MaxPayloadSize {
		payloadLen = types.MaxPayloadSize
	}
	copy(event.Payload[:payloadLen], bpfEvent.Payload[:payloadLen])

	return event, nil
}

func (t *Tracer) Close() error {
	if t.perfReader != nil {
		t.perfReader.Close()
	}
	if t.recvExitLink != nil {
		t.recvExitLink.Close()
	}
	if t.recvEntryLink != nil {
		t.recvEntryLink.Close()
	}
	if t.sendLink != nil {
		t.sendLink.Close()
	}
	return t.objs.Close()
}

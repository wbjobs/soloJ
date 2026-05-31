package protocol

import (
	"encoding/binary"
	"errors"
	"io"
)

const (
	MagicNumber   uint32 = 0xFA57
	HeaderSize    int    = 10
	CmdQueryReq   uint16 = 0x01
	CmdQueryResp  uint16 = 0x81
	MaxPayloadLen uint32 = 10 * 1024 * 1024
)

type Packet struct {
	Magic   uint32
	CmdID   uint16
	Payload []byte
}

func Encode(pkt *Packet) ([]byte, error) {
	if pkt.Magic != MagicNumber {
		return nil, errors.New("invalid magic number")
	}
	payloadLen := uint32(len(pkt.Payload))
	if payloadLen > MaxPayloadLen {
		return nil, errors.New("payload too large")
	}
	buf := make([]byte, HeaderSize+payloadLen)
	binary.BigEndian.PutUint32(buf[0:4], pkt.Magic)
	binary.BigEndian.PutUint16(buf[4:6], pkt.CmdID)
	binary.BigEndian.PutUint32(buf[6:10], payloadLen)
	if payloadLen > 0 {
		copy(buf[HeaderSize:], pkt.Payload)
	}
	return buf, nil
}

func Decode(r io.Reader) (*Packet, error) {
	header := make([]byte, HeaderSize)
	if _, err := io.ReadFull(r, header); err != nil {
		return nil, err
	}
	magic := binary.BigEndian.Uint32(header[0:4])
	if magic != MagicNumber {
		return nil, errors.New("invalid magic number")
	}
	cmdID := binary.BigEndian.Uint16(header[4:6])
	payloadLen := binary.BigEndian.Uint32(header[6:10])
	if payloadLen > MaxPayloadLen {
		return nil, errors.New("payload too large")
	}
	payload := make([]byte, payloadLen)
	if payloadLen > 0 {
		if _, err := io.ReadFull(r, payload); err != nil {
			return nil, err
		}
	}
	return &Packet{
		Magic:   magic,
		CmdID:   cmdID,
		Payload: payload,
	}, nil
}

func NewQueryRequest(payload []byte) *Packet {
	return &Packet{
		Magic:   MagicNumber,
		CmdID:   CmdQueryReq,
		Payload: payload,
	}
}

func NewQueryResponse(payload []byte) *Packet {
	return &Packet{
		Magic:   MagicNumber,
		CmdID:   CmdQueryResp,
		Payload: payload,
	}
}

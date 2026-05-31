package protocol

import (
	"bytes"
	"testing"
)

func TestEncodeDecode(t *testing.T) {
	tests := []struct {
		name    string
		pkt     *Packet
		wantErr bool
	}{
		{
			name: "valid packet with payload",
			pkt: &Packet{
				Magic:   MagicNumber,
				CmdID:   CmdQueryReq,
				Payload: []byte(`{"user_id":1,"query":"test"}`),
			},
			wantErr: false,
		},
		{
			name: "valid packet empty payload",
			pkt: &Packet{
				Magic:   MagicNumber,
				CmdID:   CmdQueryResp,
				Payload: []byte{},
			},
			wantErr: false,
		},
		{
			name: "invalid magic number",
			pkt: &Packet{
				Magic:   0xDEAD,
				CmdID:   CmdQueryReq,
				Payload: []byte("test"),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := Encode(tt.pkt)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Encode() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}

			decoded, err := Decode(bytes.NewReader(data))
			if err != nil {
				t.Fatalf("Decode() error = %v", err)
			}

			if decoded.Magic != tt.pkt.Magic {
				t.Errorf("Magic = %x, want %x", decoded.Magic, tt.pkt.Magic)
			}
			if decoded.CmdID != tt.pkt.CmdID {
				t.Errorf("CmdID = %x, want %x", decoded.CmdID, tt.pkt.CmdID)
			}
			if !bytes.Equal(decoded.Payload, tt.pkt.Payload) {
				t.Errorf("Payload = %s, want %s", decoded.Payload, tt.pkt.Payload)
			}
		})
	}
}

func TestDecodeInvalidMagic(t *testing.T) {
	buf := make([]byte, HeaderSize)
	buf[0] = 0xDE
	buf[1] = 0xAD
	buf[2] = 0xBE
	buf[3] = 0xEF

	_, err := Decode(bytes.NewReader(buf))
	if err == nil {
		t.Error("expected error for invalid magic number")
	}
}

func TestNewQueryRequest(t *testing.T) {
	payload := []byte(`{"user_id":1,"query":"hello"}`)
	pkt := NewQueryRequest(payload)

	if pkt.Magic != MagicNumber {
		t.Errorf("Magic = %x, want %x", pkt.Magic, MagicNumber)
	}
	if pkt.CmdID != CmdQueryReq {
		t.Errorf("CmdID = %x, want %x", pkt.CmdID, CmdQueryReq)
	}
	if !bytes.Equal(pkt.Payload, payload) {
		t.Errorf("Payload mismatch")
	}
}

func TestNewQueryResponse(t *testing.T) {
	payload := []byte(`{"result":"ok"}`)
	pkt := NewQueryResponse(payload)

	if pkt.Magic != MagicNumber {
		t.Errorf("Magic = %x, want %x", pkt.Magic, MagicNumber)
	}
	if pkt.CmdID != CmdQueryResp {
		t.Errorf("CmdID = %x, want %x", pkt.CmdID, CmdQueryResp)
	}
	if !bytes.Equal(pkt.Payload, payload) {
		t.Errorf("Payload mismatch")
	}
}

func TestPayloadTooLarge(t *testing.T) {
	pkt := &Packet{
		Magic:   MagicNumber,
		CmdID:   CmdQueryReq,
		Payload: make([]byte, MaxPayloadLen+1),
	}
	_, err := Encode(pkt)
	if err == nil {
		t.Error("expected error for payload too large")
	}
}

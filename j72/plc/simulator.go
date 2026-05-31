package plc

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"net"
	"sync/atomic"
	"time"
)

type Simulator struct {
	listenAddr       string
	simulateCrash    bool
	crashAfterPackets  uint64
	running          atomic.Bool
	packetCount    atomic.Uint64
	crashed        atomic.Bool
	listener       net.Listener
	ctx            context.Context
	cancel         context.CancelFunc
}

func NewSimulator(listenAddr string, simulateCrash bool) *Simulator {
	return &Simulator{
		listenAddr:      listenAddr,
		simulateCrash: simulateCrash,
		crashAfterPackets: 50,
	}
}

func NewSimulatorWithConfig(listenAddr string, simulateCrash bool, crashAfterPackets uint64) *Simulator {
	return &Simulator{
		listenAddr:       listenAddr,
		simulateCrash:    simulateCrash,
		crashAfterPackets: crashAfterPackets,
	}
}

func (s *Simulator) Start() error {
	listener, err := net.Listen("tcp", s.listenAddr)
	if err != nil {
		return err
	}
	s.listener = listener
	s.running.Store(true)
	s.ctx, s.cancel = context.WithCancel(context.Background())

	go s.acceptConnections()

	return nil
}

func (s *Simulator) acceptConnections() {
	for s.running.Load() {
		select {
		case <-s.ctx.Done():
			return
		default:
		}

		conn, err := s.listener.Accept()
		if err != nil {
			if s.running.Load() {
				log.Printf("[PLC] Accept error: %v", err)
			}
			continue
		}

		go s.handleConnection(conn)
	}
}

func (s *Simulator) handleConnection(conn net.Conn) {
	defer conn.Close()

	remoteAddr := conn.RemoteAddr().String()
	log.Printf("[PLC] New connection from %s", remoteAddr)

	buf := make([]byte, 2048)

	for s.running.Load() && !s.crashed.Load() {
		conn.SetReadDeadline(time.Now().Add(30 * time.Second))

		n, err := conn.Read(buf)
		if err != nil {
			if err != io.EOF {
				log.Printf("[PLC] Read error from %s: %v", remoteAddr, err)
			}
			break
		}

		s.packetCount.Add(1)
		count := s.packetCount.Load()

		log.Printf("[PLC] Received packet #%d from %s, %d bytes", count, remoteAddr, n)

		if s.simulateCrash && s.crashAfterPackets > 0 && count%s.crashAfterPackets == 0 {
			log.Printf("[PLC] !!! SIMULATING CRASH after %d packets !!!", count)
			s.crashed.Store(true)
			conn.Close()
			return
		}

		response, err := s.processPacket(buf[:n])
		if err != nil {
			log.Printf("[PLC] Error processing packet: %v", err)
			continue
		}

		_, err = conn.Write(response)
		if err != nil {
			log.Printf("[PLC] Write error to %s: %v", remoteAddr, err)
			break
		}
	}

	log.Printf("[PLC] Connection closed from %s", remoteAddr)
}

func (s *Simulator) processPacket(packet []byte) ([]byte, error) {
	if len(packet) < 8 {
		return nil, fmt.Errorf("packet too short: %d bytes", len(packet))
	}

	transactionID := binary.BigEndian.Uint16(packet[0:2])
	protocolID := binary.BigEndian.Uint16(packet[2:4])
	length := binary.BigEndian.Uint16(packet[4:6])
	unitID := packet[6]
	functionCode := packet[7]

	log.Printf("[PLC] MBAP: TID=%d, PID=%d, Len=%d, UID=%d, FC=0x%02x",
		transactionID, protocolID, length, unitID, functionCode)

	if protocolID != 0 {
		return s.buildErrorResponse(transactionID, unitID, functionCode, 0x01), nil
	}

	switch functionCode {
	case 0x01, 0x02:
		return s.buildReadBitsResponse(transactionID, unitID, functionCode, packet[8:])
	case 0x03, 0x04:
		return s.buildReadRegistersResponse(transactionID, unitID, functionCode, packet[8:])
	case 0x05:
		return s.buildWriteSingleCoilResponse(transactionID, unitID, packet[8:])
	case 0x06:
		return s.buildWriteSingleRegisterResponse(transactionID, unitID, packet[8:])
	case 0x0F:
		return s.buildWriteMultipleCoilsResponse(transactionID, unitID, packet[8:])
	case 0x10:
		return s.buildWriteMultipleRegistersResponse(transactionID, unitID, packet[8:])
	default:
		return s.buildErrorResponse(transactionID, unitID, functionCode, 0x01), nil
	}
}

func (s *Simulator) buildReadBitsResponse(tid uint16, uid, fc byte, data []byte) []byte {
	quantity := uint16(8)
	if len(data) >= 4 {
		quantity = binary.BigEndian.Uint16(data[2:4])
	}
	byteCount := (quantity + 7) / 8

	response := make([]byte, 7+2+byteCount)
	binary.BigEndian.PutUint16(response[0:2], tid)
	binary.BigEndian.PutUint16(response[2:4], 0)
	binary.BigEndian.PutUint16(response[4:6], uint16(2+byteCount))
	response[6] = uid
	response[7] = fc
	response[8] = byte(byteCount)

	for i := 0; i < int(byteCount); i++ {
		response[9+i] = byte(i * 11)
	}

	return response
}

func (s *Simulator) buildReadRegistersResponse(tid uint16, uid, fc byte, data []byte) []byte {
	quantity := uint16(1)
	if len(data) >= 4 {
		quantity = binary.BigEndian.Uint16(data[2:4])
	}
	byteCount := quantity * 2

	response := make([]byte, 7+2+byteCount)
	binary.BigEndian.PutUint16(response[0:2], tid)
	binary.BigEndian.PutUint16(response[2:4], 0)
	binary.BigEndian.PutUint16(response[4:6], uint16(2+byteCount))
	response[6] = uid
	response[7] = fc
	response[8] = byte(byteCount)

	for i := 0; i < int(byteCount); i += 2 {
		binary.BigEndian.PutUint16(response[9+i:11+i], uint16(i*3))
	}

	return response
}

func (s *Simulator) buildWriteSingleCoilResponse(tid uint16, uid byte, data []byte) []byte {
	response := make([]byte, 12)
	binary.BigEndian.PutUint16(response[0:2], tid)
	binary.BigEndian.PutUint16(response[2:4], 0)
	binary.BigEndian.PutUint16(response[4:6], 6)
	response[6] = uid
	response[7] = 0x05

	if len(data) >= 4 {
		copy(response[8:12], data[:4])
	}

	return response
}

func (s *Simulator) buildWriteSingleRegisterResponse(tid uint16, uid byte, data []byte) []byte {
	response := make([]byte, 12)
	binary.BigEndian.PutUint16(response[0:2], tid)
	binary.BigEndian.PutUint16(response[2:4], 0)
	binary.BigEndian.PutUint16(response[4:6], 6)
	response[6] = uid
	response[7] = 0x06

	if len(data) >= 4 {
		copy(response[8:12], data[:4])
	}

	return response
}

func (s *Simulator) buildWriteMultipleCoilsResponse(tid uint16, uid byte, data []byte) []byte {
	response := make([]byte, 12)
	binary.BigEndian.PutUint16(response[0:2], tid)
	binary.BigEndian.PutUint16(response[2:4], 0)
	binary.BigEndian.PutUint16(response[4:6], 6)
	response[6] = uid
	response[7] = 0x0F

	if len(data) >= 4 {
		copy(response[8:12], data[:4])
	}

	return response
}

func (s *Simulator) buildWriteMultipleRegistersResponse(tid uint16, uid byte, data []byte) []byte {
	response := make([]byte, 12)
	binary.BigEndian.PutUint16(response[0:2], tid)
	binary.BigEndian.PutUint16(response[2:4], 0)
	binary.BigEndian.PutUint16(response[4:6], 6)
	response[6] = uid
	response[7] = 0x10

	if len(data) >= 4 {
		copy(response[8:12], data[:4])
	}

	return response
}

func (s *Simulator) buildErrorResponse(tid uint16, uid, fc, errCode byte) []byte {
	response := make([]byte, 9)
	binary.BigEndian.PutUint16(response[0:2], tid)
	binary.BigEndian.PutUint16(response[2:4], 0)
	binary.BigEndian.PutUint16(response[4:6], 3)
	response[6] = uid
	response[7] = fc | 0x80
	response[8] = errCode
	return response
}

func (s *Simulator) Stop() {
	log.Println("[PLC] Stopping...")
	s.running.Store(false)
	if s.cancel != nil {
		s.cancel()
	}
	if s.listener != nil {
		s.listener.Close()
	}
	log.Println("[PLC] Stopped")
}

func (s *Simulator) Reset() {
	s.crashed.Store(false)
	s.packetCount.Store(0)
}

func (s *Simulator) IsCrashed() bool {
	return s.crashed.Load()
}

func (s *Simulator) PacketCount() uint64 {
	return s.packetCount.Load()
}

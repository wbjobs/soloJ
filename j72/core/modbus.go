package core

import (
	"crypto/rand"
	"encoding/binary"
	"math/big"
)

type ModbusPacket struct {
	TransactionID uint16
	ProtocolID    uint16
	Length        uint16
	UnitID        byte
	FunctionCode  byte
	Data          []byte
	Raw           []byte
}

const (
	FuncReadCoils              = 0x01
	FuncReadDiscreteInputs     = 0x02
	FuncReadHoldingRegisters   = 0x03
	FuncReadInputRegisters     = 0x04
	FuncWriteSingleCoil        = 0x05
	FuncWriteSingleRegister    = 0x06
	FuncWriteMultipleCoils     = 0x0F
	FuncWriteMultipleRegisters = 0x10
)

var validFunctionCodes = []byte{
	FuncReadCoils, FuncReadDiscreteInputs, FuncReadHoldingRegisters,
	FuncReadInputRegisters, FuncWriteSingleCoil, FuncWriteSingleRegister,
	FuncWriteMultipleCoils, FuncWriteMultipleRegisters,
}

func NewModbusPacket() *ModbusPacket {
	return &ModbusPacket{
		ProtocolID: 0x0000,
		UnitID:     0x01,
	}
}

func (p *ModbusPacket) Serialize() []byte {
	pduLen := len(p.Data) + 1
	p.Length = uint16(pduLen)

	buf := make([]byte, 7+len(p.Data))
	binary.BigEndian.PutUint16(buf[0:2], p.TransactionID)
	binary.BigEndian.PutUint16(buf[2:4], p.ProtocolID)
	binary.BigEndian.PutUint16(buf[4:6], p.Length)
	buf[6] = p.UnitID
	buf[7] = p.FunctionCode
	copy(buf[8:], p.Data)
	p.Raw = buf
	return buf
}

func GenerateNormalPacket() *ModbusPacket {
	p := NewModbusPacket()
	p.TransactionID = uint16(RandomInt(0, 65535))
	p.FunctionCode = validFunctionCodes[RandomInt(0, len(validFunctionCodes))]

	switch p.FunctionCode {
	case FuncReadCoils, FuncReadDiscreteInputs, FuncReadHoldingRegisters, FuncReadInputRegisters:
		startAddr := uint16(RandomInt(0, 1000))
		quantity := uint16(RandomInt(1, 125))
		p.Data = make([]byte, 4)
		binary.BigEndian.PutUint16(p.Data[0:2], startAddr)
		binary.BigEndian.PutUint16(p.Data[2:4], quantity)

	case FuncWriteSingleCoil:
		addr := uint16(RandomInt(0, 1000))
		value := uint16(0xFF00)
		if RandomInt(0, 2) == 0 {
			value = 0x0000
		}
		p.Data = make([]byte, 4)
		binary.BigEndian.PutUint16(p.Data[0:2], addr)
		binary.BigEndian.PutUint16(p.Data[2:4], value)

	case FuncWriteSingleRegister:
		addr := uint16(RandomInt(0, 1000))
		value := uint16(RandomInt(0, 65535))
		p.Data = make([]byte, 4)
		binary.BigEndian.PutUint16(p.Data[0:2], addr)
		binary.BigEndian.PutUint16(p.Data[2:4], value)

	case FuncWriteMultipleCoils:
		startAddr := uint16(RandomInt(0, 1000))
		quantity := uint16(RandomInt(1, 100))
		byteCount := (quantity + 7) / 8
		p.Data = make([]byte, 5+byteCount)
		binary.BigEndian.PutUint16(p.Data[0:2], startAddr)
		binary.BigEndian.PutUint16(p.Data[2:4], quantity)
		p.Data[4] = byte(byteCount)
		rand.Read(p.Data[5:])

	case FuncWriteMultipleRegisters:
		startAddr := uint16(RandomInt(0, 1000))
		quantity := uint16(RandomInt(1, 100))
		byteCount := quantity * 2
		p.Data = make([]byte, 5+byteCount)
		binary.BigEndian.PutUint16(p.Data[0:2], startAddr)
		binary.BigEndian.PutUint16(p.Data[2:4], quantity)
		p.Data[4] = byte(byteCount)
		rand.Read(p.Data[5:])
	}

	p.Serialize()
	return p
}

func GenerateMalformedPacket() *ModbusPacket {
	p := NewModbusPacket()
	p.TransactionID = uint16(RandomInt(0, 65535))

	malType := RandomInt(0, 10)

	switch malType {
	case 0:
		p.FunctionCode = byte(RandomInt(0, 255))
		p.Data = make([]byte, RandomInt(0, 200))
		rand.Read(p.Data)

	case 1:
		p.FunctionCode = validFunctionCodes[RandomInt(0, len(validFunctionCodes))]
		p.Data = make([]byte, RandomInt(0, 255))
		rand.Read(p.Data)

	case 2:
		p.FunctionCode = validFunctionCodes[RandomInt(0, len(validFunctionCodes))]
		if RandomInt(0, 2) == 0 {
			p.Data = make([]byte, 1)
		} else {
			p.Data = make([]byte, 1000)
		}
		rand.Read(p.Data)

	case 3:
		p.ProtocolID = uint16(RandomInt(1, 65535))
		p.FunctionCode = validFunctionCodes[RandomInt(0, len(validFunctionCodes))]
		p.Data = make([]byte, 4)
		binary.BigEndian.PutUint16(p.Data[0:2], 0xFFFF)
		binary.BigEndian.PutUint16(p.Data[2:4], 0xFFFF)

	case 4:
		p.FunctionCode = FuncWriteSingleCoil
		p.Data = make([]byte, 4)
		binary.BigEndian.PutUint16(p.Data[0:2], uint16(RandomInt(0, 1000)))
		binary.BigEndian.PutUint16(p.Data[2:4], uint16(RandomInt(2, 254)))

	case 5:
		p.FunctionCode = FuncWriteMultipleRegisters
		startAddr := uint16(RandomInt(0, 1000))
		quantity := uint16(RandomInt(100, 1000))
		byteCount := byte(RandomInt(0, 255))
		p.Data = make([]byte, 5 + int(byteCount))
		binary.BigEndian.PutUint16(p.Data[0:2], startAddr)
		binary.BigEndian.PutUint16(p.Data[2:4], quantity)
		p.Data[4] = byteCount
		rand.Read(p.Data[5:])

	case 6:
		p.FunctionCode = validFunctionCodes[RandomInt(0, len(validFunctionCodes))]
		p.Data = make([]byte, 4)
		binary.BigEndian.PutUint16(p.Data[0:2], uint16(RandomInt(0, 1000)))
		binary.BigEndian.PutUint16(p.Data[2:4], 0x0000)

	case 7:
		p.UnitID = byte(RandomInt(0, 255))
		p.FunctionCode = validFunctionCodes[RandomInt(0, len(validFunctionCodes))]
		p.Data = make([]byte, RandomInt(4, 100))
		rand.Read(p.Data)

	case 8:
		p.FunctionCode = validFunctionCodes[RandomInt(0, len(validFunctionCodes))]
		p.Data = make([]byte, RandomInt(4, 200))
		for i := range p.Data {
			p.Data[i] = 0xFF
		}

	default:
		p.FunctionCode = 0x80 | byte(RandomInt(0, 127))
		p.Data = make([]byte, RandomInt(0, 50))
		rand.Read(p.Data)
	}

	p.Serialize()
	return p
}

func GeneratePacket(malformed bool) *ModbusPacket {
	if malformed {
		return GenerateMalformedPacket()
	}
	return GenerateNormalPacket()
}

func RandomInt(min, max int) int {
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(max-min)))
	return int(n.Int64()) + min
}

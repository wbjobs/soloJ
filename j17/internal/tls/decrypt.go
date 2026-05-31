package tls

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
)

const (
	TLS_HEADER_SIZE = 5
	MAX_RECORD_SIZE = 16384
)

type TLSVersion uint16

const (
	TLS_VERSION_UNKNOWN TLSVersion = 0
	TLS_VERSION_1_0     TLSVersion = 0x0301
	TLS_VERSION_1_1     TLSVersion = 0x0302
	TLS_VERSION_1_2     TLSVersion = 0x0303
	TLS_VERSION_1_3     TLSVersion = 0x0304
)

type ContentType uint8

const (
	ContentChangeCipherSpec ContentType = 20
	ContentAlert            ContentType = 21
	ContentHandshake        ContentType = 22
	ContentApplicationData  ContentType = 23
	ContentHeartbeat        ContentType = 24
)

type TLSRecord struct {
	ContentType ContentType
	Version     TLSVersion
	Length      uint16
	Payload     []byte
}

type TLSDecrypter struct {
	keyLog *KeyLog
}

func NewTLSDecrypter(keyLog *KeyLog) *TLSDecrypter {
	return &TLSDecrypter{
		keyLog: keyLog,
	}
}

func (d *TLSDecrypter) ParseRecord(data []byte) (*TLSRecord, error) {
	if len(data) < TLS_HEADER_SIZE {
		return nil, fmt.Errorf("data too short for TLS record: %d bytes", len(data))
	}

	record := &TLSRecord{
		ContentType: ContentType(data[0]),
		Version:     TLSVersion(binary.BigEndian.Uint16(data[1:3])),
		Length:      binary.BigEndian.Uint16(data[3:5]),
	}

	if record.Length > MAX_RECORD_SIZE {
		return nil, fmt.Errorf("TLS record too large: %d bytes", record.Length)
	}

	if len(data) < int(TLS_HEADER_SIZE+record.Length) {
		record.Payload = data[TLS_HEADER_SIZE:]
	} else {
		record.Payload = data[TLS_HEADER_SIZE : TLS_HEADER_SIZE+record.Length]
	}

	return record, nil
}

func (d *TLSDecrypter) IsEncrypted(record *TLSRecord) bool {
	return record.ContentType == ContentApplicationData
}

func (d *TLSDecrypter) Decrypt(record *TLSRecord, clientRandom []byte) ([]byte, error) {
	if !d.IsEncrypted(record) {
		return record.Payload, nil
	}

	switch record.Version {
	case TLS_VERSION_1_2:
		return d.decryptTLS12(record, clientRandom)
	case TLS_VERSION_1_3:
		return d.decryptTLS13(record, clientRandom)
	default:
		return nil, fmt.Errorf("unsupported TLS version: 0x%04x", record.Version)
	}
}

func (d *TLSDecrypter) decryptTLS12(record *TLSRecord, clientRandom []byte) ([]byte, error) {
	masterSecret := d.keyLog.GetMasterSecret(clientRandom)
	if masterSecret == nil {
		return nil, fmt.Errorf("no master secret found for client random")
	}

	if len(record.Payload) < 16+16 {
		return nil, fmt.Errorf("encrypted payload too short")
	}

	iv := record.Payload[:16]
	ciphertext := record.Payload[16 : len(record.Payload)-16]

	clientKey, serverKey, clientMAC, serverMAC := d.deriveTLS12Keys(masterSecret, clientRandom)

	block, err := aes.NewCipher(clientKey)
	if err != nil {
		return nil, fmt.Errorf("creating AES cipher: %w", err)
	}

	mode := cipher.NewCBCDecrypter(block, iv)
	plaintext := make([]byte, len(ciphertext))
	mode.CryptBlocks(plaintext, ciphertext)

	plaintext = d.removePaddingTLS12(plaintext)

	_ = clientMAC
	_ = serverMAC

	return plaintext, nil
}

func (d *TLSDecrypter) decryptTLS13(record *TLSRecord, clientRandom []byte) ([]byte, error) {
	if len(record.Payload) < 16 {
		return nil, fmt.Errorf("TLS 1.3 encrypted payload too short")
	}

	ciphertext := record.Payload[:len(record.Payload)-16]
	tag := record.Payload[len(record.Payload)-16:]

	clientWriteKey := d.keyLog.GetKey("CLIENT_HANDSHAKE_TRAFFIC_SECRET", clientRandom)
	if clientWriteKey == nil {
		clientWriteKey = d.keyLog.GetKey("CLIENT_APPLICATION_TRAFFIC_SECRET", clientRandom)
	}
	if clientWriteKey == nil {
		serverWriteKey := d.keyLog.GetKey("SERVER_HANDSHAKE_TRAFFIC_SECRET", clientRandom)
		if serverWriteKey == nil {
			serverWriteKey = d.keyLog.GetKey("SERVER_APPLICATION_TRAFFIC_SECRET", clientRandom)
		}
		if serverWriteKey == nil {
			return nil, fmt.Errorf("no traffic secret found for client random")
		}
		clientWriteKey = serverWriteKey
	}

	key := d.hkdfExpandLabel(clientWriteKey, "key", nil, 16)
	iv := d.hkdfExpandLabel(clientWriteKey, "iv", nil, 12)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("creating AES cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM cipher: %w", err)
	}

	nonce := make([]byte, 12)
	copy(nonce, iv)

	plaintext, err := aesgcm.Open(nil, nonce, append(ciphertext, tag...), nil)
	if err != nil {
		return nil, fmt.Errorf("GCM decryption failed: %w", err)
	}

	return plaintext, nil
}

func (d *TLSDecrypter) deriveTLS12Keys(masterSecret, clientRandom []byte) (clientKey, serverKey, clientMAC, serverMAC []byte) {
	seed := make([]byte, 0, 64)
	seed = append(seed, []byte("key expansion")...)
	seed = append(seed, clientRandom...)
	seed = append(seed, clientRandom...)

	keyMaterial := d.prfSHA256(masterSecret, seed, 104)

	clientMAC = keyMaterial[0:32]
	serverMAC = keyMaterial[32:64]
	clientKey = keyMaterial[64:80]
	serverKey = keyMaterial[80:96]

	return
}

func (d *TLSDecrypter) prfSHA256(secret, seed []byte, length int) []byte {
	result := make([]byte, length)
	a := seed

	for i := 0; i < length; i += 32 {
		h := sha256.New()
		h.Write(secret)
		h.Write(a)
		a = h.Sum(nil)

		h2 := sha256.New()
		h2.Write(secret)
		h2.Write(a)
		h2.Write(seed)
		tmp := h2.Sum(nil)

		copy(result[i:], tmp)
	}

	return result[:length]
}

func (d *TLSDecrypter) hkdfExpandLabel(secret []byte, label string, ctx []byte, length int) []byte {
	labels := []byte("tls13 " + label)
	
	hkdfLabel := make([]byte, 2+len(labels)+1+len(ctx))
	binary.BigEndian.PutUint16(hkdfLabel, uint16(length))
	hkdfLabel[2] = byte(len(labels))
	copy(hkdfLabel[3:], labels)
	hkdfLabel[3+len(labels)] = byte(len(ctx))
	if len(ctx) > 0 {
		copy(hkdfLabel[3+len(labels)+1:], ctx)
	}

	return d.hkdfExpand(secret, hkdfLabel, length)
}

func (d *TLSDecrypter) hkdfExpand(prk, info []byte, length int) []byte {
	t := make([]byte, 0)
	output := make([]byte, 0, length)

	for i := byte(1); len(output) < length; i++ {
		h := sha256.New()
		h.Write(t)
		h.Write(info)
		h.Write([]byte{i})
		t = h.Sum(nil)
		output = append(output, t...)
	}

	return output[:length]
}

func (d *TLSDecrypter) removePaddingTLS12(data []byte) []byte {
	if len(data) == 0 {
		return data
	}

	paddingLen := int(data[len(data)-1])
	if paddingLen >= len(data) {
		return data
	}

	return data[:len(data)-paddingLen-1]
}

func (d *TLSDecrypter) ExtractClientRandom(record *TLSRecord) []byte {
	if record.ContentType != ContentHandshake {
		return nil
	}

	if len(record.Payload) < 34 {
		return nil
	}

	clientHello := record.Payload
	if clientHello[0] != 1 {
		return nil
	}

	return clientHello[6:38]
}

func (d *TLSDecrypter) IsHTTP(plaintext []byte) bool {
	if len(plaintext) < 4 {
		return false
	}

	head := bytes.ToUpper(plaintext[:min(len(plaintext), 20)])
	methods := []string{"GET ", "POST", "PUT ", "DELE", "PATC", "HEAD", "OPTI", "CONN", "TRAC", "HTTP"}
	for _, m := range methods {
		if bytes.HasPrefix(head, []byte(m)) {
			return true
		}
	}
	return false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

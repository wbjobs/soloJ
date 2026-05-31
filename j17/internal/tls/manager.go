package tls

import (
	"sync"
	"time"

	"github.com/ebpf-http-tracer/internal/types"
)

type SessionState struct {
	ClientRandom []byte
	LastSeen     time.Time
	IsDecryptable bool
}

type TLSManager struct {
	keyLog     *KeyLog
	decrypter  *TLSDecrypter
	sessions   map[uint64]*SessionState
	sessionsMu sync.RWMutex
}

func NewTLSManager(keyLogPath string) (*TLSManager, error) {
	keyLog, err := NewKeyLog(keyLogPath)
	if err != nil {
		return nil, err
	}

	return &TLSManager{
		keyLog:    keyLog,
		decrypter: NewTLSDecrypter(keyLog),
		sessions:  make(map[uint64]*SessionState),
	}, nil
}

func (m *TLSManager) GetOrCreateSession(sslPtr uint64) *SessionState {
	m.sessionsMu.Lock()
	defer m.sessionsMu.Unlock()

	if session, ok := m.sessions[sslPtr]; ok {
		session.LastSeen = time.Now()
		return session
	}

	session := &SessionState{
		LastSeen: time.Now(),
	}
	m.sessions[sslPtr] = session
	return session
}

func (m *TLSManager) SetClientRandom(sslPtr uint64, clientRandom []byte) {
	session := m.GetOrCreateSession(sslPtr)
	session.ClientRandom = clientRandom
	
	if m.keyLog.GetMasterSecret(clientRandom) != nil {
		session.IsDecryptable = true
	}
}

func (m *TLSManager) DecryptEvent(event *types.HTTPEvent) ([]byte, error) {
	if event.IsTLS == 0 {
		payloadLen := int(event.PayloadLen)
		if payloadLen > types.MaxPayloadSize {
			payloadLen = types.MaxPayloadSize
		}
		return event.Payload[:payloadLen], nil
	}

	session := m.GetOrCreateSession(event.SSLCtxPtr)
	
	payloadLen := int(event.PayloadLen)
	if payloadLen > types.MaxPayloadSize {
		payloadLen = types.MaxPayloadSize
	}

	record, err := m.decrypter.ParseRecord(event.Payload[:payloadLen])
	if err != nil {
		return nil, err
	}

	if record.ContentType == ContentHandshake {
		clientRandom := m.decrypter.ExtractClientRandom(record)
		if clientRandom != nil {
			session.ClientRandom = clientRandom
			if m.keyLog.GetMasterSecret(clientRandom) != nil {
				session.IsDecryptable = true
			}
		}
		return record.Payload, nil
	}

	if !m.decrypter.IsEncrypted(record) {
		return record.Payload, nil
	}

	if !session.IsDecryptable || session.ClientRandom == nil {
		return nil, nil
	}

	plaintext, err := m.decrypter.Decrypt(record, session.ClientRandom)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

func (m *TLSManager) ReloadKeys() error {
	return m.keyLog.Reload()
}

func (m *TLSManager) CleanupOldSessions(maxAge time.Duration) {
	m.sessionsMu.Lock()
	defer m.sessionsMu.Unlock()

	cutoff := time.Now().Add(-maxAge)
	for ptr, session := range m.sessions {
		if session.LastSeen.Before(cutoff) {
			delete(m.sessions, ptr)
		}
	}
}

func (m *TLSManager) Close() error {
	return m.keyLog.Close()
}

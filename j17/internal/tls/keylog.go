package tls

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"sync"
)

type KeyLogEntry struct {
	Label     string
	ClientRandom []byte
	Secret    []byte
}

type KeyLog struct {
	mu          sync.RWMutex
	entries     map[string]*KeyLogEntry
	filePath    string
	fileWatcher *os.File
}

func NewKeyLog(filePath string) (*KeyLog, error) {
	kl := &KeyLog{
		entries:  make(map[string]*KeyLogEntry),
		filePath: filePath,
	}

	if err := kl.loadFile(); err != nil {
		return nil, fmt.Errorf("loading keylog file: %w", err)
	}

	return kl, nil
}

func (kl *KeyLog) loadFile() error {
	kl.mu.Lock()
	defer kl.mu.Unlock()

	file, err := os.Open(kl.filePath)
	if err != nil {
		return fmt.Errorf("opening file: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), 64*1024)

	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		entry, err := parseKeyLogLine(line)
		if err != nil {
			continue
		}

		key := fmt.Sprintf("%s-%x", entry.Label, entry.ClientRandom)
		kl.entries[key] = entry
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scanning file: %w", err)
	}

	return nil
}

func parseKeyLogLine(line string) (*KeyLogEntry, error) {
	parts := strings.Split(line, " ")
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid line format")
	}

	label := parts[0]
	clientRandom, err := hexDecode(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decoding client random: %w", err)
	}

	secret, err := hexDecode(parts[2])
	if err != nil {
		return nil, fmt.Errorf("decoding secret: %w", err)
	}

	return &KeyLogEntry{
		Label:        label,
		ClientRandom: clientRandom,
		Secret:       secret,
	}, nil
}

func hexDecode(s string) ([]byte, error) {
	if len(s)%2 != 0 {
		return nil, fmt.Errorf("odd length hex string")
	}

	result := make([]byte, len(s)/2)
	for i := 0; i < len(s); i += 2 {
		high, err := hexCharToByte(s[i])
		if err != nil {
			return nil, err
		}
		low, err := hexCharToByte(s[i+1])
		if err != nil {
			return nil, err
		}
		result[i/2] = (high << 4) | low
	}
	return result, nil
}

func hexCharToByte(c byte) (byte, error) {
	switch {
	case c >= '0' && c <= '9':
		return c - '0', nil
	case c >= 'a' && c <= 'f':
		return c - 'a' + 10, nil
	case c >= 'A' && c <= 'F':
		return c - 'A' + 10, nil
	default:
		return 0, fmt.Errorf("invalid hex character: %c", c)
	}
}

func (kl *KeyLog) GetMasterSecret(clientRandom []byte) []byte {
	kl.mu.RLock()
	defer kl.mu.RUnlock()

	key := fmt.Sprintf("CLIENT_RANDOM-%x", clientRandom)
	if entry, ok := kl.entries[key]; ok {
		return entry.Secret
	}
	return nil
}

func (kl *KeyLog) GetKey(label string, clientRandom []byte) []byte {
	kl.mu.RLock()
	defer kl.mu.RUnlock()

	key := fmt.Sprintf("%s-%x", label, clientRandom)
	if entry, ok := kl.entries[key]; ok {
		return entry.Secret
	}
	return nil
}

func (kl *KeyLog) Reload() error {
	return kl.loadFile()
}

func (kl *KeyLog) Close() error {
	kl.mu.Lock()
	defer kl.mu.Unlock()
	
	if kl.fileWatcher != nil {
		kl.fileWatcher.Close()
	}
	return nil
}

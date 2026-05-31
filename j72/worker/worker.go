package worker

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"modbus-fuzzer/core"
	"modbus-fuzzer/core/coverage"
	"modbus-fuzzer/core/rules"
)

const (
	RulesChannel    = "modbus:fuzz:rules:update"
	maxConcurrentTasks = 10
	maxConnPerTarget   = 5
	connIdleTimeout    = 30 * time.Second
	maxRetries         = 3
)

type connPool struct {
	conns    map[string]chan net.Conn
	mu       sync.Mutex
	maxConns int
}

func newConnPool(maxConns int) *connPool {
	return &connPool{
		conns:    make(map[string]chan net.Conn),
		maxConns: maxConns,
	}
}

func (p *connPool) get(target string) (net.Conn, error) {
	p.mu.Lock()
	if _, ok := p.conns[target]; !ok {
		p.conns[target] = make(chan net.Conn, p.maxConns)
	}
	ch := p.conns[target]
	p.mu.Unlock()

	select {
	case conn := <-ch:
		if conn != nil {
			conn.SetDeadline(time.Time{})
			return conn, nil
		}
	default:
	}

	return nil, nil
}

func (p *connPool) put(target string, conn net.Conn) {
	if conn == nil {
		return
	}

	p.mu.Lock()
	ch, ok := p.conns[target]
	if !ok {
		ch = make(chan net.Conn, p.maxConns)
		p.conns[target] = ch
	}
	p.mu.Unlock()

	conn.SetDeadline(time.Now().Add(connIdleTimeout))

	select {
	case ch <- conn:
	default:
		conn.Close()
	}
}

func (p *connPool) close() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for target, ch := range p.conns {
		close(ch)
		for conn := range ch {
			if conn != nil {
				conn.Close()
			}
		}
		delete(p.conns, target)
	}
}

type Worker struct {
	ID             string
	redisClient    *redis.Client
	ctx            context.Context
	cancel         context.CancelFunc
	icmpConn       net.PacketConn
	activeTargets  map[string]time.Time
	mu             sync.Mutex
	icmpListenerWg sync.WaitGroup
	connPool       *connPool
	semaphore      chan struct{}

	ruleManager    *rules.RuleManager
	coverageTracker *coverage.CoverageTracker
	useDynamicRules bool
}

func NewWorker(workerID string, redisAddr string, redisDB int) (*Worker, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:         redisAddr,
		DB:           redisDB,
		PoolSize:     20,
		MinIdleConns: 5,
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx, cancel := context.WithCancel(context.Background())

	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to connect to Redis: %v", err)
	}

	ruleManager := rules.NewRuleManager()
	coverageTracker := coverage.NewCoverageTracker(workerID)

	coverage.GetRegistry().RegisterTracker(coverageTracker)

	worker := &Worker{
		ID:              workerID,
		redisClient:     rdb,
		ctx:             ctx,
		cancel:          cancel,
		activeTargets:   make(map[string]time.Time),
		connPool:        newConnPool(maxConnPerTarget),
		semaphore:       make(chan struct{}, maxConcurrentTasks),
		ruleManager:     ruleManager,
		coverageTracker: coverageTracker,
		useDynamicRules: true,
	}

	if err := worker.setupSockets(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to setup sockets: %v", err)
	}

	return worker, nil
}

func (w *Worker) RuleManager() *rules.RuleManager {
	return w.ruleManager
}

func (w *Worker) CoverageTracker() *coverage.CoverageTracker {
	return w.coverageTracker
}

func (w *Worker) setupSockets() error {
	var err error

	w.icmpConn, err = net.ListenPacket("ip4:icmp", "0.0.0.0")
	if err != nil {
		log.Printf("[Worker %s] Warning: ICMP listener failed (need admin/root): %v", w.ID, err)
		log.Printf("[Worker %s] ICMP monitoring disabled", w.ID)
		w.icmpConn = nil
		return nil
	}

	return nil
}

func (w *Worker) Start() {
	log.Printf("[Worker %s] Starting... (max concurrent: %d, pool size: %d per target)",
		w.ID, maxConcurrentTasks, maxConnPerTarget)

	if w.icmpConn != nil {
		w.icmpListenerWg.Add(1)
		go w.listenICMP()
	}

	go w.cleanupIdleTargets()
	go w.listenRuleUpdates()

	for i := 0; i < maxConcurrentTasks; i++ {
		go w.processTasks()
	}

	log.Printf("[Worker %s] Started %d worker goroutines", w.ID, maxConcurrentTasks)
	log.Printf("[Worker %s] Dynamic mutation rules: enabled", w.ID)
}

func (w *Worker) listenRuleUpdates() {
	pubsub := w.redisClient.Subscribe(w.ctx, RulesChannel)
	defer pubsub.Close()

	_, err := pubsub.Receive(w.ctx)
	if err != nil {
		log.Printf("[Worker %s] Failed to subscribe to rule updates: %v", w.ID, err)
		return
	}

	log.Printf("[Worker %s] Subscribed to rule updates channel", w.ID)

	ch := pubsub.Channel()
	for {
		select {
		case msg, ok := <-ch:
			if !ok {
				return
			}

			var rule rules.MutationRule
			if err := json.Unmarshal([]byte(msg.Payload), &rule); err != nil {
				log.Printf("[Worker %s] Failed to parse rule update: %v", w.ID, err)
				continue
			}

			existing, _ := w.ruleManager.GetRule(rule.ID)
			if existing == nil {
				if err := w.ruleManager.AddRule(&rule); err != nil {
					log.Printf("[Worker %s] Failed to add rule %s: %v", w.ID, rule.ID, err)
				} else {
					log.Printf("[Worker %s] Added new rule: %s (%s, weight: %d, enabled: %v)",
						w.ID, rule.ID, rule.Name, rule.Weight, rule.Enabled)
				}
			} else {
				if err := w.ruleManager.UpdateRule(&rule); err != nil {
					log.Printf("[Worker %s] Failed to update rule %s: %v", w.ID, rule.ID, err)
				} else {
					log.Printf("[Worker %s] Updated rule: %s (weight: %d, enabled: %v)",
						w.ID, rule.ID, rule.Weight, rule.Enabled)
				}
			}

		case <-w.ctx.Done():
			return
		}
	}
}

func (w *Worker) listenICMP() {
	defer w.icmpListenerWg.Done()

	buf := make([]byte, 1500)
	for {
		select {
		case <-w.ctx.Done():
			return
		default:
		}

		if w.icmpConn == nil {
			return
		}

		w.icmpConn.SetReadDeadline(time.Now().Add(1 * time.Second))
		n, src, err := w.icmpConn.ReadFrom(buf)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			select {
			case <-w.ctx.Done():
				return
			default:
			}
			log.Printf("[Worker %s] ICMP read error: %v", w.ID, err)
			time.Sleep(1 * time.Second)
			continue
		}

		if n < 8 {
			continue
		}

		icmpType := buf[0]
		srcIP := src.String()

		w.mu.Lock()
		if _, ok := w.activeTargets[srcIP]; ok {
			if icmpType == 3 {
				log.Printf("[Worker %s] ICMP Destination Unreachable from %s", w.ID, srcIP)
				delete(w.activeTargets, srcIP)
			}
		}
		w.mu.Unlock()
	}
}

func (w *Worker) cleanupIdleTargets() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.mu.Lock()
			now := time.Now()
			for ip, t := range w.activeTargets {
				if now.Sub(t) > 60*time.Second {
					delete(w.activeTargets, ip)
				}
			}
			w.mu.Unlock()
		case <-w.ctx.Done():
			return
		}
	}
}

func (w *Worker) processTasks() {
	for {
		select {
		case <-w.ctx.Done():
			return
		default:
		}

		select {
		case w.semaphore <- struct{}{}:
		case <-w.ctx.Done():
			return
		}

		task, err := w.dequeueTask()
		if err != nil {
			<-w.semaphore
			if err != redis.Nil {
				select {
				case <-w.ctx.Done():
					return
				default:
				}
				log.Printf("[Worker %s] Error dequeuing task: %v", w.ID, err)
			}
			time.Sleep(500 * time.Millisecond)
			continue
		}

		go func(t *core.FuzzTask) {
			defer func() {
				<-w.semaphore
				if r := recover(); r != nil {
					log.Printf("[Worker %s] Panic recovered executing task %s: %v", w.ID, t.ID, r)
					w.coverageTracker.RecordError()
				}
			}()

			result := w.executeTask(t)
			if err := w.enqueueResult(result); err != nil {
				log.Printf("[Worker %s] Error enqueuing result for task %s: %v", w.ID, t.ID, err)
			}
		}(task)
	}
}

func (w *Worker) dequeueTask() (*core.FuzzTask, error) {
	select {
	case <-w.ctx.Done():
		return nil, fmt.Errorf("worker stopped")
	default:
	}

	data, err := w.redisClient.BRPop(w.ctx, 2*time.Second, "modbus:fuzz:tasks").Result()
	if err != nil {
		return nil, err
	}

	if len(data) < 2 {
		return nil, fmt.Errorf("invalid task data")
	}

	return core.DeserializeTask([]byte(data[1]))
}

func (w *Worker) executeTask(task *core.FuzzTask) *core.TaskResult {
	result := &core.TaskResult{
		TaskID:   task.ID,
		TargetIP: task.TargetIP,
		IsAlive:  true,
	}

	ruleID := ""
	if w.useDynamicRules && task.IsMalformed {
		rule := w.ruleManager.SelectRandomRule()
		if rule != nil {
			ruleID = rule.ID
			log.Printf("[Worker %s] Applying rule '%s' to task %s", w.ID, rule.Name, task.ID)
		}
	}

	packet := parsePacketFromTask(task)
	functionCode := byte(0)
	if packet != nil {
		functionCode = packet.FunctionCode
	}
	w.coverageTracker.RecordPacket(task.IsMalformed, functionCode, ruleID)

	log.Printf("[Worker %s] Executing task %s -> %s:%d (malformed: %v, rule: %s)",
		w.ID, task.ID, task.TargetIP, task.TargetPort, task.IsMalformed, ruleID)

	sendStart := time.Now()
	if err := w.sendRawPacket(task); err != nil {
		result.Success = false
		result.ErrorMsg = err.Error()
		w.coverageTracker.RecordError()
		log.Printf("[Worker %s] Failed to send packet for task %s: %v", w.ID, task.ID, err)
		return result
	}
	sendDuration := time.Since(sendStart)

	result.Success = true
	w.coverageTracker.RecordSuccess(sendDuration)

	isAlive := w.checkTargetAlive(task.TargetIP)
	result.IsAlive = isAlive

	if !isAlive {
		w.coverageTracker.RecordCrash()
		log.Printf("[Worker %s] CRASH DETECTED: Target %s is not responding! (task: %s)",
			w.ID, task.TargetIP, task.ID)
	}

	result.FinishedAt = time.Now().Unix()
	return result
}

func parsePacketFromTask(task *core.FuzzTask) *core.ModbusPacket {
	if len(task.PacketData) < 8 {
		return nil
	}

	packet := &core.ModbusPacket{
		TransactionID: uint16(task.PacketData[0])<<8 | uint16(task.PacketData[1]),
		ProtocolID:    uint16(task.PacketData[2])<<8 | uint16(task.PacketData[3]),
		Length:        uint16(task.PacketData[4])<<8 | uint16(task.PacketData[5]),
		UnitID:        task.PacketData[6],
		FunctionCode:  task.PacketData[7],
		Data:          task.PacketData[8:],
		Raw:           task.PacketData,
	}

	return packet
}

func (w *Worker) sendRawPacket(task *core.FuzzTask) error {
	target := fmt.Sprintf("%s:%d", task.TargetIP, task.TargetPort)
	conn, err := w.getConnection(target)
	if err != nil {
		return fmt.Errorf("connection failed: %v", err)
	}

	conn.SetDeadline(time.Now().Add(3 * time.Second))

	w.mu.Lock()
	w.activeTargets[task.TargetIP] = time.Now()
	w.mu.Unlock()

	var writeErr error
	for i := 0; i < maxRetries; i++ {
		_, writeErr = conn.Write(task.PacketData)
		if writeErr == nil {
			break
		}
		if i < maxRetries-1 {
			log.Printf("[Worker %s] Retry %d writing to %s: %v", w.ID, i+1, target, writeErr)
			time.Sleep(100 * time.Millisecond)
		}
	}

	if writeErr != nil {
		w.connPool.put(target, nil)
		conn.Close()
		w.mu.Lock()
		delete(w.activeTargets, task.TargetIP)
		w.mu.Unlock()
		return fmt.Errorf("write failed after %d retries: %v", maxRetries, writeErr)
	}

	buf := make([]byte, 1024)
	_, readErr := conn.Read(buf)
	if readErr != nil {
		if netErr, ok := readErr.(net.Error); ok && netErr.Timeout() {
			w.coverageTracker.RecordTimeout()
			w.connPool.put(target, conn)
			return nil
		}
		w.connPool.put(target, nil)
		conn.Close()
		return fmt.Errorf("read failed: %v", readErr)
	}

	w.connPool.put(target, conn)
	return nil
}

func (w *Worker) getConnection(target string) (net.Conn, error) {
	conn, err := w.connPool.get(target)
	if err != nil {
		return nil, err
	}
	if conn != nil {
		return conn, nil
	}

	dialer := &net.Dialer{
		Timeout:   2 * time.Second,
		KeepAlive: 30 * time.Second,
	}

	conn, err = dialer.Dial("tcp", target)
	if err != nil {
		return nil, err
	}

	return conn, nil
}

func (w *Worker) checkTargetAlive(targetIP string) bool {
	time.Sleep(300 * time.Millisecond)

	target := fmt.Sprintf("%s:502", targetIP)
	conn, err := w.getConnection(target)
	if err != nil {
		return false
	}
	defer func() {
		w.connPool.put(target, conn)
	}()

	conn.SetDeadline(time.Now().Add(2 * time.Second))
	testPacket := buildTestPacket()

	if _, err := conn.Write(testPacket); err != nil {
		return false
	}

	buf := make([]byte, 100)
	if _, err := conn.Read(buf); err != nil {
		return false
	}

	w.mu.Lock()
	delete(w.activeTargets, targetIP)
	w.mu.Unlock()

	return true
}

func buildTestPacket() []byte {
	packet := make([]byte, 12)
	binary.BigEndian.PutUint16(packet[0:2], 0x0001)
	binary.BigEndian.PutUint16(packet[2:4], 0x0000)
	binary.BigEndian.PutUint16(packet[4:6], 0x0006)
	packet[6] = 0x01
	packet[7] = 0x03
	binary.BigEndian.PutUint16(packet[8:10], 0x0000)
	binary.BigEndian.PutUint16(packet[10:12], 0x0001)
	return packet
}

func (w *Worker) enqueueResult(result *core.TaskResult) error {
	data, err := result.Serialize()
	if err != nil {
		return err
	}

	for i := 0; i < maxRetries; i++ {
		err = w.redisClient.LPush(w.ctx, "modbus:fuzz:results", data).Err()
		if err == nil {
			return nil
		}
		log.Printf("[Worker %s] Retry %d enqueuing result: %v", w.ID, i+1, err)
		time.Sleep(200 * time.Millisecond)
	}

	return fmt.Errorf("failed to enqueue result after %d retries: %v", maxRetries, err)
}

func (w *Worker) Stop() {
	log.Printf("[Worker %s] Stopping...", w.ID)
	w.cancel()

	coverage.GetRegistry().UnregisterTracker(w.ID)

	if w.icmpConn != nil {
		w.icmpConn.Close()
	}

	w.icmpListenerWg.Wait()

	w.connPool.close()

	w.redisClient.Close()

	log.Printf("[Worker %s] Stopped cleanly", w.ID)
}

package kafka

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/segmentio/kafka-go"
)

type MessageHandler func(msg []byte) error

type BattleEventConsumer struct {
	brokers []string
	readers []*kafka.Reader
}

type ConsumerConfig struct {
	Brokers []string
}

func NewBattleEventConsumer(cfg ConsumerConfig) *BattleEventConsumer {
	return &BattleEventConsumer{
		brokers: cfg.Brokers,
	}
}

func (c *BattleEventConsumer) SubscribeTopic(ctx context.Context, topic, groupID string, handler MessageHandler) error {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:       c.brokers,
		Topic:         topic,
		GroupID:       groupID,
		MinBytes:      1,
		MaxBytes:      10 * 1024 * 1024,
		CommitInterval: time.Second,
		RetentionTime:  7 * 24 * time.Hour,
	})
	c.readers = append(c.readers, r)

	go func() {
		backoff := 100 * time.Millisecond
		maxBackoff := 30 * time.Second

		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			msg, err := r.ReadMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				fmt.Printf("kafka read error on topic %s: %v, retrying in %v\n", topic, err, backoff)
				time.Sleep(backoff)
				backoff = time.Duration(math.Min(float64(backoff*2), float64(maxBackoff)))
				continue
			}

			backoff = 100 * time.Millisecond

			if err := handler(msg.Value); err != nil {
				fmt.Printf("handler error on topic %s: %v\n", topic, err)
			}
		}
	}()

	return nil
}

func (c *BattleEventConsumer) ReadBatch(ctx context.Context, topic, groupID string, maxMessages int) ([]kafka.Message, error) {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:       c.brokers,
		Topic:         topic,
		GroupID:       groupID,
		MinBytes:      1,
		MaxBytes:      10 * 1024 * 1024,
		CommitInterval: time.Second,
	})
	c.readers = append(c.readers, r)

	var messages []kafka.Message
	timeout := time.After(5 * time.Second)

	for i := 0; i < maxMessages; i++ {
		select {
		case <-timeout:
			return messages, nil
		default:
		}

		ctxRead, cancel := context.WithTimeout(ctx, 2*time.Second)
		msg, err := r.ReadMessage(ctxRead)
		cancel()
		if err != nil {
			break
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

func (c *BattleEventConsumer) SeekToTimestamp(topic string, partition int, timestampMs int64) error {
	conn, err := kafka.DialLeader(context.Background(), "tcp", c.brokers[0], topic, partition)
	if err != nil {
		return fmt.Errorf("dial leader for topic %s partition %d: %w", topic, partition, err)
	}
	defer conn.Close()

	offset, err := conn.ReadOffset(timestampMs)
	if err != nil {
		return fmt.Errorf("seek to timestamp %d: %w", timestampMs, err)
	}

	if err := conn.SetOffset(offset); err != nil {
		return fmt.Errorf("set offset %d: %w", offset, err)
	}

	return nil
}

func (c *BattleEventConsumer) ReadMessagesInRange(ctx context.Context, topic string, partition int, fromMs, toMs int64) ([]kafka.Message, error) {
	conn, err := kafka.DialLeader(ctx, "tcp", c.brokers[0], topic, partition)
	if err != nil {
		return nil, fmt.Errorf("dial leader for topic %s partition %d: %w", topic, partition, err)
	}
	defer conn.Close()

	startOffset, err := conn.ReadOffset(fromMs)
	if err != nil {
		return nil, fmt.Errorf("read offset for timestamp %d: %w", fromMs, err)
	}

	endOffset, err := conn.ReadOffset(toMs)
	if err != nil {
		return nil, fmt.Errorf("read offset for timestamp %d: %w", toMs, err)
	}

	if err := conn.SetOffset(startOffset); err != nil {
		return nil, fmt.Errorf("set offset %d: %w", startOffset, err)
	}

	var messages []kafka.Message
	batchSize := 1000

	for {
		batch, err := conn.ReadBatch(batchSize, 10*1024*1024)
		if err != nil {
			break
		}

		for {
			msg, err := batch.ReadMessage()
			if err != nil {
				break
			}
			if msg.Offset > endOffset {
				batch.Close()
				return messages, nil
			}
			messages = append(messages, msg)
		}
		batch.Close()

		if len(messages) == 0 {
			break
		}
	}

	return messages, nil
}

func (c *BattleEventConsumer) GetPartitions(topic string) ([]int, error) {
	conn, err := kafka.Dial("tcp", c.brokers[0])
	if err != nil {
		return nil, fmt.Errorf("dial broker: %w", err)
	}
	defer conn.Close()

	partitions, err := conn.ReadPartitions(topic)
	if err != nil {
		return nil, fmt.Errorf("read partitions for topic %s: %w", topic, err)
	}

	result := make([]int, 0, len(partitions))
	for _, p := range partitions {
		result = append(result, p.ID)
	}
	return result, nil
}

func (c *BattleEventConsumer) Close() error {
	var firstErr error
	for _, r := range c.readers {
		if err := r.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

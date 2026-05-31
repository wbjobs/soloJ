package dao

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type Store struct {
	db *sql.DB
}

func NewStore(dsn string) (*Store, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxIdleConns(10)
	db.SetMaxOpenConns(100)
	db.SetConnMaxLifetime(time.Hour)
	if err := db.Ping(); err != nil {
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) DB() *sql.DB { return s.db }

func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS nodes (
			id VARCHAR(64) PRIMARY KEY,
			address VARCHAR(256) NOT NULL,
			region VARCHAR(64) NOT NULL,
			bandwidth_cap DOUBLE NOT NULL DEFAULT 0,
			status VARCHAR(32) NOT NULL DEFAULT 'online',
			last_heartbeat DATETIME NULL,
			registered_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS heartbeats (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			node_id VARCHAR(64) NOT NULL,
			cpu_usage DOUBLE NOT NULL DEFAULT 0,
			mem_usage DOUBLE NOT NULL DEFAULT 0,
			bw_usage DOUBLE NOT NULL DEFAULT 0,
			lat_ms DOUBLE NOT NULL DEFAULT 0,
			ts DATETIME NOT NULL,
			INDEX idx_node_ts (node_id, ts)
		)`,
		`CREATE TABLE IF NOT EXISTS score_history (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			node_id VARCHAR(64) NOT NULL,
			elo DOUBLE NOT NULL,
			availability DOUBLE NOT NULL,
			bandwidth_contrib DOUBLE NOT NULL,
			uptime_ratio DOUBLE NOT NULL,
			version BIGINT NOT NULL DEFAULT 0,
			computed_at DATETIME NOT NULL,
			INDEX idx_node_at (node_id, computed_at)
		)`,
		`CREATE TABLE IF NOT EXISTS schedule_logs (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			file_hash VARCHAR(128) NOT NULL,
			client_region VARCHAR(64) NOT NULL,
			node_ids TEXT NOT NULL,
			strategy VARCHAR(32) NOT NULL,
			ts DATETIME NOT NULL,
			INDEX idx_hash (file_hash)
		)`,
		`CREATE TABLE IF NOT EXISTS heritage_logs (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			from_node VARCHAR(64) NOT NULL,
			to_nodes TEXT NOT NULL,
			total_elo DOUBLE NOT NULL,
			weights TEXT NOT NULL,
			ts DATETIME NOT NULL,
			INDEX idx_from (from_node)
		)`,
		`CREATE TABLE IF NOT EXISTS raft_logs (
			term BIGINT NOT NULL,
			idx BIGINT NOT NULL,
			type VARCHAR(32) NOT NULL,
			payload BLOB NOT NULL,
			PRIMARY KEY (term, idx)
		)`,
		`CREATE TABLE IF NOT EXISTS schedule_feedback (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			file_hash VARCHAR(128) NOT NULL,
			node_id VARCHAR(64) NOT NULL,
			download_speed DOUBLE NOT NULL DEFAULT 0,
			response_time_ms DOUBLE NOT NULL DEFAULT 0,
			success TINYINT NOT NULL DEFAULT 1,
			weights_json TEXT NOT NULL,
			ts DATETIME NOT NULL,
			INDEX idx_hash_node (file_hash, node_id),
			INDEX idx_ts (ts)
		)`,
		`CREATE TABLE IF NOT EXISTS qtable_snapshot (
			id INT PRIMARY KEY DEFAULT 1,
			data MEDIUMTEXT NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
	}
	for _, st := range stmts {
		if _, err := s.db.Exec(st); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) Close() error { return s.db.Close() }

// ----- Node -----
type Node struct {
	ID            string    `json:"id"`
	Address       string    `json:"address"`
	Region        string    `json:"region"`
	BandwidthCap  float64   `json:"bandwidth_cap"`
	Status        string    `json:"status"`
	LastHeartbeat time.Time `json:"last_heartbeat"`
	RegisteredAt  time.Time `json:"registered_at"`
}

type Heartbeat struct {
	NodeID    string    `json:"node_id"`
	CPU       float64   `json:"cpu_usage"`
	Mem       float64   `json:"mem_usage"`
	BWUsage   float64   `json:"bw_usage"`
	LatencyMs float64   `json:"lat_ms"`
	TS        time.Time `json:"ts"`
}

type ScoreHistory struct {
	NodeID     string    `json:"node_id"`
	Elo        float64   `json:"elo"`
	Avail      float64   `json:"availability"`
	BWContrib  float64   `json:"bandwidth_contrib"`
	Uptime     float64   `json:"uptime_ratio"`
	Version    int64     `json:"version"`
	ComputedAt time.Time `json:"computed_at"`
}

type ScheduleLog struct {
	FileHash     string    `json:"file_hash"`
	ClientRegion string    `json:"client_region"`
	NodeIDs      string    `json:"node_ids"`
	Strategy     string    `json:"strategy"`
	TS           time.Time `json:"ts"`
}

type HeritageLog struct {
	FromNode string    `json:"from_node"`
	ToNodes  string    `json:"to_nodes"`
	TotalElo float64   `json:"total_elo"`
	Weights  string    `json:"weights"`
	TS       time.Time `json:"ts"`
}

type ScheduleFeedback struct {
	FileHash       string    `json:"file_hash"`
	NodeID         string    `json:"node_id"`
	DownloadSpeed  float64   `json:"download_speed"`
	ResponseTimeMs float64   `json:"response_time_ms"`
	Success        bool      `json:"success"`
	WeightsJSON    string    `json:"weights_json"`
	TS             time.Time `json:"ts"`
}

func (s *Store) RegisterNode(ctx context.Context, n *Node) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO nodes(id,address,region,bandwidth_cap,status,last_heartbeat,registered_at)
		 VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
		 address=VALUES(address),region=VALUES(region),bandwidth_cap=VALUES(bandwidth_cap),status=VALUES(status)`,
		n.ID, n.Address, n.Region, n.BandwidthCap, n.Status, n.LastHeartbeat, n.RegisteredAt)
	return err
}

func (s *Store) GetNode(ctx context.Context, id string) (*Node, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id,address,region,bandwidth_cap,status,last_heartbeat,registered_at FROM nodes WHERE id=?`, id)
	n := &Node{}
	err := row.Scan(&n.ID, &n.Address, &n.Region, &n.BandwidthCap, &n.Status, &n.LastHeartbeat, &n.RegisteredAt)
	return n, err
}

func (s *Store) ListOnlineNodes(ctx context.Context, ttl time.Duration) ([]Node, error) {
	cutoff := time.Now().Add(-ttl)
	rows, err := s.db.QueryContext(ctx,
		`SELECT id,address,region,bandwidth_cap,status,last_heartbeat,registered_at FROM nodes
		 WHERE status='online' AND last_heartbeat >= ?`, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Node
	for rows.Next() {
		var n Node
		if err := rows.Scan(&n.ID, &n.Address, &n.Region, &n.BandwidthCap, &n.Status, &n.LastHeartbeat, &n.RegisteredAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (s *Store) ListAllNodes(ctx context.Context) ([]Node, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id,address,region,bandwidth_cap,status,last_heartbeat,registered_at FROM nodes`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Node
	for rows.Next() {
		var n Node
		if err := rows.Scan(&n.ID, &n.Address, &n.Region, &n.BandwidthCap, &n.Status, &n.LastHeartbeat, &n.RegisteredAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (s *Store) UpdateHeartbeat(ctx context.Context, hb *Heartbeat) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx,
		`INSERT INTO heartbeats(node_id,cpu_usage,mem_usage,bw_usage,lat_ms,ts) VALUES(?,?,?,?,?,?)`,
		hb.NodeID, hb.CPU, hb.Mem, hb.BWUsage, hb.LatencyMs, hb.TS)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx,
		`UPDATE nodes SET last_heartbeat=?,status='online' WHERE id=?`, hb.TS, hb.NodeID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) SetNodeStatus(ctx context.Context, id, status string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE nodes SET status=? WHERE id=?`, status, id)
	return err
}

func (s *Store) SaveScore(ctx context.Context, sh *ScoreHistory) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO score_history(node_id,elo,availability,bandwidth_contrib,uptime_ratio,version,computed_at)
		 VALUES(?,?,?,?,?,?,?)`,
		sh.NodeID, sh.Elo, sh.Avail, sh.BWContrib, sh.Uptime, sh.Version, sh.ComputedAt)
	return err
}

func (s *Store) LatestScore(ctx context.Context, nodeID string) (*ScoreHistory, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT node_id,elo,availability,bandwidth_contrib,uptime_ratio,version,computed_at
		 FROM score_history WHERE node_id=? ORDER BY computed_at DESC LIMIT 1`, nodeID)
	sh := &ScoreHistory{}
	err := row.Scan(&sh.NodeID, &sh.Elo, &sh.Avail, &sh.BWContrib, &sh.Uptime, &sh.Version, &sh.ComputedAt)
	return sh, err
}

func (s *Store) LatestScores(ctx context.Context) (map[string]*ScoreHistory, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT t.node_id,t.elo,t.availability,t.bandwidth_contrib,t.uptime_ratio,t.version,t.computed_at
		 FROM score_history t
		 JOIN (SELECT node_id, MAX(computed_at) AS m FROM score_history GROUP BY node_id) m
		   ON m.node_id=t.node_id AND m.m=t.computed_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]*ScoreHistory{}
	for rows.Next() {
		sh := &ScoreHistory{}
		if err := rows.Scan(&sh.NodeID, &sh.Elo, &sh.Avail, &sh.BWContrib, &sh.Uptime, &sh.Version, &sh.ComputedAt); err != nil {
			return nil, err
		}
		out[sh.NodeID] = sh
	}
	return out, rows.Err()
}

func (s *Store) SaveScheduleLog(ctx context.Context, l *ScheduleLog) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO schedule_logs(file_hash,client_region,node_ids,strategy,ts) VALUES(?,?,?,?,?)`,
		l.FileHash, l.ClientRegion, l.NodeIDs, l.Strategy, l.TS)
	return err
}

func (s *Store) SaveHeritageLog(ctx context.Context, h *HeritageLog) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO heritage_logs(from_node,to_nodes,total_elo,weights,ts) VALUES(?,?,?,?,?)`,
		h.FromNode, h.ToNodes, h.TotalElo, h.Weights, h.TS)
	return err
}

func (s *Store) AppendRaftLog(ctx context.Context, term, idx int64, typ string, payload []byte) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO raft_logs(term,idx,type,payload) VALUES(?,?,?,?)
		 ON DUPLICATE KEY UPDATE type=VALUES(type),payload=VALUES(payload)`,
		term, idx, typ, payload)
	return err
}

func (s *Store) LastRaftIndex(ctx context.Context) (int64, error) {
	row := s.db.QueryRowContext(ctx, `SELECT COALESCE(MAX(idx),0) FROM raft_logs`)
	var v int64
	err := row.Scan(&v)
	return v, err
}

func (s *Store) SaveScheduleFeedback(ctx context.Context, f *ScheduleFeedback) error {
	successInt := 0
	if f.Success {
		successInt = 1
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO schedule_feedback(file_hash,node_id,download_speed,response_time_ms,success,weights_json,ts)
		 VALUES(?,?,?,?,?,?,?)`,
		f.FileHash, f.NodeID, f.DownloadSpeed, f.ResponseTimeMs, successInt, f.WeightsJSON, f.TS)
	return err
}

func (s *Store) RecentFeedback(ctx context.Context, limit int) ([]ScheduleFeedback, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT file_hash,node_id,download_speed,response_time_ms,success,weights_json,ts
		 FROM schedule_feedback ORDER BY ts DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ScheduleFeedback
	for rows.Next() {
		var f ScheduleFeedback
		var successInt int
		if err := rows.Scan(&f.FileHash, &f.NodeID, &f.DownloadSpeed, &f.ResponseTimeMs, &successInt, &f.WeightsJSON, &f.TS); err != nil {
			return nil, err
		}
		f.Success = successInt == 1
		out = append(out, f)
	}
	return out, rows.Err()
}

func (s *Store) AvgFeedbackMetrics(ctx context.Context) (avgSpeed, avgLat float64, err error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT COALESCE(AVG(download_speed),0), COALESCE(AVG(response_time_ms),0) FROM schedule_feedback WHERE success=1`)
	err = row.Scan(&avgSpeed, &avgLat)
	return
}

func (s *Store) SaveQTableSnapshot(ctx context.Context, data string) error {
	now := time.Now()
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO qtable_snapshot(id,data,updated_at) VALUES(1,?,?)
		 ON DUPLICATE KEY UPDATE data=VALUES(data),updated_at=VALUES(updated_at)`,
		data, now)
	return err
}

func (s *Store) LoadQTableSnapshot(ctx context.Context) (string, error) {
	row := s.db.QueryRowContext(ctx, `SELECT data FROM qtable_snapshot WHERE id=1`)
	var data string
	err := row.Scan(&data)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return data, err
}

func JSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

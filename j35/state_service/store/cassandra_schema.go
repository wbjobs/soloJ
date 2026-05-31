package store

const KeyspaceCQL = `
CREATE KEYSPACE IF NOT EXISTS state_service
WITH replication = {
	'class': 'SimpleStrategy',
	'replication_factor': 3
}
`

const BattleLogsTableCQL = `
CREATE TABLE IF NOT EXISTS state_service.battle_logs (
	battle_id UUID,
	frame_number INT,
	timestamp BIGINT,
	player_id TEXT,
	event_type TEXT,
	event_data TEXT,
	PRIMARY KEY ((battle_id), frame_number, player_id)
) WITH CLUSTERING ORDER BY (frame_number ASC, player_id ASC)
  AND compaction = {'class': 'LeveledCompactionStrategy'}
  AND compression = {'sstable_compression': 'LZ4Compressor'}
`

const PlayerSnapshotsTableCQL = `
CREATE TABLE IF NOT EXISTS state_service.player_snapshots (
	player_id TEXT,
	snapshot_time BIGINT,
	battle_id UUID,
	frame_number INT,
	position_x DOUBLE,
	position_y DOUBLE,
	position_z DOUBLE,
	heading DOUBLE,
	hp DOUBLE,
	max_hp DOUBLE,
	shield DOUBLE,
	team_id INT,
	combat_attack DOUBLE,
	combat_defense DOUBLE,
	combat_crit_rate DOUBLE,
	combat_dodge_rate DOUBLE,
	buff_data TEXT,
	skill_data TEXT,
	PRIMARY KEY ((player_id), snapshot_time)
) WITH CLUSTERING ORDER BY (snapshot_time DESC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy',
                    'compaction_window_size': 1,
                    'compaction_window_unit': 'HOURS'}
  AND compression = {'sstable_compression': 'LZ4Compressor'}
  AND default_time_to_live = 86400
`

const CombatEventsTableCQL = `
CREATE TABLE IF NOT EXISTS state_service.combat_events (
	battle_id UUID,
	event_id TIMEUUID,
	frame_number INT,
	timestamp BIGINT,
	attacker_id TEXT,
	defender_id TEXT,
	skill_id TEXT,
	damage DOUBLE,
	is_crit BOOLEAN,
	is_dodge BOOLEAN,
	hp_remaining DOUBLE,
	shield_remaining DOUBLE,
	PRIMARY KEY ((battle_id), event_id)
) WITH CLUSTERING ORDER BY (event_id ASC)
  AND compaction = {'class': 'LeveledCompactionStrategy'}
  AND compression = {'sstable_compression': 'LZ4Compressor'}
`

var SchemaCQLs = []string{
	KeyspaceCQL,
	BattleLogsTableCQL,
	PlayerSnapshotsTableCQL,
	CombatEventsTableCQL,
}

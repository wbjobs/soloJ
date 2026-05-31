package main

const (
	MsgWorldData    = "world_data"
	MsgPlayerJoin   = "player_join"
	MsgPlayerLeave  = "player_leave"
	MsgPlayerMove   = "player_move"
	MsgBlockChange  = "block_change"
	MsgChunkUpdate  = "chunk_update"
	MsgPlayerList   = "player_list"
	MsgInit         = "init"
)

const (
	BlockAir   = 0
	BlockGrass = 1
	BlockDirt  = 2
	BlockStone = 3
	BlockWood  = 4
	BlockSand  = 5
)

type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type WorldDataMsg struct {
	Chunks []ChunkData `json:"chunks"`
}

type ChunkData struct {
	CX    int    `json:"cx"`
	CY    int    `json:"cy"`
	CZ    int    `json:"cz"`
	Blocks []byte `json:"blocks"`
}

type PlayerJoinMsg struct {
	ID       string  `json:"id"`
	Username string  `json:"username"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
}

type PlayerLeaveMsg struct {
	ID string `json:"id"`
}

type PlayerMoveMsg struct {
	ID string  `json:"id"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	Z  float64 `json:"z"`
	RX float64 `json:"rx"`
	RY float64 `json:"ry"`
}

type BlockChangeMsg struct {
	X     int `json:"x"`
	Y     int `json:"y"`
	Z     int `json:"z"`
	Block int `json:"block"`
}

type InitMsg struct {
	PlayerID string          `json:"player_id"`
	World    WorldDataMsg    `json:"world"`
	Players  []PlayerMoveMsg `json:"players"`
}

type ClientMoveMsg struct {
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	Z  float64 `json:"z"`
	RX float64 `json:"rx"`
	RY float64 `json:"ry"`
}

type ClientBlockMsg struct {
	X     int `json:"x"`
	Y     int `json:"y"`
	Z     int `json:"z"`
	Block int `json:"block"`
}

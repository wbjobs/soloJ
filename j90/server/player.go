package main

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Player struct {
	ID       string
	Conn     *websocket.Conn
	X        float64
	Y        float64
	Z        float64
	RX       float64
	RY       float64
	SendCh   chan []byte
	mu       sync.Mutex
	closed   bool
}

func NewPlayer(id string, conn *websocket.Conn) *Player {
	return &Player{
		ID:     id,
		Conn:   conn,
		X:      0,
		Y:      20,
		Z:      0,
		RX:     0,
		RY:     0,
		SendCh: make(chan []byte, 64),
	}
}

func (p *Player) SendMessage(msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.closed {
		return
	}
	select {
	case p.SendCh <- data:
	default:
	}
}

func (p *Player) StartReading(hub *Hub) {
	defer func() {
		hub.Unregister <- p
		p.Conn.Close()
	}()

	p.Conn.SetReadLimit(65536)
	p.Conn.SetReadDeadline(time.Now().Add(120 * time.Second))
	p.Conn.SetPongHandler(func(string) error {
		p.Conn.SetReadDeadline(time.Now().Add(120 * time.Second))
		return nil
	})

	for {
		_, message, err := p.Conn.ReadMessage()
		if err != nil {
			break
		}
		p.Conn.SetReadDeadline(time.Now().Add(120 * time.Second))

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		hub.HandleMessage(p, msg)
	}
}

func (p *Player) StartWriting() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		p.Conn.Close()
	}()

	for {
		select {
		case data, ok := <-p.SendCh:
			if !ok {
				p.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			p.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := p.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		case <-ticker.C:
			p.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := p.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (p *Player) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.closed {
		p.closed = true
		close(p.SendCh)
	}
}

func (p *Player) GetPosition() PlayerMoveMsg {
	return PlayerMoveMsg{
		ID: p.ID,
		X:  p.X,
		Y:  p.Y,
		Z:  p.Z,
		RX: p.RX,
		RY: p.RY,
	}
}

type Hub struct {
	Players    map[string]*Player
	Register   chan *Player
	Unregister chan *Player
	World      *World
	mu         sync.RWMutex
}

func NewHub(world *World) *Hub {
	return &Hub{
		Players:    make(map[string]*Player),
		Register:   make(chan *Player),
		Unregister: make(chan *Player),
		World:      world,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case player := <-h.Register:
			h.mu.Lock()
			h.Players[player.ID] = player
			h.mu.Unlock()

			h.sendInit(player)
			h.broadcastPlayerJoin(player)
			h.sendExistingPlayers(player)

		case player := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Players[player.ID]; ok {
				delete(h.Players, player.ID)
				player.Close()
			}
			h.mu.Unlock()
			h.broadcastPlayerLeave(player)
		}
	}
}

func (h *Hub) sendInit(player *Player) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	worldData := h.World.GetAllChunkData()

	var players []PlayerMoveMsg
	for _, p := range h.Players {
		if p.ID != player.ID {
			players = append(players, p.GetPosition())
		}
	}

	initMsg := InitMsg{
		PlayerID: player.ID,
		World: WorldDataMsg{
			Chunks: worldData,
		},
		Players: players,
	}

	player.SendMessage(Message{
		Type: MsgInit,
		Data: initMsg,
	})
}

func (h *Hub) broadcastPlayerJoin(player *Player) {
	msg := Message{
		Type: MsgPlayerJoin,
		Data: PlayerJoinMsg{
			ID: player.ID,
			X:  player.X,
			Y:  player.Y,
			Z:  player.Z,
		},
	}
	h.broadcast(msg, player.ID)
}

func (h *Hub) broadcastPlayerLeave(player *Player) {
	msg := Message{
		Type: MsgPlayerLeave,
		Data: PlayerLeaveMsg{
			ID: player.ID,
		},
	}
	h.broadcast(msg, "")
}

func (h *Hub) sendExistingPlayers(player *Player) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, p := range h.Players {
		if p.ID != player.ID {
			player.SendMessage(Message{
				Type: MsgPlayerJoin,
				Data: PlayerJoinMsg{
					ID: p.ID,
					X:  p.X,
					Y:  p.Y,
					Z:  p.Z,
				},
			})
		}
	}
}

func (h *Hub) HandleMessage(player *Player, msg Message) {
	switch msg.Type {
	case MsgPlayerMove:
		var moveData ClientMoveMsg
		data, _ := json.Marshal(msg.Data)
		if err := json.Unmarshal(data, &moveData); err != nil {
			return
		}
		player.X = moveData.X
		player.Y = moveData.Y
		player.Z = moveData.Z
		player.RX = moveData.RX
		player.RY = moveData.RY

		broadcastMsg := Message{
			Type: MsgPlayerMove,
			Data: PlayerMoveMsg{
				ID: player.ID,
				X:  moveData.X,
				Y:  moveData.Y,
				Z:  moveData.Z,
				RX: moveData.RX,
				RY: moveData.RY,
			},
		}
		h.broadcast(broadcastMsg, player.ID)

	case MsgBlockChange:
		var blockData ClientBlockMsg
		data, _ := json.Marshal(msg.Data)
		if err := json.Unmarshal(data, &blockData); err != nil {
			return
		}

		h.World.SetBlock(blockData.X, blockData.Y, blockData.Z, byte(blockData.Block))

		broadcastMsg := Message{
			Type: MsgBlockChange,
			Data: BlockChangeMsg{
				X:     blockData.X,
				Y:     blockData.Y,
				Z:     blockData.Z,
				Block: blockData.Block,
			},
		}
		h.broadcast(broadcastMsg, "")
	}
}

func (h *Hub) broadcast(msg Message, excludeID string) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, player := range h.Players {
		if player.ID == excludeID {
			continue
		}
		player.mu.Lock()
		if !player.closed {
			select {
			case player.SendCh <- data:
			default:
			}
		}
		player.mu.Unlock()
	}
}

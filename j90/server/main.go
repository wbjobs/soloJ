package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Server struct {
	Hub  *Hub
	Port int
}

func NewServer(port int, hub *Hub) *Server {
	return &Server{
		Hub:  hub,
		Port: port,
	}
}

func (s *Server) Start() error {
	http.HandleFunc("/ws", s.handleWebSocket)
	http.HandleFunc("/api/world", s.handleWorldAPI)

	fs := http.FileServer(http.Dir("../client"))
	http.Handle("/", fs)

	addr := ":" + strconv.Itoa(s.Port)
	log.Printf("Server starting on %s", addr)
	return http.ListenAndServe(addr, nil)
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	playerID := generatePlayerID()
	player := NewPlayer(playerID, conn)

	s.Hub.Register <- player

	go player.StartWriting()
	go player.StartReading(s.Hub)
}

func (s *Server) handleWorldAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	data := s.Hub.World.GetAllChunkData()
	json.NewEncoder(w).Encode(data)
}

var playerCounter int

func generatePlayerID() string {
	playerCounter++
	return fmt.Sprintf("player_%d", playerCounter)
}

func main() {
	world := NewWorld()
	hub := NewHub(world)
	go hub.Run()

	server := NewServer(8080, hub)
	log.Fatal(server.Start())
}

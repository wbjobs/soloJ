package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"audio-fingerprint-backend/internal/db"
	"audio-fingerprint-backend/internal/handler"
)

func main() {
	addr := flag.String("addr", ":8080", "HTTP server address")
	dbPath := flag.String("db", "./data/rocksdb", "RocksDB data directory")
	flag.Parse()

	store, err := db.NewStore(*dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer store.Close()

	log.Printf("Database initialized at %s", *dbPath)

	h := handler.NewHandler(store)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", h.HealthCheck)
	mux.HandleFunc("/api/fingerprints", h.StoreFingerprints)
	mux.HandleFunc("/api/match", h.MatchFingerprints)
	mux.HandleFunc("/api/match-multi", h.MultiMatchFingerprints)
	mux.HandleFunc("/api/audio", h.ListAudio)
	mux.HandleFunc("/api/audio/", h.DeleteAudio)

	corsMux := h.CORS(mux)

	server := &http.Server{
		Addr:    *addr,
		Handler: corsMux,
	}

	go func() {
		log.Printf("Starting server on %s", *addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
}

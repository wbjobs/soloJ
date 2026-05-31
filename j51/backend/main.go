package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image/jpeg"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"github.com/suyashkumar/dicom"
	"github.com/suyashkumar/dicom/pkg/tag"
)

const (
	uploadDir = "./uploads"
	imageDir  = "./images"
	tempDir   = "./temp"
)

type ConversionTask struct {
	FileID         string `json:"fileId"`
	ClientID       string `json:"clientId"`
	FrontendFileID string `json:"frontendFileId"`
	FileName       string `json:"fileName"`
	DcmPath        string `json:"dcmPath"`
	CreatedAt      int64  `json:"createdAt"`
}

type WSMessage struct {
	Type    string `json:"type"`
	FileID  string `json:"fileId,omitempty"`
	Percent int    `json:"percent,omitempty"`
	Stage   string `json:"stage,omitempty"`
	URL     string `json:"url,omitempty"`
	Message string `json:"message,omitempty"`
}

type Client struct {
	ID   string
	Conn *websocket.Conn
	Send chan WSMessage
}

type Hub struct {
	clients    map[string]*Client
	broadcast  chan WSMessage
	register   chan *Client
	unregister chan *Client
}

var (
	rdb         *redis.Client
	ctx         = context.Background()
	hub         = newHub()
	upgrader    = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	fileLocks   = sync.Map{}
	workerCount = runtime.NumCPU()
)

type fileLock struct {
	mu sync.Mutex
}

func getFileLock(key string) *fileLock {
	actual, _ := fileLocks.LoadOrStore(key, &fileLock{})
	return actual.(*fileLock)
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		broadcast:  make(chan WSMessage),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client.ID] = client
		case client := <-h.unregister:
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
			}
		case message := <-h.broadcast:
			for _, client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client.ID)
				}
			}
		}
	}
}

func (h *Hub) sendToClient(clientID string, message WSMessage) {
	if client, ok := h.clients[clientID]; ok {
		select {
		case client.Send <- message:
		default:
		}
	}
}

func generateUniqueID() string {
	uuidPart := uuid.New().String()
	timestampPart := strconv.FormatInt(time.Now().UnixNano(), 10)
	randomBytes := make([]byte, 8)
	rand.Read(randomBytes)
	randomPart := hex.EncodeToString(randomBytes)
	return fmt.Sprintf("%s_%s_%s", timestampPart, uuidPart[:8], randomPart)
}

func init() {
	os.MkdirAll(uploadDir, 0755)
	os.MkdirAll(imageDir, 0755)
	os.MkdirAll(tempDir, 0755)

	rdb = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	go cleanupOldFiles()
	go hub.run()
	for i := 0; i < workerCount; i++ {
		go taskWorker(i)
	}
}

func cleanupOldFiles() {
	for {
		cutoff := time.Now().Add(-24 * time.Hour)
		cleanupDir(uploadDir, cutoff)
		cleanupDir(imageDir, cutoff)
		cleanupDir(tempDir, cutoff)
		time.Sleep(1 * time.Hour)
	}
}

func cleanupDir(dir string, cutoff time.Time) {
	files, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, f := range files {
		info, err := f.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			os.Remove(filepath.Join(dir, f.Name()))
		}
	}
}

func taskWorker(id int) {
	fmt.Printf("Worker %d started\n", id)
	
	for {
		result, err := rdb.BLPop(ctx, 0*time.Second, "dicom:queue").Result()
		if err != nil {
			time.Sleep(1 * time.Second)
			continue
		}

		if len(result) < 2 {
			continue
		}

		var task ConversionTask
		if err := json.Unmarshal([]byte(result[1]), &task); err != nil {
			fmt.Printf("Worker %d: Failed to parse task: %v\n", id, err)
			continue
		}

		processTask(id, &task)
	}
}

func processTask(workerID int, task *ConversionTask) {
	fmt.Printf("Worker %d: Processing %s\n", workerID, task.FileName)

	sendProgress(task, 10, "队列中取出")

	lock := getFileLock(task.FileID)
	lock.mu.Lock()
	defer lock.mu.Unlock()

	defer func() {
		go func() {
			time.Sleep(10 * time.Minute)
			os.Remove(task.DcmPath)
		}()
	}()

	sendProgress(task, 20, "解析 DICOM")

	tempJpgPath := filepath.Join(tempDir, task.FileID+".jpg.tmp")
	finalJpgPath := filepath.Join(imageDir, task.FileID+".jpg")

	if err := convertDicomToJpeg(task.DcmPath, tempJpgPath, task); err != nil {
		os.Remove(tempJpgPath)
		sendError(task, err.Error())
		return
	}

	sendProgress(task, 90, "保存文件")

	if err := os.Rename(tempJpgPath, finalJpgPath); err != nil {
		os.Remove(tempJpgPath)
		sendError(task, "Failed to finalize image: "+err.Error())
		return
	}

	sendProgress(task, 100, "完成")
	sendCompleted(task, "/images/"+task.FileID+".jpg")

	fmt.Printf("Worker %d: Completed %s\n", workerID, task.FileName)
}

func sendProgress(task *ConversionTask, percent int, stage string) {
	msg := WSMessage{
		Type:    "progress",
		FileID:  task.FileID,
		Percent: percent,
		Stage:   stage,
	}
	hub.sendToClient(task.ClientID, msg)
}

func sendCompleted(task *ConversionTask, url string) {
	msg := WSMessage{
		Type:   "completed",
		FileID: task.FileID,
		URL:    url,
	}
	hub.sendToClient(task.ClientID, msg)
}

func sendError(task *ConversionTask, message string) {
	msg := WSMessage{
		Type:    "error",
		FileID:  task.FileID,
		Message: message,
	}
	hub.sendToClient(task.ClientID, msg)
}

func convertDicomToJpeg(dcmPath, jpgPath string, task *ConversionTask) error {
	file, err := os.Open(dcmPath)
	if err != nil {
		return fmt.Errorf("failed to open DICOM file: %v", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat file: %v", err)
	}

	sendProgress(task, 30, "读取像素数据")

	dataset, err := dicom.Parse(file, fileInfo.Size(), nil)
	if err != nil {
		return fmt.Errorf("failed to parse DICOM: %v", err)
	}

	sendProgress(task, 50, "提取帧数据")

	pixelDataElement, err := dataset.FindElementByTag(tag.PixelData)
	if err != nil {
		return fmt.Errorf("no pixel data found: %v", err)
	}

	pixelDataInfo := dicom.MustGetPixelDataInfo(pixelDataElement.Value)
	if len(pixelDataInfo.Frames) == 0 {
		return fmt.Errorf("no frames found in DICOM")
	}

	sendProgress(task, 70, "编码 JPEG")

	frame := pixelDataInfo.Frames[0]
	img := frame.GetImage()

	outFile, err := os.Create(jpgPath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %v", err)
	}
	defer outFile.Close()

	opts := &jpeg.Options{Quality: 90}
	if err := jpeg.Encode(outFile, img, opts); err != nil {
		os.Remove(jpgPath)
		return fmt.Errorf("failed to encode JPEG: %v", err)
	}

	if err := outFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync file: %v", err)
	}

	return nil
}

func handleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	clientID := generateUniqueID()
	client := &Client{
		ID:   clientID,
		Conn: conn,
		Send: make(chan WSMessage, 256),
	}

	hub.register <- client

	conn.WriteJSON(WSMessage{
		Type: "connected",
	})

	go func() {
		defer func() {
			hub.unregister <- client
			conn.Close()
		}()

		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()

	go func() {
		for message := range client.Send {
			if err := conn.WriteJSON(message); err != nil {
				break
			}
		}
	}()
}

func handleBatchUpload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file received"})
		return
	}

	clientID := c.PostForm("clientId")
	frontendFileID := c.PostForm("frontendFileId")

	fileID := generateUniqueID()
	tempPath := filepath.Join(tempDir, fileID+".dcm.tmp")
	finalDcmPath := filepath.Join(uploadDir, fileID+".dcm")

	if err := c.SaveUploadedFile(file, tempPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to save file: " + err.Error(),
		})
		return
	}

	if err := os.Rename(tempPath, finalDcmPath); err != nil {
		os.Remove(tempPath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to finalize file: " + err.Error(),
		})
		return
	}

	task := ConversionTask{
		FileID:         fileID,
		ClientID:       clientID,
		FrontendFileID: frontendFileID,
		FileName:       file.Filename,
		DcmPath:        finalDcmPath,
		CreatedAt:      time.Now().UnixNano(),
	}

	taskJSON, _ := json.Marshal(task)

	if err := rdb.RPush(ctx, "dicom:queue", taskJSON).Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to queue task: " + err.Error(),
		})
		return
	}

	queueLen, _ := rdb.LLen(ctx, "dicom:queue").Result()

	c.JSON(http.StatusOK, gin.H{
		"fileId":    fileID,
		"success":   true,
		"queueSize": queueLen,
	})
}

func handleUpload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file received"})
		return
	}

	fileID := generateUniqueID()
	tempPath := filepath.Join(tempDir, fileID+".dcm.tmp")
	finalDcmPath := filepath.Join(uploadDir, fileID+".dcm")
	finalJpgPath := filepath.Join(imageDir, fileID+".jpg")

	lock := getFileLock(fileID)
	lock.mu.Lock()
	defer lock.mu.Unlock()

	defer func() {
		os.Remove(tempPath)
	}()

	if err := c.SaveUploadedFile(file, tempPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to save file: " + err.Error(),
		})
		return
	}

	if err := os.Rename(tempPath, finalDcmPath); err != nil {
		os.Remove(tempPath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to finalize file: " + err.Error(),
		})
		return
	}

	defer func() {
		go func() {
			time.Sleep(10 * time.Minute)
			os.Remove(finalDcmPath)
		}()
	}()

	tempJpgPath := filepath.Join(tempDir, fileID+".jpg.tmp")
	if err := convertDicomToJpegSync(finalDcmPath, tempJpgPath); err != nil {
		os.Remove(tempJpgPath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to convert: " + err.Error(),
		})
		return
	}

	if err := os.Rename(tempJpgPath, finalJpgPath); err != nil {
		os.Remove(tempJpgPath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to finalize image: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":     "/images/" + fileID + ".jpg",
		"success": true,
	})
}

func convertDicomToJpegSync(dcmPath, jpgPath string) error {
	file, err := os.Open(dcmPath)
	if err != nil {
		return fmt.Errorf("failed to open DICOM file: %v", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat file: %v", err)
	}

	dataset, err := dicom.Parse(file, fileInfo.Size(), nil)
	if err != nil {
		return fmt.Errorf("failed to parse DICOM: %v", err)
	}

	pixelDataElement, err := dataset.FindElementByTag(tag.PixelData)
	if err != nil {
		return fmt.Errorf("no pixel data found: %v", err)
	}

	pixelDataInfo := dicom.MustGetPixelDataInfo(pixelDataElement.Value)
	if len(pixelDataInfo.Frames) == 0 {
		return fmt.Errorf("no frames found in DICOM")
	}

	frame := pixelDataInfo.Frames[0]
	img := frame.GetImage()

	outFile, err := os.Create(jpgPath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %v", err)
	}
	defer outFile.Close()

	opts := &jpeg.Options{Quality: 90}
	if err := jpeg.Encode(outFile, img, opts); err != nil {
		os.Remove(jpgPath)
		return fmt.Errorf("failed to encode JPEG: %v", err)
	}

	if err := outFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync file: %v", err)
	}

	return nil
}

func main() {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.Static("/images", imageDir)

	r.GET("/ws", handleWebSocket)
	r.POST("/upload", handleUpload)
	r.POST("/upload/batch", handleBatchUpload)

	fmt.Println("DICOM Processing Server")
	fmt.Println("=======================")
	fmt.Printf("HTTP Server: http://localhost:8080\n")
	fmt.Printf("WebSocket: ws://localhost:8080/ws\n")
	fmt.Printf("Worker count: %d\n", workerCount)
	fmt.Println("Redis: localhost:6379")
	fmt.Println("=======================")

	r.Run(":8080")
}

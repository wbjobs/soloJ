package main

import (
	"bytes"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ebpf-http-tracer/internal/ebpf"
	"github.com/ebpf-http-tracer/internal/output"
	"github.com/ebpf-http-tracer/internal/parser"
	"github.com/ebpf-http-tracer/internal/tls"
	"github.com/ebpf-http-tracer/internal/types"
	"github.com/spf13/cobra"
)

var (
	pidFlag       uint32
	alertFlag     string
	jsonFlag      string
	verboseFlag   bool
	keylogFlag    string
	httpsOnlyFlag bool
)

var rootCmd = &cobra.Command{
	Use:   "http-tracer",
	Short: "eBPF-based HTTP/HTTPS request tracer",
	Long: `A command-line tool that uses eBPF technology to trace HTTP and HTTPS request 
lifecycle in kernel space. It monitors tcp_sendmsg/tcp_recvmsg kernel functions 
and SSL_write/SSL_read for HTTPS. Supports decryption via SSLKEYLOGFILE.`,
	RunE: runTracer,
}

func init() {
	rootCmd.Flags().Uint32VarP(&pidFlag, "pid", "p", 0, "Filter by process PID (0 = all processes)")
	rootCmd.Flags().StringVarP(&alertFlag, "alert", "a", "", "Alert threshold for response time (e.g., 500ms, 1s)")
	rootCmd.Flags().StringVarP(&jsonFlag, "json", "j", "", "Export trace data to JSON file")
	rootCmd.Flags().BoolVarP(&verboseFlag, "verbose", "v", false, "Enable verbose output")
	rootCmd.Flags().StringVarP(&keylogFlag, "keylog", "k", "", "Path to SSLKEYLOGFILE for HTTPS decryption")
	rootCmd.Flags().BoolVarP(&httpsOnlyFlag, "https-only", "s", false, "Only show HTTPS requests")
}

func bytesToComm(b [16]byte) string {
	n := bytes.IndexByte(b[:], 0)
	if n == -1 {
		n = 16
	}
	return string(b[:n])
}

func tlsVersionToString(version uint16) string {
	switch version {
	case 0x0301:
		return "TLS 1.0"
	case 0x0302:
		return "TLS 1.1"
	case 0x0303:
		return "TLS 1.2"
	case 0x0304:
		return "TLS 1.3"
	default:
		return fmt.Sprintf("TLS 0x%04x", version)
	}
}

func runTracer(cmd *cobra.Command, args []string) error {
	var alertThreshold time.Duration
	var err error
	if alertFlag != "" {
		alertThreshold, err = time.ParseDuration(alertFlag)
		if err != nil {
			return fmt.Errorf("invalid alert threshold: %w", err)
		}
	}

	var tlsManager *tls.TLSManager
	if keylogFlag != "" {
		tlsManager, err = tls.NewTLSManager(keylogFlag)
		if err != nil {
			return fmt.Errorf("failed to load SSLKEYLOGFILE: %w", err)
		}
		defer tlsManager.Close()
		fmt.Printf("🔐 SSLKEYLOGFILE loaded from: %s\n", keylogFlag)
	}

	tracer, err := ebpf.NewTracer()
	if err != nil {
		return fmt.Errorf("failed to create tracer: %w", err)
	}
	defer tracer.Close()

	fmt.Println("🚀 Starting eBPF HTTP/HTTPS tracer...")
	fmt.Println("📡 Monitoring tcp_sendmsg, tcp_recvmsg, SSL_write, SSL_read")
	if keylogFlag != "" {
		fmt.Println("🔐 HTTPS decryption enabled via SSLKEYLOGFILE")
	}
	if httpsOnlyFlag {
		fmt.Println("🔒 HTTPS-only mode enabled")
	}
	fmt.Println("⏹️  Press Ctrl+C to stop")
	fmt.Println()

	var httpParser *parser.HTTPParser
	if tlsManager != nil {
		httpParser = parser.NewHTTPParserWithTLS(tlsManager)
	} else {
		httpParser = parser.NewHTTPParser()
	}

	tableOutput := output.NewTableOutput(alertThreshold)

	var jsonOutput *output.JSONOutput
	if jsonFlag != "" {
		jsonOutput, err = output.NewJSONOutput(jsonFlag)
		if err != nil {
			return fmt.Errorf("failed to create JSON output: %w", err)
		}
		defer jsonOutput.Close()
		fmt.Printf("💾 Will export data to: %s\n\n", jsonFlag)
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	errCh := make(chan error, 1)
	go func() {
		for {
			event, err := tracer.ReadEvent()
			if err != nil {
				errCh <- err
				return
			}

			if pidFlag > 0 && event.PID != pidFlag {
				continue
			}

			if httpsOnlyFlag && event.IsTLS == 0 {
				continue
			}

			payloadLen := int(event.PayloadLen)
			if payloadLen > types.MaxPayloadSize {
				payloadLen = types.MaxPayloadSize
			}
			payloadSlice := event.Payload[:payloadLen]

			isHTTP := parser.IsHTTP(payloadSlice)
			isTLS := event.IsTLS > 0
			
			if !isHTTP && !isTLS {
				continue
			}

			if verboseFlag {
				comm := bytesToComm(event.Comm)
				segInfo := ""
				if event.IsSegmented > 0 {
					segInfo = fmt.Sprintf(" SEG=%d", event.SegmentCount)
				}
				tlsInfo := ""
				if isTLS {
					tlsInfo = fmt.Sprintf(" TLS=%s", tlsVersionToString(event.TLSVersion))
				}
				typeStr := fmt.Sprintf("%d", event.Type)
				if event.Type == 2 {
					typeStr = "TLS_WRITE"
				} else if event.Type == 3 {
					typeStr = "TLS_READ"
				} else if event.Type == 0 {
					typeStr = "SEND"
				} else if event.Type == 1 {
					typeStr = "RECV"
				}
				fmt.Printf("DEBUG: PID=%d TID=%d COMM=%s Type=%s Len=%d Total=%d%s%s\n",
					event.PID, event.TID, comm, typeStr, event.PayloadLen, event.TotalLen, segInfo, tlsInfo)
			}

			req, ok := httpParser.ParseEvent(event)
			if ok {
				tableOutput.Write(req)
				if jsonOutput != nil {
					jsonOutput.Write(req)
				}
			}
		}
	}()

	select {
	case <-sigCh:
		fmt.Println("\n\n🛑 Stopping tracer...")
		return nil
	case err := <-errCh:
		return fmt.Errorf("trace error: %w", err)
	}
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

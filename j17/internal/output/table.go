package output

import (
	"fmt"
	"os"
	"time"

	"github.com/ebpf-http-tracer/internal/types"
	"github.com/olekukonko/tablewriter"
)

type TableOutput struct {
	table    *tablewriter.Table
	alertDur time.Duration
}

func NewTableOutput(alertThreshold time.Duration) *TableOutput {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{
		"TIME",
		"PROTO",
		"PID",
		"COMM",
		"METHOD",
		"PATH",
		"STATUS",
		"RESP TIME",
		"REQ SIZE",
		"RES SIZE",
		"SEG",
		"SRC",
		"DST",
	})
	table.SetAutoWrapText(false)
	table.SetAutoFormatHeaders(true)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAlignment(tablewriter.ALIGN_LEFT)
	table.SetBorder(false)
	table.SetHeaderLine(true)
	table.SetColumnSeparator("|")
	table.SetCenterSeparator("+")
	table.SetRowSeparator("-")

	return &TableOutput{
		table:    table,
		alertDur: alertThreshold,
	}
}

func (t *TableOutput) Write(req *types.HTTPRequest) {
	statusColor := tablewriter.FG_GREEN
	if req.StatusCode >= 400 && req.StatusCode < 500 {
		statusColor = tablewriter.FG_YELLOW
	} else if req.StatusCode >= 500 {
		statusColor = tablewriter.FG_RED
	}

	respTimeColor := tablewriter.FG_WHITE
	respTimeStr := req.ResponseTime.String()
	if t.alertDur > 0 && req.ResponseTime > t.alertDur {
		respTimeColor = tablewriter.FG_RED
		respTimeStr = fmt.Sprintf("%s ⚠️", respTimeStr)
	}
	
	protoStr := "HTTP"
	protoColor := tablewriter.FG_WHITE
	if req.IsHTTPS {
		protoStr = "HTTPS"
		protoColor = tablewriter.FG_GREEN
	}
	
	segStr := "-"
	if req.IsSegmented {
		if req.SegmentCount > 0 {
			segStr = fmt.Sprintf("%d", req.SegmentCount)
		} else {
			segStr = "✓"
		}
	}

	row := []string{
		req.Timestamp.Format("15:04:05.000"),
		protoStr,
		fmt.Sprintf("%d", req.PID),
		truncateString(req.Comm, 12),
		req.Method,
		truncateString(req.Path, 35),
		fmt.Sprintf("%d", req.StatusCode),
		respTimeStr,
		formatSize(req.RequestSize),
		formatSize(req.ResponseSize),
		segStr,
		fmt.Sprintf("%s:%d", req.SrcIP, req.SrcPort),
		fmt.Sprintf("%s:%d", req.DstIP, req.DstPort),
	}

	colors := []tablewriter.Colors{
		{},
		{protoColor},
		{},
		{},
		{},
		{},
		{statusColor},
		{respTimeColor},
		{},
		{},
		{},
		{},
		{},
	}

	t.table.Rich(row, colors)
	t.table.Render()
	t.table.ClearRows()

	if t.alertDur > 0 && req.ResponseTime > t.alertDur {
		fmt.Printf("\n🚨 ALERT: Response time exceeded threshold! %s > %s\n\n",
			req.ResponseTime, t.alertDur)
	}
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func formatSize(size int) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(size)/float64(div), "KMGTPE"[exp])
}

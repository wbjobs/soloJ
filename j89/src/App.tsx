import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import type {
  NetworkInterface,
  PacketInfo,
  ProtocolType,
  CaptureAvailability,
  ReplaySession,
} from "./types";

type FilterType = "ALL" | ProtocolType;

const ROW_HEIGHT = 33;
const OVERSCAN = 10;

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  packetIds: number[];
}

function ContextMenu({
  menuState,
  onReplay,
  onClose,
}: {
  menuState: ContextMenuState;
  onReplay: (ids: number[]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [onClose]);

  if (!menuState.visible) return null;

  const hasTcp = menuState.packetIds.length > 0;

  return (
    <div
      className="context-menu"
      style={{ left: menuState.x, top: menuState.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`context-menu-item ${!hasTcp ? "disabled" : ""}`}
        onClick={() => {
          if (hasTcp) onReplay(menuState.packetIds);
          onClose();
        }}
      >
        🔄 重放选中的数据包 ({menuState.packetIds.length})
      </div>
      <div className="context-menu-item" onClick={onClose}>
        ✕ 取消
      </div>
    </div>
  );
}

function VirtualizedPacketTable({
  packets,
  selectedPacketId,
  selectedIds,
  onSelectPacket,
  onContextMenu,
}: {
  packets: PacketInfo[];
  selectedPacketId: number | null;
  selectedIds: Set<number>;
  onSelectPacket: (p: PacketInfo, ctrlKey: boolean) => void;
  onContextMenu: (e: React.MouseEvent, packet: PacketInfo) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(container);
    setContainerHeight(container.clientHeight);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const totalHeight = packets.length * ROW_HEIGHT;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    packets.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN
  );

  const visiblePackets = packets.slice(startIndex, endIndex);

  const getProtocolClass = (protocol: ProtocolType) => {
    switch (protocol) {
      case "HTTP":
        return "protocol-http";
      case "DNS":
        return "protocol-dns";
      case "TCP":
        return "protocol-tcp";
      default:
        return "protocol-other";
    }
  };

  const renderFlags = (flags?: string) => {
    if (!flags) return null;
    const flagChars = ["SYN", "ACK", "FIN", "RST", "PSH", "URG"];
    return (
      <span className="flags-display">
        {flagChars.map((flag) => (
          <span
            key={flag}
            className={`flag ${flags.includes(flag) ? "set" : ""}`}
            title={flag}
          >
            {flag[0]}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div
      ref={containerRef}
      className="virtual-scroll-container"
      onScroll={handleScroll}
    >
      <div className="virtual-scroll-header">
        <table className="packet-table">
          <thead>
            <tr>
              <th className="col-check">✓</th>
              <th className="col-id">编号</th>
              <th className="col-time">时间</th>
              <th className="col-protocol">协议</th>
              <th className="col-addr">源地址</th>
              <th className="col-addr">目的地址</th>
              <th className="col-len">长度</th>
              <th className="col-flags">标志</th>
              <th className="col-info">信息</th>
            </tr>
          </thead>
        </table>
      </div>
      <div className="virtual-scroll-body" style={{ height: totalHeight }}>
        <table className="packet-table">
          <tbody
            style={{
              transform: `translateY(${startIndex * ROW_HEIGHT}px)`,
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
            }}
          >
            {visiblePackets.map((packet) => {
              const isSelected = selectedIds.has(packet.id);
              const isActive = selectedPacketId === packet.id;
              return (
                <tr
                  key={packet.id}
                  className={`${isActive ? "selected" : ""} ${isSelected ? "multi-selected" : ""}`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={(e) => onSelectPacket(packet, e.ctrlKey || e.metaKey)}
                  onContextMenu={(e) => onContextMenu(e, packet)}
                >
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectPacket(packet, true)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="col-id">{packet.id}</td>
                  <td className="col-time">{packet.timestamp}</td>
                  <td className="col-protocol">
                    <span
                      className={`protocol-badge ${getProtocolClass(packet.protocol)}`}
                    >
                      {packet.protocol}
                    </span>
                  </td>
                  <td className="col-addr">
                    {packet.sourceIp}:{packet.sourcePort}
                  </td>
                  <td className="col-addr">
                    {packet.destIp}:{packet.destPort}
                  </td>
                  <td className="col-len">{packet.length}</td>
                  <td className="col-flags">{renderFlags(packet.flags)}</td>
                  <td className="col-info info-cell">{packet.info}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReplayPanel({
  session,
  onClose,
}: {
  session: ReplaySession | null;
  onClose: () => void;
}) {
  if (!session) return null;

  const successCount = session.results.filter((r) => r.success).length;
  const failCount = session.results.filter((r) => !r.success).length;

  return (
    <div className="replay-panel">
      <div className="replay-panel-header">
        <div className="replay-panel-title">
          🔄 回放结果 — {session.id}
          <span className="replay-stats">
            总计: {session.total_packets} | 成功:{" "}
            <span className="replay-success-count">{successCount}</span> | 失败:{" "}
            <span className="replay-fail-count">{failCount}</span>
          </span>
        </div>
        <button className="btn replay-close-btn" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="replay-results">
        <table className="replay-table">
          <thead>
            <tr>
              <th>数据包ID</th>
              <th>目标地址</th>
              <th>状态</th>
              <th>耗时</th>
              <th>响应摘要</th>
              <th>错误</th>
            </tr>
          </thead>
          <tbody>
            {session.results.map((result) => (
              <tr key={result.packet_id}>
                <td>#{result.packet_id}</td>
                <td>
                  {result.dest_ip}:{result.dest_port}
                </td>
                <td>
                  <span
                    className={`replay-status ${result.success ? "replay-ok" : "replay-fail"}`}
                  >
                    {result.success ? "成功" : "失败"}
                  </span>
                </td>
                <td>{result.response_time_ms}ms</td>
                <td className="info-cell">{result.response_summary || "—"}</td>
                <td className="info-cell replay-error">
                  {result.error || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function App() {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [packets, setPackets] = useState<PacketInfo[]>([]);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [selectedPacket, setSelectedPacket] = useState<PacketInfo | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<CaptureAvailability | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    packetIds: [],
  });
  const [replaySession, setReplaySession] = useState<ReplaySession | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);

  useEffect(() => {
    checkAvailability();
    setupEventListeners();
  }, []);

  const checkAvailability = async () => {
    try {
      await invoke("check_capture_available");
      setAvailability({ available: true });
      loadInterfaces();
    } catch (e) {
      setAvailability({ available: false, reason: String(e) });
    }
  };

  const loadInterfaces = async () => {
    try {
      const result = await invoke<NetworkInterface[]>("get_interfaces");
      setInterfaces(result);
      if (result.length > 0 && !selectedInterface) {
        setSelectedInterface(result[0].name);
      }
    } catch (e) {
      setError(`获取网卡列表失败: ${e}`);
    }
  };

  const setupEventListeners = async () => {
    await listen<PacketInfo>("packet-received", (event) => {
      setPackets((prev) => [...prev, event.payload]);
    });

    await listen<string>("capture-error", (event) => {
      setError(`捕获错误: ${event.payload}`);
      setIsCapturing(false);
    });

    await listen("capture-stopped", () => {
      setIsCapturing(false);
    });

    await listen<number>("replay-started", () => {
      setIsReplaying(true);
      setError(null);
    });

    await listen<ReplaySession>("replay-completed", (event) => {
      setReplaySession(event.payload);
      setIsReplaying(false);
    });
  };

  const startCapture = useCallback(async () => {
    if (!selectedInterface) return;
    try {
      setError(null);
      setPackets([]);
      setSelectedPacket(null);
      setSelectedIds(new Set());
      await invoke("start_capture", { interfaceName: selectedInterface });
      setIsCapturing(true);
    } catch (e) {
      setError(`启动抓包失败: ${e}`);
      setIsCapturing(false);
    }
  }, [selectedInterface]);

  const stopCapture = useCallback(async () => {
    try {
      await invoke("stop_capture");
      setIsCapturing(false);
    } catch (e) {
      setError(`停止抓包失败: ${e}`);
    }
  }, []);

  const handleSelectPacket = useCallback(
    (packet: PacketInfo, multiSelect: boolean) => {
      if (multiSelect) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(packet.id)) {
            next.delete(packet.id);
          } else {
            next.add(packet.id);
          }
          return next;
        });
      } else {
        setSelectedIds(new Set([packet.id]));
      }
      setSelectedPacket(packet);
    },
    []
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, packet: PacketInfo) => {
      e.preventDefault();
      let ids: number[];
      if (selectedIds.has(packet.id)) {
        ids = Array.from(selectedIds);
      } else {
        ids = [packet.id];
        setSelectedIds(new Set([packet.id]));
      }
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        packetIds: ids,
      });
    },
    [selectedIds]
  );

  const handleReplay = useCallback(
    async (ids: number[]) => {
      try {
        setError(null);
        setReplaySession(null);
        await invoke("replay_packets", { packetIds: ids });
      } catch (e) {
        setError(`重放失败: ${e}`);
        setIsReplaying(false);
      }
    },
    []
  );

  const filteredPackets = useMemo(
    () =>
      filter === "ALL"
        ? packets
        : packets.filter((p) => p.protocol === filter),
    [packets, filter]
  );

  const renderFlags = (flags?: string) => {
    if (!flags) return null;
    const flagChars = ["SYN", "ACK", "FIN", "RST", "PSH", "URG"];
    return (
      <span className="flags-display">
        {flagChars.map((flag) => (
          <span
            key={flag}
            className={`flag ${flags.includes(flag) ? "set" : ""}`}
            title={flag}
          >
            {flag[0]}
          </span>
        ))}
      </span>
    );
  };

  const renderPermissionBanner = () => {
    if (!availability || availability.available) return null;
    return (
      <div className="permission-banner">
        <div className="permission-banner-icon">⚠️</div>
        <div className="permission-banner-content">
          <div className="permission-banner-title">无法启动网络捕获</div>
          <div className="permission-banner-text">{availability.reason}</div>
        </div>
        <button
          className="btn permission-retry-btn"
          onClick={checkAvailability}
        >
          重新检测
        </button>
      </div>
    );
  };

  const isDisabled = !availability?.available;

  return (
    <div className="app">
      <div className="toolbar">
        <select
          className="interface-select"
          value={selectedInterface || ""}
          onChange={(e) => setSelectedInterface(e.target.value)}
          disabled={isCapturing || isDisabled}
        >
          {interfaces.map((iface) => (
            <option key={iface.name} value={iface.name}>
              {iface.description || iface.name}
              {iface.addresses.length > 0 ? ` (${iface.addresses[0]})` : ""}
            </option>
          ))}
        </select>

        {!isCapturing ? (
          <button
            className="btn btn-start"
            onClick={startCapture}
            disabled={!selectedInterface || isDisabled}
          >
            开始捕获
          </button>
        ) : (
          <button className="btn btn-stop" onClick={stopCapture}>
            停止捕获
          </button>
        )}

        <div className="filter-container">
          <label className="filter-label">协议过滤:</label>
          <select
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
          >
            <option value="ALL">全部</option>
            <option value="HTTP">HTTP</option>
            <option value="DNS">DNS</option>
            <option value="TCP">TCP</option>
            <option value="OTHER">其他</option>
          </select>
        </div>

        {selectedIds.size > 0 && (
          <button
            className="btn btn-replay"
            onClick={() => handleReplay(Array.from(selectedIds))}
            disabled={isReplaying}
          >
            {isReplaying ? "重放中..." : `🔄 重放 (${selectedIds.size})`}
          </button>
        )}
      </div>

      {renderPermissionBanner()}

      <div className="status-bar">
        <span className="status-indicator">
          <span
            className={`status-dot ${isCapturing ? "active" : "inactive"}`}
          />
          {isCapturing ? "正在捕获..." : "已停止"}
          {isReplaying && (
            <span className="replay-indicator"> | 🔄 正在重放...</span>
          )}
        </span>
        <span style={{ marginLeft: "16px" }}>
          数据包: {filteredPackets.length} / {packets.length}
        </span>
        {selectedIds.size > 0 && (
          <span style={{ marginLeft: "16px", color: "#89b4fa" }}>
            已选: {selectedIds.size}
          </span>
        )}
        {error && (
          <span style={{ marginLeft: "16px", color: "#f38ba8" }}>{error}</span>
        )}
      </div>

      <div className="packet-table-container">
        {packets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div>
              {isDisabled
                ? "请解决上方权限问题后开始抓包"
                : "选择网卡并点击「开始捕获」开始抓包"}
            </div>
          </div>
        ) : (
          <VirtualizedPacketTable
            packets={filteredPackets}
            selectedPacketId={selectedPacket?.id ?? null}
            selectedIds={selectedIds}
            onSelectPacket={handleSelectPacket}
            onContextMenu={handleContextMenu}
          />
        )}
      </div>

      <ReplayPanel
        session={replaySession}
        onClose={() => setReplaySession(null)}
      />

      {selectedPacket && !replaySession && (
        <div className="selected-packet-details">
          <div className="detail-section">
            <div className="detail-title">基本信息</div>
            <div className="detail-row">
              <span className="detail-label">时间:</span>
              <span className="detail-value">{selectedPacket.timestamp}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">协议:</span>
              <span className="detail-value">{selectedPacket.protocol}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">长度:</span>
              <span className="detail-value">{selectedPacket.length} 字节</span>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-title">网络层</div>
            <div className="detail-row">
              <span className="detail-label">源地址:</span>
              <span className="detail-value">{selectedPacket.sourceIp}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">目的地址:</span>
              <span className="detail-value">{selectedPacket.destIp}</span>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-title">传输层</div>
            <div className="detail-row">
              <span className="detail-label">源端口:</span>
              <span className="detail-value">{selectedPacket.sourcePort}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">目的端口:</span>
              <span className="detail-value">{selectedPacket.destPort}</span>
            </div>
            {selectedPacket.flags && (
              <div className="detail-row">
                <span className="detail-label">TCP标志:</span>
                <span className="detail-value">
                  {renderFlags(selectedPacket.flags)}
                </span>
              </div>
            )}
          </div>

          {selectedPacket.protocol === "HTTP" && (
            <div className="detail-section">
              <div className="detail-title">HTTP</div>
              {selectedPacket.httpMethod && (
                <div className="detail-row">
                  <span className="detail-label">方法:</span>
                  <span className="detail-value">
                    {selectedPacket.httpMethod}
                  </span>
                </div>
              )}
              {selectedPacket.httpPath && (
                <div className="detail-row">
                  <span className="detail-label">路径:</span>
                  <span className="detail-value">
                    {selectedPacket.httpPath}
                  </span>
                </div>
              )}
            </div>
          )}

          {selectedPacket.protocol === "DNS" && (
            <div className="detail-section">
              <div className="detail-title">DNS</div>
              {selectedPacket.dnsQuery && (
                <div className="detail-row">
                  <span className="detail-label">查询:</span>
                  <span className="detail-value">
                    {selectedPacket.dnsQuery}
                  </span>
                </div>
              )}
              {selectedPacket.dnsType && (
                <div className="detail-row">
                  <span className="detail-label">类型:</span>
                  <span className="detail-value">
                    {selectedPacket.dnsType}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ContextMenu
        menuState={contextMenu}
        onReplay={handleReplay}
        onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
      />
    </div>
  );
}

export default App;

export interface NetworkInterface {
  name: string;
  description: string;
  addresses: string[];
}

export type ProtocolType = "HTTP" | "DNS" | "TCP" | "OTHER";

export interface PacketInfo {
  id: number;
  timestamp: string;
  protocol: ProtocolType;
  sourceIp: string;
  sourcePort: number;
  destIp: string;
  destPort: number;
  length: number;
  info: string;
  flags?: string;
  httpMethod?: string;
  httpPath?: string;
  dnsQuery?: string;
  dnsType?: string;
}

export interface CaptureStatus {
  isCapturing: boolean;
  selectedInterface: string | null;
  packetCount: number;
}

export type CaptureAvailability =
  | { available: true }
  | { available: false; reason: string };

export interface ReplayResult {
  packet_id: number;
  dest_ip: string;
  dest_port: number;
  success: boolean;
  response_summary: string;
  response_time_ms: number;
  error: string | null;
}

export type ReplayStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface ReplaySession {
  id: string;
  total_packets: number;
  results: ReplayResult[];
  status: ReplayStatus;
}

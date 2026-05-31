import type { ServiceStatus, ServiceType } from '../../shared/types';

/**
 * 将纳秒转换为可读格式
 * @param ns - 纳秒数
 * @returns 格式化的时间字符串 (ms, μs, ns)
 */
export function formatDuration(ns: number): string {
  if (ns >= 1_000_000) {
    return `${(ns / 1_000_000).toFixed(2)} ms`;
  }
  if (ns >= 1_000) {
    return `${(ns / 1_000).toFixed(2)} μs`;
  }
  return `${ns} ns`;
}

/**
 * 格式化 ISO 时间字符串
 * @param isoString - ISO 格式的时间字符串
 * @returns 格式化的时间字符串
 */
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 获取服务状态对应的颜色
 * @param status - 服务状态
 * @returns Tailwind 颜色类名
 */
export function getStatusColor(status: ServiceStatus): string {
  const colors: Record<ServiceStatus, string> = {
    healthy: 'text-emerald-500',
    warning: 'text-amber-500',
    error: 'text-red-500',
  };
  return colors[status];
}

/**
 * 获取服务类型对应的图标名
 * @param type - 服务类型
 * @returns Lucide 图标名称
 */
export function getServiceTypeIcon(type: ServiceType): string {
  const icons: Record<ServiceType, string> = {
    http: 'Globe',
    grpc: 'Radio',
    database: 'Database',
    cache: 'HardDrive',
    'message-queue': 'MessageSquare',
    gateway: 'Server',
    other: 'Box',
  };
  return icons[type];
}

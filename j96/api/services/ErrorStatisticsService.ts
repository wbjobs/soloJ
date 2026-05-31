import type { ErrorLog } from '../../shared/types.ts';

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

/**
 * 格式化时间为 ISO 字符串，去除毫秒部分
 */
function formatTimeKey(date: Date): string {
  return date.toISOString().slice(0, 16) + ':00.000Z';
}

/**
 * 错误统计服务
 *
 * 提供错误日志的统计分析功能，包括按错误类型分组、
 * 时间趋势分析等。
 */
export const ErrorStatisticsService = {
  /**
   * 按错误类型分组统计
   *
   * 将错误日志按 errorType 字段分组，统计每种错误类型的出现次数，
   * 结果按出现次数降序排列。
   *
   * @param errors - 错误日志数组
   * @returns 按错误类型分组的统计结果
   *
   * @example
   * ```ts
   * const byType = ErrorStatisticsService.groupErrorsByType(errors);
   * console.log(byType['NullPointerException']);
   * ```
   */
  groupErrorsByType(errors: ErrorLog[]): Record<string, number> {
    const result: Record<string, number> = {};

    for (const error of errors) {
      const type = error.errorType;
      if (!result[type]) {
        result[type] = 0;
      }
      result[type]++;
    }

    const sorted = Object.entries(result)
      .sort(([, a], [, b]) => b - a)
      .reduce<Record<string, number>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    return sorted;
  },

  /**
   * 获取错误时间趋势
   *
   * 按小时统计指定时间范围内的错误数量，生成时间序列数据。
   * 时间范围从最新错误时间向前推算 hours 小时，每个时间点为整点。
   *
   * @param errors - 错误日志数组
   * @param hours - 统计的小时数
   * @returns 时间趋势数据数组，每个元素包含时间和错误计数
   *
   * @example
   * ```ts
   * const trend = ErrorStatisticsService.getErrorTrend(errors, 24);
   * // 返回 [{ time: '2024-01-01T00:00:00.000Z', count: 5 }, ...]
   * ```
   */
  getErrorTrend(errors: ErrorLog[], hours: number): { time: string; count: number }[] {
    if (errors.length === 0) {
      const now = new Date();
      const result: { time: string; count: number }[] = [];
      for (let i = hours - 1; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * MILLISECONDS_PER_HOUR);
        hour.setMinutes(0, 0, 0);
        result.push({ time: formatTimeKey(hour), count: 0 });
      }
      return result;
    }

    const maxTime = Math.max(...errors.map((e) => new Date(e.timestamp).getTime()));
    const endTime = new Date(maxTime);
    endTime.setMinutes(0, 0, 0);

    const startTime = new Date(endTime.getTime() - (hours - 1) * MILLISECONDS_PER_HOUR);

    const timeBuckets: Record<string, number> = {};
    let current = new Date(startTime);
    while (current <= endTime) {
      timeBuckets[formatTimeKey(current)] = 0;
      current = new Date(current.getTime() + MILLISECONDS_PER_HOUR);
    }

    for (const error of errors) {
      const errorTime = new Date(error.timestamp);
      const bucketTime = new Date(errorTime);
      bucketTime.setMinutes(0, 0, 0);
      const key = formatTimeKey(bucketTime);
      if (key in timeBuckets) {
        timeBuckets[key]++;
      }
    }

    return Object.entries(timeBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, count]) => ({ time, count }));
  },

  /**
   * 按服务分组统计错误
   *
   * 将错误日志按服务名分组，统计每个服务的错误数量和错误类型分布。
   *
   * @param errors - 错误日志数组
   * @returns 按服务名分组的统计结果
   *
   * @example
   * ```ts
   * const byService = ErrorStatisticsService.groupErrorsByService(errors);
   * ```
   */
  groupErrorsByService(errors: ErrorLog[]): Record<string, {
    count: number;
    errorTypes: Record<string, number>;
  }> {
    const result: Record<string, {
      count: number;
      errorTypes: Record<string, number>;
    }> = {};

    for (const error of errors) {
      const serviceName = error.serviceName;
      if (!result[serviceName]) {
        result[serviceName] = { count: 0, errorTypes: {} };
      }
      result[serviceName].count++;
      const type = error.errorType;
      if (!result[serviceName].errorTypes[type]) {
        result[serviceName].errorTypes[type] = 0;
      }
      result[serviceName].errorTypes[type]++;
    }

    return result;
  },
};

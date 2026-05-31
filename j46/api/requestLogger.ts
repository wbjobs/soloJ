export interface RequestLog {
  id: string;
  timestamp: Date;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
  query: Record<string, any>;
  matchedKeywords: string[];
  dangerLevel: 'low' | 'medium' | 'high' | 'critical';
  dangerScore: number;
}

const DANGER_KEYWORDS: { keyword: string; score: number; type: string }[] = [
  { keyword: 'UNION', score: 30, type: '注入' },
  { keyword: 'SELECT', score: 25, type: '注入' },
  { keyword: '--', score: 20, type: '注释' },
  { keyword: "'", score: 15, type: '引号' },
  { keyword: '"', score: 15, type: '引号' },
  { keyword: 'OR ', score: 25, type: '布尔' },
  { keyword: 'AND ', score: 25, type: '布尔' },
  { keyword: '1=1', score: 20, type: '恒真' },
  { keyword: '1=2', score: 20, type: '恒假' },
  { keyword: 'SLEEP', score: 35, type: '时间盲注' },
  { keyword: 'BENCHMARK', score: 35, type: '时间盲注' },
  { keyword: 'INSERT', score: 30, type: '写入' },
  { keyword: 'UPDATE', score: 30, type: '修改' },
  { keyword: 'DELETE', score: 30, type: '删除' },
  { keyword: 'DROP', score: 40, type: '破坏' },
  { keyword: 'TABLE', score: 20, type: '元数据' },
  { keyword: 'DATABASE', score: 25, type: '元数据' },
  { keyword: 'INFORMATION_SCHEMA', score: 35, type: '元数据' },
  { keyword: 'SCHEMA', score: 25, type: '元数据' },
  { keyword: 'ASCII', score: 20, type: '盲注' },
  { keyword: 'SUBSTRING', score: 20, type: '盲注' },
  { keyword: 'CHAR', score: 15, type: '编码' },
  { keyword: 'CONCAT', score: 15, type: '拼接' },
  { keyword: 'EXEC', score: 40, type: '执行' },
  { keyword: 'CMD', score: 35, type: '命令' },
];

class RequestLogger {
  private logs: RequestLog[] = [];
  private maxLogs = 100;

  addLog(log: Omit<RequestLog, 'id' | 'timestamp'>): RequestLog {
    const newLog: RequestLog = {
      ...log,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    this.logs.unshift(newLog);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return newLog;
  }

  getLogs(): RequestLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  analyzePayload(payload: string): { matchedKeywords: string[]; dangerLevel: RequestLog['dangerLevel']; dangerScore: number } {
    const matchedKeywords: string[] = [];
    let dangerScore = 0;

    const payloadUpper = payload.toUpperCase();

    for (const { keyword, score, type } of DANGER_KEYWORDS) {
      if (payloadUpper.includes(keyword.toUpperCase())) {
        matchedKeywords.push(`${keyword} (${type})`);
        dangerScore += score;
      }
    }

    let dangerLevel: RequestLog['dangerLevel'] = 'low';
    if (dangerScore >= 100) dangerLevel = 'critical';
    else if (dangerScore >= 60) dangerLevel = 'high';
    else if (dangerScore >= 30) dangerLevel = 'medium';

    return { matchedKeywords, dangerLevel, dangerScore };
  }

  getDangerKeywords() {
    return DANGER_KEYWORDS;
  }
}

export const requestLogger = new RequestLogger();

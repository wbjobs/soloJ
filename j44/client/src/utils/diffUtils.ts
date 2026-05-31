import * as Diff from 'diff';

export interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'added' | 'removed' | 'unchanged';
  originalLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
}

export function computeDiff(originalText: string, modifiedText: string): DiffResult {
  const patch = Diff.diffLines(originalText, modifiedText);
  
  const lines: DiffLine[] = [];
  let originalLineNum = 1;
  let modifiedLineNum = 1;
  let addedCount = 0;
  let removedCount = 0;

  patch.forEach((part) => {
    const partLines = part.value.split('\n');
    if (partLines[partLines.length - 1] === '') {
      partLines.pop();
    }

    partLines.forEach((line) => {
      if (part.added) {
        lines.push({
          lineNumber: modifiedLineNum,
          content: line,
          type: 'added',
          newLineNumber: modifiedLineNum
        });
        modifiedLineNum++;
        addedCount++;
      } else if (part.removed) {
        lines.push({
          lineNumber: originalLineNum,
          content: line,
          type: 'removed',
          originalLineNumber: originalLineNum
        });
        originalLineNum++;
        removedCount++;
      } else {
        lines.push({
          lineNumber: modifiedLineNum,
          content: line,
          type: 'unchanged',
          originalLineNumber: originalLineNum,
          newLineNumber: modifiedLineNum
        });
        originalLineNum++;
        modifiedLineNum++;
      }
    });
  });

  return { lines, addedCount, removedCount };
}

export function computeInlineDiff(originalText: string, modifiedText: string): Array<{
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}> {
  const changes = Diff.diffChars(originalText, modifiedText);
  return changes.map(change => ({
    type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
    content: change.value
  }));
}

export function formatTimestamp(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return d.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

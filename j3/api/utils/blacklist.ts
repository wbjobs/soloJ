const BLACKLIST_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+(\/|~|\*)/i,
  /\bsudo\b/i,
  /\b(shutdown|reboot|halt|poweroff)\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /:\(\)\{:\|:\&};\s*:/,
  />\s*\/dev\/(sd|hd|vd)[a-z]/i,
  /\b(wget|curl)\s+.*\|\s*(bash|sh|zsh)\b/i,
  /\bchmod\s+777\b/i,
  /\bchown\s+-R\b/i,
  /\b(rm|del)\s+.*system32/i,
  /\bformat\s+[a-z]:/i,
  /\bdd\s+of=\/dev\//i,
  /\b(fork|exec)\s*\(/i,
];

export function isBlacklisted(command: string): boolean {
  return BLACKLIST_PATTERNS.some((pattern) => pattern.test(command));
}

export function validateCommand(command: string): { valid: boolean; message?: string } {
  if (!command || command.trim().length === 0) {
    return { valid: false, message: '命令不能为空' };
  }

  if (command.length > 1024) {
    return { valid: false, message: '命令长度不能超过1024字符' };
  }

  if (isBlacklisted(command)) {
    return { valid: false, message: '命令包含危险操作，已被禁止执行' };
  }

  return { valid: true };
}

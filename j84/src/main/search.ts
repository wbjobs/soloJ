export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function fuzzyMatch(query: string, target: string): { matched: boolean; score: number } {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();

  if (q === '') return { matched: true, score: 1 };

  if (t === q) return { matched: true, score: 100 };

  if (t.startsWith(q)) return { matched: true, score: 80 + (1 - q.length / t.length) * 20 };

  if (t.includes(q)) {
    const index = t.indexOf(q);
    const proximityBonus = Math.max(0, 1 - index / t.length) * 30;
    return { matched: true, score: 50 + proximityBonus };
  }

  const queryWords = q.split(/\s+/).filter((w) => w.length > 0);
  const targetWords = t.split(/\s+/).filter((w) => w.length > 0);
  let wordMatchScore = 0;
  let matchedWords = 0;

  for (const qw of queryWords) {
    for (const tw of targetWords) {
      if (tw === qw) {
        wordMatchScore += 25;
        matchedWords++;
        break;
      }
      if (tw.startsWith(qw)) {
        wordMatchScore += 15;
        matchedWords++;
        break;
      }
      if (tw.includes(qw)) {
        wordMatchScore += 10;
        matchedWords++;
        break;
      }
      const maxDistance = Math.max(1, Math.floor(Math.min(qw.length, tw.length) / 3));
      const dist = levenshteinDistance(qw, tw);
      if (dist <= maxDistance && qw.length >= 3) {
        wordMatchScore += 8 * (1 - dist / maxDistance);
        matchedWords++;
        break;
      }
    }
  }

  if (matchedWords === queryWords.length && queryWords.length > 0) {
    return { matched: true, score: Math.min(60, wordMatchScore) };
  }

  const wholeMaxDistance = Math.max(1, Math.floor(Math.min(q.length, t.length) / 4));
  const wholeDist = levenshteinDistance(q, t);
  if (wholeDist <= wholeMaxDistance && q.length >= 4) {
    return { matched: true, score: 30 * (1 - wholeDist / wholeMaxDistance) };
  }

  return { matched: wordMatchScore > 0, score: wordMatchScore };
}

export function extractSnippet(content: string, query: string, maxLength: number = 120): string {
  const q = query.toLowerCase().trim();
  const lowerContent = content.toLowerCase();

  if (q === '') {
    return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  let bestIndex = -1;
  let bestMatchLength = 0;

  const queryWords = q.split(/\s+/).filter((w) => w.length > 0);
  for (const word of queryWords) {
    let index = lowerContent.indexOf(word);
    while (index !== -1) {
      if (word.length > bestMatchLength) {
        bestIndex = index;
        bestMatchLength = word.length;
      }
      index = lowerContent.indexOf(word, index + 1);
    }
  }

  if (bestIndex === -1) {
    bestIndex = 0;
  }

  const start = Math.max(0, bestIndex - Math.floor(maxLength / 3));
  const end = Math.min(content.length, start + maxLength);
  const snippet = content.slice(start, end);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return prefix + snippet + suffix;
}

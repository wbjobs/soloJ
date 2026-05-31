import React, { useMemo } from 'react';

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const HighlightText: React.FC<HighlightTextProps> = ({ text, query, className }) => {
  const parts = useMemo(() => {
    if (!query.trim()) {
      return [{ text, highlighted: false }];
    }

    const trimmedQuery = query.trim();
    const words = trimmedQuery.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      return [{ text, highlighted: false }];
    }

    const pattern = words.map(escapeRegExp).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    const result: { text: string; highlighted: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          text: text.slice(lastIndex, match.index),
          highlighted: false,
        });
      }
      result.push({
        text: match[0],
        highlighted: true,
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      result.push({
        text: text.slice(lastIndex),
        highlighted: false,
      });
    }

    if (result.length === 0) {
      result.push({ text, highlighted: false });
    }

    return result;
  }, [text, query]);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.highlighted ? (
          <mark key={index} className="highlight-match">
            {part.text}
          </mark>
        ) : (
          part.text
        )
      )}
    </span>
  );
};

export default HighlightText;

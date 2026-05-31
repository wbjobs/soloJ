import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BIDIRECTIONAL_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

export interface ParsedNote {
  title: string;
  content: string;
  rawContent: string;
  linkTargets: string[];
  frontmatter: Record<string, any>;
}

export function parseMarkdownFile(filePath: string): ParsedNote {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content } = matter(raw);

  const linkTargets: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(BIDIRECTIONAL_LINK_REGEX.source, BIDIRECTIONAL_LINK_REGEX.flags);

  while ((match = regex.exec(content)) !== null) {
    linkTargets.push(match[1].trim());
  }

  const title = frontmatter.title || path.basename(filePath, path.extname(filePath));

  return {
    title,
    content,
    rawContent: raw,
    linkTargets,
    frontmatter,
  };
}

export function resolveNotePath(vaultPath: string, linkTarget: string): string | null {
  const mdPath = path.join(vaultPath, `${linkTarget}.md`);
  if (fs.existsSync(mdPath)) return mdPath;

  const directPath = path.join(vaultPath, linkTarget);
  if (fs.existsSync(directPath)) return directPath;

  return null;
}

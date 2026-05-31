export function parseMarkdownToMindMap(markdown) {
  const lines = markdown.split("\n");
  const root = { id: "root", text: "MindMap", children: [], _isRoot: true, _lineNumber: -1 };
  const stack = [{ node: root, indent: -1 }];
  const nodeToLineMap = new Map();
  const lineToNodeMap = new Map();

  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
    if (!listMatch) continue;

    const indent = listMatch[1].length;
    const prefix = listMatch[2] + " ";
    let text = listMatch[3].trim();

    const rawText = listMatch[3];

    text = text.replace(/\*\*(.*?)\*\*/g, "$1");
    text = text.replace(/\*(.*?)\*/g, "$1");
    text = text.replace(/`(.*?)`/g, "$1");
    text = text.replace(/\[(.*?)\]\(.*?\)/g, "$1");
    text = text.replace(/~~(.*?)~~/g, "$1");

    const node = {
      id: `n-${i}`,
      text,
      children: [],
      _lineNumber: i,
      _indent: indent,
      _prefix: prefix,
      _rawText: rawText,
      _isRoot: false,
    };

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].node;
    node._parentId = parent.id;
    node._siblingIndex = parent.children.length;
    parent.children.push(node);
    stack.push({ node, indent });

    nodeToLineMap.set(node.id, { line: i, node, parent });
    lineToNodeMap.set(i, node);
  }

  let resultRoot = root;
  if (root.children.length === 1) {
    resultRoot = root.children[0];
    resultRoot._isRoot = true;
    resultRoot._parentId = null;
  }

  if (root.children.length === 0) {
    const headingMatch = markdown.match(/^#+\s+(.+)$/m);
    if (headingMatch) {
      root.text = headingMatch[1].replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
    }
  }

  resultRoot._nodeToLineMap = nodeToLineMap;
  resultRoot._lineToNodeMap = lineToNodeMap;
  resultRoot._rawLines = lines;

  return resultRoot;
}

export function findNodeById(root, id) {
  if (root.id === id) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function findParentNode(root, childId) {
  if (!root.children) return null;
  for (const child of root.children) {
    if (child.id === childId) return root;
    const found = findParentNode(child, childId);
    if (found) return found;
  }
  return null;
}

export function getAllNodes(root) {
  const nodes = [];
  function traverse(node) {
    nodes.push(node);
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  traverse(root);
  return nodes;
}

export function getSubtreeWidth(node) {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + getSubtreeWidth(child), 0);
}

export function getNodeDepth(root, nodeId) {
  let depth = 0;
  let currentId = nodeId;
  while (currentId && currentId !== root.id) {
    const parent = findParentNode(root, currentId);
    if (!parent) break;
    depth++;
    currentId = parent.id;
  }
  return depth;
}

export function mindMapToMarkdown(root, baseIndent = 0) {
  const lines = [];

  function traverse(node, indentLevel) {
    if (!node._isRoot) {
      const indent = "  ".repeat(indentLevel + baseIndent);
      const prefix = node._prefix || "- ";
      const rawText = node._rawText !== undefined ? node._rawText : node.text;
      lines.push(`${indent}${prefix}${rawText}`);
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child, indentLevel + (node._isRoot ? 0 : 1));
      }
    }
  }

  traverse(root, 0);
  return lines.join("\n");
}

export function updateMarkdownFromNodeMove(markdown, movedNodeId, newParentId, insertIndex = -1) {
  const lines = markdown.split("\n");
  const root = parseMarkdownToMindMap(markdown);

  const movedNode = findNodeById(root, movedNodeId);
  if (!movedNode || movedNode._isRoot) {
    return { markdown, cursorOffset: null, success: false, reason: "Invalid node" };
  }

  const oldParent = findParentNode(root, movedNodeId);
  if (!oldParent) {
    return { markdown, cursorOffset: null, success: false, reason: "Old parent not found" };
  }

  if (newParentId === movedNodeId) {
    return { markdown, cursorOffset: null, success: false, reason: "Cannot be parent of self" };
  }

  let currentCheck = newParentId;
  while (currentCheck && currentCheck !== root.id) {
    if (currentCheck === movedNodeId) {
      return { markdown, cursorOffset: null, success: false, reason: "Cannot create circular reference" };
    }
    currentCheck = findParentNode(root, currentCheck)?.id;
  }

  const oldSiblingIndex = oldParent.children.findIndex(c => c.id === movedNodeId);
  oldParent.children.splice(oldSiblingIndex, 1);

  let newParent = root;
  if (newParentId !== root.id) {
    newParent = findNodeById(root, newParentId);
  }
  if (!newParent) {
    return { markdown, cursorOffset: null, success: false, reason: "New parent not found" };
  }

  if (!newParent.children) newParent.children = [];
  const actualInsertIndex = insertIndex < 0 || insertIndex > newParent.children.length
    ? newParent.children.length
    : insertIndex;

  const oldDepth = getNodeDepth(root, movedNodeId);
  movedNode._parentId = newParentId;
  newParent.children.splice(actualInsertIndex, 0, movedNode);

  const nonListLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isListLine = /^(\s*)([-*+]|\d+\.)\s+/.test(line) && !isInCodeBlock(lines, i);
    if (!isListLine && line.trim() !== "") {
      nonListLines.push({ line: i, text: line });
    }
  }

  const listContent = mindMapToMarkdown(root);
  const listLines = listContent.split("\n");

  let newLines = [];
  let listInserted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isListLine = /^(\s*)([-*+]|\d+\.)\s+/.test(line) && !isInCodeBlock(lines, i);

    if (!isListLine) {
      if (!listInserted && line.trim() === "") {
        let hasMoreList = false;
        for (let j = i + 1; j < lines.length; j++) {
          if (/^(\s*)([-*+]|\d+\.)\s+/.test(lines[j]) && !isInCodeBlock(lines, j)) {
            hasMoreList = true;
            break;
          }
          if (lines[j].trim() !== "") break;
        }
        if (!hasMoreList) {
          newLines.push(...listLines);
          listInserted = true;
        }
      }
      newLines.push(line);
    } else if (!listInserted) {
      newLines.push(...listLines);
      listInserted = true;
    }
  }

  if (!listInserted) {
    if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== "") {
      newLines.push("");
    }
    newLines.push(...listLines);
  }

  const newMarkdown = newLines.join("\n");
  const newRoot = parseMarkdownToMindMap(newMarkdown);
  const newMovedNode = findNodeById(newRoot, movedNodeId);

  let cursorOffset = null;
  if (newMovedNode && newMovedNode._lineNumber >= 0) {
    const charCount = newMarkdown.split("\n").slice(0, newMovedNode._lineNumber).reduce((sum, l) => sum + l.length + 1, 0);
    cursorOffset = charCount + 4;
  }

  return {
    markdown: newMarkdown,
    cursorOffset,
    success: true,
    movedNodeId,
    newParentId,
  };
}

function isInCodeBlock(lines, lineIndex) {
  let inBlock = false;
  for (let i = 0; i <= lineIndex; i++) {
    if (lines[i].trimStart().startsWith("```")) {
      inBlock = !inBlock;
    }
  }
  return inBlock;
}

export function collectSubtreeLineNumbers(node) {
  const lines = [];
  function traverse(n) {
    if (n._lineNumber !== undefined && n._lineNumber >= 0) {
      lines.push(n._lineNumber);
    }
    if (n.children) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }
  traverse(node);
  return lines.sort((a, b) => a - b);
}

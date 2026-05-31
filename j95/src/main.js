import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { marked } from "marked";
import {
  parseMarkdownToMindMap,
  updateMarkdownFromNodeMove,
  findNodeById,
} from "./mindmap-parser.js";
import { renderMindMap } from "./mindmap-renderer.js";

let currentFilePath = null;
let isModified = false;
let currentView = "split";
let mindmapDebounceTimer = null;
let isProgrammaticUpdate = false;
let alwaysAllowNodeDrag = true;
let lastCursorPosition = 0;
let cachedMindMapRoot = null;

const DEBOUNCE_DELAY = 300;
const FAST_DEBOUNCE_DELAY = 100;

const DEFAULT_CONTENT = `# Markdown 思维导图编辑器

## 双向同步功能

- 按住 Shift 拖拽节点可改变层级
- 左侧编辑 Markdown 自动更新导图
- 右侧拖拽节点自动更新源码
- 保持光标位置和滚动状态

### 项目管理
- 任务分析
  - 需求评审
  - 技术选型
  - 风险评估
- 开发阶段
  - 前端开发
    - UI 组件
    - 交互逻辑
  - 后端开发
    - API 接口
    - 数据库设计
- 测试上线
  - 单元测试
  - 集成测试
  - 部署发布

### 个人笔记
- 学习记录
- 灵感收集
- 待办事项

## 技术栈

- Tauri v2
  - Rust 后端
  - 文件系统操作
- 前端
  - Vite 构建
  - marked 解析
  - SVG 思维导图渲染
`;

function $(sel) {
  return document.querySelector(sel);
}

function init() {
  renderUI();
  bindEvents();
  setEditorContent(DEFAULT_CONTENT);
  updatePreview();
  updateMindMap(true);
}

function renderUI() {
  const app = $("#app");
  app.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-group">
        <button class="toolbar-btn" id="btn-new" title="新建 (Ctrl+N)">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/></svg>
          新建
        </button>
        <button class="toolbar-btn" id="btn-open" title="打开 (Ctrl+O)">
          <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm0 12H4V8h16v10z"/></svg>
          打开
        </button>
        <button class="toolbar-btn" id="btn-save" title="保存 (Ctrl+S)">
          <svg viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          保存
        </button>
        <button class="toolbar-btn" id="btn-save-as" title="另存为">
          <svg viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          另存为
        </button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button class="toolbar-btn active" id="btn-view-split" title="分屏视图">
          <svg viewBox="0 0 24 24"><path d="M3 3h8v18H3V3zm10 0h8v18h-8V3zm1 1v16h6V4h-6z"/></svg>
          分屏
        </button>
        <button class="toolbar-btn" id="btn-view-editor" title="编辑视图">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          编辑
        </button>
        <button class="toolbar-btn" id="btn-view-preview" title="预览视图">
          <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          预览
        </button>
        <button class="toolbar-btn" id="btn-view-mindmap" title="思维导图">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/><circle cx="12" cy="14" r="1.5"/><line x1="9" y1="10" x2="12" y2="14" stroke="currentColor" stroke-width="1"/><line x1="15" y1="10" x2="12" y2="14" stroke="currentColor" stroke-width="1"/></svg>
          思维导图
        </button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button class="toolbar-btn" id="btn-toggle-drag" title="切换节点拖拽模式">
          <svg viewBox="0 0 24 24"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>
          <span id="drag-mode-label">拖拽: 开启</span>
        </button>
      </div>
      <div class="toolbar-divider"></div>
      <span class="file-name" id="file-name">未保存文件</span>
    </div>
    <div class="main-content">
      <div class="split-view" id="split-view">
        <div class="editor-pane" id="editor-pane">
          <div class="editor-wrapper">
            <textarea class="editor-textarea" id="editor" placeholder="在此输入 Markdown..."></textarea>
          </div>
        </div>
        <div class="resizer" id="resizer"></div>
        <div class="preview-pane" id="preview-pane">
          <div class="markdown-body" id="preview"></div>
        </div>
      </div>
      <div class="mindmap-pane hidden" id="mindmap-pane">
        <div class="mindmap-container" id="mindmap-container"></div>
        <div class="mindmap-controls">
          <button class="mindmap-ctrl-btn zoom-in" title="放大">+</button>
          <div class="zoom-label" id="zoom-label">100%</div>
          <button class="mindmap-ctrl-btn zoom-out" title="缩小">−</button>
          <button class="mindmap-ctrl-btn zoom-reset" title="重置">⌂</button>
        </div>
      </div>
    </div>
    <div class="status-bar">
      <span id="status-left">就绪</span>
      <span id="status-right">行: 1 | 字符: 0</span>
    </div>
  `;
}

function bindEvents() {
  const editor = $("#editor");

  editor.addEventListener("input", () => {
    if (isProgrammaticUpdate) return;

    isModified = true;
    updateFileName();
    updatePreview();
    debouncedMindMapUpdate();
    updateStatus();
    lastCursorPosition = editor.selectionStart;
  });

  editor.addEventListener("scroll", () => {
    if (currentView !== "split") return;
    const preview = $("#preview-pane");
    const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
  });

  editor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + "  " + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      editor.dispatchEvent(new Event("input"));
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "o") {
      e.preventDefault();
      openFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      newFile();
    }
  });

  $("#btn-new").addEventListener("click", newFile);
  $("#btn-open").addEventListener("click", openFile);
  $("#btn-save").addEventListener("click", saveFile);
  $("#btn-save-as").addEventListener("click", saveAsFile);

  $("#btn-view-split").addEventListener("click", () => switchView("split"));
  $("#btn-view-editor").addEventListener("click", () => switchView("editor"));
  $("#btn-view-preview").addEventListener("click", () => switchView("preview"));
  $("#btn-view-mindmap").addEventListener("click", () => switchView("mindmap"));

  $("#btn-toggle-drag").addEventListener("click", toggleDragMode);

  setupResizer();
}

function toggleDragMode() {
  alwaysAllowNodeDrag = !alwaysAllowNodeDrag;
  const label = $("#drag-mode-label");
  label.textContent = alwaysAllowNodeDrag ? "拖拽: 开启" : "拖拽: 按住 Shift";
  const btn = $("#btn-toggle-drag");
  btn.classList.toggle("active", alwaysAllowNodeDrag);

  updateMindMap(true);

  const status = $("#status-left");
  status.textContent = alwaysAllowNodeDrag
    ? "节点拖拽模式: 直接拖拽即可改变层级"
    : "节点拖拽模式: 按住 Shift 拖拽改变层级";
  setTimeout(() => updateStatus(), 2000);
}

function setupResizer() {
  const resizer = $("#resizer");
  const editorPane = $("#editor-pane");
  const previewPane = $("#preview-pane");
  let isResizing = false;

  resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    resizer.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const container = $("#split-view");
    const containerRect = container.getBoundingClientRect();
    const ratio = (e.clientX - containerRect.left) / containerRect.width;
    const clamped = Math.max(0.2, Math.min(0.8, ratio));
    editorPane.style.flex = `${clamped}`;
    previewPane.style.flex = `${1 - clamped}`;
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

function setEditorContent(content, preserveCursor = false) {
  const editor = $("#editor");
  const oldValue = editor.value;
  const oldCursor = editor.selectionStart;

  if (preserveCursor) {
    const commonPrefix = findCommonPrefix(oldValue, content);
    const newCursor = Math.min(commonPrefix.length, content.length);

    editor.value = content;
    editor.selectionStart = editor.selectionEnd = newCursor;
    lastCursorPosition = newCursor;
  } else {
    editor.value = content;
    lastCursorPosition = 0;
  }

  updateStatus();
}

function findCommonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return a.substring(0, i);
}

function updatePreview() {
  const editor = $("#editor");
  const preview = $("#preview");
  try {
    preview.innerHTML = marked(editor.value);
  } catch (err) {
    preview.innerHTML = `<p style="color:var(--danger)">解析错误: ${err.message}</p>`;
  }
}

function debouncedMindMapUpdate(immediate = false) {
  clearTimeout(mindmapDebounceTimer);
  if (immediate) {
    updateMindMap(true);
  } else {
    mindmapDebounceTimer = setTimeout(() => {
      updateMindMap(false);
    }, DEBOUNCE_DELAY);
  }
}

function updateMindMap(force = false) {
  const container = $("#mindmap-container");
  if (!container) return;

  if (container.closest(".mindmap-pane.hidden") && !force) {
    return;
  }

  const editor = $("#editor");
  const tree = parseMarkdownToMindMap(editor.value);
  cachedMindMapRoot = tree;

  renderMindMap(container, tree, {
    alwaysAllowDrag: alwaysAllowNodeDrag,
    onNodeDrop: handleNodeDrop,
    onRenderRequest: () => updateMindMap(true),
  });
}

function handleNodeDrop(draggedNodeId, targetNodeId) {
  const editor = $("#editor");
  const oldMarkdown = editor.value;
  const oldCursor = editor.selectionStart;

  const result = updateMarkdownFromNodeMove(oldMarkdown, draggedNodeId, targetNodeId);

  if (!result.success) {
    const status = $("#status-left");
    status.textContent = `操作失败: ${result.reason}`;
    setTimeout(() => updateStatus(), 2000);
    return { ...result, markdown: oldMarkdown };
  }

  if (result.markdown === oldMarkdown) {
    return result;
  }

  isProgrammaticUpdate = true;

  const targetOffset = result.cursorOffset !== null
    ? result.cursorOffset
    : calculateNewCursorPosition(oldMarkdown, result.markdown, oldCursor);

  setEditorContent(result.markdown, false);
  editor.selectionStart = editor.selectionEnd = targetOffset;
  editor.focus();

  isModified = true;
  updateFileName();
  updatePreview();
  updateStatus();

  cachedMindMapRoot = parseMarkdownToMindMap(result.markdown);

  isProgrammaticUpdate = false;

  const status = $("#status-left");
  status.textContent = "已同步更新 Markdown 源码";
  setTimeout(() => updateStatus(), 2000);

  return result;
}

function calculateNewCursorPosition(oldText, newText, oldCursor) {
  const lines = oldText.substring(0, oldCursor).split("\n");
  const oldLine = lines.length;
  const oldCol = lines[lines.length - 1].length;

  const newLines = newText.split("\n");
  if (oldLine <= newLines.length) {
    const line = newLines[oldLine - 1] || "";
    const newCol = Math.min(oldCol, line.length);
    return newText.substring(0, oldLine - 1).split("").filter(c => c === "\n").length * 0 +
      newLines.slice(0, oldLine - 1).reduce((sum, l) => sum + l.length + 1, 0) + newCol;
  }

  const prefix = findCommonPrefix(oldText.substring(0, oldCursor), newText);
  return Math.min(prefix.length, newText.length);
}

function switchView(view) {
  currentView = view;
  const editorPane = $("#editor-pane");
  const previewPane = $("#preview-pane");
  const resizer = $("#resizer");
  const mindmapPane = $("#mindmap-pane");

  document.querySelectorAll(".toolbar-btn[id^='btn-view-']").forEach((btn) => {
    btn.classList.remove("active");
  });
  $(`#btn-view-${view}`).classList.add("active");

  if (view === "split") {
    editorPane.classList.remove("hidden");
    previewPane.classList.remove("hidden");
    resizer.style.display = "";
    mindmapPane.classList.add("hidden");
    editorPane.style.flex = "1";
    previewPane.style.flex = "1";
  } else if (view === "editor") {
    editorPane.classList.remove("hidden");
    previewPane.classList.add("hidden");
    resizer.style.display = "none";
    mindmapPane.classList.add("hidden");
  } else if (view === "preview") {
    editorPane.classList.add("hidden");
    previewPane.classList.remove("hidden");
    resizer.style.display = "none";
    mindmapPane.classList.add("hidden");
  } else if (view === "mindmap") {
    editorPane.classList.add("hidden");
    previewPane.classList.add("hidden");
    resizer.style.display = "none";
    mindmapPane.classList.remove("hidden");
    setTimeout(() => updateMindMap(true), 50);
  }
}

function updateFileName() {
  const el = $("#file-name");
  if (currentFilePath) {
    const parts = currentFilePath.replace(/\\/g, "/").split("/");
    el.textContent = parts[parts.length - 1];
  } else {
    el.textContent = "未保存文件";
  }
  if (isModified) {
    el.classList.add("modified");
  } else {
    el.classList.remove("modified");
  }
}

function updateStatus() {
  const editor = $("#editor");
  const lines = editor.value.split("\n").length;
  const chars = editor.value.length;
  const cursor = editor.selectionStart;
  const cursorLine = editor.value.substring(0, cursor).split("\n").length;
  const cursorCol = cursor - editor.value.substring(0, cursor).lastIndexOf("\n");

  $("#status-right").textContent = `行: ${lines} | 字符: ${chars} | 光标: ${cursorLine}:${cursorCol}`;

  if (currentFilePath) {
    $("#status-left").textContent = currentFilePath;
  } else {
    $("#status-left").textContent = "就绪";
  }
}

async function newFile() {
  if (isModified) {
    const confirmed = window.confirm("当前文件未保存，是否创建新文件？");
    if (!confirmed) return;
  }
  currentFilePath = null;
  isModified = false;
  setEditorContent("");
  updatePreview();
  updateMindMap(true);
  updateFileName();
  updateStatus();
}

async function openFile() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
    });
    if (!selected) return;

    const result = await invoke("read_file", { path: selected });
    currentFilePath = result.path;
    isModified = false;
    setEditorContent(result.content);
    updatePreview();
    updateMindMap(true);
    updateFileName();
    updateStatus();
  } catch (err) {
    $("#status-left").textContent = `打开失败: ${err}`;
  }
}

async function saveFile() {
  if (!currentFilePath) {
    await saveAsFile();
    return;
  }

  try {
    const editor = $("#editor");
    await invoke("write_file", { path: currentFilePath, content: editor.value });
    isModified = false;
    updateFileName();
    updateStatus();
    $("#status-left").textContent = "已保存";
    setTimeout(() => {
      if ($("#status-left").textContent === "已保存") {
        $("#status-left").textContent = currentFilePath;
      }
    }, 2000);
  } catch (err) {
    $("#status-left").textContent = `保存失败: ${err}`;
  }
}

async function saveAsFile() {
  try {
    const editor = $("#editor");
    const selected = await save({
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
      defaultPath: "untitled.md",
    });
    if (!selected) return;

    await invoke("write_file", { path: selected, content: editor.value });
    currentFilePath = selected;
    isModified = false;
    updateFileName();
    updateStatus();
  } catch (err) {
    $("#status-left").textContent = `保存失败: ${err}`;
  }
}

window.addEventListener("DOMContentLoaded", init);

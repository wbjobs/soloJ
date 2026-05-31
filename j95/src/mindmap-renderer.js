const NODE_H_GAP = 60;
const NODE_V_GAP = 16;
const NODE_PADDING_X = 16;
const NODE_PADDING_Y = 8;
const NODE_MIN_WIDTH = 80;
const NODE_MAX_WIDTH = 220;
const NODE_BORDER_RADIUS = 8;
const ROOT_BORDER_RADIUS = 24;

const BRANCH_COLORS = [
  "#89b4fa",
  "#a6e3a1",
  "#f9e2af",
  "#f38ba8",
  "#cba6f7",
  "#94e2d5",
  "#fab387",
  "#74c7ec",
  "#eba0ac",
  "#b4befe",
];

let _nodeIdCounter = 0;

function measureText(text, fontSize = 13) {
  const avgCharWidth = fontSize * 0.6;
  const maxCharsPerLine = Math.floor((NODE_MAX_WIDTH - NODE_PADDING_X * 2) / avgCharWidth);
  const lines = Math.ceil(text.length / maxCharsPerLine) || 1;
  const w = Math.min(Math.max(text.length * avgCharWidth + NODE_PADDING_X * 2, NODE_MIN_WIDTH), NODE_MAX_WIDTH);
  const h = lines * (fontSize * 1.4) + NODE_PADDING_Y * 2;
  return { width: w, height: h, lines };
}

function layoutTree(node, direction = "right") {
  _nodeIdCounter++;
  node._layoutId = _nodeIdCounter;

  const measured = measureText(node.text, node._isRoot ? 15 : 13);
  node._width = measured.width + (node._isRoot ? 20 : 0);
  node._height = measured.height + (node._isRoot ? 10 : 0);

  if (!node.children || node.children.length === 0) {
    node._subtreeHeight = node._height;
    return;
  }

  for (const child of node.children) {
    child._isRoot = false;
    layoutTree(child, direction);
  }

  const childrenTotalHeight = node.children.reduce(
    (sum, child) => sum + child._subtreeHeight,
    0
  ) + (node.children.length - 1) * NODE_V_GAP;

  node._subtreeHeight = Math.max(node._height, childrenTotalHeight);
}

function positionNodes(node, x, y, direction = "right", depth = 0, colorIndex = 0) {
  node._x = x;
  node._y = y;
  node._depth = depth;
  node._color = depth === 0 ? "#89b4fa" : BRANCH_COLORS[colorIndex % BRANCH_COLORS.length];

  if (!node.children || node.children.length === 0) return;

  const childX = direction === "right"
    ? x + node._width / 2 + NODE_H_GAP
    : x - node._width / 2 - NODE_H_GAP;

  const childrenTotalHeight = node.children.reduce(
    (sum, child) => sum + child._subtreeHeight,
    0
  ) + (node.children.length - 1) * NODE_V_GAP;

  let currentY = y - childrenTotalHeight / 2;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const childCenterY = currentY + child._subtreeHeight / 2;
    const ci = depth === 0 ? i : colorIndex;
    positionNodes(child, childX, childCenterY, direction, depth + 1, ci);
    currentY += child._subtreeHeight + NODE_V_GAP;
  }
}

export function renderMindMap(container, rootNode, options = {}) {
  container.innerHTML = "";

  if (!rootNode || (!rootNode.text && (!rootNode.children || rootNode.children.length === 0))) {
    container.innerHTML = '<div class="mindmap-empty">在 Markdown 中输入列表以生成思维导图<br><small style="opacity:0.6">按住 Shift 拖拽节点可改变层级</small></div>';
    return;
  }

  rootNode._isRoot = true;
  _nodeIdCounter = 0;

  const leftChildren = rootNode.children ? rootNode.children.slice(0, Math.ceil(rootNode.children.length / 2)) : [];
  const rightChildren = rootNode.children ? rootNode.children.slice(Math.ceil(rootNode.children.length / 2)) : [];

  const rightRoot = { ...rootNode, children: rightChildren, _isRoot: true };
  const leftRoot = { ...rootNode, children: leftChildren, _isRoot: true };

  layoutTree(rightRoot, "right");
  layoutTree(leftRoot, "left");

  const svgWidth = container.clientWidth || 800;
  const svgHeight = container.clientHeight || 600;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;

  positionNodes(rightRoot, centerX + 10, centerY, "right");
  positionNodes(leftRoot, centerX - 10, centerY, "left");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "mindmap-svg");
  svg.setAttribute("width", svgWidth);
  svg.setAttribute("height", svgHeight);
  svg.style.userSelect = "none";

  const mainGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  mainGroup.setAttribute("class", "mindmap-main-group");

  const allNodesMap = new Map();
  collectAllNodes(rootNode, allNodesMap);

  const rootMeasured = measureText(rootNode.text, 15);
  const rootW = rootMeasured.width + 30;
  const rootH = rootMeasured.height + 14;

  const rootG = createNodeSVG(rootNode.text, centerX, centerY, rootW, rootH, 0, "#89b4fa", true, rootNode.id, allNodesMap);
  mainGroup.appendChild(rootG);

  if (rightChildren.length > 0) {
    renderBranch(mainGroup, rightRoot, "right", allNodesMap);
  }
  if (leftChildren.length > 0) {
    renderBranch(mainGroup, leftRoot, "left", allNodesMap);
  }

  svg.appendChild(mainGroup);
  container.appendChild(svg);

  setupPanZoom(container, svg, mainGroup, rootNode, options, allNodesMap);

  if (options.onNodeDrop) {
    setupNodeDrag(container, svg, mainGroup, rootNode, options, allNodesMap);
  }
}

function collectAllNodes(node, map) {
  map.set(node.id, node);
  if (node.children) {
    for (const child of node.children) {
      collectAllNodes(child, map);
    }
  }
}

function renderBranch(parentSvg, node, direction, allNodesMap) {
  if (!node.children || node.children.length === 0) return;

  for (const child of node.children) {
    const fromX = direction === "right"
      ? node._x + node._width / 2
      : node._x - node._width / 2;
    const fromY = node._y;
    const toX = direction === "right"
      ? child._x - child._width / 2
      : child._x + child._width / 2;
    const toY = child._y;

    const cpOffset = Math.abs(toX - fromX) * 0.4;
    const cp1x = fromX + (direction === "right" ? cpOffset : -cpOffset);
    const cp2x = toX + (direction === "right" ? -cpOffset : cpOffset);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${fromX} ${fromY} C ${cp1x} ${fromY}, ${cp2x} ${toY}, ${toX} ${toY}`);
    path.setAttribute("stroke", child._color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-opacity", "0.6");
    path.setAttribute("data-node-id", child.id);
    path.setAttribute("class", "mindmap-connection");
    parentSvg.appendChild(path);

    const childG = createNodeSVG(
      child.text,
      child._x,
      child._y,
      child._width,
      child._height,
      child._depth,
      child._color,
      false,
      child.id,
      allNodesMap
    );
    parentSvg.appendChild(childG);

    renderBranch(parentSvg, child, direction, allNodesMap);
  }
}

function createNodeSVG(text, cx, cy, width, height, depth, color, isRoot, nodeId, allNodesMap) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "mindmap-node");
  g.setAttribute("data-node-id", nodeId);
  g.style.cursor = isRoot ? "pointer" : "grab";

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", cx - width / 2);
  rect.setAttribute("y", cy - height / 2);
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("rx", isRoot ? ROOT_BORDER_RADIUS : NODE_BORDER_RADIUS);
  rect.setAttribute("ry", isRoot ? ROOT_BORDER_RADIUS : NODE_BORDER_RADIUS);
  rect.setAttribute("data-node-id", nodeId);

  if (isRoot) {
    rect.setAttribute("fill", color);
    rect.setAttribute("stroke", "none");
  } else {
    rect.setAttribute("fill", "var(--mindmap-node-bg)");
    rect.setAttribute("stroke", color);
    rect.setAttribute("stroke-width", "1.5");
  }

  g.appendChild(rect);

  const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
  textEl.setAttribute("x", cx);
  textEl.setAttribute("y", cy);
  textEl.setAttribute("text-anchor", "middle");
  textEl.setAttribute("dominant-baseline", "central");
  textEl.setAttribute("font-size", isRoot ? "15" : "13");
  textEl.setAttribute("font-family", "var(--font-sans)");
  textEl.setAttribute("font-weight", isRoot ? "700" : "500");
  textEl.setAttribute("fill", isRoot ? "var(--mindmap-root-text)" : "var(--text-primary)");
  textEl.setAttribute("pointer-events", "none");

  const maxChars = Math.floor((width - NODE_PADDING_X) / 8);
  const wrapped = wrapText(text, maxChars);
  if (wrapped.length > 1) {
    const lineHeight = isRoot ? 20 : 17;
    const startY = cy - ((wrapped.length - 1) * lineHeight) / 2;
    for (let i = 0; i < wrapped.length; i++) {
      const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      tspan.setAttribute("x", cx);
      tspan.setAttribute("y", startY + i * lineHeight);
      tspan.textContent = wrapped[i];
      textEl.appendChild(tspan);
    }
  } else {
    textEl.textContent = text;
  }

  g.appendChild(textEl);
  return g;
}

function wrapText(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const lines = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let breakAt = remaining.lastIndexOf(" ", maxChars);
    if (breakAt <= 0) breakAt = maxChars;
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining) lines.push(remaining);
  return lines.slice(0, 3);
}

function setupNodeDrag(container, svg, mainGroup, rootNode, options, allNodesMap) {
  let dragState = {
    isDragging: false,
    isNodeDrag: false,
    draggedNodeId: null,
    startPoint: { x: 0, y: 0 },
    draggedElement: null,
    ghostElement: null,
    highlightTargetId: null,
  };

  let viewBox = { x: 0, y: 0, w: parseFloat(svg.getAttribute("width")), h: parseFloat(svg.getAttribute("height")) };

  function screenToSvg(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
    const y = ((clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
    return { x, y };
  }

  function findNodeAtPoint(svgX, svgY, excludeId = null) {
    let closest = null;
    let closestDist = Infinity;

    for (const [id, node] of allNodesMap) {
      if (id === excludeId) continue;
      if (isDescendant(allNodesMap.get(excludeId), node)) continue;

      const dx = svgX - node._x;
      const dy = svgY - node._y;
      const halfW = node._width / 2 + 15;
      const halfH = node._height / 2 + 10;

      if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = node;
        }
      }
    }
    return closest;
  }

  function isDescendant(ancestor, node) {
    if (!ancestor || !node) return false;
    if (ancestor.id === node.id) return true;
    if (!ancestor.children) return false;
    for (const child of ancestor.children) {
      if (isDescendant(child, node)) return true;
    }
    return false;
  }

  function clearHighlights() {
    svg.querySelectorAll(".mindmap-drop-target").forEach(el => {
      el.classList.remove("mindmap-drop-target");
      el.setAttribute("stroke-width", "1.5");
      el.setAttribute("stroke-dasharray", "");
    });
    svg.querySelectorAll(".mindmap-node.dragging").forEach(el => {
      el.classList.remove("dragging");
      el.style.opacity = "1";
    });
    dragState.highlightTargetId = null;
  }

  function highlightTarget(node) {
    clearHighlights();
    if (!node) return;
    const rect = svg.querySelector(`rect[data-node-id="${node.id}"]`);
    if (rect) {
      rect.classList.add("mindmap-drop-target");
      rect.setAttribute("stroke-width", "3");
      rect.setAttribute("stroke-dasharray", "5,3");
    }
    dragState.highlightTargetId = node.id;
  }

  function showDragHint() {
    let hint = container.querySelector(".mindmap-drag-hint");
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "mindmap-drag-hint";
      hint.style.cssText = `
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-surface);
        border: 1px solid var(--accent);
        color: var(--accent);
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 20;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
      `;
      container.appendChild(hint);
    }
    hint.textContent = "松开以改变层级，按 Esc 取消";
    hint.style.opacity = "1";
  }

  function hideDragHint() {
    const hint = container.querySelector(".mindmap-drag-hint");
    if (hint) {
      hint.style.opacity = "0";
    }
  }

  container.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;

    const target = e.target.closest(".mindmap-node");
    if (!target) return;

    const nodeId = target.getAttribute("data-node-id");
    if (nodeId === rootNode.id) return;

    const isShiftDrag = e.shiftKey;
    if (!isShiftDrag && !options.alwaysAllowDrag) return;

    e.preventDefault();
    e.stopPropagation();

    const node = allNodesMap.get(nodeId);
    if (!node) return;

    dragState.isDragging = true;
    dragState.isNodeDrag = true;
    dragState.draggedNodeId = nodeId;
    dragState.draggedElement = target;
    dragState.startPoint = { x: e.clientX, y: e.clientY };

    target.classList.add("dragging");
    target.style.opacity = "0.4";

    showDragHint();
  });

  container.addEventListener("mousemove", (e) => {
    if (!dragState.isNodeDrag) return;

    const svgPt = screenToSvg(e.clientX, e.clientY);
    const targetNode = findNodeAtPoint(svgPt.x, svgPt.y, dragState.draggedNodeId);

    if (targetNode) {
      highlightTarget(targetNode);
    } else {
      clearHighlights();
    }

    if (dragState.draggedElement) {
      const dx = (e.clientX - dragState.startPoint.x) * (viewBox.w / container.clientWidth);
      const dy = (e.clientY - dragState.startPoint.y) * (viewBox.h / container.clientHeight);
      const node = allNodesMap.get(dragState.draggedNodeId);
      if (node) {
        const transform = `translate(${dx}, ${dy})`;
        dragState.draggedElement.setAttribute("transform", transform);

        const connections = svg.querySelectorAll(`path[data-node-id="${dragState.draggedNodeId}"]`);
        connections.forEach(c => {
          c.setAttribute("transform", transform);
        });
      }
    }
  });

  container.addEventListener("mouseup", (e) => {
    if (!dragState.isNodeDrag) return;

    const svgPt = screenToSvg(e.clientX, e.clientY);
    const targetNode = findNodeAtPoint(svgPt.x, svgPt.y, dragState.draggedNodeId);

    hideDragHint();

    if (targetNode && options.onNodeDrop) {
      const result = options.onNodeDrop(dragState.draggedNodeId, targetNode.id);
      if (result && result.success && options.onMarkdownUpdate) {
        options.onMarkdownUpdate(result);
      }
    }

    clearHighlights();
    dragState = {
      isDragging: false,
      isNodeDrag: false,
      draggedNodeId: null,
      startPoint: { x: 0, y: 0 },
      draggedElement: null,
      ghostElement: null,
      highlightTargetId: null,
    };

    if (options.onRenderRequest) {
      options.onRenderRequest();
    }
  });

  container.addEventListener("mouseleave", () => {
    if (dragState.isNodeDrag) {
      hideDragHint();
      clearHighlights();
      if (dragState.draggedElement) {
        dragState.draggedElement.removeAttribute("transform");
        dragState.draggedElement.classList.remove("dragging");
        dragState.draggedElement.style.opacity = "1";
      }
      dragState = {
        isDragging: false,
        isNodeDrag: false,
        draggedNodeId: null,
        startPoint: { x: 0, y: 0 },
        draggedElement: null,
        ghostElement: null,
        highlightTargetId: null,
      };
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dragState.isNodeDrag) {
      hideDragHint();
      clearHighlights();
      if (dragState.draggedElement) {
        dragState.draggedElement.removeAttribute("transform");
        dragState.draggedElement.classList.remove("dragging");
        dragState.draggedElement.style.opacity = "1";
      }
      dragState = {
        isDragging: false,
        isNodeDrag: false,
        draggedNodeId: null,
        startPoint: { x: 0, y: 0 },
        draggedElement: null,
        ghostElement: null,
        highlightTargetId: null,
      };
    }
  });

  function updateViewBoxFromPan() {
    const vb = mainGroup.getAttribute("transform");
    if (vb) {
      const match = vb.match(/translate\(([^,]+),([^)]+)\)/);
      if (match) {
        const containerTransform = container.getAttribute("data-viewbox");
        if (containerTransform) {
          const parts = containerTransform.split(" ");
          viewBox = {
            x: parseFloat(parts[0]),
            y: parseFloat(parts[1]),
            w: parseFloat(parts[2]),
            h: parseFloat(parts[3]),
          };
        }
      }
    }
  }

  container.addEventListener("pan-updated", updateViewBoxFromPan);
}

function setupPanZoom(container, svg, mainGroup, rootNode, options, allNodesMap) {
  let viewBox = { x: 0, y: 0, w: parseFloat(svg.getAttribute("width")), h: parseFloat(svg.getAttribute("height")) };
  let isPanning = false;
  let startPoint = { x: 0, y: 0 };
  let scale = 1;

  function updateViewBox() {
    svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    container.setAttribute("data-viewbox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  }

  container._setViewBox = (vb) => { viewBox = vb; updateViewBox(); };
  container._getViewBox = () => ({ ...viewBox });
  container._getScale = () => scale;

  container.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const target = e.target.closest(".mindmap-node");
    if (target && (e.shiftKey || options.alwaysAllowDrag)) return;

    isPanning = true;
    startPoint = { x: e.clientX, y: e.clientY };
    container.classList.add("grabbing");
  });

  container.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    const dx = (e.clientX - startPoint.x) * (viewBox.w / container.clientWidth);
    const dy = (e.clientY - startPoint.y) * (viewBox.h / container.clientHeight);
    viewBox.x -= dx;
    viewBox.y -= dy;
    startPoint = { x: e.clientX, y: e.clientY };
    updateViewBox();
    container.dispatchEvent(new CustomEvent("pan-updated"));
  });

  container.addEventListener("mouseup", () => {
    isPanning = false;
    container.classList.remove("grabbing");
  });

  container.addEventListener("mouseleave", () => {
    isPanning = false;
    container.classList.remove("grabbing");
  });

  container.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const newW = viewBox.w * factor;
    const newH = viewBox.h * factor;

    if (newW < 100 || newW > 10000) return;

    viewBox.x += (viewBox.w - newW) * mx;
    viewBox.y += (viewBox.h - newH) * my;
    viewBox.w = newW;
    viewBox.h = newH;
    scale = parseFloat(svg.getAttribute("width")) / newW;
    updateViewBox();

    const zoomLabel = container.parentElement.querySelector(".zoom-label");
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    }
  });

  const controls = container.parentElement.querySelector(".mindmap-controls");
  if (controls) {
    controls.querySelector(".zoom-in").onclick = () => {
      const factor = 0.8;
      const newW = viewBox.w * factor;
      const newH = viewBox.h * factor;
      viewBox.x += (viewBox.w - newW) / 2;
      viewBox.y += (viewBox.h - newH) / 2;
      viewBox.w = newW;
      viewBox.h = newH;
      scale = parseFloat(svg.getAttribute("width")) / newW;
      updateViewBox();
      const zoomLabel = container.parentElement.querySelector(".zoom-label");
      if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    };
    controls.querySelector(".zoom-out").onclick = () => {
      const factor = 1.25;
      const newW = viewBox.w * factor;
      const newH = viewBox.h * factor;
      viewBox.x += (viewBox.w - newW) / 2;
      viewBox.y += (viewBox.h - newH) / 2;
      viewBox.w = newW;
      viewBox.h = newH;
      scale = parseFloat(svg.getAttribute("width")) / newW;
      updateViewBox();
      const zoomLabel = container.parentElement.querySelector(".zoom-label");
      if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    };
    controls.querySelector(".zoom-reset").onclick = () => {
      viewBox = { x: 0, y: 0, w: parseFloat(svg.getAttribute("width")), h: parseFloat(svg.getAttribute("height")) };
      scale = 1;
      updateViewBox();
      const zoomLabel = container.parentElement.querySelector(".zoom-label");
      if (zoomLabel) zoomLabel.textContent = "100%";
    };
  }
}

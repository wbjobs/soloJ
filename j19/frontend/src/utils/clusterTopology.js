export function calculateGridLayout(nodes, rows = 4, cols = 4) {
  const width = 800
  const height = 600
  const padding = 80
  const availableWidth = width - padding * 2
  const availableHeight = height - padding * 2
  const cellWidth = availableWidth / (cols - 1 || 1)
  const cellHeight = availableHeight / (rows - 1 || 1)

  return nodes.map((node, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    return {
      ...node,
      x: padding + col * cellWidth,
      y: padding + row * cellHeight,
    }
  })
}

export function calculateCircularLayout(nodes, centerX = 400, centerY = 300, radius = 200) {
  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    }
  })
}

export function calculateForceLayout(nodes, edges, iterations = 100) {
  const width = 800
  const height = 600
  const nodeRadius = 30
  const repulsionStrength = 5000
  const attractionStrength = 0.01
  const centerStrength = 0.05
  const centerX = width / 2
  const centerY = height / 2

  let positionedNodes = nodes.map((node, i) => ({
    ...node,
    x: node.x || 100 + Math.random() * (width - 200),
    y: node.y || 100 + Math.random() * (height - 200),
    vx: 0,
    vy: 0,
  }))

  for (let iter = 0; iter < iterations; iter++) {
    positionedNodes = positionedNodes.map((node) => {
      let fx = 0
      let fy = 0

      positionedNodes.forEach((other) => {
        if (node.id === other.id) return
        const dx = node.x - other.x
        const dy = node.y - other.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = repulsionStrength / (dist * dist)
        fx += (dx / dist) * force
        fy += (dy / dist) * force
      })

      fx += (centerX - node.x) * centerStrength
      fy += (centerY - node.y) * centerStrength

      return { ...node, fx, fy }
    })

    edges.forEach((edge) => {
      const source = positionedNodes.find((n) => n.id === edge.source)
      const target = positionedNodes.find((n) => n.id === edge.target)
      if (!source || !target) return

      const dx = target.x - source.x
      const dy = target.y - source.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = (dist - 100) * attractionStrength

      source.fx += (dx / dist) * force
      source.fy += (dy / dist) * force
      target.fx -= (dx / dist) * force
      target.fy -= (dy / dist) * force
    })

    positionedNodes = positionedNodes.map((node) => {
      const damping = 0.9
      node.vx = (node.vx + node.fx) * damping
      node.vy = (node.vy + node.fy) * damping
      node.x = Math.max(nodeRadius, Math.min(width - nodeRadius, node.x + node.vx))
      node.y = Math.max(nodeRadius, Math.min(height - nodeRadius, node.y + node.vy))
      return node
    })
  }

  return positionedNodes
}

export function findNodeAtPosition(nodes, x, y, radius = 30) {
  return nodes.find((node) => {
    const dx = node.x - x
    const dy = node.y - y
    return Math.sqrt(dx * dx + dy * dy) <= radius
  })
}

export function getNodeConnectionPath(node1, node2) {
  const dx = node2.x - node1.x
  const dy = node2.y - node1.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < 1) {
    return `M ${node1.x} ${node1.y} L ${node2.x} ${node2.y}`
  }

  const midX = (node1.x + node2.x) / 2
  const midY = (node1.y + node2.y) / 2
  const offset = Math.min(dist * 0.1, 20)
  const perpX = -dy / dist * offset
  const perpY = dx / dist * offset

  return `M ${node1.x} ${node1.y} Q ${midX + perpX} ${midY + perpY} ${node2.x} ${node2.y}`
}

export function calculateConnectionPaths(nodes, connections) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return connections.map((conn) => {
    const source = nodeMap.get(conn.source)
    const target = nodeMap.get(conn.target)
    if (!source || !target) return null

    return {
      ...conn,
      path: getNodeConnectionPath(source, target),
      sourceNode: source,
      targetNode: target,
    }
  }).filter(Boolean)
}

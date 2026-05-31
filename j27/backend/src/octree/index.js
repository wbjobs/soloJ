const EventEmitter = require('events');

class OctreeNode {
  constructor(bounds, level = 0, key = 'root') {
    this.bounds = bounds;
    this.level = level;
    this.key = key;
    this.children = null;
    this.points = [];
    this.pointCount = 0;
  }

  get centerX() {
    return (this.bounds.minX + this.bounds.maxX) / 2;
  }

  get centerY() {
    return (this.bounds.minY + this.bounds.maxY) / 2;
  }

  get centerZ() {
    return (this.bounds.minZ + this.bounds.maxZ) / 2;
  }

  get size() {
    return Math.max(
      this.bounds.maxX - this.bounds.minX,
      this.bounds.maxY - this.bounds.minY,
      this.bounds.maxZ - this.bounds.minZ
    );
  }

  containsPoint(x, y, z) {
    return (
      x >= this.bounds.minX && x < this.bounds.maxX &&
      y >= this.bounds.minY && y < this.bounds.maxY &&
      z >= this.bounds.minZ && z < this.bounds.maxZ
    );
  }

  getChildIndex(x, y, z) {
    const midX = this.centerX;
    const midY = this.centerY;
    const midZ = this.centerZ;

    let index = 0;
    if (x >= midX) index |= 1;
    if (y >= midY) index |= 2;
    if (z >= midZ) index |= 4;
    return index;
  }

  getChildBounds(index) {
    const midX = this.centerX;
    const midY = this.centerY;
    const midZ = this.centerZ;

    const minX = (index & 1) ? midX : this.bounds.minX;
    const maxX = (index & 1) ? this.bounds.maxX : midX;
    const minY = (index & 2) ? midY : this.bounds.minY;
    const maxY = (index & 2) ? this.bounds.maxY : midY;
    const minZ = (index & 4) ? midZ : this.bounds.minZ;
    const maxZ = (index & 4) ? this.bounds.maxZ : midZ;

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  split() {
    if (this.children) return;
    this.children = [];
    for (let i = 0; i < 8; i++) {
      const childBounds = this.getChildBounds(i);
      const childKey = `${this.key}-${i}`;
      this.children.push(new OctreeNode(childBounds, this.level + 1, childKey));
    }
  }

  getAllNodes(result = []) {
    result.push(this);
    if (this.children) {
      for (const child of this.children) {
        child.getAllNodes(result);
      }
    }
    return result;
  }

  getLeafNodes(result = []) {
    if (!this.children || this.children.length === 0) {
      if (this.pointCount > 0) {
        result.push(this);
      }
    } else {
      for (const child of this.children) {
        child.getLeafNodes(result);
      }
    }
    return result;
  }

  getNodesAtLevel(targetLevel, result = []) {
    if (this.level === targetLevel) {
      if (this.pointCount > 0 || (this.children && this.children.some(c => c.pointCount > 0))) {
        result.push(this);
      }
    } else if (this.children && this.level < targetLevel) {
      for (const child of this.children) {
        child.getNodesAtLevel(targetLevel, result);
      }
    }
    return result;
  }
}

class Octree extends EventEmitter {
  constructor(bounds, options = {}) {
    super();
    this.root = new OctreeNode(bounds, 0, '0');
    this.maxPointsPerNode = options.maxPointsPerNode || 65536;
    this.maxDepth = options.maxDepth || 8;
    this.totalPoints = 0;
    this.totalLeafNodes = 0;
  }

  insert(point) {
    this.totalPoints++;
    let node = this.root;

    while (true) {
      node.pointCount++;

      if (!node.children) {
        node.points.push(point);

        if (node.points.length > this.maxPointsPerNode && node.level < this.maxDepth) {
          node.split();
          for (const p of node.points) {
            const childIndex = node.getChildIndex(p.x, p.y, p.z);
            node.children[childIndex].points.push(p);
            node.children[childIndex].pointCount++;
          }
          node.points = null;
        }
        break;
      }

      const childIndex = node.getChildIndex(point.x, point.y, point.z);
      node = node.children[childIndex];
    }
  }

  insertBatch(points) {
    for (const point of points) {
      this.insert(point);
    }
  }

  query(bounds, result = []) {
    const stack = [this.root];

    while (stack.length > 0) {
      const node = stack.pop();

      if (!this._boundsIntersect(node.bounds, bounds)) {
        continue;
      }

      if (node.points) {
        for (const point of node.points) {
          if (
            point.x >= bounds.minX && point.x < bounds.maxX &&
            point.y >= bounds.minY && point.y < bounds.maxY &&
            point.z >= bounds.minZ && point.z < bounds.maxZ
          ) {
            result.push(point);
          }
        }
      } else if (node.children) {
        for (const child of node.children) {
          if (child.pointCount > 0) {
            stack.push(child);
          }
        }
      }
    }

    return result;
  }

  _boundsIntersect(a, b) {
    return !(
      a.maxX < b.minX || a.minX > b.maxX ||
      a.maxY < b.minY || a.minY > b.maxY ||
      a.maxZ < b.minZ || a.minZ > b.maxZ
    );
  }

  getStats() {
    const allNodes = this.root.getAllNodes();
    const leafNodes = this.root.getLeafNodes();
    const depthCounts = {};
    let maxDepth = 0;

    for (const node of allNodes) {
      depthCounts[node.level] = (depthCounts[node.level] || 0) + 1;
      maxDepth = Math.max(maxDepth, node.level);
    }

    return {
      totalPoints: this.totalPoints,
      totalNodes: allNodes.length,
      totalLeafNodes: leafNodes.length,
      maxDepth,
      depthCounts,
      avgPointsPerLeaf: this.totalPoints / leafNodes.length,
    };
  }

  getNodesAtLevel(level) {
    return this.root.getNodesAtLevel(level, []);
  }

  getLeafNodes() {
    return this.root.getLeafNodes([]);
  }

  simplifyForLOD(level, strategy = 'uniform') {
    const nodes = this.getNodesAtLevel(level);
    const simplifiedNodes = [];

    for (const node of nodes) {
      const points = this._collectPoints(node);
      let simplified;

      if (strategy === 'uniform') {
        simplified = this._uniformSampling(points, this.maxPointsPerNode);
      } else if (strategy === 'grid') {
        simplified = this._gridSampling(points, node.size / 100);
      } else {
        simplified = points.slice(0, this.maxPointsPerNode);
      }

      simplifiedNodes.push({
        ...node,
        points: simplified,
      });
    }

    return simplifiedNodes;
  }

  _collectPoints(node, result = []) {
    if (node.points) {
      result.push(...node.points);
    } else if (node.children) {
      for (const child of node.children) {
        if (child.pointCount > 0) {
          this._collectPoints(child, result);
        }
      }
    }
    return result;
  }

  _uniformSampling(points, targetCount) {
    if (points.length <= targetCount) return points;
    const step = Math.ceil(points.length / targetCount);
    const sampled = [];
    for (let i = 0; i < points.length; i += step) {
      sampled.push(points[i]);
    }
    return sampled;
  }

  _gridSampling(points, cellSize) {
    const grid = new Map();
    const result = [];

    for (const point of points) {
      const cellX = Math.floor(point.x / cellSize);
      const cellY = Math.floor(point.y / cellSize);
      const cellZ = Math.floor(point.z / cellSize);
      const key = `${cellX},${cellY},${cellZ}`;

      if (!grid.has(key)) {
        grid.set(key, true);
        result.push(point);
      }
    }

    return result;
  }
}

module.exports = { Octree, OctreeNode };

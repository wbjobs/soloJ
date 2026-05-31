const { Octree } = require('../src/octree');

function generateRandomPoints(count, bounds) {
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
      z: bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ),
      intensity: Math.floor(Math.random() * 256),
    });
  }
  return points;
}

function benchmarkOctree(pointCount, maxPointsPerNode = 1000) {
  console.log(`\nBenchmarking Octree with ${pointCount.toLocaleString()} points...`);

  const bounds = {
    minX: 0, maxX: 1000,
    minY: 0, maxY: 1000,
    minZ: 0, maxZ: 1000,
  };

  console.log('Generating points...');
  const points = generateRandomPoints(pointCount, bounds);

  const octree = new Octree(bounds, {
    maxPointsPerNode,
    maxDepth: 10,
  });

  console.log('Inserting points...');
  const startInsert = Date.now();
  octree.insertBatch(points);
  const insertTime = Date.now() - startInsert;

  const stats = octree.getStats();
  console.log(`Insert time: ${insertTime}ms`);
  console.log(`Insert rate: ${Math.floor(pointCount / (insertTime / 1000)).toLocaleString()} points/sec`);
  console.log(`Total nodes: ${stats.totalNodes}`);
  console.log(`Leaf nodes: ${stats.totalLeafNodes}`);
  console.log(`Max depth: ${stats.maxDepth}`);
  console.log(`Avg points per leaf: ${Math.floor(stats.avgPointsPerLeaf)}`);

  console.log('\nTesting queries...');
  const queryCount = 100;
  const startQuery = Date.now();
  for (let i = 0; i < queryCount; i++) {
    const qBounds = {
      minX: Math.random() * 800,
      maxX: Math.random() * 200 + 800,
      minY: Math.random() * 800,
      maxY: Math.random() * 200 + 800,
      minZ: Math.random() * 800,
      maxZ: Math.random() * 200 + 800,
    };
    octree.query(qBounds);
  }
  const queryTime = Date.now() - startQuery;
  console.log(`${queryCount} queries in ${queryTime}ms`);
  console.log(`Avg query time: ${(queryTime / queryCount).toFixed(2)}ms`);

  console.log('\nTesting LOD generation...');
  const startLOD = Date.now();
  for (let level = 0; level <= stats.maxDepth; level++) {
    const lodNodes = octree.simplifyForLOD(level);
    let total = 0;
    for (const node of lodNodes) {
      total += node.points.length;
    }
    console.log(`  LOD ${level}: ${lodNodes.length} nodes, ${total.toLocaleString()} points`);
  }
  const lodTime = Date.now() - startLOD;
  console.log(`LOD generation time: ${lodTime}ms`);

  const memoryUsed = process.memoryUsage();
  console.log(`\nMemory usage: ${Math.floor(memoryUsed.heapUsed / 1024 / 1024)} MB`);

  return {
    insertTime,
    insertRate: Math.floor(pointCount / (insertTime / 1000)),
    queryTime,
    avgQueryTime: queryTime / queryCount,
    lodTime,
    memoryMB: Math.floor(memoryUsed.heapUsed / 1024 / 1024),
    stats,
  };
}

async function main() {
  console.log('=== Point Cloud Octree Benchmark ===');

  const results = [];

  results.push(benchmarkOctree(10000, 100));
  results.push(benchmarkOctree(100000, 1000));
  results.push(benchmarkOctree(1000000, 10000));

  console.log('\n=== Summary ===');
  for (let i = 0; i < results.length; i++) {
    console.log(`\nRun ${i + 1}:`);
    console.log(`  Insert rate: ${results[i].insertRate.toLocaleString()} points/sec`);
    console.log(`  Avg query: ${results[i].avgQueryTime.toFixed(2)}ms`);
    console.log(`  Memory: ${results[i].memoryMB} MB`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { benchmarkOctree, generateRandomPoints };

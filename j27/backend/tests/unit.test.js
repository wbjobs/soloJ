const LASParser = require('../src/parsers/LASParser');
const { Octree } = require('../src/octree');
const dracoCompressor = require('../src/compression/draco');

async function testOctree() {
  console.log('Testing Octree...');

  const bounds = {
    minX: 0, maxX: 100,
    minY: 0, maxY: 100,
    minZ: 0, maxZ: 100,
  };

  const octree = new Octree(bounds, {
    maxPointsPerNode: 100,
    maxDepth: 5,
  });

  const points = [];
  for (let i = 0; i < 10000; i++) {
    points.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 100,
      intensity: Math.floor(Math.random() * 256),
      rgb: {
        r: Math.floor(Math.random() * 65536),
        g: Math.floor(Math.random() * 65536),
        b: Math.floor(Math.random() * 65536),
      },
    });
  }

  octree.insertBatch(points);

  const stats = octree.getStats();
  console.log('Octree stats:', JSON.stringify(stats, null, 2));

  const queryBounds = {
    minX: 25, maxX: 75,
    minY: 25, maxY: 75,
    minZ: 25, maxZ: 75,
  };

  const queried = octree.query(queryBounds);
  console.log(`Queried points: ${queried.length}`);

  const lodNodes = octree.simplifyForLOD(2, 'uniform');
  let totalSimplified = 0;
  for (const node of lodNodes) {
    totalSimplified += node.points.length;
  }
  console.log(`LOD level 2 total points: ${totalSimplified}`);

  console.log('Octree test passed!');
  return true;
}

async function testDracoCompression() {
  console.log('\nTesting Draco compression...');

  const points = [];
  for (let i = 0; i < 1000; i++) {
    points.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 100,
      intensity: Math.floor(Math.random() * 256),
      rgb: {
        r: Math.floor(Math.random() * 65536),
        g: Math.floor(Math.random() * 65536),
        b: Math.floor(Math.random() * 65536),
      },
    });
  }

  const compressed = await dracoCompressor.compressPointCloud(points);
  console.log(`Compressed: ${compressed.originalSize} -> ${compressed.compressedSize} bytes`);
  console.log(`Compression ratio: ${compressed.compressionRatio.toFixed(2)}x`);
  console.log(`Has RGB: ${compressed.hasRGB}, Has intensity: ${compressed.hasIntensity}`);

  const decompressed = await dracoCompressor.decompressPointCloud(compressed.buffer);
  console.log(`Decompressed points: ${decompressed.pointCount}`);
  console.log(`Decompressed has RGB: ${decompressed.hasRGB}, Has intensity: ${decompressed.hasIntensity}`);

  if (decompressed.pointCount === points.length) {
    console.log('Draco compression test passed!');
    return true;
  } else {
    console.error('Point count mismatch after compression/decompression');
    return false;
  }
}

async function runAllTests() {
  console.log('=== Running Point Cloud Backend Tests ===\n');

  let passed = 0;
  let failed = 0;

  try {
    if (await testOctree()) passed++;
    else failed++;
  } catch (error) {
    console.error('Octree test failed:', error);
    failed++;
  }

  try {
    if (await testDracoCompression()) passed++;
    else failed++;
  } catch (error) {
    console.error('Draco compression test failed:', error);
    failed++;
  }

  console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runAllTests();
}

module.exports = { testOctree, testDracoCompression };

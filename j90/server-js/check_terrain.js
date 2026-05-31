const { World, BLOCK, CHUNK_SIZE } = require('./world');

const world = new World();

console.log('地形检查:');
for (let y = 0; y < 16; y++) {
  const b = world.getBlock(0, y, 0);
  console.log(`(0, ${y}, 0) = ${b} (${['AIR','GRASS','DIRT','STONE','WOOD','SAND'][b]})`);
}

console.log('\n找一个有方块的位置:');
for (let x = 0; x < 5; x++) {
  for (let z = 0; z < 5; z++) {
    for (let y = 14; y >= 0; y--) {
      const b = world.getBlock(x, y, z);
      if (b !== 0) {
        console.log(`  (${x},${y},${z}) = ${b} (${['AIR','GRASS','DIRT','STONE','WOOD','SAND'][b]})`);
        break;
      }
    }
  }
}

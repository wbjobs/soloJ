struct Particle {
  position: vec3<f32>,
  padding0: f32,
  velocity: vec3<f32>,
  padding1: f32,
  density: f32,
  pressure: f32,
  force: vec3<f32>,
  color: vec3<f32>,
};

struct HashParams {
  cellSize: f32,
  tableSize: i32,
  maxParticles: i32,
  padding: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> cellCount: array<i32>;
@group(0) @binding(2) var<storage, read_write> cellStart: array<i32>;
@group(0) @binding(3) var<storage, read_write> sortedIndices: array<i32>;
@group(0) @binding(4) var<uniform> hashParams: HashParams;

fn hashCell(cx: i32, cy: i32, cz: i32) -> i32 {
  var h: i32 = cx * 374761393 + cy * 668265263 + cz * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return abs(h % hashParams.tableSize);
}

@compute @workgroup_size(256)
fn clearCells(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx: u32 = gid.x;
  if (idx >= u32(hashParams.tableSize)) { return; }
  cellCount[idx] = 0;
  cellStart[idx] = -1;
}

@compute @workgroup_size(64)
fn countParticles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i: u32 = gid.x;
  let count: u32 = arrayLength(&particles);
  if (i >= count) { return; }

  let pos = particles[i].position;
  let cx = i32(floor(pos.x / hashParams.cellSize));
  let cy = i32(floor(pos.y / hashParams.cellSize));
  let cz = i32(floor(pos.z / hashParams.cellSize));

  let h = hashCell(cx, cy, cz);
  atomicAdd(&cellCount[h], 1);
}

@compute @workgroup_size(1)
fn computePrefixSum(@builtin(global_invocation_id) gid: vec3<u32>) {
  var sum: i32 = 0;
  for (var i: i32 = 0; i < hashParams.tableSize; i++) {
    cellStart[i] = sum;
    sum += cellCount[i];
  }
}

@compute @workgroup_size(64)
fn fillSortedIndices(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i: u32 = gid.x;
  let count: u32 = arrayLength(&particles);
  if (i >= count) { return; }

  let pos = particles[i].position;
  let cx = i32(floor(pos.x / hashParams.cellSize));
  let cy = i32(floor(pos.y / hashParams.cellSize));
  let cz = i32(floor(pos.z / hashParams.cellSize));

  let h = hashCell(cx, cy, cz);
  let offset = atomicAdd(&cellCount[h], 1);
  let writeIdx = cellStart[h] + offset;
  if (writeIdx >= 0 && writeIdx < hashParams.maxParticles) {
    sortedIndices[u32(writeIdx)] = i32(i);
  }
}
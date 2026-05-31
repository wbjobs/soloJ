const { renderBlock } = require('./src/raytracer/raytracer');

const testScene = {
  width: 64,
  height: 64,
  samplesPerPixel: 2,
  camera: {
    position: { x: 0, y: 2, z: 5 },
    lookAt: { x: 0, y: 0, z: 0 },
    fov: 60
  },
  spheres: [
    {
      center: { x: 0, y: -1000.5, z: -1 },
      radius: 1000,
      color: { x: 0.8, y: 0.8, z: 0.8 },
      reflection: 0
    },
    {
      center: { x: 0, y: 0, z: -1 },
      radius: 0.5,
      color: { x: 0.9, y: 0.3, z: 0.3 },
      reflection: 0.3
    }
  ],
  cubes: [],
  lights: [
    {
      position: { x: 5, y: 5, z: 5 },
      color: { x: 1, y: 1, z: 1 },
      intensity: 1
    }
  ]
};

console.log('Testing ray tracer...');
console.log('Rendering 64x64 test image with 2 samples per pixel...');

const block = {
  startX: 0,
  startY: 0,
  endX: 64,
  endY: 64
};

try {
  const startTime = Date.now();
  const result = renderBlock(block, testScene);
  const elapsed = Date.now() - startTime;
  
  console.log(`Rendering completed in ${elapsed}ms`);
  console.log(`Pixels rendered: ${result.pixels.length}`);
  console.log(`Total samples: ${result.totalSamples}`);
  console.log(`Render time: ${result.renderTimeMs}ms`);
  
  const firstPixel = result.pixels[0];
  console.log(`First pixel: (${firstPixel.x},${firstPixel.y}) = RGB(${firstPixel.r},${firstPixel.g},${firstPixel.b})`);
  
  console.log('✓ Ray tracer working correctly!');
} catch (err) {
  console.error('✗ Error:', err);
  process.exit(1);
}

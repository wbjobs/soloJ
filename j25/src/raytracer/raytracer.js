const { Vec3, mulberry32, hashSeed, randomInUnitSphere, reflect } = require('./vec3');

class Ray {
  constructor(origin, direction) {
    this.origin = origin;
    this.direction = direction.normalize();
  }

  at(t) {
    return this.origin.add(this.direction.mul(t));
  }
}

function hitSphere(center, radius, ray) {
  const oc = ray.origin.sub(center);
  const a = ray.direction.dot(ray.direction);
  const b = 2.0 * oc.dot(ray.direction);
  const c = oc.dot(oc) - radius * radius;
  const discriminant = b * b - 4 * a * c;
  
  if (discriminant < 0) return null;
  
  const t = (-b - Math.sqrt(discriminant)) / (2.0 * a);
  if (t > 0.001) {
    const hitPoint = ray.at(t);
    const normal = hitPoint.sub(center).normalize();
    return { t, point: hitPoint, normal };
  }
  return null;
}

function hitCube(min, max, ray) {
  let tmin = -Infinity;
  let tmax = Infinity;
  let normalMin = null;

  for (let i = 0; i < 3; i++) {
    const axis = ['x', 'y', 'z'][i];
    const invD = 1.0 / ray.direction[axis];
    let t0 = (min[axis] - ray.origin[axis]) * invD;
    let t1 = (max[axis] - ray.origin[axis]) * invD;

    let n0 = new Vec3(0, 0, 0);
    n0[axis] = -1;
    let n1 = new Vec3(0, 0, 0);
    n1[axis] = 1;

    if (invD < 0.0) {
      [t0, t1] = [t1, t0];
      [n0, n1] = [n1, n0];
    }

    if (t0 > tmin) {
      tmin = t0;
      normalMin = n0;
    }
    tmax = Math.min(tmax, t1);

    if (tmax <= tmin) return null;
  }

  if (tmin > 0.001) {
    const hitPoint = ray.at(tmin);
    return { t: tmin, point: hitPoint, normal: normalMin };
  }
  return null;
}

function traceRay(ray, scene, depth = 0, rng = Math.random) {
  if (depth > 5) return new Vec3(0, 0, 0);

  let closestHit = null;
  let closestObject = null;

  for (const sphere of scene.spheres || []) {
    const center = Vec3.fromObject(sphere.center);
    const hit = hitSphere(center, sphere.radius, ray);
    if (hit && (!closestHit || hit.t < closestHit.t)) {
      closestHit = hit;
      closestObject = { ...sphere, type: 'sphere', color: Vec3.fromObject(sphere.color) };
    }
  }

  for (const cube of scene.cubes || []) {
    const min = Vec3.fromObject(cube.min);
    const max = Vec3.fromObject(cube.max);
    const hit = hitCube(min, max, ray);
    if (hit && (!closestHit || hit.t < closestHit.t)) {
      closestHit = hit;
      closestObject = { ...cube, type: 'cube', color: Vec3.fromObject(cube.color) };
    }
  }

  if (!closestHit) {
    const t = 0.5 * (ray.direction.y + 1.0);
    return new Vec3(1.0, 1.0, 1.0).mul(1.0 - t).add(new Vec3(0.5, 0.7, 1.0).mul(t));
  }

  let ambient = new Vec3(0.1, 0.1, 0.1);
  let diffuse = new Vec3(0, 0, 0);
  let specular = new Vec3(0, 0, 0);

  for (const light of scene.lights || []) {
    const lightPos = Vec3.fromObject(light.position);
    const lightColor = Vec3.fromObject(light.color);
    const lightDir = lightPos.sub(closestHit.point).normalize();
    const distance = lightPos.sub(closestHit.point).length();
    const attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * distance * distance);

    const shadowRay = new Ray(closestHit.point.add(closestHit.normal.mul(0.001)), lightDir);
    let inShadow = false;

    for (const sphere of scene.spheres || []) {
      const center = Vec3.fromObject(sphere.center);
      const hit = hitSphere(center, sphere.radius, shadowRay);
      if (hit && hit.t < distance) {
        inShadow = true;
        break;
      }
    }
    if (!inShadow) {
      for (const cube of scene.cubes || []) {
        const min = Vec3.fromObject(cube.min);
        const max = Vec3.fromObject(cube.max);
        const hit = hitCube(min, max, shadowRay);
        if (hit && hit.t < distance) {
          inShadow = true;
          break;
        }
      }
    }

    if (!inShadow) {
      const diff = Math.max(0, closestHit.normal.dot(lightDir));
      diffuse = diffuse.add(lightColor.mul(diff * light.intensity * attenuation));

      const viewDir = ray.direction.negate().normalize();
      const reflectDir = reflect(lightDir.negate(), closestHit.normal).normalize();
      const spec = Math.pow(Math.max(0, viewDir.dot(reflectDir)), 32);
      specular = specular.add(lightColor.mul(spec * 0.5 * light.intensity * attenuation));
    }
  }

  let color = closestObject.color.mul(ambient.add(diffuse)).add(specular);

  if (closestObject.reflection > 0 && depth < 3) {
    const reflectDir = reflect(ray.direction, closestHit.normal).normalize();
    const reflectedRay = new Ray(closestHit.point.add(closestHit.normal.mul(0.001)), reflectDir);
    const reflectedColor = traceRay(reflectedRay, scene, depth + 1, rng);
    color = color.mul(1 - closestObject.reflection).add(reflectedColor.mul(closestObject.reflection));
  }

  return color;
}

function renderPixel(x, y, scene, forward, right, up, halfWidth, halfHeight, numSamples, sampleOffset = 0) {
  const width = scene.width;
  const height = scene.height;
  const camPos = Vec3.fromObject(scene.camera.position);
  const lookAt = Vec3.fromObject(scene.camera.lookAt);
  
  let color = new Vec3(0, 0, 0);
  
  for (let s = 0; s < numSamples; s++) {
    const globalSample = sampleOffset + s;
    const seed = hashSeed(x, y, globalSample);
    const rng = mulberry32(seed);
    const u = (x + rng()) / width;
    const v = 1 - (y + rng()) / height;

    const dir = forward
      .add(right.mul((u - 0.5) * 2 * halfWidth))
      .add(up.mul((v - 0.5) * 2 * halfHeight))
      .normalize();

    const ray = new Ray(camPos, dir);
    const sampleColor = traceRay(ray, scene, 0, rng);
    color = color.add(sampleColor);
  }
  
  return color.div(numSamples);
}

function computeContrastMap(colors, x, y, width, height) {
  const centerIdx = y * width + x;
  const center = colors[centerIdx];
  
  let maxDiff = 0;
  
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      
      const neighborIdx = ny * width + nx;
      const neighbor = colors[neighborIdx];
      
      const diffR = Math.abs(center.x - neighbor.x) + Math.abs(center.y - neighbor.y) + Math.abs(center.z - neighbor.z);
      maxDiff = Math.max(maxDiff, diffR);
    }
  }
  
  return maxDiff;
}

function renderPreview(scene, onProgress) {
  const width = scene.width;
  const height = scene.height;
  const totalPixels = width * height;
  const initialSamples = scene.initialSamples || 2;
  const maxSamples = scene.maxSamples || 16;
  const totalSampleBudget = totalPixels * (scene.samplesPerPixel || 4);
  
  const camera = scene.camera;
  const camPos = Vec3.fromObject(camera.position);
  const lookAt = Vec3.fromObject(camera.lookAt);
  const fov = camera.fov || 60;

  const aspect = width / height;
  const fovRad = (fov * Math.PI) / 180;
  const halfHeight = Math.tan(fovRad / 2);
  const halfWidth = aspect * halfHeight;

  const forward = lookAt.sub(camPos).normalize();
  const right = new Vec3(0, 1, 0).cross(forward).normalize();
  const up = forward.cross(right).normalize();
  
  const pixelColors = new Array(totalPixels);
  const pixelSampleCounts = new Array(totalPixels).fill(initialSamples);
  let totalSamplesUsed = 0;
  const startTime = Date.now();
  
  console.log(`Phase 1: Initial render with ${initialSamples} spp...`);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      pixelColors[idx] = renderPixel(x, y, scene, forward, right, up, halfWidth, halfHeight, initialSamples, 0);
      totalSamplesUsed += initialSamples;
    }
    if (onProgress) {
      onProgress((y / height) * 50);
    }
  }
  
  console.log('Phase 2: Contrast detection and adaptive sampling...');
  console.log(`Samples used so far: ${totalSamplesUsed} / ${totalSampleBudget}`);
  
  const contrastMap = new Array(totalPixels);
  const pixelImportance = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const contrast = computeContrastMap(pixelColors, x, y, width, height);
      contrastMap[idx] = contrast;
      pixelImportance.push({ x, y, idx, contrast });
    }
  }
  
  pixelImportance.sort((a, b) => b.contrast - a.contrast);
  
  const remainingBudget = totalSampleBudget - totalSamplesUsed;
  const adaptiveSamplesPerPixel = Math.floor(remainingBudget / totalPixels);
  
  console.log(`Remaining budget: ${remainingBudget} samples`);
  console.log(`Adaptive samples per pixel: ${adaptiveSamplesPerPixel}`);
  
  let adaptivePixelCount = 0;
  
  for (let i = 0; i < totalPixels; i++) {
    if (totalSamplesUsed >= totalSampleBudget) break;
    
    const item = pixelImportance[i];
    const contrast = item.contrast;
    
    if (contrast < 0.05) continue;
    
    const extraSamples = Math.min(
      maxSamples - initialSamples,
      Math.floor(contrast * 200),
      totalSampleBudget - totalSamplesUsed
    );
    
    if (extraSamples > 0) {
      const additionalColor = renderPixel(
        item.x, item.y, scene, forward, right, up, halfWidth, halfHeight,
        extraSamples, initialSamples
      );
      
      const currentCount = pixelSampleCounts[item.idx];
      const newCount = currentCount + extraSamples;
      pixelColors[item.idx] = pixelColors[item.idx]
        .mul(currentCount)
        .add(additionalColor.mul(extraSamples))
        .div(newCount);
      pixelSampleCounts[item.idx] = newCount;
      totalSamplesUsed += extraSamples;
      adaptivePixelCount++;
    }
    
    if (onProgress && i % 100 === 0) {
      onProgress(50 + (i / totalPixels) * 50);
    }
  }
  
  console.log(`Adaptive sampling complete: ${adaptivePixelCount} pixels got extra samples`);
  console.log(`Total samples used: ${totalSamplesUsed}`);
  
  const pixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const color = pixelColors[idx];
      const samples = pixelSampleCounts[idx];
      
      const r = Math.min(255, Math.max(0, Math.pow(color.x, 0.45) * 255));
      const g = Math.min(255, Math.max(0, Math.pow(color.y, 0.45) * 255));
      const b = Math.min(255, Math.max(0, Math.pow(color.z, 0.45) * 255));
      
      pixels.push({
        x, y,
        r: Math.round(r),
        g: Math.round(g),
        b: Math.round(b),
        samples
      });
    }
  }
  
  const renderTimeMs = Date.now() - startTime;
  
  return { pixels, renderTimeMs, totalSamples: totalSamplesUsed };
}

function renderLowResPreview(scene, targetSize = 64) {
  const origWidth = scene.width;
  const origHeight = scene.height;
  const scale = Math.min(targetSize / origWidth, targetSize / origHeight);
  const previewWidth = Math.floor(origWidth * scale);
  const previewHeight = Math.floor(origHeight * scale);
  
  const lowResScene = {
    ...scene,
    width: previewWidth,
    height: previewHeight,
    samplesPerPixel: 1
  };
  
  const result = renderBlock(
    { startX: 0, startY: 0, endX: previewWidth, endY: previewHeight },
    lowResScene
  );
  
  return {
    ...result,
    previewWidth,
    previewHeight,
    origWidth,
    origHeight
  };
}

function renderBlock(block, scene, onProgress) {
  const pixels = [];
  const width = scene.width;
  const height = scene.height;
  const samplesPerPixel = scene.samplesPerPixel || 4;

  const camera = scene.camera;
  const camPos = Vec3.fromObject(camera.position);
  const lookAt = Vec3.fromObject(camera.lookAt);
  const fov = camera.fov || 60;

  const aspect = width / height;
  const fovRad = (fov * Math.PI) / 180;
  const halfHeight = Math.tan(fovRad / 2);
  const halfWidth = aspect * halfHeight;

  const forward = lookAt.sub(camPos).normalize();
  const right = new Vec3(0, 1, 0).cross(forward).normalize();
  const up = forward.cross(right).normalize();

  let totalSamples = 0;
  const startTime = Date.now();

  for (let y = block.startY; y < block.endY; y++) {
    for (let x = block.startX; x < block.endX; x++) {
      let color = new Vec3(0, 0, 0);
      let pixelSamples = 0;

      for (let s = 0; s < samplesPerPixel; s++) {
        const seed = hashSeed(x, y, s);
        const rng = mulberry32(seed);
        const u = (x + rng()) / width;
        const v = 1 - (y + rng()) / height;

        const dir = forward
          .add(right.mul((u - 0.5) * 2 * halfWidth))
          .add(up.mul((v - 0.5) * 2 * halfHeight))
          .normalize();

        const ray = new Ray(camPos, dir);
        const sampleColor = traceRay(ray, scene, 0, rng);
        color = color.add(sampleColor);
        pixelSamples++;
        totalSamples++;
      }

      color = color.div(samplesPerPixel);
      const r = Math.min(255, Math.max(0, Math.pow(color.x, 0.45) * 255));
      const g = Math.min(255, Math.max(0, Math.pow(color.y, 0.45) * 255));
      const b = Math.min(255, Math.max(0, Math.pow(color.z, 0.45) * 255));

      pixels.push({
        x,
        y,
        r: Math.round(r),
        g: Math.round(g),
        b: Math.round(b),
        samples: pixelSamples
      });
    }
    if (onProgress) {
      const progress = ((y - block.startY) / (block.endY - block.startY)) * 100;
      onProgress(progress);
    }
  }

  const renderTimeMs = Date.now() - startTime;
  return { pixels, renderTimeMs, totalSamples };
}

module.exports = { renderBlock, renderPreview, renderLowResPreview, Ray, traceRay, hitSphere, hitCube };

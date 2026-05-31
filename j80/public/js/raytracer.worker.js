class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  
  add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  mul(s) { return new Vec3(this.x * s, this.y * s, this.z * s); }
  mulVec(v) { return new Vec3(this.x * v.x, this.y * v.y, this.z * v.z); }
  div(s) { return new Vec3(this.x / s, this.y / s, this.z / s); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) { return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); }
  length() { return Math.sqrt(this.dot(this)); }
  normalize() { const len = this.length(); return len > 0 ? this.mul(1 / len) : new Vec3(); }
  clone() { return new Vec3(this.x, this.y, this.z); }
  neg() { return new Vec3(-this.x, -this.y, -this.z); }
}

function random() { return Math.random(); }
function randomRange(min, max) { return min + random() * (max - min); }

function randomInUnitSphere() {
  while (true) {
    const p = new Vec3(randomRange(-1, 1), randomRange(-1, 1), randomRange(-1, 1));
    if (p.dot(p) < 1) return p;
  }
}

function randomUnitVector() {
  return randomInUnitSphere().normalize();
}

function randomInHemisphere(normal) {
  const inSphere = randomUnitVector();
  return inSphere.dot(normal) > 0 ? inSphere : inSphere.neg();
}

function reflect(v, n) {
  return v.sub(n.mul(2 * v.dot(n)));
}

function refract(uv, n, etaiOverEtat) {
  const cosTheta = Math.min(uv.neg().dot(n), 1);
  const rOutPerp = uv.add(n.mul(cosTheta)).mul(etaiOverEtat);
  const rOutParallel = n.mul(-Math.sqrt(Math.abs(1 - rOutPerp.dot(rOutPerp))));
  return rOutPerp.add(rOutParallel);
}

function reflectance(cosine, refIdx) {
  let r0 = (1 - refIdx) / (1 + refIdx);
  r0 = r0 * r0;
  return r0 + (1 - r0) * Math.pow(1 - cosine, 5);
}

class Ray {
  constructor(origin, direction) {
    this.origin = origin;
    this.direction = direction;
  }
  
  at(t) {
    return this.origin.add(this.direction.mul(t));
  }
}

class HitRecord {
  constructor() {
    this.p = null;
    this.normal = null;
    this.t = 0;
    this.frontFace = false;
    this.material = null;
  }
  
  setFaceNormal(ray, outwardNormal) {
    this.frontFace = ray.direction.dot(outwardNormal) < 0;
    this.normal = this.frontFace ? outwardNormal : outwardNormal.neg();
  }
}

class Sphere {
  constructor(center, radius, material) {
    this.center = center;
    this.radius = radius;
    this.material = material;
  }
  
  hit(ray, tMin, tMax, rec) {
    const oc = ray.origin.sub(this.center);
    const a = ray.direction.dot(ray.direction);
    const halfB = oc.dot(ray.direction);
    const c = oc.dot(oc) - this.radius * this.radius;
    const discriminant = halfB * halfB - a * c;
    
    if (discriminant < 0) return false;
    
    const sqrtd = Math.sqrt(discriminant);
    let root = (-halfB - sqrtd) / a;
    if (root <= tMin || root >= tMax) {
      root = (-halfB + sqrtd) / a;
      if (root <= tMin || root >= tMax) return false;
    }
    
    rec.t = root;
    rec.p = ray.at(rec.t);
    const outwardNormal = rec.p.sub(this.center).div(this.radius);
    rec.setFaceNormal(ray, outwardNormal);
    rec.material = this.material;
    
    return true;
  }
}

class Plane {
  constructor(point, normal, material) {
    this.point = point;
    this.normal = normal.normalize();
    this.material = material;
  }
  
  hit(ray, tMin, tMax, rec) {
    const denom = this.normal.dot(ray.direction);
    if (Math.abs(denom) < 1e-6) return false;
    
    const t = this.normal.dot(this.point.sub(ray.origin)) / denom;
    if (t <= tMin || t >= tMax) return false;
    
    rec.t = t;
    rec.p = ray.at(t);
    rec.setFaceNormal(ray, this.normal);
    rec.material = this.material;
    
    return true;
  }
}

class Lambertian {
  constructor(color) {
    this.albedo = color;
  }
  
  scatter(ray, rec) {
    let scatterDir = rec.normal.add(randomUnitVector());
    if (scatterDir.length() < 1e-8) scatterDir = rec.normal;
    
    return {
      scattered: new Ray(rec.p, scatterDir),
      attenuation: this.albedo,
      emitted: new Vec3(0, 0, 0)
    };
  }
}

class Metal {
  constructor(color, fuzz = 0) {
    this.albedo = color;
    this.fuzz = Math.min(fuzz, 1);
  }
  
  scatter(ray, rec) {
    const reflected = reflect(ray.direction.normalize(), rec.normal);
    const scattered = new Ray(rec.p, reflected.add(randomInUnitSphere().mul(this.fuzz)));
    
    if (scattered.direction.dot(rec.normal) <= 0) return null;
    
    return {
      scattered,
      attenuation: this.albedo,
      emitted: new Vec3(0, 0, 0)
    };
  }
}

class Dielectric {
  constructor(ir) {
    this.ir = ir;
  }
  
  scatter(ray, rec) {
    const attenuation = new Vec3(1, 1, 1);
    const refractionRatio = rec.frontFace ? (1 / this.ir) : this.ir;
    
    const unitDir = ray.direction.normalize();
    const cosTheta = Math.min(unitDir.neg().dot(rec.normal), 1);
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    
    const cannotRefract = refractionRatio * sinTheta > 1;
    let direction;
    
    if (cannotRefract || reflectance(cosTheta, refractionRatio) > random()) {
      direction = reflect(unitDir, rec.normal);
    } else {
      direction = refract(unitDir, rec.normal, refractionRatio);
    }
    
    return {
      scattered: new Ray(rec.p, direction),
      attenuation,
      emitted: new Vec3(0, 0, 0)
    };
  }
}

class DiffuseLight {
  constructor(color) {
    this.emit = color;
  }
  
  scatter() {
    return null;
  }
  
  emitted() {
    return this.emit;
  }
}

class Scene {
  constructor() {
    this.objects = [];
  }
  
  add(obj) {
    this.objects.push(obj);
  }
  
  clear() {
    this.objects = [];
  }
  
  hit(ray, tMin, tMax, rec) {
    let hitAnything = false;
    let closestSoFar = tMax;
    const tempRec = new HitRecord();
    
    for (const obj of this.objects) {
      if (obj.hit(ray, tMin, closestSoFar, tempRec)) {
        hitAnything = true;
        closestSoFar = tempRec.t;
        Object.assign(rec, tempRec);
      }
    }
    
    return hitAnything;
  }
}

class Camera {
  constructor(lookfrom, lookat, vup, vfov, aspectRatio) {
    const theta = vfov * Math.PI / 180;
    const h = Math.tan(theta / 2);
    const viewportHeight = 2 * h;
    const viewportWidth = aspectRatio * viewportHeight;
    
    const w = lookfrom.sub(lookat).normalize();
    const u = vup.cross(w).normalize();
    const v = w.cross(u);
    
    this.origin = lookfrom.clone();
    this.horizontal = u.mul(viewportWidth);
    this.vertical = v.mul(viewportHeight);
    this.lowerLeftCorner = this.origin
      .sub(this.horizontal.div(2))
      .sub(this.vertical.div(2))
      .sub(w);
  }
  
  getRay(s, t) {
    return new Ray(
      this.origin,
      this.lowerLeftCorner
        .add(this.horizontal.mul(s))
        .add(this.vertical.mul(t))
        .sub(this.origin)
    );
  }
}

function createCornellBox() {
  const scene = new Scene();
  
  const red = new Lambertian(new Vec3(0.65, 0.05, 0.05));
  const white = new Lambertian(new Vec3(0.73, 0.73, 0.73));
  const green = new Lambertian(new Vec3(0.12, 0.45, 0.15));
  const light = new DiffuseLight(new Vec3(15, 15, 15));
  
  scene.add(new Plane(new Vec3(-1, 0, 0), new Vec3(1, 0, 0), red));
  scene.add(new Plane(new Vec3(1, 0, 0), new Vec3(-1, 0, 0), green));
  scene.add(new Plane(new Vec3(0, 0, 0), new Vec3(0, 1, 0), white));
  scene.add(new Plane(new Vec3(0, 1, 0), new Vec3(0, -1, 0), white));
  scene.add(new Plane(new Vec3(0, 0, -1), new Vec3(0, 0, 1), white));
  
  scene.add(new Plane(new Vec3(0, 0.99, -0.5), new Vec3(0, -1, 0), light));
  
  const aluminum = new Metal(new Vec3(0.8, 0.85, 0.88), 0.0);
  const glass = new Dielectric(1.5);
  
  scene.add(new Sphere(new Vec3(-0.4, 0.3, -0.3), 0.3, aluminum));
  scene.add(new Sphere(new Vec3(0.4, 0.3, -0.6), 0.3, glass));
  
  return scene;
}

function createSphereScene() {
  const scene = new Scene();
  
  const ground = new Lambertian(new Vec3(0.5, 0.5, 0.5));
  scene.add(new Sphere(new Vec3(0, -1000, 0), 1000, ground));
  
  for (let a = -3; a < 3; a++) {
    for (let b = -3; b < 3; b++) {
      const chooseMat = random();
      const center = new Vec3(a + 0.9 * random(), 0.2, b + 0.9 * random());
      
      if (center.sub(new Vec3(4, 0.2, 0)).length() > 0.9) {
        if (chooseMat < 0.8) {
          const albedo = new Vec3(random() * random(), random() * random(), random() * random());
          scene.add(new Sphere(center, 0.2, new Lambertian(albedo)));
        } else if (chooseMat < 0.95) {
          const albedo = new Vec3(randomRange(0.5, 1), randomRange(0.5, 1), randomRange(0.5, 1));
          scene.add(new Sphere(center, 0.2, new Metal(albedo, randomRange(0, 0.5))));
        } else {
          scene.add(new Sphere(center, 0.2, new Dielectric(1.5)));
        }
      }
    }
  }
  
  scene.add(new Sphere(new Vec3(0, 1, 0), 1, new Dielectric(1.5)));
  scene.add(new Sphere(new Vec3(-4, 1, 0), 1, new Lambertian(new Vec3(0.4, 0.2, 0.1))));
  scene.add(new Sphere(new Vec3(4, 1, 0), 1, new Metal(new Vec3(0.7, 0.6, 0.5), 0)));
  
  const light = new DiffuseLight(new Vec3(10, 10, 10));
  scene.add(new Sphere(new Vec3(0, 5, 0), 1, light));
  
  return scene;
}

function rayColor(ray, scene, depth, maxDepth, background) {
  const rec = new HitRecord();
  
  if (depth <= 0) {
    return new Vec3(0, 0, 0);
  }
  
  if (!scene.hit(ray, 0.001, Infinity, rec)) {
    return background;
  }
  
  if (rec.material.emitted) {
    return rec.material.emitted();
  }
  
  const scatterResult = rec.material.scatter(ray, rec);
  if (!scatterResult) {
    return new Vec3(0, 0, 0);
  }
  
  const incoming = rayColor(scatterResult.scattered, scene, depth - 1, maxDepth, background);
  return scatterResult.emitted.add(scatterResult.attenuation.mulVec(incoming));
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function linearToGamma(linear) {
  return linear > 0 ? Math.sqrt(linear) : 0;
}

let currentTile = null;
let isCancelled = false;
let heartbeatInterval = null;
let lastProgress = 0;

function startHeartbeat(tileId) {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    self.postMessage({
      type: 'workerHeartbeat',
      tileId,
      progress: lastProgress
    });
  }, 15000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function renderTile(tileData) {
  return new Promise((resolve, reject) => {
    const { tileId, x, y, width, height, scene: sceneConfig, renderParams } = tileData;
    const { width: fullWidth, height: fullHeight, samplesPerPixel, maxBounces } = renderParams;
    
    const aspectRatio = fullWidth / fullHeight;
    const camEye = new Vec3(...sceneConfig.camera.eye);
    const camLookAt = new Vec3(...sceneConfig.camera.lookAt);
    const camera = new Camera(camEye, camLookAt, new Vec3(0, 1, 0), sceneConfig.camera.fov, aspectRatio);
    
    const scene = sceneConfig.type === 'cornell' ? createCornellBox() : createSphereScene();
    
    const pixelData = new Uint8ClampedArray(width * height * 4);
    const background = new Vec3(0, 0, 0);
    
    let processed = 0;
    const totalPixels = width * height;
    
    startHeartbeat(tileId);
    
    function processNextChunk() {
      if (isCancelled) {
        stopHeartbeat();
        reject(new Error('Cancelled'));
        return;
      }
      
      const chunkSize = 200;
      let count = 0;
      
      while (count < chunkSize && processed < totalPixels) {
        const py = Math.floor(processed / width);
        const px = processed % width;
        
        let color = new Vec3(0, 0, 0);
        
        for (let s = 0; s < samplesPerPixel; s++) {
          const u = (x + px + random()) / (fullWidth - 1);
          const v = (y + height - 1 - py + random()) / (fullHeight - 1);
          
          const ray = camera.getRay(u, v);
          color = color.add(rayColor(ray, scene, maxBounces, maxBounces, background));
        }
        
        color = color.div(samplesPerPixel);
        
        const r = Math.floor(256 * clamp(linearToGamma(color.x), 0, 0.999));
        const g = Math.floor(256 * clamp(linearToGamma(color.y), 0, 0.999));
        const b = Math.floor(256 * clamp(linearToGamma(color.z), 0, 0.999));
        
        const idx = (py * width + px) * 4;
        pixelData[idx] = r;
        pixelData[idx + 1] = g;
        pixelData[idx + 2] = b;
        pixelData[idx + 3] = 255;
        
        processed++;
        count++;
      }
      
      if (processed >= totalPixels) {
        stopHeartbeat();
        resolve(Array.from(pixelData));
      } else {
        const progress = Math.floor((processed / totalPixels) * 100);
        lastProgress = progress;
        self.postMessage({
          type: 'progress',
          tileId,
          progress
        });
        setTimeout(processNextChunk, 0);
      }
    }
    
    processNextChunk();
  });
}

self.onmessage = async (e) => {
  const { type, data } = e.data;
  
  if (type === 'render') {
    isCancelled = false;
    currentTile = data;
    
    try {
      const startTime = Date.now();
      const pixelData = await renderTile(data);
      const renderTime = Date.now() - startTime;
      
      self.postMessage({
        type: 'complete',
        tileId: data.tileId,
        pixelData,
        renderTime
      });
    } catch (err) {
      if (err.message !== 'Cancelled') {
        self.postMessage({
          type: 'error',
          tileId: data.tileId,
          error: err.message
        });
      }
    }
  } else if (type === 'cancel') {
    isCancelled = true;
  } else if (type === 'ping') {
    self.postMessage({
      type: 'pong',
      tileId: currentTile ? currentTile.tileId : null
    });
  }
};

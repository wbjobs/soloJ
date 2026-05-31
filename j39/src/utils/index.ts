export { VTKExporter } from './vtkExporter';
export type {
  Vector3 as VTKVector3,
  ScalarField,
  GridData,
  TimeStepData,
  ExportOptions,
  ExportFormat,
} from './vtkExporter';

export * from './math';
import { lerp, clamp } from './math';

export function invLerp(a: number, b: number, value: number): number {
  return (value - a) / (b - a);
}

export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return lerp(outMin, outMax, invLerp(inMin, inMax, value));
}

export function magnitude(x: number, y: number, z: number = 0): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export function normalize(x: number, y: number, z: number = 0): [number, number, number] {
  const mag = magnitude(x, y, z);
  if (mag === 0) return [0, 0, 0];
  return [x / mag, y / mag, z / mag];
}

export class ColorMap {
  private stops: { position: number; color: [number, number, number] }[] = [];

  constructor(colormap: 'viridis' | 'plasma' | 'rainbow' | 'coolwarm' = 'viridis') {
    this.initializeColormap(colormap);
  }

  private initializeColormap(name: string): void {
    switch (name) {
      case 'viridis':
        this.stops = [
          { position: 0.0, color: [68, 1, 84] },
          { position: 0.25, color: [59, 82, 139] },
          { position: 0.5, color: [33, 145, 140] },
          { position: 0.75, color: [94, 201, 98] },
          { position: 1.0, color: [253, 231, 37] },
        ];
        break;
      case 'plasma':
        this.stops = [
          { position: 0.0, color: [13, 8, 135] },
          { position: 0.25, color: [84, 2, 163] },
          { position: 0.5, color: [160, 54, 135] },
          { position: 0.75, color: [229, 115, 70] },
          { position: 1.0, color: [240, 249, 33] },
        ];
        break;
      case 'rainbow':
        this.stops = [
          { position: 0.0, color: [255, 0, 0] },
          { position: 0.17, color: [255, 127, 0] },
          { position: 0.33, color: [255, 255, 0] },
          { position: 0.5, color: [0, 255, 0] },
          { position: 0.67, color: [0, 255, 255] },
          { position: 0.83, color: [0, 0, 255] },
          { position: 1.0, color: [148, 0, 211] },
        ];
        break;
      case 'coolwarm':
        this.stops = [
          { position: 0.0, color: [59, 76, 192] },
          { position: 0.5, color: [221, 221, 221] },
          { position: 1.0, color: [180, 4, 38] },
        ];
        break;
    }
  }

  getColor(t: number): [number, number, number] {
    const clampedT = clamp(t, 0, 1);

    for (let i = 0; i < this.stops.length - 1; i++) {
      const curr = this.stops[i];
      const next = this.stops[i + 1];

      if (clampedT >= curr.position && clampedT <= next.position) {
        const localT = invLerp(curr.position, next.position, clampedT);
        return [
          lerp(curr.color[0], next.color[0], localT),
          lerp(curr.color[1], next.color[1], localT),
          lerp(curr.color[2], next.color[2], localT),
        ];
      }
    }

    return this.stops[this.stops.length - 1].color;
  }

  getColorHex(t: number): string {
    const [r, g, b] = this.getColor(t);
    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
  }
}

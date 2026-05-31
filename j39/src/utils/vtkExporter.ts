export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ScalarField {
  name: string;
  data: Float32Array | Float64Array | number[];
  type?: 'scalar' | 'vector' | 'color';
}

export interface GridData {
  dimensions: [number, number, number];
  origin: Vector3;
  spacing: Vector3;
  velocity?: {
    u: Float32Array | Float64Array | number[];
    v: Float32Array | Float64Array | number[];
    w: Float32Array | Float64Array | number[];
  };
  pressure?: Float32Array | Float64Array | number[];
  density?: Float32Array | Float64Array | number[];
  vorticity?: {
    x: Float32Array | Float64Array | number[];
    y: Float32Array | Float64Array | number[];
    z: Float32Array | Float64Array | number[];
  };
  customScalars?: ScalarField[];
}

export interface TimeStepData extends GridData {
  time: number;
  step: number;
}

export interface ExportOptions {
  filename?: string;
  includeVelocity?: boolean;
  includePressure?: boolean;
  includeDensity?: boolean;
  includeVorticity?: boolean;
  customScalars?: string[];
}

export type ExportFormat = 'vtk';

class VTKExporter {
  private static worker: Worker | null = null;
  private static workerUrl: string | null = null;
  private static pendingRequests: Map<number, { resolve: (value: Blob) => void; reject: (reason: Error) => void }> = new Map();
  private static requestId = 0;

  private static initWorker(): void {
    if (this.worker) return;

    const workerCode = `
      self.onmessage = function(e) {
        const { id, type, data } = e.data;
        try {
          let result;
          if (type === 'single') {
            result = exportSingleTimeStep(data.grid, data.options);
          } else if (type === 'multiple') {
            result = exportMultipleTimeSteps(data.timesteps, data.options);
          }
          self.postMessage({ id, success: true, result }, [result.buffer]);
        } catch (error) {
          self.postMessage({ id, success: false, error: error.message });
        }
      };

      function exportSingleTimeStep(grid, options) {
        const content = generateVTKContent(grid, options);
        return new TextEncoder().encode(content);
      }

      function exportMultipleTimeSteps(timesteps, options) {
        const parts = [];
        const header = '# vtk DataFile Version 3.0\\nMultiple Time Steps\\nASCII\\nDATASET STRUCTURED_POINTS\\n';
        parts.push(header);

        timesteps.forEach((ts, index) => {
          parts.push(\`# TIME_STEP \${index} \${ts.time}\\n\`);
          const dims = ts.dimensions;
          parts.push(\`DIMENSIONS \${dims[0]} \${dims[1]} \${dims[2]}\\n\`);
          parts.push(\`ORIGIN \${ts.origin.x} \${ts.origin.y} \${ts.origin.z}\\n\`);
          parts.push(\`SPACING \${ts.spacing.x} \${ts.spacing.y} \${ts.spacing.z}\\n\`);
          parts.push(generatePointDataContent(ts, options));
        });

        const content = parts.join('');
        return new TextEncoder().encode(content);
      }

      function generateVTKContent(grid, options) {
        const parts = [];
        parts.push('# vtk DataFile Version 3.0');
        parts.push('CFD Simulation Data');
        parts.push('ASCII');
        parts.push('DATASET STRUCTURED_POINTS');

        const dims = grid.dimensions;
        parts.push(\`DIMENSIONS \${dims[0]} \${dims[1]} \${dims[2]}\`);
        parts.push(\`ORIGIN \${grid.origin.x} \${grid.origin.y} \${grid.origin.z}\`);
        parts.push(\`SPACING \${grid.spacing.x} \${grid.spacing.y} \${grid.spacing.z}\`);
        parts.push(generatePointDataContent(grid, options));

        return parts.join('\\n');
      }

      function generatePointDataContent(grid, options) {
        const parts = [];
        const dims = grid.dimensions;
        const numPoints = dims[0] * dims[1] * dims[2];

        parts.push(\`POINT_DATA \${numPoints}\`);

        if (options.includeVelocity && grid.velocity) {
          parts.push('VECTORS velocity float');
          const { u, v, w } = grid.velocity;
          for (let i = 0; i < numPoints; i++) {
            parts.push(\`\${u[i]} \${v[i]} \${w[i]}\`);
          }
        }

        if (options.includePressure && grid.pressure) {
          parts.push('SCALARS pressure float 1');
          parts.push('LOOKUP_TABLE default');
          for (let i = 0; i < numPoints; i++) {
            parts.push(\`\${grid.pressure[i]}\`);
          }
        }

        if (options.includeDensity && grid.density) {
          parts.push('SCALARS density float 1');
          parts.push('LOOKUP_TABLE default');
          for (let i = 0; i < numPoints; i++) {
            parts.push(\`\${grid.density[i]}\`);
          }
        }

        if (options.includeVorticity && grid.vorticity) {
          parts.push('VECTORS vorticity float');
          const { x, y, z } = grid.vorticity;
          for (let i = 0; i < numPoints; i++) {
            parts.push(\`\${x[i]} \${y[i]} \${z[i]}\`);
          }

          const vorticityMag = new Float32Array(numPoints);
          for (let i = 0; i < numPoints; i++) {
            const vx = x[i], vy = y[i], vz = z[i];
            vorticityMag[i] = Math.sqrt(vx * vx + vy * vy + vz * vz);
          }
          parts.push('SCALARS vorticity_magnitude float 1');
          parts.push('LOOKUP_TABLE default');
          for (let i = 0; i < numPoints; i++) {
            parts.push(\`\${vorticityMag[i]}\`);
          }
        }

        if (grid.customScalars && options.customScalars) {
          grid.customScalars.forEach(scalar => {
            if (options.customScalars.includes(scalar.name)) {
              if (scalar.type === 'color') {
                parts.push(\`SCALARS \${scalar.name} unsigned_char 3\`);
                parts.push('LOOKUP_TABLE default');
                for (let i = 0; i < numPoints; i++) {
                  const idx = i * 3;
                  parts.push(\`\${scalar.data[idx]} \${scalar.data[idx + 1]} \${scalar.data[idx + 2]}\`);
                }
              } else if (scalar.type === 'vector') {
                parts.push(\`VECTORS \${scalar.name} float\`);
                for (let i = 0; i < numPoints; i++) {
                  const idx = i * 3;
                  parts.push(\`\${scalar.data[idx]} \${scalar.data[idx + 1]} \${scalar.data[idx + 2]}\`);
                }
              } else {
                parts.push(\`SCALARS \${scalar.name} float 1\`);
                parts.push('LOOKUP_TABLE default');
                for (let i = 0; i < numPoints; i++) {
                  parts.push(\`\${scalar.data[i]}\`);
                }
              }
            }
          });
        }

        return parts.join('\\n');
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.workerUrl = URL.createObjectURL(blob);
    this.worker = new Worker(this.workerUrl);

    this.worker.onmessage = (e) => {
      const { id, success, result, error } = e.data;
      const request = this.pendingRequests?.get(id);
      if (request) {
        if (success) {
          request.resolve(new Blob([result], { type: 'application/octet-stream' }));
        } else {
          request.reject(new Error(error));
        }
        this.pendingRequests?.delete(id);
      }
    };
  }

  static async export(grid: GridData, options: ExportOptions = {}): Promise<Blob> {
    this.initWorker();
    const id = this.requestId++;

    const defaultOptions: Required<ExportOptions> = {
      filename: 'output.vtk',
      includeVelocity: true,
      includePressure: true,
      includeDensity: true,
      includeVorticity: true,
      customScalars: [],
      ...options,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker?.postMessage({
        id,
        type: 'single',
        data: { grid, options: defaultOptions },
      });
    });
  }

  static async exportTimeSeries(timesteps: TimeStepData[], options: ExportOptions = {}): Promise<Blob> {
    this.initWorker();
    const id = this.requestId++;

    const defaultOptions: Required<ExportOptions> = {
      filename: 'timeseries.vtk',
      includeVelocity: true,
      includePressure: true,
      includeDensity: true,
      includeVorticity: true,
      customScalars: [],
      ...options,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker?.postMessage({
        id,
        type: 'multiple',
        data: { timesteps, options: defaultOptions },
      });
    });
  }

  static download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.vtk') ? filename : `${filename}.vtk`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async exportAndDownload(grid: GridData, options: ExportOptions = {}): Promise<void> {
    const blob = await this.export(grid, options);
    this.download(blob, options.filename || 'simulation_data.vtk');
  }

  static async exportTimeSeriesAndDownload(timesteps: TimeStepData[], options: ExportOptions = {}): Promise<void> {
    const blob = await this.exportTimeSeries(timesteps, options);
    this.download(blob, options.filename || 'timeseries_data.vtk');
  }

  static computeVorticity(
    velocity: { u: Float32Array; v: Float32Array; w: Float32Array },
    dimensions: [number, number, number],
    spacing: Vector3
  ): { x: Float32Array; y: Float32Array; z: Float32Array } {
    const [nx, ny, nz] = dimensions;
    const numPoints = nx * ny * nz;
    const vortX = new Float32Array(numPoints);
    const vortY = new Float32Array(numPoints);
    const vortZ = new Float32Array(numPoints);

    const idx = (i: number, j: number, k: number) => i + j * nx + k * nx * ny;
    const hx = spacing.x * 2;
    const hy = spacing.y * 2;
    const hz = spacing.z * 2;

    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const iMinus = Math.max(0, i - 1);
          const iPlus = Math.min(nx - 1, i + 1);
          const jMinus = Math.max(0, j - 1);
          const jPlus = Math.min(ny - 1, j + 1);
          const kMinus = Math.max(0, k - 1);
          const kPlus = Math.min(nz - 1, k + 1);

          const dwdy = (velocity.w[idx(i, jPlus, k)] - velocity.w[idx(i, jMinus, k)]) / hy;
          const dvdz = (velocity.v[idx(i, j, kPlus)] - velocity.v[idx(i, j, kMinus)]) / hz;
          vortX[idx(i, j, k)] = dwdy - dvdz;

          const dudz = (velocity.u[idx(i, j, kPlus)] - velocity.u[idx(i, j, kMinus)]) / hz;
          const dwdx = (velocity.w[idx(iPlus, j, k)] - velocity.w[idx(iMinus, j, k)]) / hx;
          vortY[idx(i, j, k)] = dudz - dwdx;

          const dvdx = (velocity.v[idx(iPlus, j, k)] - velocity.v[idx(iMinus, j, k)]) / hx;
          const dudy = (velocity.u[idx(i, jPlus, k)] - velocity.u[idx(i, jMinus, k)]) / hy;
          vortZ[idx(i, j, k)] = dvdx - dudy;
        }
      }
    }

    return { x: vortX, y: vortY, z: vortZ };
  }

  static terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = null;
    }
    this.pendingRequests.clear();
  }
}

export { VTKExporter };
export default VTKExporter;

import { System } from '../ecs';
import { Position, POSITION_COMPONENT } from '../components';

export const AOI_GRID_SIZE = 10;
export const AOI_VIEW_RANGE = 1;

export interface GridCell {
  x: number;
  y: number;
  entities: Set<string>;
}

export class AoiSystem extends System {
  readonly name = 'AoiSystem';
  readonly requiredComponents = [POSITION_COMPONENT];

  private grid: Map<string, GridCell> = new Map();
  private entityCell: Map<string, string> = new Map();
  private viewRange: number;
  private gridSize: number;

  constructor(viewRange: number = AOI_VIEW_RANGE, gridSize: number = AOI_GRID_SIZE) {
    super();
    this.viewRange = viewRange;
    this.gridSize = gridSize;
  }

  private getCellKey(cx: number, cy: number): string {
    return `${cx}_${cy}`;
  }

  private getCellForPosition(x: number, y: number): { cx: number; cy: number } {
    return {
      cx: Math.floor(x / this.gridSize),
      cy: Math.floor(y / this.gridSize)
    };
  }

  addEntity(entityId: string, x: number, y: number): void {
    const { cx, cy } = this.getCellForPosition(x, y);
    const key = this.getCellKey(cx, cy);

    if (!this.grid.has(key)) {
      this.grid.set(key, { x: cx, y: cy, entities: new Set() });
    }
    this.grid.get(key)!.entities.add(entityId);
    this.entityCell.set(entityId, key);
  }

  updateEntityPosition(entityId: string, x: number, y: number): { entered: string[]; exited: string[] } | null {
    const oldKey = this.entityCell.get(entityId);
    if (!oldKey) {
      this.addEntity(entityId, x, y);
      return null;
    }

    const { cx, cy } = this.getCellForPosition(x, y);
    const newKey = this.getCellKey(cx, cy);

    if (oldKey === newKey) return null;

    const oldCell = this.grid.get(oldKey);
    if (oldCell) {
      oldCell.entities.delete(entityId);
      if (oldCell.entities.size === 0) {
        this.grid.delete(oldKey);
      }
    }

    if (!this.grid.has(newKey)) {
      this.grid.set(newKey, { x: cx, y: cy, entities: new Set() });
    }
    this.grid.get(newKey)!.entities.add(entityId);
    this.entityCell.set(entityId, newKey);

    return { entered: [newKey], exited: [oldKey] };
  }

  removeEntity(entityId: string): void {
    const key = this.entityCell.get(entityId);
    if (!key) return;

    const cell = this.grid.get(key);
    if (cell) {
      cell.entities.delete(entityId);
      if (cell.entities.size === 0) {
        this.grid.delete(key);
      }
    }
    this.entityCell.delete(entityId);
  }

  getEntitiesInAOI(entityId: string): string[] {
    const key = this.entityCell.get(entityId);
    if (!key) return [];

    const [cxStr, cyStr] = key.split('_');
    const cx = parseInt(cxStr);
    const cy = parseInt(cyStr);

    const result: string[] = [];

    for (let dx = -this.viewRange; dx <= this.viewRange; dx++) {
      for (let dy = -this.viewRange; dy <= this.viewRange; dy++) {
        const cellKey = this.getCellKey(cx + dx, cy + dy);
        const cell = this.grid.get(cellKey);
        if (cell) {
          for (const eId of cell.entities) {
            if (eId !== entityId) {
              result.push(eId);
            }
          }
        }
      }
    }

    return result;
  }

  getEntitiesInRange(x: number, y: number, range: number): string[] {
    const centerCX = Math.floor(x / this.gridSize);
    const centerCY = Math.floor(y / this.gridSize);
    const cellRange = Math.ceil(range / this.gridSize);

    const result: string[] = [];

    for (let dx = -cellRange; dx <= cellRange; dx++) {
      for (let dy = -cellRange; dy <= cellRange; dy++) {
        const cellKey = this.getCellKey(centerCX + dx, centerCY + dy);
        const cell = this.grid.get(cellKey);
        if (cell) {
          for (const eId of cell.entities) {
            result.push(eId);
          }
        }
      }
    }

    return result;
  }

  getGridCells(): GridCell[] {
    return Array.from(this.grid.values());
  }

  getEntityCell(entityId: string): string | undefined {
    return this.entityCell.get(entityId);
  }

  getViewRange(): number {
    return this.viewRange;
  }

  getGridSize(): number {
    return this.gridSize;
  }

  update(deltaTime: number): void {}
}

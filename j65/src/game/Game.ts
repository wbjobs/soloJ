import * as PIXI from 'pixi.js';
import { MapRenderer } from './MapRenderer';
import { Player } from './Player';
import { TileType, Position, MapResponse } from '../../shared/types';
import { getVisiblePositions, DEFAULT_VIEW_RADIUS } from '../utils/visibility';

export interface GameCallbacks {
  onChestCollected?: (position: Position) => void;
  onPositionChange?: (position: Position) => void;
}

export class Game {
  private app: PIXI.Application | null;
  private mapRenderer: MapRenderer | null;
  private player: Player | null;
  private playerContainer: PIXI.Container | null;
  private mapData: number[][];
  private startPosition: Position | null;
  private totalChests: number;
  private collectedChests: number;
  private callbacks: GameCallbacks;
  private viewRadius: number;

  constructor() {
    this.app = null;
    this.mapRenderer = null;
    this.player = null;
    this.playerContainer = null;
    this.mapData = [];
    this.startPosition = null;
    this.totalChests = 0;
    this.collectedChests = 0;
    this.callbacks = {};
    this.viewRadius = DEFAULT_VIEW_RADIUS;
  }

  async init(canvas: HTMLCanvasElement, callbacks?: GameCallbacks): Promise<void> {
    if (!canvas) {
      throw new Error('Canvas element is required');
    }

    if (callbacks) {
      this.callbacks = callbacks;
    }

    this.app = new PIXI.Application({
      view: canvas,
      width: canvas.width,
      height: canvas.height,
      backgroundColor: 0x1a0a2e,
      antialias: false,
    });

    this.playerContainer = new PIXI.Container();
    this.app.stage.addChild(this.playerContainer);
  }

  loadMap(mapResponse: MapResponse): void {
    if (!this.app || !this.playerContainer) return;

    this.mapData = mapResponse.map;
    this.startPosition = mapResponse.startPosition;
    this.totalChests = mapResponse.chestCount;
    this.collectedChests = 0;

    if (this.mapRenderer) {
      this.mapRenderer.destroy();
    }
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    this.mapRenderer = new MapRenderer(this.app, this.mapData);
    this.mapRenderer.render();

    const tileSize = this.mapRenderer.getTileSize();

    this.player = new Player(
      this.app,
      this.startPosition.x,
      this.startPosition.y,
      tileSize
    );

    this.playerContainer.addChild(this.player.getSprite());

    const mapContainer = this.mapRenderer.getMapContainer();
    this.playerContainer.x = mapContainer.x;
    this.playerContainer.y = mapContainer.y;

    this.updateVisibility();

    if (this.callbacks.onPositionChange) {
      this.callbacks.onPositionChange(this.player.getPosition());
    }
  }

  private updateVisibility(): void {
    if (!this.player || !this.mapRenderer) return;

    const pos = this.player.getPosition();
    const visiblePositions = getVisiblePositions(pos.x, pos.y, this.viewRadius);
    this.mapRenderer.updateVisibility(visiblePositions);
  }

  handleKeyDown(key: string): void {
    if (!this.player || !this.mapData || !this.mapRenderer) return;

    let dx = 0;
    let dy = 0;

    switch (key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        dy = -1;
        break;
      case 's':
      case 'arrowdown':
        dy = 1;
        break;
      case 'a':
      case 'arrowleft':
        dx = -1;
        break;
      case 'd':
      case 'arrowright':
        dx = 1;
        break;
      default:
        return;
    }

    const result = this.player.move(dx, dy, this.mapData);

    if (result.moved) {
      this.updateVisibility();

      if (this.callbacks.onPositionChange) {
        this.callbacks.onPositionChange(this.player.getPosition());
      }
    }

    if (result.collectedChest) {
      const pos = this.player.getPosition();
      this.collectedChests++;
      this.mapData[pos.y][pos.x] = TileType.FLOOR;
      this.mapRenderer.updateTile(pos.x, pos.y, TileType.FLOOR);

      if (this.callbacks.onChestCollected) {
        this.callbacks.onChestCollected(pos);
      }
    }
  }

  getCollectedChests(): number {
    return this.collectedChests;
  }

  getTotalChests(): number {
    return this.totalChests;
  }

  getPlayerPosition(): Position | null {
    return this.player ? this.player.getPosition() : null;
  }

  setViewRadius(radius: number): void {
    this.viewRadius = radius;
    this.updateVisibility();
  }

  destroy(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    if (this.mapRenderer) {
      this.mapRenderer.destroy();
      this.mapRenderer = null;
    }
    if (this.playerContainer) {
      this.playerContainer.destroy({ children: true });
      this.playerContainer = null;
    }
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      this.app = null;
    }
  }
}

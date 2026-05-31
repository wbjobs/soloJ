import * as PIXI from 'pixi.js';
import { TileType, FogState } from '../../shared/types';

const TILE_COLORS: Record<number, number> = {
  [TileType.WALL]: 0x2d2d44,
  [TileType.FLOOR]: 0x4a4a6a,
  [TileType.CHEST]: 0xffd700,
};

const FOG_COLORS: Record<number, number> = {
  [FogState.UNEXPLORED]: 0x000000,
  [FogState.EXPLORED]: 0x1a1a2e,
  [FogState.VISIBLE]: 0x000000,
};

export class MapRenderer {
  private app: PIXI.Application;
  private mapData: number[][];
  private fogData: FogState[][];
  private tileSize: number;
  private mapContainer: PIXI.Container;
  private fogContainer: PIXI.Container;
  private tiles: PIXI.Graphics[][];
  private fogTiles: PIXI.Graphics[][];

  constructor(app: PIXI.Application, mapData: number[][]) {
    this.app = app;
    this.mapData = mapData;
    this.tileSize = this.calculateTileSize();
    this.mapContainer = new PIXI.Container();
    this.fogContainer = new PIXI.Container();
    this.tiles = [];
    this.fogTiles = [];

    this.initFogData();

    this.app.stage.addChild(this.mapContainer);
    this.app.stage.addChild(this.fogContainer);
  }

  private initFogData(): void {
    const mapHeight = this.mapData.length;
    const mapWidth = this.mapData[0].length;
    this.fogData = [];

    for (let y = 0; y < mapHeight; y++) {
      this.fogData[y] = [];
      for (let x = 0; x < mapWidth; x++) {
        this.fogData[y][x] = FogState.UNEXPLORED;
      }
    }
  }

  private calculateTileSize(): number {
    const { width, height } = this.app.screen;
    const mapWidth = this.mapData[0].length;
    const mapHeight = this.mapData.length;
    return Math.min(Math.floor(width / mapWidth), Math.floor(height / mapHeight));
  }

  render(): void {
    this.mapContainer.removeChildren();
    this.fogContainer.removeChildren();
    this.tiles = [];
    this.fogTiles = [];

    const mapWidth = this.mapData[0].length;
    const mapHeight = this.mapData.length;
    const totalWidth = mapWidth * this.tileSize;
    const totalHeight = mapHeight * this.tileSize;

    const offsetX = (this.app.screen.width - totalWidth) / 2;
    const offsetY = (this.app.screen.height - totalHeight) / 2;

    this.mapContainer.x = offsetX;
    this.mapContainer.y = offsetY;
    this.fogContainer.x = offsetX;
    this.fogContainer.y = offsetY;

    for (let y = 0; y < mapHeight; y++) {
      this.tiles[y] = [];
      this.fogTiles[y] = [];
      for (let x = 0; x < mapWidth; x++) {
        const tile = new PIXI.Graphics();
        const tileType = this.mapData[y][x];
        const color = TILE_COLORS[tileType] ?? TILE_COLORS[TileType.FLOOR];

        tile.beginFill(color);
        tile.drawRect(x * this.tileSize, y * this.tileSize, this.tileSize - 1, this.tileSize - 1);
        tile.endFill();

        this.mapContainer.addChild(tile);
        this.tiles[y][x] = tile;

        const fog = new PIXI.Graphics();
        const fogState = this.fogData[y]?.[x] ?? FogState.UNEXPLORED;

        if (fogState !== FogState.VISIBLE) {
          const fogColor = FOG_COLORS[fogState];
          fog.beginFill(fogColor, fogState === FogState.UNEXPLORED ? 1 : 0.7);
          fog.drawRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
          fog.endFill();
        }

        this.fogContainer.addChild(fog);
        this.fogTiles[y][x] = fog;
      }
    }
  }

  updateVisibility(visiblePositions: Set<string>): void {
    const mapHeight = this.mapData.length;
    const mapWidth = this.mapData[0].length;

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const key = `${x},${y}`;
        const isVisible = visiblePositions.has(key);

        if (isVisible) {
          this.fogData[y][x] = FogState.VISIBLE;
        } else if (this.fogData[y][x] === FogState.VISIBLE) {
          this.fogData[y][x] = FogState.EXPLORED;
        }

        this.updateFogTile(x, y);
      }
    }
  }

  private updateFogTile(x: number, y: number): void {
    const fog = this.fogTiles[y]?.[x];
    if (!fog) return;

    const fogState = this.fogData[y][x];
    fog.clear();

    if (fogState !== FogState.VISIBLE) {
      const fogColor = FOG_COLORS[fogState];
      fog.beginFill(fogColor, fogState === FogState.UNEXPLORED ? 1 : 0.7);
      fog.drawRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
      fog.endFill();
    }
  }

  updateTile(x: number, y: number, type: TileType): void {
    if (y < 0 || y >= this.tiles.length || x < 0 || x >= this.tiles[0].length) {
      return;
    }

    const tile = this.tiles[y][x];
    if (tile) {
      tile.clear();
      const color = TILE_COLORS[type] ?? TILE_COLORS[TileType.FLOOR];
      tile.beginFill(color);
      tile.drawRect(x * this.tileSize, y * this.tileSize, this.tileSize - 1, this.tileSize - 1);
      tile.endFill();
    }
  }

  getTileSize(): number {
    return this.tileSize;
  }

  getMapContainer(): PIXI.Container {
    return this.mapContainer;
  }

  addChildToMap(child: PIXI.DisplayObject): void {
    this.mapContainer.addChild(child);
  }

  destroy(): void {
    this.mapContainer.destroy({ children: true });
    this.fogContainer.destroy({ children: true });
  }
}

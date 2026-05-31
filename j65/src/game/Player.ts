import * as PIXI from 'pixi.js';
import { TileType, Position } from '../../shared/types';

interface MoveResult {
  moved: boolean;
  collectedChest: boolean;
}

export class Player {
  private app: PIXI.Application;
  private sprite: PIXI.Graphics;
  private tileSize: number;
  private gridX: number;
  private gridY: number;
  private isMoving: boolean;
  private readonly MOVE_SPEED = 0.2;

  constructor(app: PIXI.Application, startX: number, startY: number, tileSize: number) {
    this.app = app;
    this.tileSize = tileSize;
    this.gridX = startX;
    this.gridY = startY;
    this.isMoving = false;

    this.sprite = new PIXI.Graphics();
    const playerSize = tileSize * 0.7;
    const offset = (tileSize - playerSize) / 2;
    this.sprite.beginFill(0x00ff88);
    this.sprite.drawRect(offset, offset, playerSize, playerSize);
    this.sprite.endFill();

    this.sprite.x = startX * tileSize;
    this.sprite.y = startY * tileSize;

    this.app.ticker.add(this.update, this);
  }

  move(dx: number, dy: number, mapData: number[][]): MoveResult {
    if (this.isMoving) {
      return { moved: false, collectedChest: false };
    }

    const newX = this.gridX + dx;
    const newY = this.gridY + dy;

    if (newY < 0 || newY >= mapData.length || newX < 0 || newX >= mapData[0].length) {
      return { moved: false, collectedChest: false };
    }

    const tileType = mapData[newY][newX];

    if (tileType === TileType.WALL) {
      return { moved: false, collectedChest: false };
    }

    const collectedChest = tileType === TileType.CHEST;

    this.gridX = newX;
    this.gridY = newY;
    this.isMoving = true;

    return { moved: true, collectedChest };
  }

  private update(): void {
    if (!this.isMoving) return;

    const targetPixelX = this.gridX * this.tileSize;
    const targetPixelY = this.gridY * this.tileSize;

    this.sprite.x += (targetPixelX - this.sprite.x) * this.MOVE_SPEED;
    this.sprite.y += (targetPixelY - this.sprite.y) * this.MOVE_SPEED;

    const dx = Math.abs(targetPixelX - this.sprite.x);
    const dy = Math.abs(targetPixelY - this.sprite.y);

    if (dx < 0.5 && dy < 0.5) {
      this.sprite.x = targetPixelX;
      this.sprite.y = targetPixelY;
      this.isMoving = false;
    }
  }

  getPosition(): Position {
    return { x: this.gridX, y: this.gridY };
  }

  getSprite(): PIXI.Graphics {
    return this.sprite;
  }

  destroy(): void {
    this.app.ticker.remove(this.update, this);
    this.sprite.destroy();
  }
}

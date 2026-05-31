import { useEffect, useRef, useCallback } from 'react';
import { Game } from '../game/Game';
import { Position, MapResponse } from '../../shared/types';

interface GameCanvasProps {
  mapData: MapResponse | null;
  viewRadius: number;
  onChestCollected?: (position: Position) => void;
  onPositionChange?: (position: Position) => void;
}

export default function GameCanvas({ mapData, viewRadius, onChestCollected, onPositionChange }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const initializedRef = useRef(false);
  const pendingMapRef = useRef<MapResponse | null>(null);
  const pendingViewRadiusRef = useRef<number>(viewRadius);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    gameRef.current?.handleKeyDown(e.key);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && !initializedRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(width);
          canvas.height = Math.floor(height);
          canvas.style.display = 'block';
          container.appendChild(canvas);

          const game = new Game();
          gameRef.current = game;

          game.init(canvas, {
            onChestCollected: (pos) => onChestCollected?.(pos),
            onPositionChange: (pos) => onPositionChange?.(pos),
          }).then(() => {
            initializedRef.current = true;
            game.setViewRadius(pendingViewRadiusRef.current);
            if (pendingMapRef.current) {
              game.loadMap(pendingMapRef.current);
              pendingMapRef.current = null;
            }
          }).catch((error) => {
            console.error('Failed to initialize game:', error);
          });

          window.addEventListener('keydown', handleKeyDown);
          observer.disconnect();
          break;
        }
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
        initializedRef.current = false;
      }
      const canvas = container.querySelector('canvas');
      if (canvas) {
        container.removeChild(canvas);
      }
    };
  }, [handleKeyDown, onChestCollected, onPositionChange]);

  useEffect(() => {
    if (mapData && gameRef.current && initializedRef.current) {
      gameRef.current.loadMap(mapData);
    } else if (mapData && !initializedRef.current) {
      pendingMapRef.current = mapData;
    }
  }, [mapData]);

  useEffect(() => {
    if (gameRef.current && initializedRef.current) {
      gameRef.current.setViewRadius(viewRadius);
    } else {
      pendingViewRadiusRef.current = viewRadius;
    }
  }, [viewRadius]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    />
  );
}

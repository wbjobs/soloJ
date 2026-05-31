import { useState, useCallback } from 'react';
import GameCanvas from '../components/GameCanvas';
import { MapResponse, MapRequest, Position } from '../../shared/types';
import { DEFAULT_VIEW_RADIUS } from '../utils/visibility';

export default function Home() {
  const [algorithm, setAlgorithm] = useState<'drunkard' | 'bsp'>('drunkard');
  const [mapWidth, setMapWidth] = useState(50);
  const [mapHeight, setMapHeight] = useState(50);
  const [viewRadius, setViewRadius] = useState(DEFAULT_VIEW_RADIUS);
  const [mapData, setMapData] = useState<MapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [playerPosition, setPlayerPosition] = useState<Position | null>(null);
  const [collectedChests, setCollectedChests] = useState(0);
  const [totalChests, setTotalChests] = useState(0);

  const generateMap = useCallback(async () => {
    setLoading(true);
    try {
      const request: MapRequest = {
        algorithm,
        width: mapWidth,
        height: mapHeight,
      };

      const params = new URLSearchParams({
        algorithm: request.algorithm,
        width: request.width.toString(),
        height: request.height.toString(),
      });
      const response = await fetch(`/api/map?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to generate map');
      }

      const data: MapResponse = await response.json();
      setMapData(data);
      setTotalChests(data.chestCount);
      setCollectedChests(0);
      setPlayerPosition(data.startPosition);
    } catch (error) {
      console.error('Error generating map:', error);
    } finally {
      setLoading(false);
    }
  }, [algorithm, mapWidth, mapHeight]);

  const handleChestCollected = useCallback((_position: Position) => {
    setCollectedChests((prev) => prev + 1);
  }, []);

  const handlePositionChange = useCallback((position: Position) => {
    setPlayerPosition(position);
  }, []);

  const getAlgorithmName = (alg: string): string => {
    return alg === 'drunkard' ? '醉汉走路' : 'BSP树';
  };

  return (
    <div className="h-screen bg-[#1a0a2e] text-white flex flex-col overflow-hidden">
      <header className="shrink-0 p-4 border-b border-purple-700">
        <h1 className="text-2xl font-pixel text-center text-purple-300">
          地牢探险
        </h1>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 p-4 min-h-[400px] lg:min-h-0">
          <div className="w-full h-full border-4 border-purple-600 rounded-lg overflow-hidden bg-[#0d051a]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-purple-300 font-pixel animate-pulse">
                  生成地图中...
                </div>
              </div>
            ) : (
              <GameCanvas
                mapData={mapData}
                viewRadius={viewRadius}
                onChestCollected={handleChestCollected}
                onPositionChange={handlePositionChange}
              />
            )}
          </div>
        </div>

        <div className="w-full lg:w-80 p-4 bg-[#160828] border-t lg:border-t-0 lg:border-l border-purple-700 flex flex-col gap-4">
          <div className="space-y-4">
            <h2 className="text-lg font-pixel text-purple-300">控制面板</h2>

            <div className="space-y-2">
              <label className="block font-pixel text-sm text-purple-200">
                算法选择
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as 'drunkard' | 'bsp')}
                className="w-full px-3 py-2 bg-[#0d051a] border-2 border-purple-600 rounded font-pixel text-sm focus:outline-none focus:border-purple-400"
              >
                <option value="drunkard">醉汉走路</option>
                <option value="bsp">BSP树</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block font-pixel text-sm text-purple-200">
                  宽度
                </label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={mapWidth}
                  onChange={(e) => setMapWidth(Math.max(30, Math.min(100, parseInt(e.target.value) || 30)))}
                  className="w-full px-3 py-2 bg-[#0d051a] border-2 border-purple-600 rounded font-pixel text-sm focus:outline-none focus:border-purple-400"
                />
              </div>
              <div className="space-y-2">
                <label className="block font-pixel text-sm text-purple-200">
                  高度
                </label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={mapHeight}
                  onChange={(e) => setMapHeight(Math.max(30, Math.min(100, parseInt(e.target.value) || 30)))}
                  className="w-full px-3 py-2 bg-[#0d051a] border-2 border-purple-600 rounded font-pixel text-sm focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-pixel text-sm text-purple-200">
                视野范围: {viewRadius} 格 ({viewRadius * 2 + 1}x{viewRadius * 2 + 1})
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={viewRadius}
                onChange={(e) => setViewRadius(parseInt(e.target.value))}
                className="w-full h-2 bg-[#0d051a] rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <button
              onClick={generateMap}
              disabled={loading}
              className="w-full py-3 bg-purple-700 hover:bg-purple-600 disabled:bg-purple-900 disabled:cursor-not-allowed border-2 border-purple-500 rounded font-pixel text-sm transition-colors"
            >
              {loading ? '生成中...' : '生成地图'}
            </button>
          </div>

          <div className="border-t border-purple-700 pt-4">
            <h2 className="text-lg font-pixel text-purple-300 mb-3">状态</h2>
            <div className="space-y-2 font-pixel text-sm">
              <div className="flex justify-between">
                <span className="text-purple-200">当前位置:</span>
                <span className="text-green-400">
                  {playerPosition ? `(${playerPosition.x}, ${playerPosition.y})` : '(-, -)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-200">收集宝箱:</span>
                <span className="text-yellow-400">
                  {collectedChests} / {totalChests}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-200">使用算法:</span>
                <span className="text-cyan-400">
                  {mapData ? getAlgorithmName(mapData.algorithm) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-200">地图尺寸:</span>
                <span className="text-cyan-400">
                  {mapData ? `${mapData.width} x ${mapData.height}` : '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-auto border-t border-purple-700 pt-4">
            <h3 className="text-sm font-pixel text-purple-300 mb-2">操作说明</h3>
            <p className="font-pixel text-xs text-purple-400 leading-relaxed">
              使用 WASD 或方向键移动角色<br />
              收集金色宝箱获得分数<br />
              深灰色为墙壁，不可通过
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

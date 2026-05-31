import React, { useEffect, useRef, useState } from 'react';

interface ImageCanvasProps {
  pixelData: number[];
  width: number;
  height: number;
}

const RENDER_CHUNK_SIZE = 256;

const ImageCanvas: React.FC<ImageCanvasProps> = ({ pixelData, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pixelData.length === 0 || width === 0 || height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    if (pixelData.length < width * height * 4 * 0.5) {
      setRenderProgress(100);
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;
      const len = Math.min(pixelData.length, data.length);
      for (let i = 0; i < len; i++) {
        data[i] = pixelData[i];
      }
      ctx.putImageData(imageData, 0, 0);
      fitCanvas(canvas, containerRef.current);
      return;
    }

    setRenderProgress(0);
    let currentRow = 0;

    const renderChunk = () => {
      if (currentRow >= height) {
        setRenderProgress(100);
        fitCanvas(canvas, containerRef.current);
        return;
      }

      const endRow = Math.min(currentRow + RENDER_CHUNK_SIZE, height);
      const chunkHeight = endRow - currentRow;
      const chunkImageData = ctx.createImageData(width, chunkHeight);
      const chunkData = chunkImageData.data;

      const srcOffset = currentRow * width * 4;
      const copyLen = Math.min(chunkHeight * width * 4, pixelData.length - srcOffset);

      for (let i = 0; i < copyLen; i++) {
        chunkData[i] = pixelData[srcOffset + i];
      }

      ctx.putImageData(chunkImageData, 0, currentRow);

      currentRow = endRow;
      setRenderProgress(Math.round((currentRow / height) * 100));

      animFrameRef.current = requestAnimationFrame(renderChunk);
    };

    animFrameRef.current = requestAnimationFrame(renderChunk);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [pixelData, width, height]);

  if (pixelData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500 text-lg">上传 DICOM 文件以查看影像</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <div className="bg-gray-900 p-5 rounded-lg shadow-lg flex justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full cursor-crosshair"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
        <span>分辨率: {width} × {height} 像素</span>
        {renderProgress < 100 && (
          <span className="text-blue-600">渲染中 {renderProgress}%</span>
        )}
      </div>
    </div>
  );
};

function fitCanvas(canvas: HTMLCanvasElement, container: HTMLDivElement | null) {
  if (!container) return;
  const maxWidth = container.clientWidth - 40;
  const maxHeight = 600;
  const width = canvas.width;
  const height = canvas.height;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  canvas.style.width = `${width * scale}px`;
  canvas.style.height = `${height * scale}px`;
}

export default ImageCanvas;

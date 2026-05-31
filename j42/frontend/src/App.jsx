import { useState, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import ResultDisplay from './components/ResultDisplay';
import { loadImage, getImageData, createImageFromData, downloadImage } from './utils/imageUtils';
import { encodeImage, decodeImage, calculatePSNR, getMaxCapacity, getUtf8ByteLength, loadWasm } from './wasm/wasmLoader';

function App() {
  const [activeTab, setActiveTab] = useState('encode');
  const [imageFile, setImageFile] = useState(null);
  const [imageInfo, setImageInfo] = useState(null);
  const [secretMessage, setSecretMessage] = useState('');
  const [password, setPassword] = useState('');
  const [maxCapacity, setMaxCapacity] = useState(0);
  const [byteLength, setByteLength] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [resultData, setResultData] = useState(null);
  const [resultType, setResultType] = useState(null);
  const [psnr, setPsnr] = useState(null);
  const [wasmReady, setWasmReady] = useState(false);
  const [wasmStatus, setWasmStatus] = useState('加载中...');

  useEffect(() => {
    const initWasm = async () => {
      try {
        await loadWasm();
        setWasmReady(true);
        setWasmStatus('WASM 模块已加载');
      } catch (e) {
        setWasmStatus('使用 JS 回退模式');
        setWasmReady(true);
      }
    };
    initWasm();
  }, []);

  useEffect(() => {
    const updateByteLength = async () => {
      if (!wasmReady || !secretMessage) {
        setByteLength(0);
        return;
      }
      try {
        const len = await getUtf8ByteLength(secretMessage);
        setByteLength(len);
      } catch {
        setByteLength(new TextEncoder().encode(secretMessage).length);
      }
    };
    updateByteLength();
  }, [secretMessage, wasmReady]);

  const handleImageLoad = async (file) => {
    setImageFile(file);
    setResultData(null);
    setError('');
    setPsnr(null);
    
    try {
      const img = await loadImage(file);
      setImageInfo({
        width: img.width,
        height: img.height,
        name: file.name,
        size: file.size
      });
      
      const capacity = await getMaxCapacity(img.width, img.height);
      setMaxCapacity(capacity);
    } catch (err) {
      setError('加载图片失败: ' + err.message);
    }
  };

  const handleEncode = async () => {
    if (!imageFile || !secretMessage.trim()) {
      setError('请上传图片并输入秘密信息');
      return;
    }

    if (byteLength > maxCapacity) {
      setError(`消息太长！最大容量: ${maxCapacity} 字节，当前: ${byteLength} 字节`);
      return;
    }

    setIsProcessing(true);
    setError('');
    setResultData(null);
    setPsnr(null);

    try {
      const img = await loadImage(imageFile);
      const imageData = getImageData(img);
      const originalPixels = new Uint8Array(imageData.data);
      
      const modifiedPixels = await encodeImage(originalPixels, img.width, img.height, secretMessage, password);
      
      const psnrValue = await calculatePSNR(originalPixels, modifiedPixels);
      setPsnr(psnrValue);
      
      const modifiedImageData = new ImageData(
        new Uint8ClampedArray(modifiedPixels),
        img.width,
        img.height
      );
      const resultDataUrl = createImageFromData(modifiedImageData, img.width, img.height);
      
      setResultData(resultDataUrl);
      setResultType('image');
    } catch (err) {
      setError('编码失败: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecode = async () => {
    if (!imageFile) {
      setError('请上传包含隐写信息的图片');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResultData(null);
    setPsnr(null);

    try {
      const img = await loadImage(imageFile);
      const imageData = getImageData(img);
      const pixels = new Uint8Array(imageData.data);
      
      const message = await decodeImage(pixels, img.width, img.height, password);
      
      setResultData(message);
      setResultType('text');
    } catch (err) {
      setError('解码失败: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (resultData && resultType === 'image') {
      const baseName = imageInfo?.name?.replace(/\.[^/.]+$/, '') || 'stego';
      downloadImage(resultData, `${baseName}_stego.png`);
    }
  };

  const handleReset = () => {
    setImageFile(null);
    setImageInfo(null);
    setSecretMessage('');
    setPassword('');
    setMaxCapacity(0);
    setResultData(null);
    setResultType(null);
    setError('');
    setPsnr(null);
  };

  const getPsnrColor = () => {
    if (psnr === null) return 'text-gray-500';
    if (psnr === Infinity) return 'text-neon-cyan';
    if (psnr >= 50) return 'text-green-400';
    if (psnr >= 40) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getPsnrLabel = () => {
    if (psnr === null) return '-';
    if (psnr === Infinity) return '∞ (无损)';
    return psnr.toFixed(2) + ' dB';
  };

  return (
    <div className="min-h-screen relative z-10">
      <header className="py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-neon-cyan to-neon-purple bg-clip-text text-transparent">
            🔐 LSB 图像隐写工具
          </h1>
          <p className="text-gray-400 text-lg">
            基于 WebAssembly (Rust) 的最低有效位隐写算法 - 支持 XOR 加密
          </p>
          <div className={`mt-2 text-sm ${wasmReady ? 'text-green-400' : 'text-yellow-400'}`}>
            {wasmStatus}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-12">
        <div className="flex justify-center mb-8">
          <div className="glass-card inline-flex rounded-xl p-1">
            <button
              onClick={() => { setActiveTab('encode'); handleReset(); }}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'encode'
                  ? 'btn-primary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🔒 编码模式
            </button>
            <button
              onClick={() => { setActiveTab('decode'); handleReset(); }}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'decode'
                  ? 'btn-secondary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🔓 解码模式
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                {activeTab === 'encode' ? '📤 上传原始图片' : '📥 上传隐写图片'}
              </h2>
              <ImageUploader
                onImageLoad={handleImageLoad}
                label={activeTab === 'encode' ? '选择要隐藏信息的图片' : '选择要提取信息的图片'}
                icon={activeTab === 'encode' ? '🖼️' : '🔍'}
              />
              
              {imageInfo && (
                <div className="mt-4 p-4 bg-dark-900/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">尺寸:</span> <span className="text-neon-cyan">{imageInfo.width} × {imageInfo.height}</span></div>
                    <div><span className="text-gray-500">最大容量:</span> <span className="text-neon-purple">{maxCapacity} 字节</span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                🔑 {activeTab === 'encode' ? '设置加密密码' : '输入解密密码'}
              </h2>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={activeTab === 'encode' ? '输入密码（可选）' : '输入密码解密'}
                className="w-full p-4 rounded-lg font-mono"
                disabled={isProcessing}
              />
              <p className="mt-2 text-xs text-gray-500">
                {activeTab === 'encode' 
                  ? '设置密码后，解码时必须输入相同密码才能提取信息' 
                  : '如果编码时设置了密码，解码时必须输入相同密码'}
              </p>
            </div>

            {activeTab === 'encode' && (
              <div className="glass-card rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  ✏️ 输入秘密信息
                </h2>
                <textarea
                  value={secretMessage}
                  onChange={(e) => setSecretMessage(e.target.value)}
                  placeholder="在这里输入你要隐藏的秘密信息..."
                  className="w-full h-32 p-4 rounded-lg resize-none font-mono"
                  disabled={isProcessing}
                />
                <div className="mt-2 flex flex-col gap-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      字符数: 
                      <span className="text-neon-cyan">
                        {' '}{secretMessage.length}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      UTF-8 字节: 
                      <span className={byteLength > maxCapacity ? 'text-red-400' : 'text-neon-purple'}>
                        {' '}{byteLength}
                      </span>
                      {' / '}{maxCapacity}
                    </span>
                  </div>
                  {byteLength > maxCapacity && (
                    <span className="text-red-400 text-right">超出容量! 请缩短消息或使用更大的图片</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={activeTab === 'encode' ? handleEncode : handleDecode}
                disabled={isProcessing || !wasmReady || !imageFile || (activeTab === 'encode' && !secretMessage.trim())}
                className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === 'encode' ? 'btn-primary' : 'btn-secondary'
                } text-white`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="spinner"></span>
                    处理中...
                  </span>
                ) : (
                  activeTab === 'encode' ? '🚀 开始编码' : '🔍 开始解码'
                )}
              </button>
              
              <button
                onClick={handleReset}
                className="px-6 py-4 rounded-xl font-semibold bg-dark-700 hover:bg-dark-600 transition-all text-gray-300"
              >
                🔄 重置
              </button>
            </div>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
                ⚠️ {error}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                📊 结果展示
              </h2>
              
              {resultData ? (
                <div className="space-y-4">
                  {psnr !== null && activeTab === 'encode' && (
                    <div className="p-4 bg-dark-900/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">📈 峰值信噪比 (PSNR):</span>
                        <span className={`font-mono text-lg font-bold ${getPsnrColor()}`}>
                          {getPsnrLabel()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        PSNR 越高表示图像质量越好，通常 > 40dB 时人眼几乎无法察觉差异
                      </p>
                    </div>
                  )}
                  <ResultDisplay
                    type={resultType}
                    data={resultData}
                    onDownload={handleDownload}
                  />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">✨</div>
                  <p>{activeTab === 'encode' ? '上传图片并输入信息后点击编码' : '上传隐写图片后点击解码'}</p>
                  <p className="text-sm mt-2">结果将在这里显示</p>
                </div>
              )}
            </div>

            <div className="glass-card rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                💡 关于 LSB 隐写
              </h2>
              <div className="space-y-3 text-sm text-gray-400">
                <p>
                  <span className="text-neon-cyan">LSB (Least Significant Bit)</span> 最低有效位隐写是一种将秘密信息隐藏在图片像素中的技术。
                </p>
                <p>
                  <span className="text-neon-purple">XOR 加密:</span> 消息在嵌入前使用密码进行 XOR 加密，只有输入正确密码才能解密。
                </p>
                <p>
                  <span className="text-yellow-400">注意:</span> 请使用 PNG、BMP 等无损格式。JPEG 压缩会破坏隐藏的信息。
                </p>
                <div className="pt-3 border-t border-dark-600">
                  <p className="text-gray-500 text-xs">
                    🔧 核心算法由 Rust 编译为 WebAssembly，在浏览器端高性能执行
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                📈 关于 PSNR
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">PSNR ≥ 50 dB</span>
                  <span className="text-green-400">🌟 极高质量 - 完全无法察觉</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">40-50 dB</span>
                  <span className="text-green-400">✅ 高质量 - 人眼无法分辨</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">30-40 dB</span>
                  <span className="text-yellow-400">⚠️ 良好 - 可能轻微察觉</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">&lt; 30 dB</span>
                  <span className="text-orange-400">❌ 较差 - 明显可察觉</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

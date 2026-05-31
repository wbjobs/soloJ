import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useFluidSimulation } from '@/hooks/useFluidSimulation';
import { useMouseInteraction } from '@/hooks/useMouseInteraction';
import { getFluidParams, checkHealth, getMockFluidParams, uploadVideo, uploadForceData } from '@/services/api';
import { FluidParticles } from './FluidParticles';
import { ForceIndicator } from './ForceIndicator';
import { ControlPanel } from './ControlPanel';
import type { ForceApplication, SimulationConfig, ParticleData, RecordingState } from '@/types/fluid';

interface FluidContextType {
  particles: React.MutableRefObject<ParticleData>;
  config: SimulationConfig;
  applyForce: (force: ForceApplication) => void;
  updateParticles: (delta: number) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const FluidContext = createContext<FluidContextType | null>(null);

function useFluidContext() {
  const context = useContext(FluidContext);
  if (!context) {
    throw new Error('useFluidContext must be used within FluidProvider');
  }
  return context;
}

function SceneContent() {
  const { camera, gl } = useThree();
  const { particles, config, applyForce, updateParticles } = useFluidContext();
  const [mouseWorldPos, setMouseWorldPos] = useState<[number, number, number]>([0, 0, 0]);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getMouseWorldPosition,
    getIsMouseDown,
  } = useMouseInteraction({
    camera,
    domElement: gl.domElement,
    onApplyForce: (force: ForceApplication) => {
      applyForce(force);
    },
    forceRadius: 2.0,
    forceStrength: 15.0,
  });

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      handlePointerDown(e.clientX, e.clientY);
      setIsMouseDown(true);
    };

    const onPointerMove = (e: PointerEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const onPointerUp = () => {
      handlePointerUp();
      setIsMouseDown(false);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
    };
  }, [gl, handlePointerDown, handlePointerMove, handlePointerUp]);

  useFrame((_, delta) => {
    updateParticles(delta);
    setMouseWorldPos(getMouseWorldPosition());
    setIsMouseDown(getIsMouseDown());
  });

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#00f5d4" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#9b5de5" />
      
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
      
      <FluidParticles
        positions={particles.current.positions}
        colors={particles.current.colors}
        count={particles.current.count}
      />
      
      <ForceIndicator
        isActive={isMouseDown}
        position={mouseWorldPos}
        radius={2.0}
      />
      
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={30}
        autoRotate={!isMouseDown}
        autoRotateSpeed={0.3}
      />
      
      <EffectComposer multisampling={0}>
        <SMAA />
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={1.5}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={0.5} />
        <Noise opacity={0.02} />
      </EffectComposer>
    </>
  );
}

export function FluidScene() {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<[number, number, number]>([0, 0, 0]);
  
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [forceCount, setForceCount] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    particles,
    config,
    initParticles,
    resetParticles,
    updateConfig,
    applyForce,
    updateParticles,
    getForceCount,
    getForceData,
    exportForceData,
  } = useFluidSimulation();

  useEffect(() => {
    const interval = setInterval(() => {
      setForceCount(getForceCount());
    }, 500);
    return () => clearInterval(interval);
  }, [getForceCount]);

  useEffect(() => {
    const fetchParams = async () => {
      try {
        setIsLoading(true);
        
        try {
          await checkHealth();
          setIsConnected(true);
        } catch {
          setIsConnected(false);
        }

        let fluidParams;
        if (isConnected) {
          fluidParams = await getFluidParams({ gridSize: 32 });
        } else {
          fluidParams = getMockFluidParams();
        }
        
        initParticles(fluidParams);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('初始化失败，使用默认参数');
        const mockParams = getMockFluidParams();
        initParticles(mockParams);
      } finally {
        setIsLoading(false);
      }
    };

    fetchParams();
  }, [initParticles, isConnected]);

  const startRecording = useCallback(async () => {
    if (!canvasRef.current) return;
    
    try {
      const canvas = canvasRef.current;
      const stream = canvas.captureStream(60);
      
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType || undefined,
        videoBitsPerSecond: 8000000,
      });
      
      recordedChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      recordingStartTimeRef.current = Date.now();
      setRecordingDuration(0);
      
      mediaRecorder.start(100);
      setRecordingState('recording');
      
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
      }, 1000);
      
      console.log('Recording started with codec:', selectedMimeType);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setRecordingState('error');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    
    const recorder = mediaRecorderRef.current;
    const duration = recordingDuration;
    
    setRecordingState('processing');
    
    recorder.stop();
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    
    try {
      const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      
      if (videoBlob.size > 0) {
        setRecordingState('uploading');
        setUploadProgress(0);
        
        const result = await uploadVideo(videoBlob, duration, (progress) => {
          setUploadProgress(progress * 100);
        });
        
        console.log('Video uploaded:', result);
      }
      
      if (getForceCount() > 0) {
        try {
          await exportForceData();
        } catch (err) {
          console.error('Failed to upload force data:', err);
        }
      }
      
      setRecordingState('done');
      setUploadProgress(100);
      
      setTimeout(() => {
        setRecordingState('idle');
        setRecordingDuration(0);
        setUploadProgress(0);
      }, 3000);
    } catch (err) {
      console.error('Failed to process recording:', err);
      setRecordingState('error');
    }
  }, [recordingDuration, getForceCount, exportForceData]);

  const toggleRecording = useCallback(() => {
    if (recordingState === 'idle' || recordingState === 'done' || recordingState === 'error') {
      startRecording();
    } else if (recordingState === 'recording') {
      stopRecording();
    }
  }, [recordingState, startRecording, stopRecording]);

  const downloadForceData = useCallback(() => {
    const data = getForceData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forces_${data.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getForceData]);

  const handleCanvasCreated = useCallback((gl: THREE.WebGLRenderer) => {
    canvasRef.current = gl.domElement;
  }, []);

  const handleConfigChange = useCallback((updates: Partial<typeof config>) => {
    updateConfig(updates);
  }, [updateConfig]);

  const fluidContextValue: FluidContextType = {
    particles,
    config,
    applyForce,
    updateParticles,
    canvasRef,
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-cyan-300 text-xl font-semibold mb-2">正在加载流体参数...</h2>
          <p className="text-slate-500 text-sm">连接C++后端服务器</p>
          {error && <p className="text-yellow-500 text-sm mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <FluidContext.Provider value={fluidContextValue}>
      <div className="w-full h-screen bg-[#0a1628] relative overflow-hidden">
        <Canvas
          camera={{ position: [0, 0, 15], fov: 60 }}
          gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
          dpr={[1, window.devicePixelRatio]}
          onCreated={({ gl }) => {
            canvasRef.current = gl.domElement;
          }}
        >
          <color attach="background" args={['#0a1628']} />
          <fog attach="fog" args={['#0a1628', 10, 30]} />
          <SceneContent />
        </Canvas>
        
        <ControlPanel
          config={config}
          onConfigChange={handleConfigChange}
          onReset={resetParticles}
          mousePosition={mouseWorldPos}
          isConnected={isConnected}
          recordingState={recordingState}
          recordingDuration={recordingDuration}
          uploadProgress={uploadProgress}
          onToggleRecording={toggleRecording}
          onDownloadForceData={downloadForceData}
          forceCount={forceCount}
        />
        
        <div className="fixed bottom-4 right-4 text-slate-500 text-xs space-y-1">
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
            <div className="text-cyan-400 font-medium mb-1">交互说明</div>
            <div>🖱️ 点击：施加脉冲力</div>
            <div>🖱️ 拖拽：施加持续力</div>
            <div>🔄 左键拖动：旋转视角</div>
            <div>🔍 滚轮：缩放</div>
          </div>
        </div>
        
        <div className="fixed top-4 right-4 text-right">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            3D 流体交互场
          </h1>
          <p className="text-slate-500 text-xs mt-1">3D Fluid Interaction Field</p>
        </div>
      </div>
    </FluidContext.Provider>
  );
}

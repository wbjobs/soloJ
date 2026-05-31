import { useEffect, useRef, useCallback } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { useAppStore, ForceFieldType, HandGesture } from '@/store/useAppStore';

interface HandTrackingOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onForce?: (x: number, y: number, type: ForceFieldType) => void;
}

interface Landmark {
  x: number;
  y: number;
  z: number;
}

const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 6, 10, 14, 18];

export const useHandTracking = ({ videoRef, canvasRef, onForce }: HandTrackingOptions) => {
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const lastGestureRef = useRef<HandGesture>('none');
  const lastForceTimeRef = useRef<number>(0);
  const wristAngleRef = useRef<{ angle: number; timestamp: number }[]>([]);

  const {
    handTracking,
    forceStrength,
    forceRadius,
    currentUser,
    setHandTrackingInitialized,
    setCameraActive,
    setGesture,
    setFingerPosition,
    setHandLandmarks,
    addForcePoint,
  } = useAppStore();

  const calculateFingerDistances = useCallback((landmarks: Landmark[]) => {
    const distances: number[] = [];
    const palmCenter = landmarks[9];

    FINGER_TIPS.forEach((tipIdx) => {
      const tip = landmarks[tipIdx];
      const dist = Math.sqrt(
        (tip.x - palmCenter.x) ** 2 +
        (tip.y - palmCenter.y) ** 2 +
        (tip.z - palmCenter.z) ** 2
      );
      distances.push(dist);
    });

    return distances;
  }, []);

  const isFist = useCallback((landmarks: Landmark[]) => {
    const distances = calculateFingerDistances(landmarks);
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    return avgDist < 0.15;
  }, [calculateFingerDistances]);

  const isOpenPalm = useCallback((landmarks: Landmark[]) => {
    let extendedCount = 0;

    for (let i = 0; i < 5; i++) {
      const tip = landmarks[FINGER_TIPS[i]];
      const pip = landmarks[FINGER_PIPS[i]];
      const mcp = landmarks[FINGER_PIPS[i] - 1];

      const angle = Math.atan2(tip.y - pip.y, tip.x - pip.x) -
                    Math.atan2(pip.y - mcp.y, pip.x - mcp.x);

      if (Math.abs(angle) < Math.PI / 4) {
        extendedCount++;
      }
    }

    return extendedCount >= 4;
  }, []);

  const calculateWristAngle = useCallback((landmarks: Landmark[]) => {
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const angle = Math.atan2(middleMcp.y - wrist.y, middleMcp.x - wrist.x);
    return angle;
  }, []);

  const detectRotation = useCallback((landmarks: Landmark[]) => {
    const currentAngle = calculateWristAngle(landmarks);
    const now = Date.now();

    wristAngleRef.current.push({ angle: currentAngle, timestamp: now });
    wristAngleRef.current = wristAngleRef.current.filter(
      (item) => now - item.timestamp < 500
    );

    if (wristAngleRef.current.length < 10) return false;

    const angles = wristAngleRef.current.map((item) => item.angle);
    const firstAngle = angles[0];
    const lastAngle = angles[angles.length - 1];
    const angleDiff = Math.abs(lastAngle - firstAngle);

    return angleDiff > Math.PI / 2;
  }, [calculateWristAngle]);

  const recognizeGesture = useCallback((landmarks: Landmark[]): HandGesture => {
    if (isFist(landmarks)) return 'fist';
    if (detectRotation(landmarks)) return 'rotate';
    if (isOpenPalm(landmarks)) return 'open';
    return 'none';
  }, [isFist, isOpenPalm, detectRotation]);

  const getForceTypeFromGesture = useCallback((gesture: HandGesture): ForceFieldType | null => {
    switch (gesture) {
      case 'fist': return 'repel';
      case 'open': return 'attract';
      case 'rotate': return 'vortex';
      default: return null;
    }
  }, []);

  const mapToFluidCoordinates = useCallback((
    handX: number,
    handY: number,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const fluidX = (1 - handX) * canvasWidth;
    const fluidY = handY * canvasHeight;
    return { x: fluidX, y: fluidY };
  }, []);

  const drawLandmarks = useCallback((
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark[],
    gesture: HandGesture
  ) => {
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17],
    ];

    let color = '#22d3ee';
    if (gesture === 'fist') color = '#ef4444';
    if (gesture === 'open') color = '#10b981';
    if (gesture === 'rotate') color = '#818cf8';

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    connections.forEach(([a, b]) => {
      const p1 = landmarks[a];
      const p2 = landmarks[b];
      ctx.beginPath();
      ctx.moveTo((1 - p1.x) * width, p1.y * height);
      ctx.lineTo((1 - p2.x) * width, p2.y * height);
      ctx.stroke();
    });

    landmarks.forEach((point, index) => {
      const x = (1 - point.x) * width;
      const y = point.y * height;

      ctx.beginPath();
      ctx.arc(x, y, FINGER_TIPS.includes(index) ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = FINGER_TIPS.includes(index) ? color : 'rgba(34, 211, 238, 0.5)';
      ctx.fill();
    });

    ctx.shadowBlur = 0;
  }, []);

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0] as Landmark[];
      const gesture = recognizeGesture(landmarks);

      setHandLandmarks(landmarks);
      setGesture(gesture);

      const indexTip = landmarks[8];
      const fluidCoords = mapToFluidCoordinates(
        indexTip.x,
        indexTip.y,
        canvasRef.current.width,
        canvasRef.current.height
      );
      setFingerPosition(fluidCoords);

      drawLandmarks(ctx, landmarks, gesture);

      const now = Date.now();
      const forceType = getForceTypeFromGesture(gesture);

      if (forceType && now - lastForceTimeRef.current > 50) {
        const forcePoint = {
          x: fluidCoords.x,
          y: fluidCoords.y,
          type: forceType,
          strength: forceStrength,
          radius: forceRadius,
          userId: currentUser?.id,
          timestamp: now,
        };

        addForcePoint(forcePoint);
        onForce?.(fluidCoords.x, fluidCoords.y, forceType);

        setTimeout(() => {
          useAppStore.getState().removeForcePoint(now);
        }, 100);

        lastForceTimeRef.current = now;
      }

      lastGestureRef.current = gesture;
    } else {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setHandLandmarks(null);
      setGesture('none');
      setFingerPosition(null);
    }
  }, [
    canvasRef,
    recognizeGesture,
    mapToFluidCoordinates,
    drawLandmarks,
    getForceTypeFromGesture,
    forceStrength,
    forceRadius,
    currentUser?.id,
    setHandLandmarks,
    setGesture,
    setFingerPosition,
    addForcePoint,
    onForce,
  ]);

  const initHandTracking = useCallback(async () => {
    try {
      const hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });

      hands.onResults(onResults);
      handsRef.current = hands;

      setHandTrackingInitialized(true);
      return hands;
    } catch (error) {
      console.error('Failed to initialize hand tracking:', error);
      setHandTrackingInitialized(false);
      throw error;
    }
  }, [onResults, setHandTrackingInitialized]);

  const startCamera = useCallback(async () => {
    if (!videoRef.current || !handsRef.current) return;

    try {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (handsRef.current) {
            await handsRef.current.send({ image: videoRef.current! });
          }
        },
        width: 640,
        height: 480,
      });

      await camera.start();
      cameraRef.current = camera;
      setCameraActive(true);
    } catch (error) {
      console.error('Failed to start camera:', error);
      setCameraActive(false);
      throw error;
    }
  }, [videoRef, setCameraActive]);

  const stopCamera = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    setCameraActive(false);
    setHandLandmarks(null);
    setGesture('none');
    setFingerPosition(null);

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [canvasRef, setCameraActive, setHandLandmarks, setGesture, setFingerPosition]);

  useEffect(() => {
    if (handTracking.enabled && !handsRef.current) {
      initHandTracking();
    }

    return () => {
      if (handsRef.current) {
        handsRef.current.close();
        handsRef.current = null;
      }
    };
  }, [handTracking.enabled, initHandTracking]);

  useEffect(() => {
    if (handTracking.enabled && handTracking.initialized && !handTracking.cameraActive) {
      startCamera();
    } else if (!handTracking.enabled && handTracking.cameraActive) {
      stopCamera();
    }
  }, [handTracking.enabled, handTracking.initialized, handTracking.cameraActive, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, [stopCamera]);

  return {
    hands: handsRef.current,
    camera: cameraRef.current,
    initHandTracking,
    startCamera,
    stopCamera,
  };
};

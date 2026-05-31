import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Platform } from 'react-native';
import { Camera, StopCircle, Video } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';

interface VideoRecorderProps {
  onDataReady?: (data: string) => void;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ onDataReady }) => {
  const { state, dispatch } = useAppState();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setIsSupported(false);
      setError('浏览器不支持视频采集功能');
    }
    return () => {
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state.recordingState.isRecording && state.recordingState.videoEnabled) {
      startTimer();
    } else {
      stopTimer();
    }
  }, [state.recordingState.isRecording, state.recordingState.videoEnabled]);

  const startTimer = () => {
    setRecordingDuration(0);
    timerRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          dispatch({ type: 'SET_VIDEO_DATA', payload: base64Data });
          if (onDataReady) {
            onDataReady(base64Data);
          }
        };
        reader.readAsDataURL(blob);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);

      dispatch({ type: 'START_RECORDING', payload: { video: true, audio: state.recordingState.audioEnabled } });
    } catch (err) {
      setError('无法访问摄像头，请确保已授予权限');
      console.error('Video recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      dispatch({ type: 'STOP_RECORDING' });
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    stopTimer();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Camera size={24} color="#667eea" />
        <Text style={styles.title}>视频采集</Text>
        {state.recordingState.isRecording && state.recordingState.videoEnabled && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.duration}>{formatDuration(recordingDuration)}</Text>
          </View>
        )}
      </View>

      <View style={styles.videoContainer}>
        <video
          ref={videoRef}
          style={styles.video}
          muted
          playsInline
          autoPlay
        />
        {!state.recordingState.videoEnabled && !state.recordingState.videoData && (
          <View style={styles.placeholder}>
            <Video size={48} color="#ccc" />
            <Text style={styles.placeholderText}>点击开始采集视频</Text>
          </View>
        )}
        {state.recordingState.videoData && !state.recordingState.isRecording && (
          <View style={styles.completedOverlay}>
            <Text style={styles.completedText}>视频已采集 ✓</Text>
          </View>
        )}
      </View>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <View style={styles.buttonContainer}>
        {!state.recordingState.isRecording ? (
          <Button
            title="开始视频采集"
            onPress={startRecording}
            disabled={state.recordingState.isRecording}
          />
        ) : (
          <Button
            title="停止采集"
            onPress={stopRecording}
            color="#ff6b6b"
          />
        )}
        {state.recordingState.videoData && !state.recordingState.isRecording && (
          <Button
            title="重新采集"
            onPress={() => {
              dispatch({ type: 'SET_VIDEO_DATA', payload: null });
              startRecording();
            }}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginLeft: 'auto',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    animation: 'pulse 1.5s infinite',
  },
  duration: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  placeholderText: {
    marginTop: 12,
    color: '#999',
    fontSize: 14,
  },
  completedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(102, 126, 234, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    justifyContent: 'center',
  },
});

export default VideoRecorder;

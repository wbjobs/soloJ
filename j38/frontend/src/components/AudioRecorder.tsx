import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { Mic, StopCircle, Volume2 } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';

interface AudioRecorderProps {
  onDataReady?: (data: string) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onDataReady }) => {
  const { state, dispatch } = useAppState();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(20).fill(0));
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setIsSupported(false);
      setError('浏览器不支持音频采集功能');
    }
    return () => {
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (state.recordingState.isRecording && state.recordingState.audioEnabled) {
      startTimer();
    } else {
      stopTimer();
    }
  }, [state.recordingState.isRecording, state.recordingState.audioEnabled]);

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

  const visualizeAudio = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      source.connect(analyserRef.current);

      const updateVisualization = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const levels = Array.from(dataArray).map(v => v / 255);
          setAudioLevels(levels.slice(0, 20));
        }
        animationRef.current = requestAnimationFrame(updateVisualization);
      };
      updateVisualization();
    } catch (err) {
      console.error('Audio visualization error:', err);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      streamRef.current = stream;
      visualizeAudio(stream);

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          dispatch({ type: 'SET_AUDIO_DATA', payload: base64Data });
          if (onDataReady) {
            onDataReady(base64Data);
          }
        };
        reader.readAsDataURL(blob);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);

      dispatch({ type: 'START_RECORDING', payload: { video: state.recordingState.videoEnabled, audio: true } });
    } catch (err) {
      setError('无法访问麦克风，请确保已授予权限');
      console.error('Audio recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      dispatch({ type: 'STOP_RECORDING' });
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
        <Mic size={24} color="#667eea" />
        <Text style={styles.title}>音频采集</Text>
        {state.recordingState.isRecording && state.recordingState.audioEnabled && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.duration}>{formatDuration(recordingDuration)}</Text>
          </View>
        )}
      </View>

      <View style={styles.visualizerContainer}>
        {state.recordingState.isRecording && state.recordingState.audioEnabled ? (
          <View style={styles.visualizer}>
            {audioLevels.map((level, index) => (
              <View
                key={index}
                style={[
                  styles.visualizerBar,
                  {
                    height: `${Math.max(8, level * 100)}%`,
                    backgroundColor: level > 0.6 ? '#ff6b6b' : level > 0.3 ? '#667eea' : '#a8d8ea',
                  }
                ]}
              />
            ))}
          </View>
        ) : state.recordingState.audioData ? (
          <View style={styles.completedState}>
            <Volume2 size={48} color="#667eea" />
            <Text style={styles.completedText}>音频已采集 ✓</Text>
            <Text style={styles.durationInfo}>时长: {formatDuration(recordingDuration || 10)}</Text>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Volume2 size={48} color="#ccc" />
            <Text style={styles.placeholderText}>点击开始采集音频</Text>
          </View>
        )}
      </View>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <View style={styles.buttonContainer}>
        {!state.recordingState.isRecording ? (
          <Button
            title="开始音频采集"
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
        {state.recordingState.audioData && !state.recordingState.isRecording && (
          <Button
            title="重新采集"
            onPress={() => {
              dispatch({ type: 'SET_AUDIO_DATA', payload: null });
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
  visualizerContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    paddingHorizontal: 8,
    gap: 4,
  },
  visualizerBar: {
    flex: 1,
    minHeight: 8,
    borderRadius: 4,
    transition: 'height 0.1s ease',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  placeholderText: {
    color: '#999',
    fontSize: 14,
  },
  completedState: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  completedText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  durationInfo: {
    color: '#666',
    fontSize: 14,
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

export default AudioRecorder;

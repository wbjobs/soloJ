import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Keyboard, AlertCircle, CheckCircle } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import type { TypingFeature, TypingFeatures } from '../types';

interface TypingCaptureProps {
  onFeaturesReady?: (features: TypingFeatures) => void;
  minChars?: number;
}

const TypingCapture: React.FC<TypingCaptureProps> = ({
  onFeaturesReady,
  minChars = 50
}) => {
  const { state, dispatch } = useAppState();
  const [text, setText] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [keyPressEvents, setKeyPressEvents] = useState<TypingFeature[]>([]);
  const lastKeyTimeRef = useRef<number | null>(null);
  const currentKeyRef = useRef<{ key: string; time: number } | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [backspaceCount, setBackspaceCount] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isCapturing) return;

    const now = performance.now();

    if (e.key === 'Backspace') {
      setBackspaceCount(prev => prev + 1);
    }

    if (currentKeyRef.current && currentKeyRef.current.key === e.key) {
      return;
    }

    currentKeyRef.current = {
      key: e.key,
      time: now
    };
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isCapturing) return;

    const now = performance.now();

    if (currentKeyRef.current && currentKeyRef.current.key === e.key) {
      const pressTime = currentKeyRef.current.time;
      const holdTime = now - pressTime;

      let nextKeyInterval: number | undefined;
      if (lastKeyTimeRef.current !== null) {
        nextKeyInterval = pressTime - lastKeyTimeRef.current;
      }

      const feature: TypingFeature = {
        key: e.key,
        press_time: pressTime,
        release_time: now,
        hold_time: holdTime,
        next_key_interval: nextKeyInterval
      };

      setKeyPressEvents(prev => [...prev, feature]);
      lastKeyTimeRef.current = now;
      currentKeyRef.current = null;
    }
  };

  const handleTextChange = (newText: string) => {
    if (newText.length < text.length) {
      setErrorCount(prev => prev + 1);
    }
    setText(newText);

    dispatch({ type: 'SET_TEXT_DATA', payload: newText });

    if (newText.length >= minChars && isCapturing) {
      stopCapture();
    }
  };

  const startCapture = () => {
    setIsCapturing(true);
    setStartTime(performance.now());
    setKeyPressEvents([]);
    setText('');
    setErrorCount(0);
    setBackspaceCount(0);
    lastKeyTimeRef.current = null;
    currentKeyRef.current = null;
  };

  const stopCapture = () => {
    setIsCapturing(false);

    if (keyPressEvents.length > 0 && startTime) {
      const holdTimes = keyPressEvents.map(e => e.hold_time);
      const intervals = keyPressEvents
        .filter(e => e.next_key_interval !== undefined)
        .map(e => e.next_key_interval!);

      const avgHoldTime = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;
      const avgInterval = intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0;

      const varianceHoldTime = holdTimes.length > 1
        ? holdTimes.reduce((a, b) => a + Math.pow(b - avgHoldTime, 2), 0) / holdTimes.length
        : 0;

      const varianceInterval = intervals.length > 1
        ? intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length
        : 0;

      const durationSeconds = (performance.now() - startTime) / 1000;
      const totalChars = text.length;

      const features: TypingFeatures = {
        features: keyPressEvents,
        avg_hold_time: avgHoldTime,
        avg_interval: avgInterval,
        variance_hold_time: varianceHoldTime,
        variance_interval: varianceInterval,
        backspace_rate: backspaceCount / Math.max(totalChars, 1),
        error_rate: errorCount / Math.max(totalChars, 1),
        total_chars: totalChars,
        duration_seconds: durationSeconds
      };

      dispatch({ type: 'SET_TYPING_FEATURES', payload: features });

      if (onFeaturesReady) {
        onFeaturesReady(features);
      }
    }
  };

  const resetCapture = () => {
    setIsCapturing(false);
    setStartTime(null);
    setKeyPressEvents([]);
    setText('');
    setErrorCount(0);
    setBackspaceCount(0);
    dispatch({ type: 'SET_TEXT_DATA', payload: '' });
    dispatch({ type: 'SET_TYPING_FEATURES', payload: null });
  };

  const getProgress = () => {
    return Math.min(100, (text.length / minChars) * 100);
  };

  const getStatusText = () => {
    if (state.typingFeatures) {
      return `打字特征已采集 (${text.length} 字符)`;
    }
    if (isCapturing) {
      return `正在采集... ${text.length}/${minChars} 字符`;
    }
    if (text.length > 0) {
      return `已输入 ${text.length} 字符，点击开始采集打字节奏`;
    }
    return '请在下方输入一段文字，描述您最近的心情';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Keyboard size={24} color="#667eea" />
        <Text style={styles.title}>文本与打字节奏采集</Text>
        {state.typingFeatures && (
          <CheckCircle size={20} color="#51cf66" style={{ marginLeft: 'auto' }} />
        )}
      </View>

      <View style={styles.statusBar}>
        <Text style={[
          styles.statusText,
          state.typingFeatures ? styles.statusSuccess : isCapturing ? styles.statusActive : styles.statusNormal
        ]}>
          {getStatusText()}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${getProgress()}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(getProgress())}%</Text>
      </View>

      <TextInput
        multiline
        numberOfLines={8}
        value={text}
        onChangeText={handleTextChange}
        onKeyDown={handleKeyDown as any}
        onKeyUp={handleKeyUp as any}
        placeholder="请在这里自由书写，描述您最近一周的心情、感受和经历...\n\n例如：最近我感到有些疲惫，晚上经常失眠，对以前喜欢的事情也提不起兴趣..."
        style={[
          styles.textInput,
          isCapturing && styles.textInputActive
        ]}
        editable={true}
        autoFocus={false}
      />

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>字符数</Text>
          <Text style={styles.statValue}>{text.length}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>按键次数</Text>
          <Text style={styles.statValue}>{keyPressEvents.length}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>退格次数</Text>
          <Text style={styles.statValue}>{backspaceCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>平均按键时长</Text>
          <Text style={styles.statValue}>
            {state.typingFeatures ? `${state.typingFeatures.avg_hold_time.toFixed(0)}ms` : '-'}
          </Text>
        </View>
      </View>

      {isCapturing && (
        <View style={styles.captureNotice}>
          <AlertCircle size={16} color="#ff6b6b" />
          <Text style={styles.captureNoticeText}>
            正在记录打字节奏，请自然书写，完成后将自动停止
          </Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        {!isCapturing && !state.typingFeatures && (
          <button
            onClick={startCapture}
            disabled={isCapturing}
            style={{
              padding: '12px 24px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            开始采集打字节奏
          </button>
        )}
        {isCapturing && (
          <button
            onClick={stopCapture}
            style={{
              padding: '12px 24px',
              backgroundColor: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            停止采集
          </button>
        )}
        {state.typingFeatures && (
          <button
            onClick={resetCapture}
            style={{
              padding: '12px 24px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            重新采集
          </button>
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
  statusBar: {
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
  },
  statusNormal: {
    color: '#666',
  },
  statusActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  statusSuccess: {
    color: '#51cf66',
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    minWidth: 40,
    textAlign: 'right',
  },
  textInput: {
    width: '100%',
    minHeight: 160,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 12,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
    fontFamily: 'inherit',
  },
  textInputActive: {
    borderColor: '#667eea',
    backgroundColor: '#f8f9ff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  captureNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff5f5',
    borderRadius: 8,
  },
  captureNoticeText: {
    fontSize: 13,
    color: '#ff6b6b',
  },
  buttonContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
});

export default TypingCapture;

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, Circle, Send, ArrowLeft, Info, Loader2 } from 'lucide-react';
import VideoRecorder from '../components/VideoRecorder';
import AudioRecorder from '../components/AudioRecorder';
import TypingCapture from '../components/TypingCapture';
import { useAppState } from '../context/AppStateContext';
import { fullAnalysis } from '../services/api';
import type { MultimodalRequest, MultimodalResponse } from '../types';

type RootStackParamList = {
  Home: undefined;
  DataCollection: undefined;
  Results: undefined;
  Explainability: undefined;
  History: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DataCollectionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { state, dispatch } = useAppState();
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'typing'>('video');

  const isVideoComplete = !!state.recordingState.videoData;
  const isAudioComplete = !!state.recordingState.audioData;
  const isTypingComplete = !!state.typingFeatures;

  const allComplete = isVideoComplete && isAudioComplete && isTypingComplete;

  const handleVideoDataReady = useCallback((data: string) => {
    console.log('Video data ready, size:', data.length);
  }, []);

  const handleAudioDataReady = useCallback((data: string) => {
    console.log('Audio data ready, size:', data.length);
  }, []);

  const handleTypingFeaturesReady = useCallback((features: any) => {
    console.log('Typing features ready, chars:', features.total_chars);
  }, []);

  const handleSubmit = async () => {
    if (!allComplete) {
      Alert.alert(
        '数据不完整',
        '请完成所有数据采集后再提交分析',
        [{ text: '确定' }]
      );
      return;
    }

    try {
      dispatch({ type: 'START_ANALYZING' });

      const request: MultimodalRequest = {
        session_id: state.sessionId,
        user_id: state.userId,
        video_data: state.recordingState.videoData || undefined,
        audio_data: state.recordingState.audioData || undefined,
        text_data: state.recordingState.textData,
        typing_features: state.typingFeatures || undefined,
        timestamp: new Date().toISOString(),
        additional_metadata: {
          user_agent: navigator.userAgent,
          screen_width: window.screen.width,
          screen_height: window.screen.height,
        }
      };

      const response: MultimodalResponse = await fullAnalysis(request);
      
      dispatch({ type: 'SET_ANALYSIS_RESULT', payload: response });
      
      navigation.navigate('Results');
    } catch (error: any) {
      console.error('Analysis error:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error.response?.data?.detail || error.message || '分析失败，请稍后重试' 
      });
      Alert.alert(
        '分析失败',
        error.response?.data?.detail || error.message || '请检查网络连接后重试',
        [{ text: '确定' }]
      );
    }
  };

  const tabs = [
    { key: 'video', label: '视频采集', icon: '🎥', completed: isVideoComplete },
    { key: 'audio', label: '音频采集', icon: '🎤', completed: isAudioComplete },
    { key: 'typing', label: '文本采集', icon: '⌨️', completed: isTypingComplete },
  ];

  const goBack = () => {
    if (state.recordingState.isRecording) {
      Alert.alert(
        '正在采集',
        '数据采集中，确定要离开吗？',
        [
          { text: '继续采集', style: 'cancel' },
          { text: '确定离开', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={goBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>数据采集</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.progressSection}>
        <Text style={styles.progressTitle}>采集进度</Text>
        <View style={styles.progressSteps}>
          {tabs.map((tab, index) => (
            <React.Fragment key={tab.key}>
              <View style={styles.stepItem}>
                {tab.completed ? (
                  <CheckCircle2 size={24} color="#51cf66" />
                ) : (
                  <Circle size={24} color={activeTab === tab.key ? '#667eea' : '#ccc'} />
                )}
                <Text style={[
                  styles.stepLabel,
                  tab.completed && styles.stepLabelCompleted,
                  activeTab === tab.key && styles.stepLabelActive
                ]}>
                  {tab.label}
                </Text>
              </View>
              {index < tabs.length - 1 && (
                <View style={[
                  styles.progressLine,
                  (index === 0 && isVideoComplete) || (index === 1 && isAudioComplete) 
                    ? styles.progressLineComplete 
                    : styles.progressLineIncomplete
                ]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              activeTab === tab.key && styles.tabButtonActive,
              tab.completed && styles.tabButtonCompleted
            ]}
            onPress={() => setActiveTab(tab.key as 'video' | 'audio' | 'typing')}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[
              styles.tabText,
              activeTab === tab.key && styles.tabTextActive
            ]}>
              {tab.label}
            </Text>
            {tab.completed && (
              <CheckCircle2 size={16} color="#51cf66" style={styles.tabCheck} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'video' && (
          <VideoRecorder onDataReady={handleVideoDataReady} />
        )}
        {activeTab === 'audio' && (
          <AudioRecorder onDataReady={handleAudioDataReady} />
        )}
        {activeTab === 'typing' && (
          <TypingCapture onFeaturesReady={handleTypingFeaturesReady} />
        )}

        <View style={styles.navigationButtons}>
          {activeTab !== 'video' && (
            <TouchableOpacity
              style={styles.navButtonSecondary}
              onPress={() => {
                const prevTab = activeTab === 'audio' ? 'video' : 'audio';
                setActiveTab(prevTab as 'video' | 'audio' | 'typing');
              }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#667eea" />
              <Text style={styles.navButtonSecondaryText}>上一步</Text>
            </TouchableOpacity>
          )}
          
          {activeTab !== 'typing' && (
            <TouchableOpacity
              style={[
                styles.navButtonPrimary,
                !((activeTab === 'video' && isVideoComplete) || (activeTab === 'audio' && isAudioComplete)) 
                  && styles.navButtonDisabled
              ]}
              onPress={() => {
                const nextTab = activeTab === 'video' ? 'audio' : 'typing';
                setActiveTab(nextTab as 'video' | 'audio' | 'typing');
              }}
              disabled={!((activeTab === 'video' && isVideoComplete) || (activeTab === 'audio' && isAudioComplete))}
              activeOpacity={0.7}
            >
              <Text style={styles.navButtonPrimaryText}>下一步</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.completionSummary}>
          {isVideoComplete && <CheckCircle2 size={18} color="#51cf66" />}
          {isAudioComplete && <CheckCircle2 size={18} color="#51cf66" />}
          {isTypingComplete && <CheckCircle2 size={18} color="#51cf66" />}
          <Text style={styles.completionText}>
            已完成 {[isVideoComplete, isAudioComplete, isTypingComplete].filter(Boolean).length}/3
          </Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!allComplete || state.isAnalyzing) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!allComplete || state.isAnalyzing}
          activeOpacity={0.7}
        >
          {state.isAnalyzing ? (
            <>
              <Loader2 size={20} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
              <Text style={styles.submitButtonText}>正在分析...</Text>
            </>
          ) : (
            <>
              <Send size={20} color="#fff" />
              <Text style={styles.submitButtonText}>提交分析</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoBanner}>
        <Info size={16} color="#667eea" />
        <Text style={styles.infoText}>
          您的数据将被安全加密处理，仅用于研究分析。原始数据不会离开您的设备。
        </Text>
      </View>

      {state.error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  progressSection: {
    padding: 16,
    backgroundColor: '#fff',
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  stepLabelActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  stepLabelCompleted: {
    color: '#51cf66',
  },
  progressLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    borderRadius: 1,
  },
  progressLineComplete: {
    backgroundColor: '#51cf66',
  },
  progressLineIncomplete: {
    backgroundColor: '#e9ecef',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f1f3f5',
  },
  tabButtonActive: {
    backgroundColor: '#667eea20',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  tabButtonCompleted: {
    backgroundColor: '#d3f9d840',
  },
  tabIcon: {
    fontSize: 18,
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  tabCheck: {
    marginLeft: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  navButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    paddingVertical: 14,
    borderRadius: 10,
  },
  navButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#667eea',
    backgroundColor: '#fff',
  },
  navButtonSecondaryText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  completionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginLeft: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#51cf66',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#51cf66',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#adb5bd',
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: '#e7f5ff',
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    color: '#1971c2',
    lineHeight: 16,
  },
  errorBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    padding: 12,
    backgroundColor: '#ffe3e3',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffa8a8',
  },
  errorText: {
    fontSize: 13,
    color: '#c92a2a',
    textAlign: 'center',
  },
});

export default DataCollectionScreen;

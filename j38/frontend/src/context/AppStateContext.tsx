import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, RecordingState, MultimodalResponse, TypingFeatures } from '../types';

type AppAction =
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'SET_USER_ID'; payload: string }
  | { type: 'START_RECORDING'; payload: { video: boolean; audio: boolean } }
  | { type: 'STOP_RECORDING' }
  | { type: 'SET_VIDEO_DATA'; payload: string | null }
  | { type: 'SET_AUDIO_DATA'; payload: string | null }
  | { type: 'SET_TEXT_DATA'; payload: string }
  | { type: 'SET_TYPING_FEATURES'; payload: TypingFeatures | null }
  | { type: 'START_ANALYZING' }
  | { type: 'SET_ANALYSIS_RESULT'; payload: MultimodalResponse | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };

const initialRecordingState: RecordingState = {
  isRecording: false,
  videoEnabled: false,
  audioEnabled: false,
  recordingStartTime: null,
  videoData: null,
  audioData: null,
  textData: '',
};

const initialState: AppState = {
  sessionId: uuidv4(),
  userId: `user_${uuidv4().slice(0, 8)}`,
  recordingState: initialRecordingState,
  typingFeatures: null,
  analysisResult: null,
  isAnalyzing: false,
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    case 'SET_USER_ID':
      return { ...state, userId: action.payload };
    case 'START_RECORDING':
      return {
        ...state,
        recordingState: {
          ...state.recordingState,
          isRecording: true,
          videoEnabled: action.payload.video,
          audioEnabled: action.payload.audio,
          recordingStartTime: Date.now(),
          videoData: null,
          audioData: null,
        },
      };
    case 'STOP_RECORDING':
      return {
        ...state,
        recordingState: {
          ...state.recordingState,
          isRecording: false,
          recordingStartTime: null,
        },
      };
    case 'SET_VIDEO_DATA':
      return {
        ...state,
        recordingState: { ...state.recordingState, videoData: action.payload },
      };
    case 'SET_AUDIO_DATA':
      return {
        ...state,
        recordingState: { ...state.recordingState, audioData: action.payload },
      };
    case 'SET_TEXT_DATA':
      return {
        ...state,
        recordingState: { ...state.recordingState, textData: action.payload },
      };
    case 'SET_TYPING_FEATURES':
      return { ...state, typingFeatures: action.payload };
    case 'START_ANALYZING':
      return { ...state, isAnalyzing: true, error: null };
    case 'SET_ANALYSIS_RESULT':
      return { ...state, isAnalyzing: false, analysisResult: action.payload };
    case 'SET_ERROR':
      return { ...state, isAnalyzing: false, error: action.payload };
    case 'RESET_STATE':
      return {
        ...initialState,
        sessionId: uuidv4(),
        userId: state.userId,
      };
    default:
      return state;
  }
}

interface AppStateContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  generateNewSession: () => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const generateNewSession = () => {
    dispatch({ type: 'SET_SESSION_ID', payload: uuidv4() });
    dispatch({ type: 'RESET_STATE' });
  };

  return (
    <AppStateContext.Provider value={{ state, dispatch, generateNewSession }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

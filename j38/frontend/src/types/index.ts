export interface TypingFeature {
  key: string;
  press_time: number;
  release_time: number;
  hold_time: number;
  next_key_interval?: number;
}

export interface TypingFeatures {
  features: TypingFeature[];
  avg_hold_time: number;
  avg_interval: number;
  variance_hold_time: number;
  variance_interval: number;
  backspace_rate: number;
  error_rate: number;
  total_chars: number;
  duration_seconds: number;
}

export interface VisualFeatures {
  au_scores: Record<string, number>;
  gaze_avoidance_duration: number;
  gaze_avoidance_ratio: number;
  smile_frequency: number;
  smile_duration_ratio: number;
  head_pitch: number;
  head_yaw: number;
  head_roll: number;
  blink_rate: number;
  eyebrow_raise_frequency: number;
  frowning_frequency: number;
  feature_vector: number[];
  processing_time_ms: number;
}

export interface AudioFeatures {
  speech_rate: number;
  pitch_mean: number;
  pitch_std: number;
  pitch_min: number;
  pitch_max: number;
  pitch_range: number;
  pause_count: number;
  pause_duration_mean: number;
  pause_duration_total: number;
  pause_ratio: number;
  jitter: number;
  shimmer: number;
  hnr: number;
  energy_mean: number;
  energy_std: number;
  voice_quality: Record<string, number>;
  feature_vector: number[];
  processing_time_ms: number;
}

export interface TextFeatures {
  negative_word_count: number;
  negative_word_ratio: number;
  first_person_singular_count: number;
  first_person_singular_ratio: number;
  first_person_plural_count: number;
  third_person_count: number;
  sentiment_score: number;
  sentiment_label: string;
  emotion_scores: Record<string, number>;
  avg_sentence_length: number;
  avg_word_length: number;
  vocabulary_richness: number;
  past_tense_ratio: number;
  present_tense_ratio: number;
  death_related_words: number;
  hopelessness_words: number;
  feature_vector: number[];
  processing_time_ms: number;
}

export type ModalityType = 'visual' | 'audio' | 'text' | 'fusion';
export type DepressionSeverity = 'none' | 'mild' | 'moderate' | 'severe';

export interface ModalityContribution {
  modality: ModalityType;
  weight: number;
  contribution_score: number;
  normalized_weight: number;
  top_features: Array<{
    feature: string;
    value: number;
    importance: number;
  }>;
}

export interface FusionResult {
  depression_score: number;
  confidence_score: number;
  confidence_interval: [number, number];
  severity: DepressionSeverity;
  modality_contributions: ModalityContribution[];
  attention_weights: Record<string, number>;
  risk_factors: string[];
  recommendations: string[];
  processing_time_ms: number;
}

export interface ExplainabilityResult {
  shap_values: Record<string, number>;
  feature_importance: Array<{
    feature: string;
    modality: string;
    value: number;
    shap_value: number;
    importance: number;
    direction: 'increasing' | 'decreasing';
  }>;
  modality_contributions: ModalityContribution[];
  decision_path: Array<{
    step: number;
    name: string;
    description: string;
    score_change: number;
    current_score: number;
    modality: string;
  }>;
  visualization_data: Record<string, any>;
}

export interface MultimodalRequest {
  session_id: string;
  user_id?: string;
  video_data?: string;
  audio_data?: string;
  text_data?: string;
  typing_features?: TypingFeatures;
  timestamp: string;
  additional_metadata: Record<string, any>;
}

export interface MultimodalResponse {
  session_id: string;
  request_id: string;
  timestamp: string;
  visual_features?: VisualFeatures;
  audio_features?: AudioFeatures;
  text_features?: TextFeatures;
  fusion_result?: FusionResult;
  explainability?: ExplainabilityResult;
  status: string;
  message?: string;
}

export interface UserRecord {
  user_id: string;
  session_id: string;
  created_at: string;
  visual_features?: VisualFeatures;
  audio_features?: AudioFeatures;
  text_features?: TextFeatures;
  typing_features?: TypingFeatures;
  fusion_result?: FusionResult;
  is_used_for_training: boolean;
  federated_gradient_uploaded: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  recordingStartTime: number | null;
  videoData: string | null;
  audioData: string | null;
  textData: string;
}

export interface AppState {
  sessionId: string;
  userId: string;
  recordingState: RecordingState;
  typingFeatures: TypingFeatures | null;
  analysisResult: MultimodalResponse | null;
  isAnalyzing: boolean;
  error: string | null;
}

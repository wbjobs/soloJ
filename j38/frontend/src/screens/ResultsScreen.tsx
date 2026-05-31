import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  ArrowLeft, 
  Brain, 
  AlertTriangle, 
  Info, 
  BarChart3, 
  TrendingUp, 
  CheckCircle2, 
  RefreshCw,
  Eye,
  Mic,
  FileText,
  PieChart
} from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { getExplainability, federatedTrain } from '../services/api';
import type { FusionResult, ModalityContribution, DepressionSeverity } from '../types';

type RootStackParamList = {
  Home: undefined;
  DataCollection: undefined;
  Results: undefined;
  Explainability: { sessionId: string };
  History: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ResultsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { state, dispatch, generateNewSession } = useAppState();
  const [showDetails, setShowDetails] = useState(false);
  const [isTraining, setIsTraining] = useState(false);

  const result = state.analysisResult;
  const fusionResult = result?.fusion_result;

  useEffect(() => {
    if (!result || !fusionResult) {
      Alert.alert(
        '无结果数据',
        '请先完成数据采集和分析',
        [{ text: '返回', onPress: () => navigation.navigate('Home') }]
      );
    }
  }, [result, fusionResult, navigation]);

  const getSeverityInfo = (severity: DepressionSeverity) => {
    const info = {
      none: { label: '无抑郁倾向', color: '#51cf66', bgColor: '#d3f9d8', icon: '😊', recommendation: '您的心理状态良好，请继续保持健康的生活方式。' },
      mild: { label: '轻度抑郁倾向', color: '#fcc419', bgColor: '#fff3bf', icon: '😐', recommendation: '建议关注自己的情绪变化，保持规律作息，适当进行户外活动。' },
      moderate: { label: '中度抑郁倾向', color: '#ff922b', bgColor: '#ffe8cc', icon: '😔', recommendation: '建议寻求心理咨询师的帮助，与亲友分享您的感受。' },
      severe: { label: '重度抑郁倾向', color: '#ff6b6b', bgColor: '#ffe3e3', icon: '😢', recommendation: '强烈建议您尽快寻求专业精神科医生的帮助。' }
    };
    return info[severity] || info.none;
  };

  const getModalityIcon = (modality: string) => {
    switch (modality) {
      case 'visual': return Eye;
      case 'audio': return Mic;
      case 'text': return FileText;
      case 'fusion': return Brain;
      default: return BarChart3;
    }
  };

  const getModalityLabel = (modality: string) => {
    switch (modality) {
      case 'visual': return '视觉模态';
      case 'audio': return '语音模态';
      case 'text': return '文本模态';
      case 'fusion': return '融合结果';
      default: return modality;
    }
  };

  const getModalityColor = (modality: string) => {
    switch (modality) {
      case 'visual': return '#667eea';
      case 'audio': return '#f093fb';
      case 'text': return '#4facfe';
      case 'fusion': return '#43e97b';
      default: return '#adb5bd';
    }
  };

  const handleViewExplainability = async () => {
    try {
      if (!state.sessionId) return;
      await getExplainability(state.sessionId);
      navigation.navigate('Explainability', { sessionId: state.sessionId });
    } catch (error: any) {
      console.error('Get explainability error:', error);
      Alert.alert('获取详细解释失败', error.message || '请稍后重试');
    }
  };

  const handleContributeToTraining = async () => {
    try {
      setIsTraining(true);
      const response = await federatedTrain();
      Alert.alert(
        '贡献成功',
        '感谢您贡献的数据！您的匿名梯度已用于改进模型。',
        [{ text: '确定' }]
      );
    } catch (error: any) {
      console.error('Federated training error:', error);
      Alert.alert('贡献失败', error.message || '请稍后重试');
    } finally {
      setIsTraining(false);
    }
  };

  const handleNewAssessment = () => {
    Alert.alert(
      '开始新评估',
      '确定要开始新的评估吗？当前结果将被保存到历史记录中。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定', 
          onPress: () => {
            generateNewSession();
            navigation.navigate('DataCollection');
          }
        }
      ]
    );
  };

  const renderGaugeChart = (score: number, color: string) => {
    const percentage = score;
    const rotation = (percentage / 100) * 180 - 90;
    
    return (
      <View style={styles.gaugeContainer}>
        <View style={styles.gaugeBackground}>
          <View style={[styles.gaugeFill, { 
            background: `conic-gradient(from 180deg, ${color} 0%, ${color} ${percentage}%, #e9ecef ${percentage}%, #e9ecef 100%)`
          }]} />
          <View style={styles.gaugeInner}>
            <Text style={[styles.gaugeScore, { color }]}>{score.toFixed(1)}</Text>
            <Text style={styles.gaugeLabel}>抑郁倾向评分</Text>
          </View>
        </View>
        <View style={styles.gaugeLabels}>
          <Text style={styles.gaugeMin}>0</Text>
          <Text style={styles.gaugeMax}>100</Text>
        </View>
      </View>
    );
  };

  if (!result || !fusionResult) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  const severityInfo = getSeverityInfo(fusionResult.severity);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>分析结果</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={[styles.severityCard, { backgroundColor: severityInfo.bgColor }]}>
        <Text style={styles.emoji}>{severityInfo.icon}</Text>
        <Text style={[styles.severityLabel, { color: severityInfo.color }]}>
          {severityInfo.label}
        </Text>
        <Text style={styles.severityRecommendation}>{severityInfo.recommendation}</Text>
      </View>

      {renderGaugeChart(fusionResult.depression_score, severityInfo.color)}

      <View style={styles.confidenceCard}>
        <View style={styles.confidenceHeader}>
          <BarChart3 size={20} color="#667eea" />
          <Text style={styles.confidenceTitle}>置信度分析</Text>
        </View>
        <View style={styles.confidenceRow}>
          <View style={styles.confidenceItem}>
            <Text style={styles.confidenceValue}>{(fusionResult.confidence_score * 100).toFixed(1)}%</Text>
            <Text style={styles.confidenceLabel}>模型置信度</Text>
          </View>
          <View style={styles.confidenceDivider} />
          <View style={styles.confidenceItem}>
            <Text style={styles.confidenceValue}>
              [{fusionResult.confidence_interval[0].toFixed(1)}, {fusionResult.confidence_interval[1].toFixed(1)}]
            </Text>
            <Text style={styles.confidenceLabel}>95%置信区间</Text>
          </View>
        </View>
        <View style={styles.confidenceBarContainer}>
          <View style={styles.confidenceBarBg}>
            <View 
              style={[
                styles.confidenceBarFill, 
                { 
                  left: `${(fusionResult.confidence_interval[0] / 100) * 100}%`,
                  width: `${((fusionResult.confidence_interval[1] - fusionResult.confidence_interval[0]) / 100) * 100}%`,
                  backgroundColor: severityInfo.color 
                }
              ]} 
            />
            <View 
              style={[
                styles.confidenceBarPoint, 
                { 
                  left: `${(fusionResult.depression_score / 100) * 100}%`,
                  backgroundColor: severityInfo.color 
                }
              ]} 
            />
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <PieChart size={20} color="#667eea" />
        <Text style={styles.sectionTitle}>各模态贡献</Text>
      </View>

      <View style={styles.modalitiesContainer}>
        {fusionResult.modality_contributions.map((contribution: ModalityContribution, index: number) => {
          const Icon = getModalityIcon(contribution.modality);
          const color = getModalityColor(contribution.modality);
          return (
            <View key={contribution.modality} style={styles.modalityCard}>
              <View style={styles.modalityHeader}>
                <View style={[styles.modalityIcon, { backgroundColor: `${color}20` }]}>
                  <Icon size={20} color={color} />
                </View>
                <View style={styles.modalityInfo}>
                  <Text style={styles.modalityName}>{getModalityLabel(contribution.modality)}</Text>
                  <Text style={styles.modalityWeight}>
                    权重: {(contribution.normalized_weight * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={[styles.modalityScoreBadge, { backgroundColor: color }]}>
                  <Text style={styles.modalityScore}>{(contribution.contribution_score * 100).toFixed(1)}</Text>
                </View>
              </View>
              <View style={styles.modalityProgress}>
                <View 
                  style={[styles.modalityProgressFill, { 
                    width: `${contribution.normalized_weight * 100}%`,
                    backgroundColor: color 
                  }]} 
                />
              </View>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.detailsButton}
        onPress={() => setShowDetails(!showDetails)}
        activeOpacity={0.7}
      >
        <Info size={18} color="#667eea" />
        <Text style={styles.detailsButtonText}>
          {showDetails ? '隐藏详细信息' : '查看详细分析'}
        </Text>
      </TouchableOpacity>

      {showDetails && (
        <View style={styles.detailsContainer}>
          {result.visual_features && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>视觉特征</Text>
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>眼神回避</Text>
                  <Text style={styles.detailValue}>{(result.visual_features.gaze_avoidance_ratio * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>微笑频率</Text>
                  <Text style={styles.detailValue}>{result.visual_features.smile_frequency.toFixed(2)}/min</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>眨眼频率</Text>
                  <Text style={styles.detailValue}>{result.visual_features.blink_rate.toFixed(2)}/min</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>皱眉频率</Text>
                  <Text style={styles.detailValue}>{result.visual_features.frowning_frequency.toFixed(2)}/min</Text>
                </View>
              </View>
            </View>
          )}

          {result.audio_features && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>语音特征</Text>
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>语速</Text>
                  <Text style={styles.detailValue}>{result.audio_features.speech_rate.toFixed(1)} 词/分</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>基频范围</Text>
                  <Text style={styles.detailValue}>{result.audio_features.pitch_range.toFixed(1)} Hz</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>停顿占比</Text>
                  <Text style={styles.detailValue}>{(result.audio_features.pause_ratio * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>语音质量</Text>
                  <Text style={styles.detailValue}>{result.audio_features.hnr.toFixed(1)} dB</Text>
                </View>
              </View>
            </View>
          )}

          {result.text_features && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>文本特征</Text>
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>消极词汇</Text>
                  <Text style={styles.detailValue}>{(result.text_features.negative_word_ratio * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>第一人称</Text>
                  <Text style={styles.detailValue}>{(result.text_features.first_person_singular_ratio * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>情感评分</Text>
                  <Text style={styles.detailValue}>{result.text_features.sentiment_score.toFixed(2)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>过去时态</Text>
                  <Text style={styles.detailValue}>{(result.text_features.past_tense_ratio * 100).toFixed(1)}%</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {fusionResult.risk_factors && fusionResult.risk_factors.length > 0 && (
        <View style={styles.riskCard}>
          <AlertTriangle size={20} color="#ff922b" />
          <View style={styles.riskContent}>
            <Text style={styles.riskTitle}>风险因素</Text>
            {fusionResult.risk_factors.map((factor: string, index: number) => (
              <Text key={index} style={styles.riskItem}>• {factor}</Text>
            ))}
          </View>
        </View>
      )}

      {fusionResult.recommendations && fusionResult.recommendations.length > 0 && (
        <View style={styles.recommendationCard}>
          <CheckCircle2 size={20} color="#51cf66" />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>建议</Text>
            {fusionResult.recommendations.map((rec: string, index: number) => (
              <Text key={index} style={styles.recommendationItem}>• {rec}</Text>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.explainButton}
        onPress={handleViewExplainability}
        activeOpacity={0.7}
      >
        <Brain size={20} color="#fff" />
        <Text style={styles.explainButtonText}>查看AI决策解释</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.contributeButton, isTraining && styles.contributeButtonDisabled]}
        onPress={handleContributeToTraining}
        disabled={isTraining}
        activeOpacity={0.7}
      >
        {isTraining ? (
          <>
            <RefreshCw size={20} color="#667eea" style={{ animation: 'spin 1s linear infinite' }} />
            <Text style={styles.contributeButtonText}>正在贡献...</Text>
          </>
        ) : (
          <>
            <TrendingUp size={20} color="#667eea" />
            <Text style={styles.contributeButtonText}>贡献数据改进模型（联邦学习）</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.newAssessmentButton}
        onPress={handleNewAssessment}
        activeOpacity={0.7}
      >
        <Text style={styles.newAssessmentButtonText}>开始新的评估</Text>
      </TouchableOpacity>

      <View style={styles.disclaimer}>
        <Info size={16} color="#868e96" />
        <Text style={styles.disclaimerText}>
          本结果仅供研究参考，不作为医疗诊断依据。如有需要，请咨询专业医生。
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 20,
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
  severityCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  severityLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  severityRecommendation: {
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
    lineHeight: 20,
  },
  gaugeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  gaugeBackground: {
    width: 200,
    height: 100,
    overflow: 'hidden',
    position: 'relative',
  },
  gaugeFill: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  gaugeInner: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 0,
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  gaugeLabel: {
    fontSize: 12,
    color: '#868e96',
    marginTop: 4,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  gaugeMin: {
    fontSize: 12,
    color: '#868e96',
  },
  gaugeMax: {
    fontSize: 12,
    color: '#868e96',
  },
  confidenceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
  },
  confidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  confidenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  confidenceItem: {
    alignItems: 'center',
    flex: 1,
  },
  confidenceDivider: {
    width: 1,
    backgroundColor: '#e9ecef',
    marginHorizontal: 8,
  },
  confidenceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea',
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#868e96',
    marginTop: 4,
  },
  confidenceBarContainer: {
    paddingHorizontal: 8,
  },
  confidenceBarBg: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    position: 'relative',
  },
  confidenceBarFill: {
    position: 'absolute',
    height: '100%',
    borderRadius: 4,
    opacity: 0.6,
  },
  confidenceBarPoint: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: -2,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalitiesContainer: {
    gap: 12,
    marginBottom: 20,
  },
  modalityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  modalityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  modalityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalityInfo: {
    flex: 1,
  },
  modalityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalityWeight: {
    fontSize: 12,
    color: '#868e96',
    marginTop: 2,
  },
  modalityScoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalityScore: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalityProgress: {
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    overflow: 'hidden',
  },
  modalityProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: '#e7f5ff',
    borderRadius: 8,
  },
  detailsButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
  detailsContainer: {
    marginBottom: 20,
    gap: 16,
  },
  detailSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    width: '47%',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#868e96',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  riskCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff4e6',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffd8a8',
  },
  riskContent: {
    flex: 1,
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d9480f',
    marginBottom: 8,
  },
  riskItem: {
    fontSize: 13,
    color: '#868e96',
    lineHeight: 20,
  },
  recommendationCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#ebfbee',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#b2f2bb',
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2f9e44',
    marginBottom: 8,
  },
  recommendationItem: {
    fontSize: 13,
    color: '#868e96',
    lineHeight: 20,
  },
  explainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3,
  },
  explainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  contributeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  contributeButtonDisabled: {
    opacity: 0.7,
  },
  contributeButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  newAssessmentButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#495057',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  newAssessmentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: '#868e96',
    lineHeight: 16,
  },
});

export default ResultsScreen;

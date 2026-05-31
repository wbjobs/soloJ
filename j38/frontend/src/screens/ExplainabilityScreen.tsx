import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  ArrowLeft, 
  Brain, 
  Info, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Mic, 
  FileText,
  Layers,
  GitBranch,
  BarChart2,
  PieChart as PieChartIcon,
  Lightbulb
} from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { getExplainability } from '../services/api';
import type { ExplainabilityResult, ModalityContribution } from '../types';

type RootStackParamList = {
  Home: undefined;
  DataCollection: undefined;
  Results: undefined;
  Explainability: { sessionId: string };
  History: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  sessionId: string;
};

const ExplainabilityScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { state } = useAppState();
  const [explainability, setExplainability] = useState<ExplainabilityResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'path'>('overview');

  const params = route.params as RouteParams;
  const sessionId = params?.sessionId || state.sessionId;

  useEffect(() => {
    loadExplainability();
  }, [sessionId]);

  const loadExplainability = async () => {
    try {
      setIsLoading(true);
      const result = await getExplainability(sessionId);
      setExplainability(result);
    } catch (error: any) {
      console.error('Load explainability error:', error);
      Alert.alert('加载失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const getModalityIcon = (modality: string) => {
    switch (modality) {
      case 'visual': return Eye;
      case 'audio': return Mic;
      case 'text': return FileText;
      default: return Brain;
    }
  };

  const getModalityLabel = (modality: string) => {
    switch (modality) {
      case 'visual': return '视觉模态';
      case 'audio': return '语音模态';
      case 'text': return '文本模态';
      default: return modality;
    }
  };

  const getModalityColor = (modality: string) => {
    switch (modality) {
      case 'visual': return '#667eea';
      case 'audio': return '#f093fb';
      case 'text': return '#4facfe';
      default: return '#adb5bd';
    }
  };

  const getDirectionColor = (direction: 'increasing' | 'decreasing') => {
    return direction === 'increasing' ? '#ff6b6b' : '#51cf66';
  };

  const getDirectionIcon = (direction: 'increasing' | 'decreasing') => {
    return direction === 'increasing' ? TrendingUp : TrendingDown;
  };

  const renderSHAPBarChart = () => {
    if (!explainability?.feature_importance) return null;

    const topFeatures = explainability.feature_importance.slice(0, 10);
    const maxAbsValue = Math.max(...topFeatures.map(f => Math.abs(f.shap_value)));

    return (
      <View style={styles.chartContainer}>
        {topFeatures.map((feature, index) => {
          const DirectionIcon = getDirectionIcon(feature.direction);
          const directionColor = getDirectionColor(feature.direction);
          const barWidth = (Math.abs(feature.shap_value) / maxAbsValue) * 80;
          const isPositive = feature.direction === 'increasing';

          return (
            <View key={index} style={styles.barItem}>
              <View style={styles.barLabelContainer}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {feature.feature}
                </Text>
                <Text style={[styles.barModality, { color: getModalityColor(feature.modality) }]}>
                  {getModalityLabel(feature.modality)}
                </Text>
              </View>
              <View style={styles.barRow}>
                <View style={[styles.barTrack, { justifyContent: 'flex-end' }]}>
                  {!isPositive && (
                    <View 
                      style={[
                        styles.barFill, 
                        { 
                          width: `${barWidth}%`, 
                          backgroundColor: directionColor,
                          marginRight: 'auto'
                        }
                      ]} 
                    />
                  )}
                </View>
                <View style={styles.barCenter} />
                <View style={styles.barTrack}>
                  {isPositive && (
                    <View 
                      style={[
                        styles.barFill, 
                        { 
                          width: `${barWidth}%`, 
                          backgroundColor: directionColor 
                        }
                      ]} 
                    />
                  )}
                </View>
                <View style={styles.barValue}>
                  <DirectionIcon size={14} color={directionColor} />
                  <Text style={[styles.barValueText, { color: directionColor }]}>
                    {feature.shap_value.toFixed(3)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#51cf66' }]} />
            <Text style={styles.legendText}>降低风险</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ff6b6b' }]} />
            <Text style={styles.legendText}>增加风险</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderModalityContributions = () => {
    if (!explainability?.modality_contributions) return null;

    return (
      <View style={styles.modalitiesContainer}>
        {explainability.modality_contributions.map((contribution: ModalityContribution, index: number) => {
          const Icon = getModalityIcon(contribution.modality);
          const color = getModalityColor(contribution.modality);
          const percentage = contribution.normalized_weight * 100;

          return (
            <View key={contribution.modality} style={styles.modalityCard}>
              <View style={styles.modalityHeader}>
                <View style={[styles.modalityIcon, { backgroundColor: `${color}20` }]}>
                  <Icon size={24} color={color} />
                </View>
                <View style={styles.modalityInfo}>
                  <Text style={styles.modalityName}>{getModalityLabel(contribution.modality)}</Text>
                  <Text style={styles.modalityWeight}>
                    权重: {percentage.toFixed(1)}%
                  </Text>
                </View>
                <View style={[styles.modalityScoreBadge, { backgroundColor: color }]}>
                  <Text style={styles.modalityScore}>
                    {(contribution.contribution_score * 100).toFixed(1)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.modalityProgress}>
                <View 
                  style={[
                    styles.modalityProgressFill, 
                    { width: `${percentage}%`, backgroundColor: color }
                  ]} 
                />
              </View>

              {contribution.top_features && contribution.top_features.length > 0 && (
                <View style={styles.topFeatures}>
                  <Text style={styles.topFeaturesTitle}>关键特征</Text>
                  {contribution.top_features.map((feature, fIndex) => (
                    <View key={fIndex} style={styles.featureRow}>
                      <Text style={styles.featureName}>{feature.feature}</Text>
                      <Text style={styles.featureValue}>
                        {feature.value.toFixed(2)}
                      </Text>
                      <View style={[
                        styles.featureImportanceBar,
                        { width: `${Math.min(feature.importance * 100, 100)}%` }
                      ]} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderDecisionPath = () => {
    if (!explainability?.decision_path) return null;

    return (
      <View style={styles.decisionPathContainer}>
        {explainability.decision_path.map((step, index) => {
          const isLast = index === explainability.decision_path!.length - 1;
          const color = getModalityColor(step.modality);
          const scoreChange = step.score_change;
          const isPositive = scoreChange > 0;

          return (
            <View key={step.step} style={styles.decisionStep}>
              <View style={styles.stepConnector}>
                <View style={[styles.stepDot, { backgroundColor: color }]} />
                {!isLast && <View style={[styles.stepLine, { backgroundColor: color }]} />}
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Text style={[styles.stepName, { color }]}>{step.name}</Text>
                  <View style={[
                    styles.stepChangeBadge,
                    { backgroundColor: isPositive ? '#ffe3e3' : '#d3f9d8' }
                  ]}>
                    <Text style={[
                      styles.stepChange,
                      { color: isPositive ? '#c92a2a' : '#2f9e44' }
                    ]}>
                      {isPositive ? '+' : ''}{scoreChange.toFixed(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.stepDescription}>{step.description}</Text>
                <View style={styles.stepScoreRow}>
                  <Text style={styles.stepScoreLabel}>当前评分: </Text>
                  <Text style={[styles.stepScoreValue, { color }]}>
                    {step.current_score.toFixed(1)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Brain size={48} color="#667eea" style={{ marginBottom: 16 }} />
        <Text style={styles.loadingText}>正在加载可解释性分析...</Text>
        <Text style={styles.loadingSubtext}>计算SHAP值和特征重要性</Text>
      </View>
    );
  }

  if (!explainability) {
    return (
      <View style={styles.errorContainer}>
        <Info size={48} color="#ff6b6b" style={{ marginBottom: 16 }} />
        <Text style={styles.errorText}>无法加载可解释性分析</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadExplainability}
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tabs = [
    { key: 'overview', label: '模态贡献', icon: PieChartIcon },
    { key: 'features', label: '特征分析', icon: BarChart2 },
    { key: 'path', label: '决策路径', icon: GitBranch },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI决策解释</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.introCard}>
        <Lightbulb size={24} color="#fcc419" />
        <View style={styles.introContent}>
          <Text style={styles.introTitle}>可解释性分析</Text>
          <Text style={styles.introText}>
            基于SHAP值分析，展示每个特征对最终抑郁倾向评分的贡献程度。
            正值表示增加风险，负值表示降低风险。
          </Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive
              ]}
              onPress={() => setActiveTab(tab.key as 'overview' | 'features' | 'path')}
              activeOpacity={0.7}
            >
              <Icon size={18} color={activeTab === tab.key ? '#667eea' : '#868e96'} />
              <Text style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && (
          <>
            <Text style={styles.sectionTitle}>各模态贡献权重</Text>
            {renderModalityContributions()}
          </>
        )}

        {activeTab === 'features' && (
          <>
            <Text style={styles.sectionTitle}>SHAP特征重要性 (Top 10)</Text>
            {renderSHAPBarChart()}
          </>
        )}

        {activeTab === 'path' && (
          <>
            <Text style={styles.sectionTitle}>AI决策路径</Text>
            {renderDecisionPath()}
          </>
        )}

        <View style={styles.infoCard}>
          <Info size={20} color="#667eea" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>关于SHAP值</Text>
            <Text style={styles.infoText}>
              SHAP (SHapley Additive exPlanations) 是一种基于博弈论的模型解释方法，
              能够量化每个特征对模型预测结果的贡献。正值表示该特征增加了抑郁倾向风险，
              负值表示该特征降低了风险。
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 13,
    color: '#868e96',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#868e96',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  introCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff9db',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffec99',
  },
  introContent: {
    flex: 1,
  },
  introTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f08c00',
    marginBottom: 4,
  },
  introText: {
    fontSize: 12,
    color: '#868e96',
    lineHeight: 18,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f3f5',
  },
  tabButtonActive: {
    backgroundColor: '#667eea20',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  tabText: {
    fontSize: 12,
    color: '#868e96',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  modalitiesContainer: {
    gap: 16,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalityInfo: {
    flex: 1,
  },
  modalityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalityWeight: {
    fontSize: 13,
    color: '#868e96',
    marginTop: 2,
  },
  modalityScoreBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalityScore: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalityProgress: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  modalityProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  topFeatures: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
  },
  topFeaturesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  featureName: {
    fontSize: 12,
    color: '#333',
    width: 100,
  },
  featureValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
    width: 50,
    textAlign: 'right',
  },
  featureImportanceBar: {
    height: 6,
    backgroundColor: '#667eea',
    borderRadius: 3,
    maxWidth: 120,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  barItem: {
    marginBottom: 16,
  },
  barLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  barModality: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: '#f1f3f5',
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barCenter: {
    width: 2,
    height: 16,
    backgroundColor: '#adb5bd',
    marginHorizontal: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  barValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 60,
    justifyContent: 'flex-end',
  },
  barValueText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  decisionPathContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  decisionStep: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stepConnector: {
    alignItems: 'center',
    marginRight: 12,
  },
  stepDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#fff',
    zIndex: 1,
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 60,
    marginTop: -2,
    opacity: 0.3,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepName: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepChangeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  stepChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepDescription: {
    fontSize: 12,
    color: '#868e96',
    marginBottom: 8,
    lineHeight: 18,
  },
  stepScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepScoreLabel: {
    fontSize: 12,
    color: '#666',
  },
  stepScoreValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#e7f5ff',
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#a5d8ff',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1971c2',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#495057',
    lineHeight: 18,
  },
});

export default ExplainabilityScreen;

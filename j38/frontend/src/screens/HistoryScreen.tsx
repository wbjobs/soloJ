import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  ArrowLeft, 
  History, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Clock,
  Eye,
  Mic,
  FileText,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Brain
} from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { getUserRecords } from '../services/api';
import type { UserRecord, DepressionSeverity } from '../types';

type RootStackParamList = {
  Home: undefined;
  DataCollection: undefined;
  Results: undefined;
  Explainability: { sessionId: string };
  History: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { state, dispatch } = useAppState();
  const [records, setRecords] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | 'all'>('all');

  useEffect(() => {
    loadRecords();
  }, [state.userId]);

  const loadRecords = async () => {
    try {
      setIsLoading(true);
      const response = await getUserRecords(state.userId, 50);
      setRecords(response.records);
    } catch (error: any) {
      console.error('Load records error:', error);
      Alert.alert('加载失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityInfo = (severity: DepressionSeverity) => {
    const info = {
      none: { label: '无', color: '#51cf66', bgColor: '#d3f9d8', icon: '😊' },
      mild: { label: '轻度', color: '#fcc419', bgColor: '#fff3bf', icon: '😐' },
      moderate: { label: '中度', color: '#ff922b', bgColor: '#ffe8cc', icon: '😔' },
      severe: { label: '重度', color: '#ff6b6b', bgColor: '#ffe3e3', icon: '😢' }
    };
    return info[severity] || info.none;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const handleViewRecord = (record: UserRecord) => {
    dispatch({ type: 'SET_SESSION_ID', payload: record.session_id });
    dispatch({ 
      type: 'SET_ANALYSIS_RESULT', 
      payload: {
        session_id: record.session_id,
        request_id: '',
        timestamp: record.created_at,
        visual_features: record.visual_features,
        audio_features: record.audio_features,
        text_features: record.text_features,
        fusion_result: record.fusion_result,
        status: 'completed'
      }
    });
    navigation.navigate('Results');
  };

  const getTrendData = () => {
    if (records.length < 2) return null;

    const recentScores = records
      .filter(r => r.fusion_result)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(r => r.fusion_result!.depression_score);

    if (recentScores.length < 2) return null;

    const firstScore = recentScores[0];
    const lastScore = recentScores[recentScores.length - 1];
    const change = lastScore - firstScore;
    const isImproving = change < 0;

    return {
      change,
      isImproving,
      percentage: Math.abs((change / firstScore) * 100)
    };
  };

  const getAverageScore = () => {
    const scores = records.filter(r => r.fusion_result).map(r => r.fusion_result!.depression_score);
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const filteredRecords = () => {
    const now = new Date();
    return records.filter(record => {
      const recordDate = new Date(record.created_at);
      const diffMs = now.getTime() - recordDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      switch (selectedTimeRange) {
        case '7d': return diffDays <= 7;
        case '30d': return diffDays <= 30;
        default: return true;
      }
    });
  };

  const renderScoreChart = () => {
    const chartRecords = filteredRecords()
      .filter(r => r.fusion_result)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (chartRecords.length === 0) return null;

    const maxScore = 100;
    const chartHeight = 120;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>评分趋势</Text>
        <View style={styles.chart}>
          {chartRecords.map((record, index) => {
            const score = record.fusion_result!.depression_score;
            const height = (score / maxScore) * chartHeight;
            const severityInfo = getSeverityInfo(record.fusion_result!.severity);

            return (
              <View key={record.session_id} style={styles.chartBarContainer}>
                <View style={styles.chartBarWrapper}>
                  <View 
                    style={[
                      styles.chartBar, 
                      { 
                        height: height, 
                        backgroundColor: severityInfo.color 
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.chartBarLabel}>
                  {index + 1}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#51cf66' }]} />
            <Text style={styles.legendText}>无 (0-25)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#fcc419' }]} />
            <Text style={styles.legendText}>轻度 (26-50)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ff922b' }]} />
            <Text style={styles.legendText}>中度 (51-75)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ff6b6b' }]} />
            <Text style={styles.legendText}>重度 (76-100)</Text>
          </View>
        </View>
      </View>
    );
  };

  const trendData = getTrendData();
  const averageScore = getAverageScore();
  const displayRecords = filteredRecords();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>正在加载历史记录...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>历史记录</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={loadRecords}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <RefreshCw size={20} color="#667eea" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>总评估次数</Text>
            <Text style={[styles.statValue, { color: '#667eea' }]}>{records.length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>平均评分</Text>
            <Text style={[styles.statValue, { color: '#f093fb' }]}>
              {averageScore ? averageScore.toFixed(1) : '-'}
            </Text>
          </View>
          {trendData && (
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>趋势</Text>
              <View style={styles.trendRow}>
                {trendData.isImproving ? (
                  <TrendingDown size={18} color="#51cf66" />
                ) : (
                  <TrendingUp size={18} color="#ff6b6b" />
                )}
                <Text style={[
                  styles.trendValue,
                  { color: trendData.isImproving ? '#51cf66' : '#ff6b6b' }
                ]}>
                  {trendData.isImproving ? '-' : '+'}{trendData.percentage.toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.timeRangeContainer}>
          {(['7d', '30d', 'all'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                selectedTimeRange === range && styles.timeRangeButtonActive
              ]}
              onPress={() => setSelectedTimeRange(range)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.timeRangeText,
                selectedTimeRange === range && styles.timeRangeTextActive
              ]}>
                {range === '7d' ? '最近7天' : range === '30d' ? '最近30天' : '全部'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {records.length > 0 && renderScoreChart()}

        <View style={styles.sectionHeader}>
          <History size={20} color="#667eea" />
          <Text style={styles.sectionTitle}>评估记录</Text>
          <Text style={styles.recordCount}>{displayRecords.length} 条记录</Text>
        </View>

        {displayRecords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <History size={48} color="#adb5bd" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>暂无历史记录</Text>
            <Text style={styles.emptySubtitle}>完成第一次评估后，记录将显示在这里</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('DataCollection')}
              activeOpacity={0.7}
            >
              <Brain size={18} color="#fff" />
              <Text style={styles.emptyButtonText}>开始评估</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.recordsList}>
            {displayRecords.map((record) => {
              if (!record.fusion_result) return null;
              const severityInfo = getSeverityInfo(record.fusion_result.severity);
              
              return (
                <TouchableOpacity
                  key={record.session_id}
                  style={styles.recordCard}
                  onPress={() => handleViewRecord(record)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordEmoji}>{severityInfo.icon}</Text>
                    <View style={styles.recordInfo}>
                      <View style={styles.recordTitleRow}>
                        <Text style={[styles.recordSeverity, { color: severityInfo.color }]}>
                          {severityInfo.label}抑郁倾向
                        </Text>
                        <Text style={[styles.recordScore, { color: severityInfo.color }]}>
                          {record.fusion_result.depression_score.toFixed(1)}
                        </Text>
                      </View>
                      <View style={styles.recordMeta}>
                        <View style={styles.metaItem}>
                          <Calendar size={12} color="#868e96" />
                          <Text style={styles.metaText}>{formatDate(record.created_at)}</Text>
                        </View>
                        {record.federated_gradient_uploaded && (
                          <View style={styles.contributedBadge}>
                            <TrendingUp size={10} color="#51cf66" />
                            <Text style={styles.contributedText}>已贡献</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <ChevronRight size={20} color="#adb5bd" />
                  </View>

                  <View style={styles.recordModalities}>
                    {record.visual_features && (
                      <View style={styles.modalityTag}>
                        <Eye size={12} color="#667eea" />
                        <Text style={styles.modalityTagText}>视觉</Text>
                      </View>
                    )}
                    {record.audio_features && (
                      <View style={styles.modalityTag}>
                        <Mic size={12} color="#f093fb" />
                        <Text style={styles.modalityTagText}>语音</Text>
                      </View>
                    )}
                    {record.text_features && (
                      <View style={styles.modalityTag}>
                        <FileText size={12} color="#4facfe" />
                        <Text style={styles.modalityTagText}>文本</Text>
                      </View>
                    )}
                  </View>

                  {record.fusion_result.risk_factors && record.fusion_result.risk_factors.length > 0 && (
                    <View style={styles.recordRisk}>
                      <AlertCircle size={12} color="#ff922b" />
                      <Text style={styles.recordRiskText} numberOfLines={1}>
                        {record.fusion_result.risk_factors[0]}
                        {record.fusion_result.risk_factors.length > 1 && ` 等${record.fusion_result.risk_factors.length}项`}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.privacyNote}>
          <History size={16} color="#868e96" />
          <Text style={styles.privacyNoteText}>
            您的历史记录仅保存在本地服务器，用于您个人参考和研究分析。
            您可以随时请求删除您的数据。
          </Text>
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#868e96',
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
  refreshButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#868e96',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeRangeButtonActive: {
    backgroundColor: '#667eea20',
    borderColor: '#667eea',
  },
  timeRangeText: {
    fontSize: 13,
    color: '#868e96',
    fontWeight: '500',
  },
  timeRangeTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarWrapper: {
    height: 120,
    width: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    color: '#868e96',
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#666',
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
  recordCount: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#868e96',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#868e96',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  recordsList: {
    gap: 12,
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  recordEmoji: {
    fontSize: 32,
  },
  recordInfo: {
    flex: 1,
  },
  recordTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recordSeverity: {
    fontSize: 14,
    fontWeight: '600',
  },
  recordScore: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  recordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#868e96',
  },
  contributedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d3f9d8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  contributedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2f9e44',
  },
  recordModalities: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modalityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f3f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalityTagText: {
    fontSize: 11,
    color: '#495057',
    fontWeight: '500',
  },
  recordRisk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  recordRiskText: {
    fontSize: 12,
    color: '#868e96',
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: '#f1f3f5',
    borderRadius: 12,
    marginTop: 20,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#868e96',
    lineHeight: 16,
  },
});

export default HistoryScreen;

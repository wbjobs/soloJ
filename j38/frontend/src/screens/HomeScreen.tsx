import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Camera, Mic, Keyboard, Brain, Shield, BarChart3, Play, History, Info } from 'lucide-react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppState } from '../context/AppStateContext';
import { healthCheck, getStatistics } from '../services/api';

type RootStackParamList = {
  Home: undefined;
  DataCollection: undefined;
  Results: undefined;
  Explainability: undefined;
  History: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { state, generateNewSession } = useAppState();
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      setIsLoading(true);
      const health = await healthCheck();
      setIsConnected(health.status === 'healthy');
      
      const statistics = await getStatistics();
      setStats(statistics);
    } catch (error) {
      console.error('Backend connection error:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewAssessment = () => {
    generateNewSession();
    navigation.navigate('DataCollection');
  };

  const viewHistory = () => {
    navigation.navigate('History');
  };

  const features = [
    {
      icon: Camera,
      title: '视觉分析',
      description: '通过面部表情、眼神、头部姿态分析情绪状态',
      color: '#667eea'
    },
    {
      icon: Mic,
      title: '语音分析',
      description: '分析语速、语调、停顿模式等语音特征',
      color: '#f093fb'
    },
    {
      icon: Keyboard,
      title: '文本与打字分析',
      description: '分析用词倾向和打字节奏模式',
      color: '#4facfe'
    },
    {
      icon: Brain,
      title: '多模态融合',
      description: '多头注意力机制融合三模态特征',
      color: '#43e97b'
    },
    {
      icon: Shield,
      title: '隐私保护',
      description: '联邦学习框架，数据不出本地',
      color: '#fa709a'
    },
    {
      icon: BarChart3,
      title: '可解释性',
      description: '透明的决策过程，可视化各模态贡献',
      color: '#fee140'
    }
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Brain size={36} color="#667eea" />
          <View style={styles.titleContainer}>
            <Text style={styles.title}>多模态抑郁倾向筛查系统</Text>
            <Text style={styles.subtitle}>Multimodal Depression Screening System</Text>
          </View>
        </View>
        
        <View style={[
          styles.statusBadge,
          isConnected ? styles.statusConnected : styles.statusDisconnected
        ]}>
          <View style={[
            styles.statusDot,
            isConnected ? styles.dotGreen : styles.dotRed
          ]} />
          <Text style={styles.statusText}>
            {isLoading ? '连接中...' : isConnected ? '后端服务已连接' : '后端服务未连接'}
          </Text>
        </View>
      </View>

      <View style={styles.disclaimerCard}>
        <Info size={20} color="#ff6b6b" />
        <View style={styles.disclaimerContent}>
          <Text style={styles.disclaimerTitle}>研究用途声明</Text>
          <Text style={styles.disclaimerText}>
            本系统仅供学术研究使用，不能替代专业医疗诊断。如有抑郁症状，请及时寻求专业医生帮助。
            所有数据将严格保密，仅用于研究分析。
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={startNewAssessment}
          activeOpacity={0.8}
        >
          <Play size={24} color="#fff" />
          <Text style={styles.primaryButtonText}>开始新的评估</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={viewHistory}
          activeOpacity={0.8}
        >
          <History size={20} color="#667eea" />
          <Text style={styles.secondaryButtonText}>查看历史记录</Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>系统统计</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total_records}</Text>
              <Text style={styles.statLabel}>总评估数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.average_depression_score?.toFixed(1) || '-'}</Text>
              <Text style={styles.statLabel}>平均评分</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.federated_round || 0}</Text>
              <Text style={styles.statLabel}>联邦轮次</Text>
            </View>
          </View>
          {stats.severity_distribution && (
            <View style={styles.severityRow}>
              <Text style={styles.severityLabel}>分布：</Text>
              {Object.entries(stats.severity_distribution).map(([key, value]) => (
                <Text key={key} style={styles.severityItem}>
                  {key}: {value as number}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={styles.featuresTitle}>系统功能</Text>
      <View style={styles.featuresGrid}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
              <feature.icon size={28} color={feature.color} />
            </View>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureDescription}>{feature.description}</Text>
          </View>
        ))}
      </View>

      <View style={styles.privacyCard}>
        <Shield size={24} color="#51cf66" />
        <View style={styles.privacyContent}>
          <Text style={styles.privacyTitle}>隐私保护机制</Text>
          <Text style={styles.privacyText}>
            采用联邦学习框架，模型训练在本地完成，仅上传模型梯度，原始数据不会离开您的设备。
            我们严格遵守数据最小化原则，保护您的隐私安全。
          </Text>
        </View>
      </View>

      <Text style={styles.footer}>
        © 2024 多模态抑郁倾向筛查研究项目 | 仅供研究使用
      </Text>
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
  header: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusConnected: {
    backgroundColor: '#d3f9d8',
  },
  statusDisconnected: {
    backgroundColor: '#ffe3e3',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: '#51cf66',
  },
  dotRed: {
    backgroundColor: '#ff6b6b',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  disclaimerCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ffc9c9',
  },
  disclaimerContent: {
    flex: 1,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b6b',
    marginBottom: 4,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#868e96',
    lineHeight: 18,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#667eea',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  secondaryButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  severityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  severityLabel: {
    fontSize: 12,
    color: '#666',
  },
  severityItem: {
    fontSize: 12,
    color: '#868e96',
    backgroundColor: '#f1f3f5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
  privacyCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#ebfbee',
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#b2f2bb',
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2f9e44',
    marginBottom: 4,
  },
  privacyText: {
    fontSize: 12,
    color: '#868e96',
    lineHeight: 18,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#adb5bd',
    marginTop: 20,
  },
});

export default HomeScreen;

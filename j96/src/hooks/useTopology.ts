import { useMemo } from 'react';
import { useTopologyStore } from '../stores/useTopologyStore';
import type { ServiceNode, CallEdge } from '../../shared/types';

/**
 * 拓扑数据自定义 Hook
 * 封装 Store 的常用操作，提供过滤后的数据和刷新方法
 */
export function useTopology() {
  const {
    topologyData,
    selectedService,
    selectedTab,
    loading,
    error,
    serviceFilter,
    statusFilter,
    maxDepth,
    isTimeout,
    fetchTopology,
    selectService,
    setSelectedTab,
    toggleServiceFilter,
    toggleStatusFilter,
    generateMockData,
    clearData,
    setMaxDepth,
  } = useTopologyStore();

  /**
   * 根据过滤器筛选节点
   */
  const filteredNodes = useMemo<ServiceNode[]>(() => {
    if (!topologyData?.nodes) return [];

    return topologyData.nodes.filter((node) => {
      if (serviceFilter.length > 0 && !serviceFilter.includes(node.id)) {
        return false;
      }
      if (statusFilter.length > 0 && !statusFilter.includes(node.status)) {
        return false;
      }
      return true;
    });
  }, [topologyData?.nodes, serviceFilter, statusFilter]);

  /**
   * 根据过滤器筛选边（只保留两端节点都在过滤结果中的边）
   */
  const filteredEdges = useMemo<CallEdge[]>(() => {
    if (!topologyData?.edges) return [];

    const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));

    return topologyData.edges.filter(
      (edge) =>
        filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target),
    );
  }, [topologyData?.edges, filteredNodes]);

  /**
   * 刷新拓扑数据
   */
  const refresh = () => {
    return fetchTopology();
  };

  return {
    topologyData,
    selectedService,
    selectedTab,
    loading,
    error,
    serviceFilter,
    statusFilter,
    maxDepth,
    isTimeout,
    filteredNodes,
    filteredEdges,
    fetchTopology,
    selectService,
    setSelectedTab,
    toggleServiceFilter,
    toggleStatusFilter,
    generateMockData,
    clearData,
    setMaxDepth,
    refresh,
  };
}

import { create } from 'zustand';
import type {
  TopologyData,
  ServiceNode,
  ServiceStatus,
} from '../../shared/types';
import {
  getTopology,
  generateMockData,
  clearMockData,
} from '../services/api';

const MAX_RETRIES = 2;
const RETRY_DELAYS = [2000, 5000];

interface TopologyState {
  topologyData: TopologyData | null;
  selectedService: ServiceNode | null;
  selectedTab: 'spans' | 'errors';
  loading: boolean;
  error: string | null;
  serviceFilter: string[];
  statusFilter: ServiceStatus[];
  maxDepth: number;
  isTimeout: boolean;
}

interface TopologyActions {
  fetchTopology: (retryCount?: number) => Promise<void>;
  selectService: (service: ServiceNode | null) => void;
  setSelectedTab: (tab: 'spans' | 'errors') => void;
  toggleServiceFilter: (serviceId: string) => void;
  toggleStatusFilter: (status: ServiceStatus) => void;
  generateMockData: (maxDepth?: number) => Promise<void>;
  clearData: () => Promise<void>;
  setMaxDepth: (depth: number) => void;
}

export const useTopologyStore = create<TopologyState & TopologyActions>(
  (set, get) => ({
    topologyData: null,
    selectedService: null,
    selectedTab: 'spans',
    loading: false,
    error: null,
    serviceFilter: [],
    statusFilter: [],
    maxDepth: 10,
    isTimeout: false,

    fetchTopology: async (retryCount = 0) => {
      set({ loading: true, error: null, isTimeout: false });
      try {
        const { maxDepth } = get();
        const depth = retryCount > 0 ? Math.max(maxDepth - retryCount * 2, 3) : maxDepth;
        const response = await getTopology(depth);
        if (response.success && response.data) {
          set({ topologyData: response.data, isTimeout: false });
        } else {
          const isTimeout = response.error?.includes('超时') || response.error?.includes('timeout');
          if (isTimeout && retryCount < MAX_RETRIES) {
            set({ loading: false });
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[retryCount] || 5000));
            return get().fetchTopology(retryCount + 1);
          }
          set({ error: response.error || '获取拓扑数据失败', isTimeout });
        }
      } catch (err: any) {
        set({ error: err.message || '获取拓扑数据失败' });
      } finally {
        set({ loading: false });
      }
    },

    selectService: (service) => {
      set({ selectedService: service });
    },

    setSelectedTab: (tab) => {
      set({ selectedTab: tab });
    },

    toggleServiceFilter: (serviceId) => {
      const { serviceFilter } = get();
      const hasFilter = serviceFilter.includes(serviceId);
      set({
        serviceFilter: hasFilter
          ? serviceFilter.filter((id) => id !== serviceId)
          : [...serviceFilter, serviceId],
      });
    },

    toggleStatusFilter: (status) => {
      const { statusFilter } = get();
      const hasFilter = statusFilter.includes(status);
      set({
        statusFilter: hasFilter
          ? statusFilter.filter((s) => s !== status)
          : [...statusFilter, status],
      });
    },

    generateMockData: async (maxDepth?: number) => {
      set({ loading: true, error: null, isTimeout: false });
      try {
        const response = await generateMockData({
          serviceCount: 8,
          traceCount: 100,
          errorRate: 0.1,
          maxDepth,
        });
        if (response.success) {
          if (maxDepth && maxDepth > 10) {
            set({ maxDepth: Math.ceil(maxDepth * 0.8) });
          }
          await get().fetchTopology();
        } else {
          set({ error: response.error || '生成模拟数据失败' });
        }
      } catch (err: any) {
        set({ error: err.message || '生成模拟数据失败' });
      } finally {
        set({ loading: false });
      }
    },

    clearData: async () => {
      set({ loading: true, error: null });
      try {
        const response = await clearMockData();
        if (response.success) {
          set({ topologyData: null, selectedService: null, maxDepth: 10 });
        } else {
          set({ error: response.error || '清除数据失败' });
        }
      } catch (err: any) {
        set({ error: err.message || '清除数据失败' });
      } finally {
        set({ loading: false });
      }
    },

    setMaxDepth: (depth) => {
      set({ maxDepth: depth });
    },
  }),
);

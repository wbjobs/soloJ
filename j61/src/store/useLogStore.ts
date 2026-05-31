import { create } from 'zustand';
import type { LogEntry, LogLevel } from '../../shared/types';
import { SERVICES, LOG_LEVELS } from '../../shared/types';

const MAX_LOGS = 2000;
const MAX_RENDER_LOGS = 200;

interface LogState {
  allLogs: LogEntry[];
  connected: boolean;
  selectedService: string | null;
  selectedLevels: LogLevel[];
  autoScroll: boolean;
  totalCount: number;
  serviceCounts: Record<string, number>;
  levelCounts: Record<LogLevel, number>;
  searchKeyword: string;
  alertEnabled: boolean;
  hasAlert: boolean;
  alertMessage: string | null;

  addLogs: (logs: LogEntry[]) => void;
  setLogs: (logs: LogEntry[]) => void;
  setConnected: (connected: boolean) => void;
  setSelectedService: (service: string | null) => void;
  toggleLevel: (level: LogLevel) => void;
  setAutoScroll: (autoScroll: boolean) => void;
  setSearchKeyword: (keyword: string) => void;
  setAlertEnabled: (enabled: boolean) => void;
  triggerAlert: (message: string) => void;
  dismissAlert: () => void;
  resetFilters: () => void;

  getFilteredLogs: () => LogEntry[];
}

function countStats(logs: LogEntry[]): {
  serviceCounts: Record<string, number>;
  levelCounts: Record<LogLevel, number>;
} {
  const serviceCounts: Record<string, number> = {};
  const levelCounts: Record<LogLevel, number> = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };
  logs.forEach((log) => {
    serviceCounts[log.serviceName] = (serviceCounts[log.serviceName] || 0) + 1;
    levelCounts[log.level] = (levelCounts[log.level] || 0) + 1;
  });
  return { serviceCounts, levelCounts };
}

export const useLogStore = create<LogState>((set, get) => ({
  allLogs: [],
  connected: false,
  selectedService: null,
  selectedLevels: [...LOG_LEVELS],
  autoScroll: true,
  totalCount: 0,
  serviceCounts: {},
  levelCounts: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 },
  searchKeyword: '',
  alertEnabled: true,
  hasAlert: false,
  alertMessage: null,

  addLogs: (newLogs) =>
    set((state) => {
      const combined = [...state.allLogs, ...newLogs];
      const trimmed = combined.length > MAX_LOGS ? combined.slice(-MAX_LOGS) : combined;
      const { serviceCounts, levelCounts } = countStats(trimmed);
      return {
        allLogs: trimmed,
        totalCount: state.totalCount + newLogs.length,
        serviceCounts,
        levelCounts,
      };
    }),

  setLogs: (logs) =>
    set(() => {
      const { serviceCounts, levelCounts } = countStats(logs);
      return {
        allLogs: logs,
        totalCount: logs.length,
        serviceCounts,
        levelCounts,
      };
    }),

  setConnected: (connected) => set({ connected }),

  setSelectedService: (service) => set({ selectedService: service }),

  toggleLevel: (level) =>
    set((state) => {
      const hasLevel = state.selectedLevels.includes(level);
      if (hasLevel) {
        if (state.selectedLevels.length === 1) {
          return state;
        }
        return {
          selectedLevels: state.selectedLevels.filter((l) => l !== level),
        };
      }
      return {
        selectedLevels: [...state.selectedLevels, level],
      };
    }),

  setAutoScroll: (autoScroll) => set({ autoScroll }),

  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),

  setAlertEnabled: (enabled) => set({ alertEnabled: enabled }),

  triggerAlert: (message) =>
    set((state) => {
      if (!state.alertEnabled) return state;
      return { hasAlert: true, alertMessage: message };
    }),

  dismissAlert: () => set({ hasAlert: false, alertMessage: null }),

  resetFilters: () =>
    set({
      selectedService: null,
      selectedLevels: [...LOG_LEVELS],
      searchKeyword: '',
    }),

  getFilteredLogs: () => {
    const state = get();
    const keyword = state.searchKeyword.toLowerCase().trim();
    const filtered = state.allLogs.filter((log) => {
      const serviceMatch = !state.selectedService || log.serviceName === state.selectedService;
      const levelMatch = state.selectedLevels.includes(log.level);
      const keywordMatch = !keyword || log.message.toLowerCase().includes(keyword) || 
        log.serviceName.toLowerCase().includes(keyword) ||
        log.level.toLowerCase().includes(keyword);
      return serviceMatch && levelMatch && keywordMatch;
    });
    return filtered.length > MAX_RENDER_LOGS
      ? filtered.slice(-MAX_RENDER_LOGS)
      : filtered;
  },
}));

export { SERVICES, LOG_LEVELS, MAX_LOGS, MAX_RENDER_LOGS };

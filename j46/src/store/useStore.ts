import { create } from 'zustand';

interface AttackRecord {
  id: string;
  timestamp: Date;
  payload: string;
  executedSql: string;
  responseTime: number;
  success: boolean;
  message: string;
  type: 'login' | 'search';
}

interface AppState {
  user: {
    id: number;
    username: string;
    role: string;
  } | null;
  attackHistory: AttackRecord[];
  currentPayload: string;
  currentResponseTime: number;
  currentSql: string;
  
  setUser: (user: any) => void;
  clearUser: () => void;
  addAttackRecord: (record: Omit<AttackRecord, 'id' | 'timestamp'>) => void;
  setCurrentAttack: (payload: string, sql: string, responseTime: number) => void;
  clearHistory: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  attackHistory: [],
  currentPayload: '',
  currentResponseTime: 0,
  currentSql: '',
  
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
  
  addAttackRecord: (record) => set((state) => ({
    attackHistory: [
      {
        ...record,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
      },
      ...state.attackHistory,
    ].slice(0, 50),
  })),
  
  setCurrentAttack: (payload, sql, responseTime) => set({
    currentPayload: payload,
    currentSql: sql,
    currentResponseTime: responseTime,
  }),
  
  clearHistory: () => set({ attackHistory: [] }),
}));

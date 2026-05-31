import { create } from "zustand";
import type { MoleculeSummary, MoleculeDetail } from "@/types/molecule";

interface MoleculeState {
  list: MoleculeSummary[];
  current: MoleculeDetail | null;
  selectedId: string | null;
  loading: boolean;
  selectedAtomIndex: number | null;
  explodeFactor: number;
  fetchList: () => Promise<void>;
  selectMolecule: (id: string) => Promise<void>;
  selectAtom: (index: number | null) => void;
  setExplodeFactor: (factor: number) => void;
}

export const useMoleculeStore = create<MoleculeState>((set, get) => ({
  list: [],
  current: null,
  selectedId: null,
  loading: false,
  selectedAtomIndex: null,
  explodeFactor: 0,

  fetchList: async () => {
    try {
      const res = await fetch("/api/molecules");
      const data = await res.json();
      set({ list: data.molecules });
      if (data.molecules.length > 0 && !get().selectedId) {
        get().selectMolecule(data.molecules[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch molecule list:", e);
    }
  },

  selectMolecule: async (id: string) => {
    if (id === get().selectedId && get().current) return;
    set({ loading: true, selectedId: id, selectedAtomIndex: null, explodeFactor: 0 });
    try {
      const res = await fetch(`/api/molecules/${id}`);
      const data = await res.json();
      set({ current: data, loading: false });
    } catch (e) {
      console.error("Failed to fetch molecule detail:", e);
      set({ loading: false });
    }
  },

  selectAtom: (index: number | null) => {
    set({ selectedAtomIndex: index });
  },

  setExplodeFactor: (factor: number) => {
    set({ explodeFactor: factor });
  },
}));

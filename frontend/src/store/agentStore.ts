import { create } from 'zustand';
export const useAgentStore = create<{
  selectedAgentId: string | null;
  select: (id: string | null) => void;
}>((set) => ({ selectedAgentId: null, select: (id) => set({ selectedAgentId: id }) }));

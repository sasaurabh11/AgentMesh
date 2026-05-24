import { create } from 'zustand';

export const useWorkflowStore = create<{
  selectedNodeId: string | null;
  setSelectedNode: (id: string | null) => void;
}>((set) => ({ selectedNodeId: null, setSelectedNode: (id) => set({ selectedNodeId: id }) }));

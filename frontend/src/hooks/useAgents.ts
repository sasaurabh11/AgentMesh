import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentAPI } from '../api/client';
export function useAgents() {
  return useQuery({ queryKey: ['agents'], queryFn: AgentAPI.list });
}
export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: AgentAPI.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}
export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => AgentAPI.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

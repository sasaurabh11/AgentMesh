import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkflowAPI } from '../api/client';
export function useWorkflows() {
  return useQuery({ queryKey: ['workflows'], queryFn: WorkflowAPI.list });
}
export function useTemplates() {
  return useQuery({ queryKey: ['workflow-templates'], queryFn: WorkflowAPI.templates });
}
export function useSaveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      data.id ? WorkflowAPI.update(data.id, data) : WorkflowAPI.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, Save } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { WorkflowAPI } from '../api/client';
import { useAgents } from '../hooks/useAgents';
import { useSaveWorkflow, useTemplates } from '../hooks/useWorkflows';
import { WorkflowCanvas } from '../components/workflow/WorkflowCanvas';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
export function WorkflowBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const agents = useAgents();
  const templates = useTemplates();
  const workflow = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => WorkflowAPI.get(id!),
    enabled: !!id && id !== 'new',
  });
  const save = useSaveWorkflow();
  const [name, setName] = useState('Untitled Workflow');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [graph, setGraph] = useState<any>({
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'end', type: 'end' },
    ],
    edges: [],
  });
  useEffect(() => {
    if (workflow.data) {
      setName(workflow.data.name);
      setDescription(workflow.data.description);
      setGraph(workflow.data.graph_definition);
    }
  }, [workflow.data]);
  async function persist() {
    setError('');
    try {
      const w = await save.mutateAsync({
        id: id && id !== 'new' ? id : undefined,
        name,
        description,
        graph_definition: graph,
        is_template: false,
      });
      nav(`/workflows/${w.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to save workflow');
    }
  }
  async function run() {
    if (id && id !== 'new') {
      setError('');
      try {
        const r = await WorkflowAPI.execute(id, 'Manual run from builder');
        nav(`/executions/${r.execution_id}`);
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to execute workflow');
      }
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea
          className="max-w-xl"
          rows={1}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button onClick={persist}>
          <Save size={16} />
          Save
        </Button>
        {id && id !== 'new' && (
          <Button onClick={run}>
            <Play size={16} />
            Execute
          </Button>
        )}
        <select
          className="rounded-md border px-3 py-2"
          onChange={(e) => {
            const t = templates.data?.find((x) => x.id === e.target.value);
            if (t) {
              setName(t.name);
              setDescription(t.description);
              setGraph(t.graph_definition);
            }
          }}
        >
          <option>Templates</option>
          {templates.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <WorkflowCanvas agents={agents.data ?? []} value={graph} onChange={setGraph} />
    </div>
  );
}

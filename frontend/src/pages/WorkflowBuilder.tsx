import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, Save, X } from 'lucide-react';
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
  const agents    = useAgents();
  const templates = useTemplates();
  const workflow  = useQuery({ queryKey: ['workflow', id], queryFn: () => WorkflowAPI.get(id!), enabled: !!id && id !== 'new' });
  const save      = useSaveWorkflow();

  const [name, setName]       = useState('Untitled Workflow');
  const [desc, setDesc]       = useState('');
  const [error, setError]     = useState('');
  const [showRun, setShowRun] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [graph, setGraph]     = useState<any>({
    nodes: [{ id: 'start', type: 'start' }, { id: 'end', type: 'end' }],
    edges: [],
  });

  useEffect(() => {
    if (workflow.data) {
      setName(workflow.data.name);
      setDesc(workflow.data.description);
      setGraph(workflow.data.graph_definition);
    }
  }, [workflow.data]);

  async function persist() {
    setError('');
    try {
      const w = await save.mutateAsync({
        id: id && id !== 'new' ? id : undefined,
        name, description: desc, graph_definition: graph, is_template: false,
      });
      nav(`/workflows/${w.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to save');
    }
  }

  async function run() {
    if (!id || id === 'new') return;
    setError('');
    try {
      const r = await WorkflowAPI.execute(id, runInput || 'Manual run from builder');
      setShowRun(false); setRunInput('');
      nav(`/executions/${r.execution_id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to execute');
    }
  }

  return (
    <div className="flex flex-col h-screen bg-bg">

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-surface/80 backdrop-blur px-5 py-3 shrink-0 flex-wrap">
        <Link to="/workflows" className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all mr-1">
          <ArrowLeft size={15} />
        </Link>
        <Input className="max-w-[200px] h-9 text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Workflow name" />
        <Textarea className="max-w-[320px] h-9 text-sm py-2" rows={1} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" />

        <div className="flex gap-2 ml-auto items-center">
          <select
            className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:border-primary/60 cursor-pointer"
            onChange={e => {
              const t = templates.data?.find(x => x.id === e.target.value);
              if (t) { setName(t.name); setDesc(t.description); setGraph(t.graph_definition); }
            }}
          >
            <option>Templates</option>
            {templates.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {id && id !== 'new' && (
            <Button variant="success" size="sm" onClick={() => setShowRun(true)}>
              <Play size={13} />Run
            </Button>
          )}
          <Button size="sm" onClick={persist} disabled={save.isPending}>
            <Save size={13} />{save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between mx-5 mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}<button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* Run dialog */}
      {showRun && (
        <div className="mx-5 mt-3 rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">Execute Workflow</p>
            <button onClick={() => setShowRun(false)} className="text-muted hover:text-foreground transition-colors"><X size={15} /></button>
          </div>
          <Textarea rows={3} placeholder="Enter input (optional)…" value={runInput} onChange={e => setRunInput(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={run}><Play size={13} />Run</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRun(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 p-4 min-h-0">
        <WorkflowCanvas agents={agents.data ?? []} value={graph} onChange={setGraph} />
      </div>
    </div>
  );
}

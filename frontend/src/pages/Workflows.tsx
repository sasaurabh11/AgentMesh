import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { WorkflowAPI } from '../api/client';
import { useWorkflows, useDeleteWorkflow } from '../hooks/useWorkflows';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/input';

export function Workflows() {
  const nav = useNavigate();
  const workflows = useWorkflows();
  const deleteWorkflow = useDeleteWorkflow();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runInput, setRunInput] = useState('');
  const [error, setError] = useState('');

  async function execute(id: string) {
    setError('');
    try {
      const r = await WorkflowAPI.execute(id, runInput || 'Manual run');
      setRunningId(null);
      setRunInput('');
      nav(`/executions/${r.execution_id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to execute workflow');
    }
  }

  function confirmDelete(id: string, name: string) {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteWorkflow.mutate(id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workflows</h1>
        <Link to="/workflows/new">
          <Button>
            <Plus size={16} />
            New Workflow
          </Button>
        </Link>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {workflows.isLoading ? (
        <p>Loading workflows...</p>
      ) : workflows.isError ? (
        <p>Unable to load workflows.</p>
      ) : workflows.data?.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">No workflows yet.</p>
          <Link to="/workflows/new" className="mt-2 inline-block text-sm text-primary">
            Create your first workflow
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.data?.map((w) => (
            <Card key={w.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{w.name}</h3>
                  {w.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{w.description}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {w.graph_definition.nodes.length} nodes · updated{' '}
                    {new Date(w.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => confirmDelete(w.id, w.name)}
                  className="shrink-0 text-slate-300 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {runningId === w.id ? (
                <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">Workflow input (optional)</p>
                    <button
                      onClick={() => { setRunningId(null); setRunInput(''); }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="What should this workflow do?"
                    value={runInput}
                    onChange={(e) => setRunInput(e.target.value)}
                  />
                  <Button onClick={() => execute(w.id)}>
                    <Play size={14} />
                    Run
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link to={`/workflows/${w.id}`} className="flex-1">
                    <Button className="w-full">
                      <Pencil size={14} />
                      Edit
                    </Button>
                  </Link>
                  <Button onClick={() => { setRunningId(w.id); setRunInput(''); }}>
                    <Play size={14} />
                    Run
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

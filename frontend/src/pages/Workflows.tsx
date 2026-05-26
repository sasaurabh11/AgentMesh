import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boxes, Calendar, GitBranch, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { WorkflowAPI } from '../api/client';
import { useWorkflows, useDeleteWorkflow } from '../hooks/useWorkflows';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/input';

export function Workflows() {
  const nav = useNavigate();
  const workflows = useWorkflows();
  const deleteWF = useDeleteWorkflow();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runInput, setRunInput] = useState('');
  const [error, setError] = useState('');

  async function execute(id: string) {
    setError('');
    try {
      const r = await WorkflowAPI.execute(id, runInput || 'Manual run');
      setRunningId(null); setRunInput('');
      nav(`/executions/${r.execution_id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed');
    }
  }

  const count = workflows.data?.length ?? 0;

  return (
    <div className="p-8 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Workflows</h1>
          <p className="text-sm text-muted-light mt-1">{count} workflow{count !== 1 ? 's' : ''} ready to run</p>
        </div>
        <Link to="/workflows/new">
          <Button size="sm"><Plus size={13} />New Workflow</Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* Content */}
      {workflows.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-52 rounded-2xl skeleton" />)}
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
            <Boxes size={28} className="text-cyan-400" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-1">No workflows yet</h3>
          <p className="text-muted-light text-sm mb-5 max-w-xs">Build your first multi-agent pipeline with the visual editor.</p>
          <Link to="/workflows/new"><Button size="sm"><Plus size={13} />Create Workflow</Button></Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {workflows.data?.map(w => (
            <div key={w.id} className="group flex flex-col rounded-2xl border border-border bg-card shadow-card hover:border-border-light hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              {/* Top strip */}
              <div className="h-1 w-full bg-gradient-to-r from-cyan-500 to-indigo-600 opacity-70" />

              <div className="flex-1 p-5 space-y-4">
                {/* Title */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
                      <Boxes size={17} className="text-cyan-300" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[15px] text-white leading-tight truncate">{w.name}</h3>
                      {w.description && (
                        <p className="text-xs text-muted-light mt-0.5 line-clamp-1">{w.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => window.confirm(`Delete "${w.name}"?`) && deleteWF.mutate(w.id)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-muted/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Meta chips */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-light">
                    <GitBranch size={10} />{w.graph_definition.nodes.length} nodes
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-light">
                    <Calendar size={10} />{new Date(w.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Run inline panel */}
              {runningId === w.id ? (
                <div className="border-t border-border bg-surface/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">Workflow input (optional)</p>
                    <button onClick={() => { setRunningId(null); setRunInput(''); }} className="text-muted hover:text-foreground transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                  <Textarea rows={2} placeholder="What should this workflow do?" value={runInput} onChange={e => setRunInput(e.target.value)} className="text-xs" />
                  <Button size="sm" onClick={() => execute(w.id)}><Play size={12} />Run Now</Button>
                </div>
              ) : (
                <div className="border-t border-border p-4 flex gap-2">
                  <Link to={`/workflows/${w.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full"><Pencil size={12} />Edit</Button>
                  </Link>
                  <Button size="sm" variant="success" onClick={() => { setRunningId(w.id); setRunInput(''); }}>
                    <Play size={12} />Run
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Bot, Network, Plus, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Agent } from '../api/client';
import { AgentAPI } from '../api/client';
import { useAgents, useCreateAgent, useUpdateAgent } from '../hooks/useAgents';
import { AgentCard } from '../components/agents/AgentCard';
import { AgentForm } from '../components/agents/AgentForm';
import { Button } from '../components/ui/button';

export function Agents() {
  const [editing, setEditing] = useState<Agent | null>(null);
  const [open, setOpen] = useState(false);
  const [creatingOrch, setCreatingOrch] = useState(false);
  const [orchError, setOrchError] = useState('');

  const qc = useQueryClient();
  const agents = useAgents();
  const create = useCreateAgent();
  const update = useUpdateAgent();

  async function save(data: any) {
    if (editing) {
      await new Promise<void>((res, rej) =>
        update.mutate({ id: editing.id, data }, { onSuccess: () => res(), onError: rej })
      );
    } else {
      await new Promise<void>((res, rej) =>
        create.mutate(data, { onSuccess: () => res(), onError: rej })
      );
    }
    setOpen(false);
    setEditing(null);
  }

  async function createOrchestrator() {
    setOrchError(''); setCreatingOrch(true);
    try {
      await AgentAPI.createOrchestrator();
      await qc.invalidateQueries({ queryKey: ['agents'] });
    } catch (e: any) {
      setOrchError(e?.response?.data?.detail ?? e?.message ?? 'Failed');
    } finally {
      setCreatingOrch(false);
    }
  }

  const count = agents.data?.length ?? 0;

  return (
    <div className="flex h-screen overflow-hidden animate-fade-in">

      {/* ── Left: Agent list ── */}
      <div className={`flex flex-col flex-1 min-w-0 overflow-y-auto transition-all duration-300 ${open ? 'pr-0' : ''}`}>

        {/* Page header */}
        <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur border-b border-border px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">Agents</h1>
              <p className="text-xs text-muted mt-0.5">{count} agent{count !== 1 ? 's' : ''} configured</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={createOrchestrator} disabled={creatingOrch}>
                <Network size={13} />
                {creatingOrch ? 'Creating…' : 'Orchestrator'}
              </Button>
              <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus size={13} />
                New Agent
              </Button>
            </div>
          </div>
          {orchError && (
            <p className="mt-2 text-xs text-red-300">{orchError}</p>
          )}
        </div>

        {/* Content */}
        <div className="p-8">
          {agents.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-56 rounded-2xl skeleton" />
              ))}
            </div>
          ) : agents.isError ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-red-300 font-medium">Failed to load agents</p>
            </div>
          ) : count === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                <Bot size={28} className="text-indigo-400" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-1">No agents yet</h3>
              <p className="text-muted-light text-sm mb-5 max-w-xs">
                Create your first AI agent and give it tools, memory, and a goal.
              </p>
              <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus size={13} />
                Create Your First Agent
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {agents.data?.map(a => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  onEdit={() => { setEditing(a); setOpen(true); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Form drawer ── */}
      {open && (
        <div className="w-[420px] shrink-0 border-l border-border bg-surface flex flex-col overflow-hidden animate-slide-in">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="text-sm font-bold text-white">{editing ? 'Edit Agent' : 'New Agent'}</h2>
              <p className="text-xs text-muted mt-0.5">{editing ? editing.name : 'Configure a new AI agent'}</p>
            </div>
            <button
              onClick={() => { setOpen(false); setEditing(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-card transition-all"
            >
              <X size={15} />
            </button>
          </div>
          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <AgentForm key={editing?.id ?? 'create'} agent={editing ?? undefined} onSubmit={save} />
          </div>
        </div>
      )}
    </div>
  );
}

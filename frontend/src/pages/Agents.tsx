import { useState } from 'react';
import { Network } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Agent } from '../api/client';
import { AgentAPI } from '../api/client';
import { useAgents, useCreateAgent, useUpdateAgent } from '../hooks/useAgents';
import { AgentCard } from '../components/agents/AgentCard';
import { AgentForm } from '../components/agents/AgentForm';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export function Agents() {
  const [editing, setEditing] = useState<Agent | null>(null);
  const [open, setOpen] = useState(false);
  const [creatingOrchestrator, setCreatingOrchestrator] = useState(false);
  const [orchError, setOrchError] = useState('');

  const qc = useQueryClient();
  const agents = useAgents();
  const create = useCreateAgent();
  const update = useUpdateAgent();

  async function save(data: any) {
    if (editing) {
      await new Promise<void>((resolve, reject) =>
        update.mutate({ id: editing.id, data }, { onSuccess: () => resolve(), onError: reject })
      );
    } else {
      await new Promise<void>((resolve, reject) =>
        create.mutate(data, { onSuccess: () => resolve(), onError: reject })
      );
    }
    setOpen(false);
    setEditing(null);
  }

  async function createOrchestrator() {
    setOrchError('');
    setCreatingOrchestrator(true);
    try {
      await AgentAPI.createOrchestrator();
      await qc.invalidateQueries({ queryKey: ['agents'] });
    } catch (e: any) {
      setOrchError(e?.response?.data?.detail ?? e?.message ?? 'Failed to create orchestrator');
    } finally {
      setCreatingOrchestrator(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Agents</h1>
          <div className="flex gap-2">
            <Button
              onClick={createOrchestrator}
              disabled={creatingOrchestrator}
              title="Creates an Orchestrator agent that can route tasks and ask users for input"
            >
              <Network size={16} />
              {creatingOrchestrator ? 'Creating…' : 'Create Orchestrator'}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              Create Agent
            </Button>
          </div>
        </div>
        {orchError && <p className="mb-3 text-sm text-red-500">{orchError}</p>}
        {agents.isLoading ? (
          <p>Loading agents...</p>
        ) : agents.isError ? (
          <p>Unable to load agents.</p>
        ) : agents.data?.length === 0 ? (
          <Card>No agents yet.</Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {agents.data?.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                onEdit={() => {
                  setEditing(a);
                  setOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </section>
      <aside>
        {open && (
          <Card>
            <h2 className="mb-3 font-semibold">{editing ? 'Edit Agent' : 'Create Agent'}</h2>
            <AgentForm key={editing?.id ?? 'create'} agent={editing ?? undefined} onSubmit={save} />
          </Card>
        )}
      </aside>
    </div>
  );
}

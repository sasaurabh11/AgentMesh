import { useState } from 'react';
import type { Agent } from '../api/client';
import { useAgents, useCreateAgent, useUpdateAgent } from '../hooks/useAgents';
import { AgentCard } from '../components/agents/AgentCard';
import { AgentForm } from '../components/agents/AgentForm';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
export function Agents() {
  const [editing, setEditing] = useState<Agent | null>(null);
  const [open, setOpen] = useState(false);
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
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Agents</h1>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Create Agent
          </Button>
        </div>
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
            <AgentForm agent={editing ?? undefined} onSubmit={save} />
          </Card>
        )}
      </aside>
    </div>
  );
}

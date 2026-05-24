import { Bot, Cable } from 'lucide-react';
import type { Agent } from '../../api/client';
import { Card } from '../ui/card';
export function AgentCard({ agent, onEdit }: { agent: Agent; onEdit: () => void }) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[#e6f4f8] text-primary">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-sm text-slate-600">{agent.role}</p>
          </div>
        </div>
        <button onClick={onEdit} className="text-sm text-primary">
          Edit
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-slate-100 px-2 py-1">{agent.model}</span>
        <span className="rounded bg-slate-100 px-2 py-1">{agent.tools.length} tools</span>
        {agent.channel && (
          <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-1 text-accent">
            <Cable size={12} />
            {agent.channel}
          </span>
        )}
      </div>
    </Card>
  );
}

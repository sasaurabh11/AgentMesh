import { Bot, Cable, Key, MessageSquare, Pencil, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Agent } from '../../api/client';

const MODEL_BADGE: Record<string, string> = {
  'gpt-4o':           'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'gpt-4o-mini':      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'claude-opus-4-7':  'bg-orange-500/15  text-orange-300  border-orange-500/30',
  'claude-sonnet-4-6':'bg-orange-500/15  text-orange-300  border-orange-500/30',
  'claude-haiku-4-5': 'bg-orange-500/15  text-orange-200  border-orange-500/30',
};
const modelBadge = (m: string) =>
  MODEL_BADGE[m] ??
  (m.startsWith('gemini') || m.startsWith('gemma')
    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30');

/* Avatar gradient cycles through a handful of palettes */
const AVATAR_GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-cyan-500 to-indigo-600',
  'from-violet-500 to-pink-600',
  'from-orange-500 to-red-600',
  'from-emerald-500 to-cyan-600',
];
const avatarGradient = (name: string) =>
  AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];

export function AgentCard({ agent, onEdit }: { agent: Agent; onEdit: () => void }) {
  const grad = avatarGradient(agent.name);
  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-card shadow-card hover:border-border-light hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">

      {/* ── Top colour strip ── */}
      <div className={`h-1 w-full bg-gradient-to-r ${grad} opacity-70`} />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className={`flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${grad} shadow-lg shrink-0`}>
            <span className="text-sm font-bold text-white">
              {agent.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-[15px] text-white leading-tight truncate">{agent.name}</h3>
            <p className="text-xs text-muted-light mt-0.5 leading-tight truncate">{agent.role}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            to={`/chat/${agent.id}`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all"
          >
            <MessageSquare size={12} />
            Chat
          </Link>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-light bg-card border border-border hover:text-foreground hover:border-border-light hover:bg-card-hover transition-all"
          >
            <Pencil size={12} />
            Edit
          </button>
        </div>
      </div>

      {/* ── Badges ── */}
      <div className="flex flex-wrap gap-1.5 px-5 pb-3">
        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${modelBadge(agent.model)}`}>
          {agent.model}
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-light">
          <Wrench size={10} />{agent.tools.length} tools
        </span>
        {agent.has_api_key && (
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <Key size={10} />Custom Key
          </span>
        )}
        {agent.channel && (
          <span className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-medium text-orange-300">
            <Cable size={10} />{agent.channel}
          </span>
        )}
      </div>

      {/* ── System prompt ── */}
      {agent.system_prompt && (
        <div className="mx-5 mb-4 mt-1 rounded-xl border border-border bg-surface/60 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
            <Bot size={10} />System Prompt
          </p>
          <p className="text-xs text-subtle leading-relaxed line-clamp-3">
            {agent.system_prompt}
          </p>
        </div>
      )}
    </div>
  );
}

import type { ExecutionLog } from '../../api/client';

const STYLES: Record<string, { badge: string; dot: string }> = {
  agent_start:       { badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',   dot: 'bg-indigo-400' },
  tool_call:         { badge: 'bg-amber-500/15  text-amber-300  border-amber-500/30',    dot: 'bg-amber-400' },
  tool_result:       { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',dot: 'bg-emerald-400' },
  agent_output:      { badge: 'bg-violet-500/15 text-violet-300  border-violet-500/30',  dot: 'bg-violet-400' },
  error:             { badge: 'bg-red-500/15    text-red-300    border-red-500/30',       dot: 'bg-red-400' },
  condition_eval:    { badge: 'bg-cyan-500/15   text-cyan-300   border-cyan-500/30',      dot: 'bg-cyan-400' },
  waiting_for_input: { badge: 'bg-amber-500/15  text-amber-300  border-amber-500/30',    dot: 'bg-amber-400 animate-pulse' },
  completed:         { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',dot: 'bg-emerald-400' },
};
const fallback = { badge: 'bg-surface text-muted-light border-border', dot: 'bg-muted' };

export function LiveLogStream({ logs }: { logs: ExecutionLog[] }) {
  return (
    <div className="h-[480px] overflow-y-auto rounded-2xl border border-border bg-surface/50 p-3 space-y-1.5">
      {logs.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted">No live logs yet.</p>
        </div>
      ) : (
        logs.map((l, i) => {
          const s = STYLES[l.log_type] ?? fallback;
          return (
            <div key={(l.id ?? 'live') + i} className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-1.5 hover:border-border-light transition-colors">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{l.log_type}
                </span>
                {l.agent_id && (
                  <span className="font-mono text-[11px] text-muted">{l.agent_id.slice(0,12)}…</span>
                )}
                {l.created_at && (
                  <span className="ml-auto text-[11px] text-muted/60">{new Date(l.created_at).toLocaleTimeString()}</span>
                )}
              </div>
              <p className="text-xs text-subtle leading-relaxed whitespace-pre-wrap">{l.content}</p>
            </div>
          );
        })
      )}
    </div>
  );
}

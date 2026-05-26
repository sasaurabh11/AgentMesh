import { DollarSign, Zap } from 'lucide-react';
import type { ExecutionLog } from '../../api/client';

export function CostTracker({ logs }: { logs: ExecutionLog[] }) {
  const rows = logs.filter(l => l.metadata?.cost || l.metadata?.token_count);
  const total = rows.reduce((s, r) => s + Number(r.metadata.cost ?? 0), 0);
  const tokens = rows.reduce((s, r) => s + Number(r.metadata.token_count ?? 0), 0);

  if (!rows.length) return (
    <div className="py-8 text-center">
      <DollarSign size={24} className="mx-auto text-muted/30 mb-2" />
      <p className="text-sm text-muted">No cost data yet.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted flex items-center gap-1"><Zap size={10} />Total Tokens</p>
          <p className="text-2xl font-extrabold text-white mt-1.5">{tokens.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted flex items-center gap-1"><DollarSign size={10} />Total Cost</p>
          <p className="text-2xl font-extrabold text-indigo-300 mt-1.5 font-mono">${total.toFixed(6)}</p>
        </div>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/40">
              {['Agent','Tokens','Cost'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={`border-b border-border/40 row-hover ${i%2===1?'bg-surface/20':''}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-light">{r.agent_id ? r.agent_id.slice(0,12)+'…' : 'workflow'}</td>
                <td className="px-4 py-2.5 text-xs text-subtle">{Number(r.metadata.token_count ?? 0).toLocaleString()}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-indigo-400">${Number(r.metadata.cost ?? 0).toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

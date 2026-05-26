import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, DollarSign } from 'lucide-react';
import { ExecutionAPI } from '../api/client';
import { StatusBadge } from '../components/ui/badge';

export function Executions() {
  const q = useQuery({ queryKey: ['executions'], queryFn: ExecutionAPI.list });
  const count = q.data?.length ?? 0;

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Executions</h1>
        <p className="text-sm text-muted-light mt-1">{count} execution{count !== 1 ? 's' : ''} recorded</p>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        {q.isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 skeleton rounded-xl" />)}
          </div>
        ) : count === 0 ? (
          <div className="py-20 text-center">
            <Activity size={36} className="mx-auto text-muted/30 mb-3" />
            <p className="text-muted-light text-sm">No executions yet.</p>
            <p className="text-muted text-xs mt-1">Run a workflow to see history here.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/40">
                {['Execution ID','Workflow','Channel','Status','Started','Cost'].map(h => (
                  <th key={h} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data?.map((e, i) => (
                <tr key={e.id} className={`border-b border-border/40 row-hover transition-colors ${i%2===1?'bg-surface/20':''}`}>
                  <td className="px-6 py-4">
                    <Link className="font-mono text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors" to={`/executions/${e.id}`}>
                      {e.id.slice(0,8)}…
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-light">{e.workflow_id.slice(0,8)}…</td>
                  <td className="px-6 py-4">
                    <span className="rounded-lg bg-surface border border-border px-2.5 py-1 text-xs text-muted-light">{e.trigger_channel}</span>
                  </td>
                  <td className="px-6 py-4"><StatusBadge status={e.status} /></td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-xs text-muted-light">
                      <Clock size={11} />
                      {e.started_at ? new Date(e.started_at).toLocaleString() : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-light">
                      <DollarSign size={11} />{e.total_cost_usd.toFixed(6)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

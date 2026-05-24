import type { ExecutionLog } from '../../api/client';
export function CostTracker({ logs }: { logs: ExecutionLog[] }) {
  const rows = logs.filter((l) => l.metadata?.cost || l.metadata?.token_count);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left">
          <th>Agent</th>
          <th>Tokens</th>
          <th>Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="py-2">{r.agent_id ?? 'workflow'}</td>
            <td>{String(r.metadata.token_count ?? 0)}</td>
            <td>${Number(r.metadata.cost ?? 0).toFixed(6)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

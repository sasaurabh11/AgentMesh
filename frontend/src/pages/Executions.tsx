import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExecutionAPI } from '../api/client';
import { Card } from '../components/ui/card';
export function Executions() {
  const executions = useQuery({ queryKey: ['executions'], queryFn: ExecutionAPI.list });
  return (
    <Card>
      <h1 className="mb-4 text-2xl font-semibold">Executions</h1>
      {executions.isLoading ? (
        <p>Loading executions...</p>
      ) : executions.isError ? (
        <p>Unable to load execution history.</p>
      ) : executions.data?.length === 0 ? (
        <p>No executions yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>ID</th>
              <th>Workflow</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Started</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {executions.data?.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="py-2">
                  <Link className="text-primary" to={`/executions/${e.id}`}>
                    {e.id.slice(0, 8)}
                  </Link>
                </td>
                <td>{e.workflow_id.slice(0, 8)}</td>
                <td>{e.trigger_channel}</td>
                <td>{e.status}</td>
                <td>{e.started_at ? new Date(e.started_at).toLocaleString() : 'pending'}</td>
                <td>${e.total_cost_usd.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
